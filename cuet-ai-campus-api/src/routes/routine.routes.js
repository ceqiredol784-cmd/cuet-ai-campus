import express from 'express';
import { protect, requireCoordinator } from '../middleware/auth.js';
import { RoutineEntry, Section } from '../models/index.js';
import { AppError, asyncHandler, sendData } from '../utils/http.js';
import {
  routinePopulate,
  serializeRoutineEntry,
} from '../services/routineSerializer.js';
import { logAudit } from '../services/audit.js';
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
    throw new AppError(403, 'You can only manage your own section routine');
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

router.post(
  '/',
  requireCoordinator,
  asyncHandler(async (req, res) => {
    const section = await resolveSection(req);
    const body = req.body;
    if (!body.courseId || !body.day || body.period == null || !body.startTime || !body.endTime) {
      throw new AppError(400, 'courseId, day, period, startTime, and endTime are required');
    }

    const existing = await RoutineEntry.findOne({
      sectionId: section._id,
      day: body.day,
      period: body.period,
    });
    if (existing) throw new AppError(409, 'A routine entry already exists for this day and period');

    const entry = new RoutineEntry({
      sectionId: section._id,
      courseId: body.courseId,
      teacherId: body.teacherId || null,
      day: body.day,
      period: Number(body.period),
      startTime: body.startTime,
      endTime: body.endTime,
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
  requireCoordinator,
  asyncHandler(async (req, res) => {
    const entry = await RoutineEntry.findById(req.params.id);
    if (!entry) throw new AppError(404, 'Routine entry not found');

    const section = await Section.findById(entry.sectionId);
    if (!section) throw new AppError(404, 'Section not found');
    if (
      !req.user.roles.includes('admin') &&
      !req.user.roles.includes('coordinator') &&
      String(req.user.sectionId?._id ?? req.user.sectionId) !== String(section._id)
    ) {
      throw new AppError(403, 'You can only manage your own section routine');
    }

    const body = req.body;
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
  requireCoordinator,
  asyncHandler(async (req, res) => {
    const entry = await RoutineEntry.findById(req.params.id);
    if (!entry) throw new AppError(404, 'Routine entry not found');

    const section = await Section.findById(entry.sectionId);
    if (!section) throw new AppError(404, 'Section not found');
    if (
      !req.user.roles.includes('admin') &&
      !req.user.roles.includes('coordinator') &&
      String(req.user.sectionId?._id ?? req.user.sectionId) !== String(section._id)
    ) {
      throw new AppError(403, 'You can only manage your own section routine');
    }

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
