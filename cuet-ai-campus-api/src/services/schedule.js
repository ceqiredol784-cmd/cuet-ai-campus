import {
  Exam,
  RoutineEntry,
  ScheduleOverride,
} from '../models/index.js';
import {
  dateRange,
  dayNameFor,
  isValidDateString,
} from '../utils/dates.js';
import { AppError } from '../utils/http.js';
import {
  examPopulate,
  routinePopulate,
  serializeExam,
  serializeRoutineEntry,
  sortRoutineEntries,
} from './routineSerializer.js';

const DAY_LEVEL_TYPES = ['auto_day_off', 'mid_break', 'classes_end'];

function plain(doc) {
  return typeof doc?.toObject === 'function' ? doc.toObject({ virtuals: true }) : { ...(doc || {}) };
}

function idString(value) {
  return String(value?._id || value || '');
}

function matchesOverride(entry, override) {
  if (override.routineEntryId) {
    return idString(entry._id) === idString(override.routineEntryId);
  }
  if (override.courseId) {
    return idString(entry.courseId) === idString(override.courseId);
  }
  return false;
}

function mergeOriginal(entry, override) {
  const original = { ...(entry.original || {}) };
  if (override.originalValues?.startTime) original.startTime = override.originalValues.startTime;
  if (override.originalValues?.endTime) original.endTime = override.originalValues.endTime;
  if (override.originalValues?.room) original.room = override.originalValues.room;
  if (!original.startTime && override.type === 'time_change') original.startTime = entry.startTime;
  if (!original.endTime && override.type === 'time_change') original.endTime = entry.endTime;
  if (!original.room && override.type === 'room_change') original.room = entry.room;
  entry.original = original;
}

function declarationPayload(override) {
  if (!override) return null;
  return {
    id: idString(override._id),
    type: override.type,
    reason: override.reason || null,
    startDate:
      override.type === 'mid_break'
        ? override.startDate
        : override.specificDate || override.startDate,
    endDate:
      override.type === 'mid_break'
        ? override.endDate
        : override.specificDate || override.endDate,
  };
}

/** Approved overrides that apply to one section on one date. */
export async function applicableOverrides(sectionId, date) {
  if (!isValidDateString(date)) throw new AppError(400, 'date must be YYYY-MM-DD');
  return ScheduleOverride.find({
    sectionId,
    status: 'approved',
    $or: [
      { specificDate: date },
      {
        type: 'mid_break',
        startDate: { $lte: date },
        endDate: { $gte: date },
      },
      // Classes-end declarations run open-endedly from their start date.
      {
        type: 'classes_end',
        startDate: { $lte: date },
      },
    ],
  })
    .populate('courseId', 'code title credits')
    .sort({ createdAt: 1 });
}

/** The day-level declaration (day off / mid-break) for a date, if any. */
export function dayDeclarationFrom(overrides) {
  const applicable = overrides.filter((override) =>
    DAY_LEVEL_TYPES.includes(override.type)
  );
  if (!applicable.length) return null;
  return applicable.sort(
    (left, right) => new Date(right.createdAt) - new Date(left.createdAt)
  )[0];
}

