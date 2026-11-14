import { DAYS } from '../constants.js';

export const routinePopulate = [
  { path: 'courseId', select: 'code title credits' },
  {
    path: 'teacherId',
    select: 'name designation email phone departmentId',
    populate: { path: 'departmentId', select: 'name code' },
  },
];

export const overridePopulate = [
  { path: 'sectionId', select: 'name label termId' },
  { path: 'declaredBy', select: 'name role' },
  { path: 'reviewedBy', select: 'name role' },
  { path: 'courseId', select: 'code title credits' },
];

export const examPopulate = [
  { path: 'courseId', select: 'code title credits' },
  { path: 'sectionId', select: 'name label' },
];

export function serializeRoutineEntry(entry) {
  const raw = typeof entry.toObject === 'function' ? entry.toObject({ virtuals: true }) : { ...entry };
  const course = raw.courseId && typeof raw.courseId === 'object' ? raw.courseId : raw.course;
  const teacher =
    raw.teacherId && typeof raw.teacherId === 'object' ? raw.teacherId : raw.teacher;

  if (course) raw.course = course;
  if (teacher) {
    raw.teacher = teacher;
    if (teacher.departmentId && typeof teacher.departmentId === 'object') {
      raw.teacher.department = teacher.departmentId;
    }
  }

  raw.isRead = Boolean(raw.isRead);
  raw.isBreak = Boolean(raw.isBreak);
  raw.session = raw.session || null;
  // One linked teacher wins; otherwise fall back to the free-text teacher
  // list (a class may be taken by one, two or more teachers).
  raw.instructor = teacher?.name
    ? [teacher.name]
    : Array.isArray(raw.teacherNames) && raw.teacherNames.length > 0
      ? raw.teacherNames.filter(Boolean)
      : [];
  raw.instructorState = raw.instructor.length > 0 ? 'session_specific' : 'unspecified';
  return raw;
}

export function serializeExam(exam) {
  const raw = typeof exam.toObject === 'function' ? exam.toObject({ virtuals: true }) : { ...exam };
  const course = raw.courseId && typeof raw.courseId === 'object' ? raw.courseId : raw.course;
  if (course) raw.course = course;
  raw.examDate = String(raw.examDate || '').slice(0, 10);
  return raw;
}

export const dayIndex = (day) => {
  const index = DAYS.indexOf(day);
  return index === -1 ? 99 : index;
};

export function sortRoutineEntries(entries) {
  return [...entries].sort((left, right) => {
    const byDay = dayIndex(left.day) - dayIndex(right.day);
    if (byDay !== 0) return byDay;
    const byPeriod = Number(left.period || 0) - Number(right.period || 0);
    if (byPeriod !== 0) return byPeriod;
    return String(left.startTime || '').localeCompare(String(right.startTime || ''));
  });
}
