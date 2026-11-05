import express from 'express';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { protect, requireCr } from '../middleware/auth.js';
import { ScheduleOverride, RoutineEntry, Section, Update } from '../models/index.js';
import { asyncHandler, sendData } from '../utils/http.js';
import { AppError } from '../utils/http.js';
import { isValidTime, normalizeDate } from '../utils/dates.js';
import { logAudit } from '../services/audit.js';
import { idOf } from '../services/access.js';
import { departmentCodeForBatch } from '../services/updates.js';
import { overridePopulate } from '../services/routineSerializer.js';

const router = express.Router();
router.use(protect);

/**
 * The Updates-feed post that mirrors a CR declaration. Without it students on
 * other devices would only see the change if they opened the calendar on the
 * exact date — the feed would stay silent.
 */
function overrideFeedContent(override) {
  const course =
    override.courseId && typeof override.courseId === 'object'
      ? override.courseId
      : null;
  const code = course?.code || 'Class';
  const title = course?.title || '';
  const date = override.specificDate || override.startDate;
  const time =
    override.startTime && override.endTime
      ? `${override.startTime}–${override.endTime}`
      : '';
  const detail = [title, time, override.room ? `Room ${override.room}` : '', override.reason]
    .filter(Boolean)
    .join(' · ');

  switch (override.type) {
    case 'auto_day_off':
      return {
        type: 'cancellation',
        priority: 'important',
        title: `Day off declared on ${date}`,
        description: override.reason || 'Classes are suspended for the day.',
      };
    case 'mid_break':
      return {
        type: 'cancellation',
        priority: 'important',
        title: `Mid-break declared ${override.startDate} → ${override.endDate}`,
        description: override.reason || 'Classes are suspended for the mid-break.',
      };
    case 'class_cancellation':
      return {
        type: 'class_cancellation',
        priority: 'urgent',
        title: `${code} class cancelled on ${date}`,
        description: detail || 'This class has been cancelled.',
      };
    case 'room_change':
      return {
        type: 'room_change',
        priority: 'important',
        title: `${code} room changed on ${date}`,
        description: `New room: ${override.room || 'TBA'}${override.reason ? ` · ${override.reason}` : ''}`,
      };
    case 'time_change':
      return {
        type: 'time_change',
        priority: 'important',
        title: `${code} time changed on ${date}`,
        description: `New time: ${time || 'TBA'}${override.reason ? ` · ${override.reason}` : ''}`,
      };
    case 'extra_class':
      return override.classType === 'ct'
        ? {
            type: 'ct_reminder',
            priority: 'important',
            title: `${code} CT on ${date}`,
            description: detail || 'A class test has been declared.',
          }
        : {
            type: 'extra_class',
            priority: 'normal',
            title: `${code} extra class on ${date}`,
            description: detail || 'An extra class has been scheduled.',
          };
    default:
      return {
        type: 'other',
        priority: 'normal',
        title: `${code} schedule updated on ${date}`,
        description: detail || 'The class schedule has been updated.',
      };
  }
}

async function createLinkedUpdate(override, user) {
  const feed = overrideFeedContent(override);
  return Update.create({
    authorId: user._id,
    sectionId: idOf(override.sectionId),
    batchId: idOf(user.batchId) || null,
    courseId: override.courseId?._id || override.courseId || null,
    type: feed.type,
    title: feed.title,
    description: feed.description,
    priority: feed.priority,
    scope: 'section',
    departmentCode: String(user.departmentId?.code || '').toUpperCase() || null,
    status: 'approved',
    sourceOverrideId: override._id,
  });
}

