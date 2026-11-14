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
/**
 * Ensure every sibling section of the batch has its copy of a batch-wide
 * declaration (an earlier partial sync may have created only the CR's own
 * copy before the response was lost). Idempotent — creates only what's
 * missing, keyed by the declaration's groupId.
 */
async function ensureBatchWideSiblings(ownCopy, basePayload, extra) {
  if (!ownCopy?.groupId) return;
  const ownSection = await Section.findById(idOf(ownCopy.sectionId)).select('batchId');
  if (!ownSection?.batchId) return;
  const siblings = await Section.find({
    batchId: ownSection.batchId,
    _id: { $ne: idOf(ownCopy.sectionId) },
  }).select('_id');
  for (const section of siblings) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await ScheduleOverride.findOne({
      groupId: ownCopy.groupId,
      sectionId: section._id,
    });
    if (!exists) {
      // eslint-disable-next-line no-await-in-loop
      await ScheduleOverride.create({
        ...basePayload,
        sectionId: section._id,
        ...extra,
        groupId: ownCopy.groupId,
      });
    }
  }
}

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
    case 'classes_end':
      return {
        type: 'cancellation',
        priority: 'important',
        title: `DL starts from ${override.startDate}`,
        description:
          override.reason ||
          'Classes are over — duration leave (DL) for exam preparation begins.',
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

    // CRs see their own section plus every declaration they made (a CR may
    // aim a declaration at a sibling section of the same batch).
    let ownSectionId = null;
    let dedupeBatchGroups = false;
    if (!req.user.roles.includes('admin') && !req.user.roles.includes('coordinator')) {
      ownSectionId = idOf(req.user.sectionId);
      if (req.user.roles.includes('cr')) {
        filter.$or = [{ sectionId: ownSectionId }, { declaredBy: req.user._id }];
        // Batch-wide declarations (day off, DL) are copied to every sibling
        // section. The $or above matches the CR's own copy AND the sibling
        // copies they declared — without dedupe one declaration would show
        // twice in their list and double-count in the statistics.
        dedupeBatchGroups = true;
      } else {
        filter.sectionId = ownSectionId;
      }
    }

    const overrides = await ScheduleOverride.find(filter)
      .populate(overridePopulate)
      .sort({ createdAt: -1 });

    let visible = overrides;
    if (dedupeBatchGroups) {
      // One batch-wide declaration creates one copy per section; the $or
      // above matches the CR's own copy AND the sibling copies they declared
      // (declaredBy). Dedupe by groupId so one declaration = one list entry,
      // preferring the CR's own-section copy.
      const byGroup = new Map();
      const deduped = [];
      for (const doc of overrides) {
        const gid = doc.groupId ? String(doc.groupId) : null;
        if (!gid) {
          deduped.push(doc);
          continue;
        }
        const existing = byGroup.get(gid);
        if (!existing) {
          byGroup.set(gid, doc);
          deduped.push(doc);
          continue;
        }
        const isOwnCopy = String(idOf(doc.sectionId)) === String(ownSectionId);
        const existingIsOwn =
          String(idOf(existing.sectionId)) === String(ownSectionId);
        if (isOwnCopy && !existingIsOwn) {
          deduped[deduped.indexOf(existing)] = doc;
          byGroup.set(gid, doc);
        }
      }
      visible = deduped;
    }

    sendData(res, visible);
  })
);

/**
 * Find an existing approved day-level declaration that conflicts with a new
 * declaration for the given date/range in the target section. Day-level
 * declarations are batch-wide (one copy per section), so the target section's
 * copies are authoritative for "what is already declared on that day".
 */
async function findDayConflict(sectionId, { date = null, startDate = null, endDate = null } = {}) {
  const from = startDate ?? date;
  const to = endDate ?? date;
  if (!from) return null;
  const dayLevel = await ScheduleOverride.find({
    sectionId,
    status: 'approved',
    type: { $in: ['auto_day_off', 'mid_break', 'classes_end'] },
  }).lean();
  for (const override of dayLevel) {
    if (override.type === 'auto_day_off') {
      const d = override.specificDate;
      if (d && d >= from && d <= to) return override;
    } else if (override.type === 'mid_break') {
      const s = override.startDate;
      const e = override.endDate;
      if (s && e && s <= to && e >= from) return override;
    } else if (override.type === 'classes_end') {
      // DL is open-ended from its start date — everything on/after it is
      // already "no classes".
      if (override.startDate && override.startDate <= from) return override;
    }
  }
  return null;
}

/** Human-readable conflict message for a day-level clash. */
function dayConflictMessage(conflict, date) {
  if (conflict.type === 'mid_break') {
    return `Mid-break (${conflict.startDate} → ${conflict.endDate}) already covers ${date} — withdraw it before declaring a day off there`;
  }
  if (conflict.type === 'classes_end') {
    return `DL has already started (${conflict.startDate}) — classes are over, a day off can't be declared`;
  }
  return `A day off is already declared for ${conflict.specificDate} — withdraw it before declaring again`;
}

