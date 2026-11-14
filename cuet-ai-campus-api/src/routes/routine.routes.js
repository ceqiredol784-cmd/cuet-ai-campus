import express from 'express';
import { protect, requireCoordinator } from '../middleware/auth.js';
import { Course, RoutineEntry, Section } from '../models/index.js';
import { PERIOD_TIMES } from '../constants.js';
import { AppError, asyncHandler, sendData } from '../utils/http.js';
import {
  routinePopulate,
  serializeRoutineEntry,
} from '../services/routineSerializer.js';
import { logAudit } from '../services/audit.js';
import { assertSectionWritableByCr, idOf } from '../services/access.js';
import { dayNameFor, todayISO } from '../utils/dates.js';

const router = express.Router();
router.use(protect);

async function resolveSection(req) {
  const sectionId = req.query.sectionId || req.body?.sectionId || req.user.sectionId;
  if (!sectionId) throw new AppError(400, 'sectionId is required');
  const section = await Section.findById(sectionId);
  if (!section) throw new AppError(404, 'Section not found');

  if (
    !req.user.roles.includes('admin') &&
    !req.user.roles.includes('coordinator') &&
    String(req.user.sectionId?._id ?? req.user.sectionId) !== String(section._id)
  ) {
    // Read-only allowance: a CR may inspect a sibling section's routine of
    // their own batch to aim declarations at it. Writes are gated by
    // assertSectionWritableByCr (own section or a sibling in the same batch).
    const crBatch = idOf(req.user.batchId);
    const crMayView =
      req.user.roles.includes('cr') && crBatch && section.batchId &&
      String(crBatch) === String(section.batchId);
    if (!crMayView) {
      throw new AppError(403, 'You can only manage your own section routine');
    }
  }
  return section;
}

router.get(
  '/weekly',
  asyncHandler(async (req, res) => {
    const section = await resolveSection(req);
    const entries = await RoutineEntry.find({ sectionId: section._id })
      .populate(routinePopulate)
      .sort({ day: 1, period: 1 });

    sendData(res, entries.map(serializeRoutineEntry));
  })
);

router.get(
  '/daily',
  asyncHandler(async (req, res) => {
    const section = await resolveSection(req);
    // The Home screen asks for "today's routine" without naming a weekday, so
    // default to today in the campus time zone (Sunday–Thursday use the same
    // names as the routine model).
    const day = req.query.day || dayNameFor(todayISO());

    const entries = await RoutineEntry.find({ sectionId: section._id, day })
      .populate(routinePopulate)
      .sort({ period: 1 });

    sendData(res, entries.map(serializeRoutineEntry));
  })
);