/** Batch-scoped feed mirror for a change applied to a batch-shared CT. */
async function createBatchLinkedUpdate(override, user, groupCopy) {
  const feed = overrideFeedContent(override);
  const section = await Section.findById(groupCopy.sectionId);
  const batchId = idOf(section?.batchId) || idOf(user.batchId);
  const departmentCode = (await departmentCodeForBatch(batchId)) || null;
  return Update.create({
    authorId: user._id,
    sectionId: null,
    batchId: batchId || null,
    courseId: override.courseId?._id || override.courseId || null,
    type: feed.type,
    title: feed.title,
    description: feed.description,
    priority: feed.priority,
    scope: 'batch',
    departmentCode,
    status: 'approved',
    sourceOverrideId: override._id,
  });
}

/**
 * Build the per-section copy of a change (cancel / room / time) that targets a
 * batch-shared CT so every section sees the same shifted or cancelled slot.
 */
function changeOverrideForCopy(basePayload, body, type, copy, groupId) {
  const originalValues = {
    startTime: copy.startTime,
    endTime: copy.endTime,
    room: copy.room || null,
  };
  return new ScheduleOverride({
    ...basePayload,
    sectionId: copy.sectionId,
    specificDate: copy.specificDate,
    routineEntryId: copy._id,
    originalValues,
    startTime:
      type === 'time_change' ? body.startTime || originalValues.startTime : originalValues.startTime,
    endTime:
      type === 'time_change' ? body.endTime || originalValues.endTime : originalValues.endTime,
    room: type === 'room_change' ? body.room : originalValues.room,
    groupId,
  });
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.sectionId) filter.sectionId = req.query.sectionId;
    if (req.query.status) filter.status = req.query.status;

    // CRs see their own overrides unless an admin/coordinator asks for another section.
    if (!req.user.roles.includes('admin') && !req.user.roles.includes('coordinator')) {
      filter.sectionId = idOf(req.user.sectionId);
    }

    const overrides = await ScheduleOverride.find(filter)
      .populate(overridePopulate)
      .sort({ createdAt: -1 });

    sendData(res, overrides);
  })
);