/** Conflict message for scheduling a class (extra class / change) on a day. */
function classConflictMessage(conflict, date) {
  if (conflict.type === 'mid_break') {
    return `Mid-break (${conflict.startDate} → ${conflict.endDate}) covers ${date} — no classes run that day`;
  }
  if (conflict.type === 'classes_end') {
    return `DL has already started (${conflict.startDate}) — classes are over`;
  }
  return `${date} is already declared as a day off — withdraw that declaration before scheduling a class`;
}

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

    // Optional target section: a CR may aim a declaration at a sibling
    // section of the same batch (e.g. a make-up class for the other section).
    // Anything outside their own batch is rejected.
    let targetSectionId = sectionId;
    if (body.sectionId && mongoose.isValidObjectId(String(body.sectionId))) {
      if (String(idOf(body.sectionId)) !== sectionId) {
        const requested = await Section.findById(body.sectionId).select('batchId');
        const ownSectionDoc = await Section.findById(sectionId).select('batchId');
        const sameBatch =
          requested?.batchId &&
          ownSectionDoc?.batchId &&
          String(idOf(requested.batchId)) === String(idOf(ownSectionDoc.batchId));
        if (!sameBatch) {
          throw new AppError(403, 'You can only declare for sections in your own batch');
        }
        targetSectionId = idOf(requested._id);
      }
    }

    const basePayload = {
      sectionId: targetSectionId,
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
      // Idempotent: an outbox retry after a lost response must not create a
      // second declaration (and a second feed notice) for the same day.
      const dupe = await ScheduleOverride.findOne({
        sectionId: targetSectionId,
        type,
        specificDate: date,
        status: 'approved',
      });
      if (dupe) {
        await ensureBatchWideSiblings(dupe, basePayload, {
          specificDate: date,
          startDate: date,
          endDate: date,
        });
        const linked = await Update.findOne({ sourceOverrideId: dupe._id });
        return sendData(
          res,
          {
            id: String(dupe._id),
            _id: String(dupe._id),
            updateId: linked ? String(linked._id) : null,
            groupId: dupe.groupId ?? null,
            message: 'Declaration already exists',
          },
          200
        );
      }
      const groupId = randomUUID();
      // A day off can't be declared inside an existing mid-break or after DL
      // has started — the day is already class-free.
      const dayConflict = await findDayConflict(targetSectionId, { date });
      if (dayConflict) {
        throw new AppError(400, dayConflictMessage(dayConflict, date));
      }

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
      // Idempotent: a retried identical mid-break must not duplicate.
      const dupe = await ScheduleOverride.findOne({
        sectionId: targetSectionId,
        type,
        startDate,
        endDate,
        status: 'approved',
      });
      if (dupe) {
        await ensureBatchWideSiblings(dupe, basePayload, {
          specificDate: null,
          startDate,
          endDate,
        });
        const linked = await Update.findOne({ sourceOverrideId: dupe._id });
        return sendData(
          res,
          {
            id: String(dupe._id),
            _id: String(dupe._id),
            updateId: linked ? String(linked._id) : null,
            groupId: dupe.groupId ?? null,
            message: 'Declaration already exists',
          },
          200
        );
      }
      // A mid-break can't overlap another mid-break, swallow an existing day
      // off, or start after DL has begun.
      const breakConflict = await findDayConflict(targetSectionId, { startDate, endDate });
      if (breakConflict) {
        if (breakConflict.type === 'auto_day_off') {
          throw new AppError(
            400,
            `A day off is already declared on ${breakConflict.specificDate} — withdraw it before declaring a mid-break covering it`
          );
        }
        if (breakConflict.type === 'mid_break') {
          throw new AppError(
            400,
            `This range overlaps an existing mid-break (${breakConflict.startDate} → ${breakConflict.endDate}) — withdraw it first`
          );
        }
        throw new AppError(
          400,
          `DL has already started (${breakConflict.startDate}) — a mid-break can't be declared after classes end`
        );
      }
      // A mid-break pauses the whole batch's classes, so it is declared
      // batch-wide: one copy per sibling section, all sharing a groupId.
      const groupId = randomUUID();
      override = new ScheduleOverride({
        ...basePayload,
        startDate,
        endDate,
        groupId,
      });

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
            startDate,
            endDate,
            groupId,
            sectionId: section._id,
          })
      );
    } else if (type === 'classes_end') {
      // DL (duration leave): regular classes stop from the declared date and
      // exam preparation begins. Batch-wide — every section finishes together.
      const date = normalizeDate(body.date);
      if (!date) throw new AppError(400, 'A valid date (YYYY-MM-DD) is required');
      // Idempotent: a retried identical DL declaration must not duplicate.
      const dupe = await ScheduleOverride.findOne({
        sectionId: targetSectionId,
        type,
        startDate: date,
        status: 'approved',
      });
      if (dupe) {
        await ensureBatchWideSiblings(dupe, basePayload, {
          specificDate: null,
          startDate: date,
          endDate: null,
        });
        const linked = await Update.findOne({ sourceOverrideId: dupe._id });
        return sendData(
          res,
          {
            id: String(dupe._id),
            _id: String(dupe._id),
            updateId: linked ? String(linked._id) : null,
            groupId: dupe.groupId ?? null,
            message: 'Declaration already exists',
          },
          200
        );
      }
      const groupId = randomUUID();
      // Only one live DL declaration: a second one with a different start
      // date would leave two conflicting "classes are over" marks. The CR's
      // replace flow withdraws the previous one first.
      const otherDl = await ScheduleOverride.findOne({
        sectionId: targetSectionId,
        type: 'classes_end',
        status: 'approved',
        startDate: { $ne: date },
      });
      if (otherDl) {
        throw new AppError(
          400,
          `DL is already declared from ${otherDl.startDate} — withdraw it before declaring a new date`
        );
      }
      const wrapPayload = { specificDate: null, startDate: date, endDate: null };
      override = new ScheduleOverride({ ...basePayload, ...wrapPayload, groupId });

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
            ...wrapPayload,
            groupId,
            sectionId: section._id,
          })
      );
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
      // A class change is meaningless on a day that is already class-free
      // (day off / mid-break / after DL) — there is no class to change.
      const changeDayConflict = await findDayConflict(targetSectionId, { date });
      if (changeDayConflict) {
        throw new AppError(400, classConflictMessage(changeDayConflict, date));
      }
      let entry = null;
      let originalValues;
      let courseId;
      // When the change targets a batch-shared CT, the same change is applied
      // to every section copy so the batch stays consistent.
      let targetGroupCopies = null;

      // Idempotent: a retried identical change (same entry, date and values)
      // must not create a second override. A genuine second change differs
      // in room/time, so it still goes through.
      const changeDupe = await ScheduleOverride.findOne({
        sectionId: targetSectionId,
        type,
        specificDate: date,
        status: 'approved',
        ...(body.routineEntryId ? { routineEntryId: body.routineEntryId } : {}),
        ...(type === 'room_change' && body.room ? { room: body.room } : {}),
        ...(type === 'time_change'
          ? { startTime: body.startTime, endTime: body.endTime }
          : {}),
      });
      if (changeDupe) {
        const linked = await Update.findOne({ sourceOverrideId: changeDupe._id });
        return sendData(
          res,
          {
            id: String(changeDupe._id),
            _id: String(changeDupe._id),
            updateId: linked ? String(linked._id) : null,
            message: 'Declaration already exists',
          },
          200
        );
      }

      // The target may be a routine entry or an already-declared override
      // (extra class / class test id created by a CR declaration).
      if (body.routineEntryId) {
        if (!mongoose.isValidObjectId(body.routineEntryId)) {
          throw new AppError(404, 'Routine entry not found');
        }
        entry = await RoutineEntry.findById(body.routineEntryId);
        if (entry) {
          if (String(entry.sectionId) !== String(targetSectionId)) {
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
            sectionId: targetSectionId,
            type: 'extra_class',
          });
          if (!declared) {
            throw new AppError(404, 'Routine entry not found');
          }
          if (String(declared.sectionId) !== String(targetSectionId)) {
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
      // A class can't be scheduled on a day that is already class-free
      // (day off / mid-break / after DL) — the calendar would contradict
      // itself.
      const classDayConflict = await findDayConflict(targetSectionId, { date });
      if (classDayConflict) {
        throw new AppError(400, classConflictMessage(classDayConflict, date));
      }
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
      // batch correct (each section sees it through its own override). A
      // regular make-up class stays scoped to the CR's own section.
      const batchWide = classType === 'ct';
      const ownSectionDoc = await Section.findById(targetSectionId);
      const batchId = batchWide
        ? idOf(ownSectionDoc?.batchId) || idOf(user.batchId)
        : null;
      const targetSections = batchWide && batchId
        ? await Section.find({ batchId }).select('_id').sort({ name: 1 })
        : [];
      if (targetSections.length === 0) targetSections.push({ _id: targetSectionId });

      const groupId = randomUUID();
      const created = [];
      for (const section of targetSections) {
        // Idempotent: a client retry after a lost response must not produce a
        // duplicate CT on the same section / date / course / slot.
        // eslint-disable-next-line no-await-in-loop
        const dupe = await ScheduleOverride.findOne({
          sectionId: section._id,
          type: 'extra_class',
          classType,
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

      if (!batchWide) {
        // Section-scoped make-up class: mirror the post into the CR's own
        // section feed exactly like the other declaration types.
        const populatedOwn = await ScheduleOverride.findById(ownOverride._id).populate(
          overridePopulate
        );
        const linkedUpdate = await createLinkedUpdate(populatedOwn, user);
        await logAudit({
          action: 'override_created',
          user,
          sectionId,
          targetId: ownOverride._id,
          details: `${type} for ${date} — section-scoped`,
          req,
        });
        return sendData(
          res,
          {
            id: String(ownOverride._id),
            _id: String(ownOverride._id),
            updateId: String(linkedUpdate._id),
            message: 'Declaration submitted',
          },
          201
        );
      }

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
