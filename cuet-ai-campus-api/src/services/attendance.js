import { Attendance, RoutineEntry, ScheduleOverride } from '../models/index.js';
import {
  dateRange,
  dayNameFor,
  endOfDay,
} from '../utils/dates.js';

export async function getAttendanceView({ userId, sectionId, days = 90 }) {
  const from = endOfDay(new Date(Date.now() - (days - 1) * 86400000)).toISOString().slice(0, 10);
  const to = endOfDay(new Date()).toISOString().slice(0, 10);

  const [routine, overrides, absences] = await Promise.all([
    RoutineEntry.find({ sectionId }).sort({ day: 1, period: 1 }),
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
  const cancelledOverrides = overrides.filter((o) => o.type === 'class_cancellation');
  const cancelledMap = {};
  for (const override of cancelledOverrides) {
    cancelledMap[`${override.specificDate}:${override.routineEntryId || override.courseId}`] = true;
  }

  const eligibleDates = dateRange(from, to);
  const courseResults = {};

  let eligible = 0;
  let absentCount = 0;

  for (const date of eligibleDates) {
    const day = dayNameFor(date);
    if (dayOffDates.includes(date)) continue;

    const isMidBreak = midBreakRanges.some(
      (o) => date >= o.startDate && date <= o.endDate
    );
    if (isMidBreak) continue;

    const dayRoutine = routine.filter((entry) => entry.day === day);
    for (const entry of dayRoutine) {
      if (entry.classType === 'ct') continue;
      const key = `${entry.courseId}:${date}:${entry.startTime}`;
      if (cancelledMap[key]) continue;

      eligible++;
      const courseKey = idOf(entry.courseId);
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

  return {
    needsProfile: false,
    overall: { present, absent: absentCount, eligible, percent },
    courses,
    absences: absences.map((absence) => ({
      courseId: absence.courseId,
      date: absence.date,
      startTime: absence.startTime,
      endTime: absence.endTime,
      room: absence.room || null,
      classType: absence.classType || 'lecture',
    })),
    windowDays: days,
  };
}

function idOf(value) {
  return String(value?._id || value || '');
}