// CRs may add single entries to their own section's routine directly;
// coordinators manage any section in their scope.
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const targetSectionId = req.body.sectionId || req.user.sectionId;
    req.body.sectionId = targetSectionId;
    const section = await resolveSection(req);
    await assertSectionWritableByCr(req.user, section);
    const body = req.body;
    if (!body.day || body.period == null) {
      throw new AppError(400, 'day and period are required');
    }
    if (!body.courseId && !String(body.courseCode ?? '').trim()) {
      throw new AppError(400, 'A subject is required — pick a course or enter a subject code');
    }

    // Manual subject entry: resolve (or create) the course from its code.
    let courseId = body.courseId || null;
    if (!courseId) {
      const code = String(body.courseCode).trim();
      let course = await Course.findOne({
        code: { $regex: `^${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
      });
      if (!course) {
        const sectionDept = idOf(
          (section.batchId && typeof section.batchId === 'object'
            ? section.batchId.departmentId
            : null) ?? section.departmentId
        );
        if (!sectionDept) {
          throw new AppError(400, `Cannot resolve a department for course ${code}`);
        }
        course = await Course.create({
          code,
          title: String(body.courseTitle ?? '').trim() || code,
          credits: 0,
          departmentId: sectionDept,
        });
      }
      courseId = course._id;
    }

    // The official day is period-based: derive the times from the period
    // when the client doesn't send explicit ones, and only accept canonical
    // period times for new entries.
    const periodTimes = PERIOD_TIMES[Number(body.period)];
    if (!periodTimes) {
      throw new AppError(400, 'period must be between 1 and 9');
    }
    const startTime = body.startTime || periodTimes.startTime;
    const endTime = body.endTime || periodTimes.endTime;
    if (
      startTime !== periodTimes.startTime ||
      endTime !== periodTimes.endTime
    ) {
      throw new AppError(
        400,
        `Period ${Number(body.period)} runs ${periodTimes.startTime}–${periodTimes.endTime} — use those times`
      );
    }

    const existing = await RoutineEntry.findOne({
      sectionId: section._id,
      day: body.day,
      period: Number(body.period),
    });
    if (existing) throw new AppError(409, 'A routine entry already exists for this day and period');

    const entry = new RoutineEntry({
      sectionId: section._id,
      courseId,
      teacherId: body.teacherId || null,
      teacherNames: Array.isArray(body.teacherNames)
        ? body.teacherNames.map((t) => String(t).trim()).filter(Boolean)
        : [],
      day: body.day,
      period: Number(body.period),
      startTime,
      endTime,
      room: body.room || null,
      classType: body.classType || 'lecture',
      isBreak: Boolean(body.isBreak),
      breakType: body.breakType || null,
      createdBy: req.user._id,
    });
    await entry.save();

    await logAudit({
      action: 'routine_created',
      user: req.user,
      sectionId: section._id,
      targetId: entry._id,
      details: `Created routine entry ${entry.courseId} on ${entry.day} period ${entry.period}`,
      req,
    });

    const populated = await RoutineEntry.findById(entry._id).populate(routinePopulate);
    sendData(res, serializeRoutineEntry(populated), 201);
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const entry = await RoutineEntry.findById(req.params.id);
    if (!entry) throw new AppError(404, 'Routine entry not found');

    const section = await Section.findById(entry.sectionId);
    if (!section) throw new AppError(404, 'Section not found');
    await assertSectionWritableByCr(req.user, section);

    const body = req.body;
    // Manual subject entry: resolve (or create) the course from its code.
    if (!body.courseId && body.courseCode !== undefined) {
      const code = String(body.courseCode ?? '').trim();
      if (code) {
        let course = await Course.findOne({
          code: { $regex: `^${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
        });
        if (!course) {
          const sectionDept = idOf(
            (section.batchId && typeof section.batchId === 'object'
              ? section.batchId.departmentId
              : null) ?? section.departmentId
          );
          if (!sectionDept) {
            throw new AppError(400, `Cannot resolve a department for course ${code}`);
          }
          course = await Course.create({
            code,
            title: String(body.courseTitle ?? '').trim() || code,
            credits: 0,
            departmentId: sectionDept,
          });
        }
        body.courseId = course._id;
      }
    }
    // Period-based times: derive from the official period when the client
    // changes the period without sending explicit times.
    if (body.period != null && body.startTime === undefined && body.endTime === undefined) {
      const periodTimes = PERIOD_TIMES[Number(body.period)];
      if (!periodTimes) throw new AppError(400, 'period must be between 1 and 9');
      body.startTime = periodTimes.startTime;
      body.endTime = periodTimes.endTime;
    }
    const allowed = [
      'courseId',
      'teacherId',
      'day',
      'period',
      'startTime',
      'endTime',
      'room',
      'classType',
      'isBreak',
      'breakType',
    ];
    for (const field of allowed) {
      if (body[field] !== undefined) entry[field] = body[field];
    }
    if (Array.isArray(body.teacherNames)) {
      entry.teacherNames = body.teacherNames.map((t) => String(t).trim()).filter(Boolean);
    }
    if (body.period != null) entry.period = Number(body.period);
    if (body.isBreak != null) entry.isBreak = Boolean(body.isBreak);

    await entry.save();

    await logAudit({
      action: 'routine_updated',
      user: req.user,
      sectionId: section._id,
      targetId: entry._id,
      details: `Updated routine entry on ${entry.day} period ${entry.period}`,
      req,
    });

    const populated = await RoutineEntry.findById(entry._id).populate(routinePopulate);
    sendData(res, serializeRoutineEntry(populated));
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const entry = await RoutineEntry.findById(req.params.id);
    if (!entry) throw new AppError(404, 'Routine entry not found');

    const section = await Section.findById(entry.sectionId);
    if (!section) throw new AppError(404, 'Section not found');
    await assertSectionWritableByCr(req.user, section);

    await RoutineEntry.findByIdAndDelete(req.params.id);
    await logAudit({
      action: 'routine_deleted',
      user: req.user,
      sectionId: section._id,
      targetId: entry._id,
      details: `Deleted routine entry on ${entry.day} period ${entry.period}`,
      req,
    });
    sendData(res, { message: 'Routine entry deleted' });
  })
);

export default router;