router.post(
  '/',
  requireCr,
  asyncHandler(async (req, res) => {
    const body = req.body;
    const user = req.user;
    if (!user.sectionId) throw new AppError(400, 'You are not assigned to a section');

    const type = body.type;
    const now = new Date();
    const sectionId = idOf(user.sectionId);

    const basePayload = {
      sectionId,
      declaredBy: user._id,
      status: 'approved',
      type,
      reason: body.reason || '',
    };

    let override;
    // Per-section copies of a change applied to a batch-shared CT.
    let siblingsAdditional = [];

    if (type === 'auto_day_off') {
      const date = normalizeDate(body.date);
      if (!date) throw new AppError(400, 'A valid date (YYYY-MM-DD) is required');
      const groupId = randomUUID();
      override = new ScheduleOverride({
        ...basePayload,
        specificDate: date,
        startDate: date,
        endDate: date,
        groupId,
      });

      // A CR day-off declaration is an academic day-off for the whole batch,
      // not a section-only class cancellation. Copy it to every section so
      // both section calendars resolve the same day status.
      const ownSection = await Section.findById(sectionId).select('batchId');
      const siblingSections = ownSection?.batchId
        ? await Section.find({
            batchId: ownSection.batchId,
            _id: { $ne: sectionId },
          }).select('_id')
        : [];
      siblingsAdditional = siblingSections.map(
        (section) =>
          new ScheduleOverride({
            ...basePayload,
            sectionId: section._id,
            specificDate: date,
            startDate: date,
            endDate: date,
            groupId,
          })
      );
    } else if (type === 'mid_break') {
      const startDate = normalizeDate(body.startDate);
      const endDate = normalizeDate(body.endDate);
      if (!startDate || !endDate || endDate < startDate) {
        throw new AppError(400, 'Valid mid-break date range is required');
      }
      override = new ScheduleOverride({
        ...basePayload,
        startDate,
        endDate,
      });
    } else if (
      type === 'class_cancellation' ||
      type === 'room_change' ||
      type === 'time_change'
    ) {
      const date = normalizeDate(body.date);
      if (!date) throw new AppError(400, 'A valid date (YYYY-MM-DD) is required');
      if (type === 'time_change') {
        if (!isValidTime(body.startTime) || !isValidTime(body.endTime)) {
          throw new AppError(400, 'Valid startTime and endTime are required');
        }
        if (body.startTime >= body.endTime) {
          throw new AppError(400, 'startTime must be before endTime');
        }
      }
      if (type === 'room_change' && !String(body.room || '').trim()) {
        throw new AppError(400, 'A new room is required');
      }
      let entry = null;
      let originalValues;
      let courseId;
      // When the change targets a batch-shared CT, the same change is applied
      // to every section copy so the batch stays consistent.
      let targetGroupCopies = null;

      // The target may be a routine entry or an already-declared override
      // (extra class / class test id created by a CR declaration).
      if (body.routineEntryId) {
        if (!mongoose.isValidObjectId(body.routineEntryId)) {
          throw new AppError(404, 'Routine entry not found');
        }
        entry = await RoutineEntry.findById(body.routineEntryId);
        if (entry) {
          if (String(entry.sectionId) !== String(sectionId)) {
            throw new AppError(403, 'You cannot override classes in another section');
          }
          originalValues = {
            startTime: entry.startTime,
            endTime: entry.endTime,
            room: entry.room || null,
          };
          courseId = body.courseId || entry.courseId;
        } else {
          const declared = await ScheduleOverride.findOne({
            _id: body.routineEntryId,
            sectionId,
            type: 'extra_class',
          });
          if (!declared) {
            throw new AppError(404, 'Routine entry not found');
          }
          if (String(declared.sectionId) !== String(sectionId)) {
            throw new AppError(403, 'You cannot override classes in another section');
          }
          originalValues = {
            startTime: declared.startTime,
            endTime: declared.endTime,
            room: declared.room || null,
          };
          courseId = body.courseId || declared.courseId;
          if (declared.groupId) {
            targetGroupCopies = await ScheduleOverride.find({
              groupId: declared.groupId,
              _id: { $ne: declared._id },
            }).sort({ createdAt: 1 });
          }
        }
      } else {
        courseId = body.courseId || null;
        originalValues = { startTime: null, endTime: null, room: null };
      }

      const changeGroupId = targetGroupCopies ? randomUUID() : null;
      override = new ScheduleOverride({
        ...basePayload,
        specificDate: date,
        routineEntryId: body.routineEntryId || null,
        courseId,
        originalValues,
        startTime: type === 'time_change' ? body.startTime || originalValues.startTime : originalValues.startTime,
        endTime: type === 'time_change' ? body.endTime || originalValues.endTime : originalValues.endTime,
        room: type === 'room_change' ? body.room : originalValues.room,
        groupId: changeGroupId,
      });
      if (targetGroupCopies) {
        siblingsAdditional = targetGroupCopies.map((copy) =>
          changeOverrideForCopy(basePayload, body, type, copy, changeGroupId)
        );
      }
    } else if (type === 'extra_class') {
      const date = normalizeDate(body.date);
      if (!date) throw new AppError(400, 'A valid date (YYYY-MM-DD) is required');
      const classType = body.classType === 'ct' ? 'ct' : 'lecture';

      let startTime = body.startTime || null;
      let endTime = body.endTime || null;

      const hasBothTimes = Boolean(startTime && endTime);
      const hasOneTime = Boolean(startTime) !== Boolean(endTime);
      if (hasOneTime) {
        throw new AppError(400, 'Both startTime and endTime are required for a scheduled class');
      }
      if (hasBothTimes) {
        if (!isValidTime(startTime) || !isValidTime(endTime)) {
          throw new AppError(400, 'startTime and endTime must use HH:mm format');
        }
        if (startTime >= endTime) {
          throw new AppError(400, 'startTime must be before endTime');
        }
      }

      if (classType === 'ct') {
        if (!body.courseId) {
          throw new AppError(400, 'courseId is required to declare a class test');
        }
        // The routine no longer carries a fixed CT slot: every CT is declared
        // with its own explicit times by the CR.
        if (!hasBothTimes) {
          throw new AppError(400, 'Both startTime and endTime are required to declare a class test');
        }
      }

      // A declared class test applies to the whole batch, not just the CR's
      // own section: one copy per sibling section keeps every calendar in the
      // batch correct (each section sees it through its own override).
      const ownSectionDoc = await Section.findById(sectionId);
      const batchId = idOf(ownSectionDoc?.batchId) || idOf(user.batchId);
      const targetSections = batchId
        ? await Section.find({ batchId }).select('_id').sort({ name: 1 })
        : [];
      if (targetSections.length === 0) targetSections.push({ _id: sectionId });

      const groupId = randomUUID();
      const created = [];
      for (const section of targetSections) {
        // Idempotent: a client retry after a lost response must not produce a
        // duplicate CT on the same section / date / course / slot.
        // eslint-disable-next-line no-await-in-loop
        const dupe = await ScheduleOverride.findOne({
          sectionId: section._id,
          type: 'extra_class',
          classType: 'ct',
          specificDate: date,
          courseId: body.courseId || null,
          startTime,
          endTime,
          status: 'approved',
        });
        if (dupe) {
          created.push(dupe);
          continue;
        }
        // eslint-disable-next-line no-await-in-loop
        created.push(
          await ScheduleOverride.create({
            ...basePayload,
            sectionId: section._id,
            specificDate: date,
            courseId: body.courseId || null,
            startTime,
            endTime,
            room: body.room || null,
            classType,
            groupId,
          })
        );
      }

      const ownOverride =
        created.find((doc) => String(idOf(doc.sectionId)) === String(sectionId)) ?? created[0];

      // ONE feed post scoped to the batch so every account — both sections —
      // sees the CT in Updates. Per-section posts would show duplicates to
      // batch viewers.
      const departmentCode = await departmentCodeForBatch(batchId);
      await Update.updateMany(
        { sourceOverrideId: { $in: created.map((doc) => doc._id) } },
        {
          type: 'ct_reminder',
          sectionId: null,
          batchId: batchId || null,
          departmentCode,
          scope: 'batch',
        }
      );
      let linkedUpdate = await Update.findOne({ sourceOverrideId: ownOverride._id });
      if (!linkedUpdate) {
        const populatedGroup = await ScheduleOverride.findById(ownOverride._id).populate(
          overridePopulate
        );
        const feed = overrideFeedContent(populatedGroup);
        linkedUpdate = await Update.create({
          authorId: user._id,
          sectionId: null,
          batchId: batchId || null,
          courseId: ownOverride.courseId || null,
          type: feed.type,
          title: feed.title,
          description: feed.description,
          priority: feed.priority,
          scope: 'batch',
          departmentCode,
          status: 'approved',
          sourceOverrideId: ownOverride._id,
        });
      }

      await logAudit({
        action: 'override_created',
        user,
        sectionId,
        targetId: ownOverride._id,
        details: `${type} (CT) for ${date} — batch-wide across ${
          new Set(created.map((doc) => String(idOf(doc.sectionId)))).size
        } section(s)`,
        req,
      });

      return sendData(
        res,
        {
          id: String(ownOverride._id),
          _id: String(ownOverride._id),
          updateId: String(linkedUpdate._id),
          groupId,
          sectionIds: created.map((doc) => idOf(doc.sectionId)),
          message: 'CT declared for the whole batch',
        },
        201
      );
    } else {
      throw new AppError(400, 'Unknown override type');
    }

    await override.save();
    for (const sibling of siblingsAdditional) {
      // eslint-disable-next-line no-await-in-loop
      await sibling.save();
    }
    await logAudit({
      action: 'override_created',
      user,
      sectionId,
      targetId: override._id,
      details: `${type}${override.classType === 'ct' ? ' (CT)' : ''} for ${
        override.specificDate || `${override.startDate} → ${override.endDate}`
      }${siblingsAdditional.length ? ` (+ ${siblingsAdditional.length} sibling section copy/ies)` : ''}`,
      req,
    });

    const populated = await ScheduleOverride.findById(override._id).populate(overridePopulate);
    // Mirror the declaration into the section feed so every student account
    // sees it in Updates, not only inside the calendar on that exact date. A
    // change to a batch-shared CT is posted batch-wide instead.
    const linkedUpdate = siblingsAdditional.length
      ? await createBatchLinkedUpdate(populated, user, siblingsAdditional[0])
      : await createLinkedUpdate(populated, user);
    sendData(
      res,
      {
        id: String(populated._id),
        _id: String(populated._id),
        updateId: String(linkedUpdate._id),
        message: 'Declaration submitted',
      },
      201
    );
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const override = await ScheduleOverride.findById(req.params.id);
    if (!override) throw new AppError(404, 'Override not found');

    const isOwner = String(override.declaredBy) === String(req.user._id);
    if (
      !isOwner &&
      !req.user.roles.includes('admin') &&
      !req.user.roles.includes('coordinator')
    ) {
      throw new AppError(403, 'You cannot withdraw this declaration');
    }

    // Batch-wide declarations (CT group) remove every sibling copy too, or
    // other sections would keep a CT the CR already withdrew.
    const groupIds = [override._id];
    if (override.groupId) {
      const siblings = await ScheduleOverride.find({
        groupId: override.groupId,
        _id: { $ne: override._id },
      });
      for (const sibling of siblings) {
        // eslint-disable-next-line no-await-in-loop
        await ScheduleOverride.findByIdAndDelete(sibling._id);
        groupIds.push(sibling._id);
      }
    }

    await ScheduleOverride.findByIdAndDelete(req.params.id);
    // The matching feed post must disappear too, or students keep seeing a
    // cancelled notice after the CR withdrew it.
    await Update.deleteMany({ sourceOverrideId: { $in: groupIds } });
    await logAudit({
      action: 'override_withdrawn',
      user: req.user,
      sectionId: override.sectionId,
      targetId: override._id,
      details: `Withdrew ${override.type}`,
    });
    sendData(res, { message: 'Declaration withdrawn' });
  })
);

