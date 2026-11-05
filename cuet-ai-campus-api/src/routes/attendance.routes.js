import express from 'express';
import { protect } from '../middleware/auth.js';
import { Attendance, RoutineEntry, ScheduleOverride } from '../models/index.js';
import { idOf } from '../services/access.js';
import { AppError, asyncHandler, sendData } from '../utils/http.js';

const router = express.Router();
router.use(protect);

router.get(
  '/view',
  asyncHandler(async (req, res) => {
    const days = Math.min(366, Math.max(1, Number.parseInt(req.query.days, 10) || 90));
    const userId = req.user._id;
    const sectionId = idOf(req.user.sectionId);

    if (!sectionId) {
      return sendData(res, { needsProfile: true, overall: { present: 0, absent: 0, eligible: 0, percent: null }, courses: [], absences: [], windowDays: days });
    }

    const toDate = new Date();
    toDate.setHours(23, 59, 59, 999);
    const fromDate = new Date(toDate);
    fromDate.setDate(toDate.getDate() - (days - 1));

    const from = fromDate.toISOString().slice(0, 10);
    const to = toDate.toISOString().slice(0, 10);

    const [routine, overrides, absences] = await Promise.all([
      RoutineEntry.find({ sectionId })
        .populate('courseId', 'code title credits')
        .sort({ day: 1, period: 1 }),
      ScheduleOverride.find({
        sectionId,
        status: 'approved',
        $or: [
          { specificDate: { $gte: from, $lte: to } },
          { startDate: { $lte: to }, endDate: { $gte: from } },
        ],
      }),
      Attendance.find({ userId, date: { $gte: from, $lte: to } }),
    ]);

    const absentMap = {};
    for (const absence of absences) {
      if (absence.status === 'absent') {
        absentMap[`${absence.courseId}:${absence.date}:${absence.startTime}`] = true;
      }
    }

    const dayOffDates = overrides
      .filter((o) => o.type === 'auto_day_off')
      .map((o) => o.specificDate);
    const midBreakRanges = overrides.filter((o) => o.type === 'mid_break');
    // A cancellation targets either a routine entry (by id) or a whole course
    // on that date, so it has to be matched against each session explicitly.
    const cancellations = overrides.filter((o) => o.type === 'class_cancellation');
    const isCancelledOn = (date, entry, courseKey) =>
      cancellations.some((override) => {
        if (String(override.specificDate) !== date) return false;
        if (override.routineEntryId) {
          return String(override.routineEntryId) === String(entry._id);
        }
        return Boolean(override.courseId) && idOf(override.courseId) === courseKey;
      });

    const dates = [];
    let cursor = new Date(fromDate);
    while (cursor <= toDate) {
      dates.push(cursor.toISOString().slice(0, 10));
      cursor.setDate(cursor.getDate() + 1);
    }

    let eligible = 0;
    let absentCount = 0;
    const courseResults = {};

    for (const date of dates) {
      const day = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
      if (dayOffDates.includes(date)) continue;
      if (midBreakRanges.some((o) => date >= o.startDate && date <= o.endDate)) continue;

      const dayRoutine = routine.filter((entry) => entry.day === day);
      for (const entry of dayRoutine) {
        if (entry.classType === 'ct') continue;
        const courseKey = idOf(entry.courseId);
        const key = `${courseKey}:${date}:${entry.startTime}`;
        if (isCancelledOn(date, entry, courseKey)) continue;

        eligible++;
        if (!courseResults[courseKey]) {
          courseResults[courseKey] = {
            courseId: courseKey,
            code: entry.courseId && typeof entry.courseId === 'object' ? entry.courseId.code : null,
            title: entry.courseId && typeof entry.courseId === 'object' ? entry.courseId.title : null,
            eligible: 0,
            absent: 0,
          };
        }
        courseResults[courseKey].eligible++;

        if (absentMap[key]) {
          absentCount++;
          courseResults[courseKey].absent++;
        }
      }
    }

    const present = Math.max(0, eligible - absentCount);
    const percent = eligible > 0 ? Math.round((present / eligible) * 1000) / 10 : null;

    const courses = Object.values(courseResults).map((course) => ({
      courseId: course.courseId,
      code: course.code,
      title: course.title,
      eligible: course.eligible,
      percent: course.eligible > 0 ? Math.round(((course.eligible - course.absent) / course.eligible) * 1000) / 10 : null,
    }));

    sendData(res, {
      needsProfile: false,
      overall: { present, absent: absentCount, eligible, percent },
      courses,
      // Only genuinely absent sessions belong in the "recorded absences" list;
      // restoring one marks the record present instead of deleting it.
      absences: absences
        .filter((absence) => absence.status === 'absent')
        .map((absence) => ({
          courseId: absence.courseId,
          date: absence.date,
          startTime: absence.startTime,
          endTime: absence.endTime,
          room: absence.room || null,
          classType: absence.classType || 'lecture',
        })),
      windowDays: days,
    });
  })
);

router.post(
  '/mark',
  asyncHandler(async (req, res) => {
    const body = req.body;
    if (!body.courseId || !body.date || !body.startTime || !body.endTime || !body.status) {
      throw new AppError(400, 'courseId, date, startTime, endTime, and status are required');
    }
    if (!['present', 'absent'].includes(body.status)) {
      throw new AppError(400, 'status must be present or absent');
    }

    const attendance = await Attendance.findOneAndUpdate(
      {
        userId: req.user._id,
        courseId: body.courseId,
        date: body.date,
        startTime: body.startTime,
      },
      {
        userId: req.user._id,
        sectionId: req.user.sectionId || null,
        courseId: body.courseId,
        date: body.date,
        startTime: body.startTime,
        endTime: body.endTime,
        status: body.status,
        classType: body.classType || 'lecture',
        markedBy: req.user._id,
      },
      { upsert: true, new: true }
    );
    sendData(res, { message: 'Attendance marked', id: String(attendance._id) });
  })
);

export default router;