export async function getDaySchedule({ date, sectionId }) {
  if (!isValidDateString(date)) throw new AppError(400, 'date must be YYYY-MM-DD');
  const day = dayNameFor(date);

  const [routine, overrides, exams] = await Promise.all([
    RoutineEntry.find({ sectionId, day }).populate(routinePopulate),
    applicableOverrides(sectionId, date),
    Exam.find({ sectionId, examDate: date, status: 'approved' }).populate(examPopulate),
  ]);

  const declaration = dayDeclarationFrom(overrides);
  const dayStatus =
    declaration?.type === 'mid_break'
      ? 'mid_break'
      : declaration?.type === 'classes_end'
        ? 'classes_ended'
        : declaration
          ? 'auto_day_off'
          : 'regular';

  let classes = [];
  if (!declaration) {
    classes = sortRoutineEntries(routine.map((entry) => serializeRoutineEntry(entry)));

    // CR-declared extra classes / class tests are appended up front so shift
    // and cancel declarations that target them by id can be applied below.
    const extras = [];
    for (const override of overrides) {
      if (override.type !== 'extra_class') continue;
      const course = plain(override.courseId);
      extras.push({
        _id: idString(override._id),
        id: idString(override._id),
        sectionId,
        courseId: override.courseId,
        teacherId: null,
        day,
        period: 0,
        startTime: override.startTime,
        endTime: override.endTime,
        room: override.room || null,
        classType: override.classType === 'ct' ? 'ct' : 'extra',
        isBreak: false,
        course,
        teacher: null,
        instructor: [],
        instructorState: 'unspecified',
        status: 'extra',
        overrideType: override.type,
        overrideReason: override.reason || null,
        original: null,
        source: 'override',
      });
    }
    if (extras.length > 0) classes.push(...extras);

    for (const override of overrides) {
      if (override.type === 'class_cancellation') {
        const matches = classes.filter((entry) => matchesOverride(entry, override));
        for (const entry of matches) {
          // Snapshot the effective values so the UI can show
          // "original → CANCELLED" like the local-first preview does.
          entry.original = {
            startTime: entry.startTime,
            endTime: entry.endTime,
            room: entry.room || null,
          };
          entry.status = 'cancelled';
          entry.overrideType = override.type;
          entry.overrideReason = override.reason || null;
          entry.source = 'override';
        }
        continue;
      }

      if (override.type === 'room_change' || override.type === 'time_change') {
        const matches = classes.filter(
          (entry) => matchesOverride(entry, override) && entry.status !== 'cancelled'
        );
        for (const entry of matches) {
          mergeOriginal(entry, override);
          if (override.type === 'room_change') {
            if (override.room) entry.room = override.room;
            if (!entry.original?.room) entry.original.room = entry.room;
          }
          if (override.type === 'time_change') {
            if (override.startTime) entry.startTime = override.startTime;
            if (override.endTime) entry.endTime = override.endTime;
          }
          entry.status = 'updated';
          entry.overrideType = override.type;
          entry.overrideReason = override.reason || null;
          entry.source = 'override';
        }
        continue;
      }
    }

    classes = sortRoutineEntries(classes);
  }

  return {
    date,
    day,
    sectionId: idString(sectionId),
    dayStatus,
    declaration: declarationPayload(declaration),
    activeOverrides: overrides.map(plain),
    classes,
    exams: exams.map(serializeExam),
  };
}

export async function getDayStatuses({ from, to, sectionId }) {
  const days = dateRange(from, to, { maxDays: 366 });
  const overrides = await ScheduleOverride.find({
    sectionId,
    status: 'approved',
    $or: [
      { specificDate: { $gte: from, $lte: to } },
      { startDate: { $lte: to }, endDate: { $gte: from } },
    ],
  }).sort({ createdAt: 1 });

  return days.map((date) => {
    const applicable = overrides.filter((override) => {
      if (override.type === 'mid_break') {
        return override.startDate <= date && override.endDate >= date;
      }
      if (override.type === 'classes_end') {
        return Boolean(override.startDate) && override.startDate <= date;
      }
      return override.specificDate === date;
    });
    const declaration = applicable
      .filter((override) => DAY_LEVEL_TYPES.includes(override.type))
      .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))[0];

    // Month markers for one-off changes, so a declared CT/extra class is
    // visible on the calendar grid instead of only inside the day panel.
    const marks = new Set();
    for (const override of applicable) {
      if (override.type === 'extra_class') {
        marks.add(override.classType === 'ct' ? 'ct' : 'extraClass');
      } else if (
        override.type === 'class_cancellation' ||
        override.type === 'room_change' ||
        override.type === 'time_change'
      ) {
        marks.add('classChange');
      } else if (override.type === 'classes_end') {
        marks.add('classesEnd');
      }
    }

    return {
      date,
      status:
        declaration?.type === 'mid_break'
          ? 'mid_break'
          : declaration?.type === 'classes_end'
            ? 'classes_ended'
            : declaration
              ? 'auto_day_off'
              : 'regular',
      declarationId: declaration ? idString(declaration._id) : null,
      marks: [...marks],
    };
  });
}