router.put(
  '/:id/review',
  asyncHandler(async (req, res) => {
    const { decision, note } = req.body || {};
    if (!req.user.roles.includes('admin') && !req.user.roles.includes('coordinator')) {
      throw new AppError(403, 'Coordinator access required');
    }
    if (!['approved', 'rejected'].includes(decision)) {
      throw new AppError(400, 'Invalid decision');
    }

    const override = await ScheduleOverride.findById(req.params.id);
    if (!override) throw new AppError(404, 'Override not found');

    // The review decision applies to every copy of a batch-wide group.
    const reviewed = [override];
    if (override.groupId) {
      reviewed.push(
        ...(await ScheduleOverride.find({
          groupId: override.groupId,
          _id: { $ne: override._id },
        }))
      );
    }
    for (const doc of reviewed) {
      doc.status = decision;
      doc.reviewNote = note || null;
      doc.reviewedBy = req.user._id;
      doc.reviewedAt = new Date();
      // eslint-disable-next-line no-await-in-loop
      await doc.save();
    }

    if (decision === 'rejected') {
      // A rejected declaration must not linger in the section Updates feed.
      await Update.deleteMany({ sourceOverrideId: { $in: reviewed.map((doc) => doc._id) } });
    }

    await logAudit({
      action: 'override_reviewed',
      user: req.user,
      sectionId: override.sectionId,
      targetId: override._id,
      details: `${decision} ${override.type}`,
    });

    const populated = await ScheduleOverride.findById(override._id).populate(overridePopulate);
    sendData(res, populated);
  })
);

export default router;
