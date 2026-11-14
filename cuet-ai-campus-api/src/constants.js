export const ROLES = ['student', 'cr', 'coordinator', 'admin'];

export const ROLE_PRIORITY = {
  admin: 4,
  coordinator: 3,
  cr: 2,
  student: 1,
};

export const STUDENT_PERMISSIONS = [
  'student.read.schedule',
  'student.read.exam',
  'student.read.notice',
  'student.use.ai',
];

export const CR_PERMISSIONS = [
  ...STUDENT_PERMISSIONS,
  'cr.create.notice',
  'cr.create.event',
  'cr.declare.auto',
  'cr.declare.mid_break',
  'cr.update.class',
  'cr.update.room',
  'cr.update.time',
  'cr.schedule.extra_class',
];

export const COORDINATOR_PERMISSIONS = [
  ...CR_PERMISSIONS,
  'coordinator.manage.students',
  'coordinator.manage.sections',
  'coordinator.manage.crs',
  'coordinator.review.updates',
  'coordinator.review.overrides',
];

export const ADMIN_PERMISSIONS = [...COORDINATOR_PERMISSIONS, 'admin.manage.all'];

export const permissionsForRoles = (roles = []) => {
  const set = new Set();
  if (roles.includes('student')) STUDENT_PERMISSIONS.forEach((p) => set.add(p));
  if (roles.includes('cr')) CR_PERMISSIONS.forEach((p) => set.add(p));
  if (roles.includes('coordinator')) {
    COORDINATOR_PERMISSIONS.forEach((p) => set.add(p));
  }
  if (roles.includes('admin')) ADMIN_PERMISSIONS.forEach((p) => set.add(p));
  return [...set];
};

export const primaryRoleFor = (roles = []) => {
  const ordered = [...roles].sort(
    (a, b) => (ROLE_PRIORITY[b] || 0) - (ROLE_PRIORITY[a] || 0)
  );
  return ordered[0] || 'student';
};

export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

/**
 * The official CUET period structure (Periods 1–9, Sunday–Thursday).
 * Break (10:30–10:45) sits between periods 3 and 4; Lunch (13:00–13:45)
 * between periods 6 and 7 — a single class can never span those gaps.
 */
export const PERIOD_TIMES = {
  1: { startTime: '08:10', endTime: '09:00' },
  2: { startTime: '09:00', endTime: '09:45' },
  3: { startTime: '09:45', endTime: '10:30' },
  4: { startTime: '10:45', endTime: '11:30' },
  5: { startTime: '11:30', endTime: '12:15' },
  6: { startTime: '12:15', endTime: '13:00' },
  7: { startTime: '13:45', endTime: '14:30' },
  8: { startTime: '14:30', endTime: '15:15' },
  9: { startTime: '15:15', endTime: '16:00' },
};

/** True when [from, to] crosses the Break or Lunch gap. */
export function periodRangeCrossesBreak(from, to) {
  return (from <= 3 && to >= 4) || (from <= 6 && to >= 7);
}

export const UPDATE_TYPES = [
  'announcement',
  'cancellation',
  'class_cancellation',
  'room_change',
  'time_change',
  'extra_class',
  'teacher_change',
  'lab_change',
  'ct_reminder',
  'exam_reminder',
  'assignment_reminder',
  'emergency',
  'other',
  'event',
];

export const UPDATE_SCOPES = ['section', 'batch', 'department', 'global'];
export const UPDATE_PRIORITIES = ['normal', 'important', 'urgent'];
export const UPDATE_STATUSES = ['pending', 'approved', 'rejected', 'draft', 'archived'];

export const OVERRIDE_TYPES = [
  'auto_day_off',
  'mid_break',
  'class_cancellation',
  'room_change',
  'time_change',
  'extra_class',
  'classes_end',
];

export const OVERRIDE_STATUSES = ['pending', 'approved', 'rejected', 'expired'];

export const DEFAULT_CR_UPDATE_PERMISSIONS = {
  allowedUpdateTypes: [
    'announcement',
    'event',
    'cancellation',
    'class_cancellation',
    'room_change',
    'time_change',
    'extra_class',
    'teacher_change',
    'lab_change',
    'other',
    'auto_day_off',
    'mid_break',
  ],
  directPublishTypes: ['announcement', 'event', 'cancellation', 'class_cancellation'],
};

/** CRs publish directly with no coordinator approval. */
export const CR_DIRECT_PUBLISH = true;

export const EXAM_TYPES = ['final', 'quiz', 'makeup', 'ct', 'other'];
export const ASSIGNMENT_STATUSES = ['not_started', 'in_progress', 'completed'];
export const ASSIGNMENT_PRIORITIES = ['low', 'medium', 'high'];
export const STUDY_MATERIAL_TYPES = ['notes', 'slides', 'book', 'video', 'other'];
