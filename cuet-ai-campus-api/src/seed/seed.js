import {
  Department,
  AcademicSession,
  Term,
  Batch,
  Section,
  Course,
  Teacher,
  User,
  RoutineEntry,
  Update,
  Assignment,
  Exam,
  Attendance,
  StudyMaterial,
  AuditLog,
  CRAssignment,
  AssignmentRule,
} from '../models/index.js';
import { pathToFileURL } from 'node:url';
import { env } from '../config/env.js';
import bcrypt from 'bcryptjs';

/**
 * The only login accounts this seed creates — one per role, for manual testing.
 * Every account uses DEMO_PASSWORD (default `Campus123`).
 *
 *   u2204001@student.cuet.ac.bd  Demo Student      Section A   (student)
 *   u2204002@student.cuet.ac.bd  Demo CR           Section A   (student + cr)
 *   u2204003@student.cuet.ac.bd  Demo Student B    Section B   (student)
 *   coordinator@cuet.ac.bd       Demo Coordinator  CSE dept    (coordinator)
 */
const DEMO_ACCOUNTS = [
  {
    email: 'u2204001@student.cuet.ac.bd',
    name: 'Demo Student',
    studentId: '2204001',
    section: 'A',
    roles: ['student'],
  },
  {
    email: 'u2204002@student.cuet.ac.bd',
    name: 'Demo CR',
    studentId: '2204002',
    section: 'A',
    roles: ['student', 'cr'],
  },
  {
    email: 'u2204003@student.cuet.ac.bd',
    name: 'Demo Student B',
    studentId: '2204003',
    section: 'B',
    roles: ['student'],
  },
  {
    email: 'coordinator@cuet.ac.bd',
    name: 'Demo Coordinator',
    section: 'A',
    roles: ['coordinator'],
  },
];

const TEACHERS = [
  { id: 't-tista', name: 'Sharmistha Chanda Tista', designation: 'Assistant Professor', email: 'tista@cuet.ac.bd' },
  { id: 't-rizvi', name: 'Md. Atiqul Islam Rizvi', designation: 'Associate Professor', email: 'rizvi@cuet.ac.bd' },
  { id: 't-arefin', name: 'Prof. Dr. Mohammad Shamsul Arefin', designation: 'Professor', email: 'arefin@cuet.ac.bd' },
  { id: 't-kowsar', name: 'Mir Md. Saki Kowsar', designation: 'Assistant Professor', email: 'kowsar@cuet.ac.bd' },
  { id: 't-mahfuz', name: 'Prof. Dr. Mahfuzulhoq Chowdhury', designation: 'Professor', email: 'mahfuz@cuet.ac.bd' },
  { id: 't-rashadur', name: 'Md. Rashadur Rahman', designation: 'Assistant Professor', email: 'rashadur@cuet.ac.bd' },
  { id: 't-moshiul', name: 'Prof. Dr. Mohammed Moshiul Hoque', designation: 'Professor', email: 'moshiul@cuet.ac.bd' },
  { id: 't-afroza', name: 'Afroza Akter', designation: 'Assistant Professor', email: 'afroza@cuet.ac.bd' },
  { id: 't-ayesha', name: 'Ayesha Banu', designation: 'Assistant Professor', email: 'ayesha@cuet.ac.bd' },
  { id: 't-annesha', name: 'Annesha Das', designation: 'Assistant Professor', email: 'annesha@cuet.ac.bd' },
  { id: 't-maisha', name: 'Maisha Fahmida', designation: 'Assistant Professor', email: 'maisha@cuet.ac.bd' },
  { id: 't-refaj', name: 'Md. Refaj Hossan', designation: 'Assistant Professor', email: 'refaj@cuet.ac.bd' },
];

const COURSES = [
  { code: 'CSE-300', title: 'S/W Development Project (Sessional)', credits: 0.75 },
  { code: 'CSE-302', title: 'Technical Writing and Presentation (Sessional)', credits: 0.75 },
  { code: 'CSE-311', title: 'Computer Networks', credits: 3 },
  { code: 'CSE-321', title: 'Computer Architecture', credits: 3 },
  { code: 'CSE-345', title: 'Artificial Intelligence', credits: 3 },
  { code: 'CSE-347', title: 'Introduction to Mathematical Programming', credits: 3 },
  { code: 'CSE-355', title: 'Software Engineering', credits: 3 },
  { code: 'CSE-300/CSE-302', title: 'S/W Development Project + Technical Writing (Sessional)', credits: 1.5 },
  { code: 'CSE-356/CSE-300', title: 'Software Engineering + S/W Project (Sessional)', credits: 1.5 },
  { code: 'CSE-346 A1', title: 'Artificial Intelligence (Sessional) — Group A1', credits: 1.5 },
  { code: 'CSE-346 A2', title: 'Artificial Intelligence (Sessional) — Group A2', credits: 1.5 },
  { code: 'CSE-346 B1', title: 'Artificial Intelligence (Sessional) — Group B1', credits: 1.5 },
  { code: 'CSE-346 B2', title: 'Artificial Intelligence (Sessional) — Group B2', credits: 1.5 },
  { code: 'CSE-312 A1', title: 'Computer Networks (Sessional) — Group A1', credits: 1.5 },
  { code: 'CSE-312 A2', title: 'Computer Networks (Sessional) — Group A2', credits: 1.5 },
  { code: 'CSE-312 B1', title: 'Computer Networks (Sessional) — Group B1', credits: 1.5 },
  { code: 'CSE-312 B2', title: 'Computer Networks (Sessional) — Group B2', credits: 1.5 },
  { code: 'CSE-356-A', title: 'Software Engineering (Sessional) — Compiler Lab', credits: 0.75 },
];

const TEACHER_BY_NAME = {
  'Sharmistha Chanda Tista': 't-tista',
  'Md. Atiqul Islam Rizvi': 't-rizvi',
  'Prof. Dr. Mohammad Shamsul Arefin': 't-arefin',
  'Mir Md. Saki Kowsar': 't-kowsar',
  'Prof. Dr. Mahfuzulhoq Chowdhury': 't-mahfuz',
  'Md. Rashadur Rahman': 't-rashadur',
  'Prof. Dr. Mohammed Moshiul Hoque': 't-moshiul',
  'Afroza Akter': 't-afroza',
  'Ayesha Banu': 't-ayesha',
  'Annesha Das': 't-annesha',
  'Maisha Fahmida': 't-maisha',
  'Md. Refaj Hossan': 't-refaj',
};

const PERIODS = {
  P1: { start: '08:10', end: '09:00' },
  P2: { start: '09:00', end: '09:45' },
  P3: { start: '09:45', end: '10:30' },
  P4: { start: '10:45', end: '11:30' },
  P5: { start: '11:30', end: '12:15' },
  P6: { start: '12:15', end: '13:00' },
  P7: { start: '13:45', end: '14:30' },
  P8: { start: '14:30', end: '15:15' },
  P9: { start: '15:15', end: '16:00' },
};

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

const teacherMap = new Map();
const courseMap = new Map();

function periodKey(name) {
  return PERIODS[name];
}

async function clearCollections() {
  const collections = [
    Attendance,
    Assignment,
    Exam,
    Update,
    RoutineEntry,
    StudyMaterial,
    CRAssignment,
    AssignmentRule,
    AuditLog,
    User,
    Section,
    Batch,
    Term,
    AcademicSession,
    Course,
    Teacher,
    Department,
  ];
  for (const model of collections) {
    await model.deleteMany({});
  }
}

export async function seedDatabase({ clear = true } = {}) {
  if (clear) await clearCollections();

  const department = await Department.create({
    name: 'Computer Science & Engineering',
    code: 'CSE',
  });

  const session = await AcademicSession.create({
    name: '2022–2026',
    startYear: 2022,
    endYear: 2026,
    isActive: true,
  });

  const term = await Term.create({
    label: 'Level-3 Term-II',
    level: 3,
    termNumber: 2,
    academicSessionId: session._id,
    isActive: true,
  });

  const batch = await Batch.create({
    departmentId: department._id,
    batchNumber: 22,
    label: 'Batch 22',
    name: 'Batch 22',
    startYear: 2022,
    endYear: 2026,
  });

  const sectionA = await Section.create({
    batchId: batch._id,
    termId: term._id,
    name: 'A',
    label: 'Section A — Room 3403',
    maxStudents: 45,
  });

  const sectionB = await Section.create({
    batchId: batch._id,
    termId: term._id,
    name: 'B',
    label: 'Section B — Room 3305',
    maxStudents: 45,
  });

  for (const teacher of TEACHERS) {
    const created = await Teacher.create({
      departmentId: department._id,
      ...teacher,
    });
    teacherMap.set(teacher.id, created._id);
  }

  for (const course of COURSES) {
    const created = await Course.create({
      departmentId: department._id,
      ...course,
    });
    courseMap.set(course.code, created._id);
  }

  const passwordHash = await bcrypt.hash(env.demoPassword, 12);
  const sectionByName = { A: sectionA, B: sectionB };

  const users = [];
  for (const account of DEMO_ACCOUNTS) {
    const user = await User.create({
      email: account.email,
      name: account.name,
      ...(account.studentId ? { studentId: account.studentId } : {}),
      roles: account.roles,
      departmentId: department._id,
      batchId: batch._id,
      sectionId: sectionByName[account.section]._id,
      academicSessionId: session._id,
      passwordHash,
      hasPassword: true,
      isActive: true,
    });
    users.push(user);
  }

  const coordinator = users.find((user) => user.roles.includes('coordinator'));
  const studentUsers = users.filter((user) => user.roles.includes('student'));

  const userById = new Map();
  for (const user of users) {
    userById.set(user.email, user);
  }

  // CR assignment for the demo CR account.
  for (const user of users.filter((candidate) => candidate.roles.includes('cr'))) {
    await CRAssignment.create({
      userId: user._id,
      sectionId: user.sectionId,
      permissions: {
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
      },
      assignedBy: coordinator._id,
    });
  }

  // ---------- Routine entries ----------
  const routineSpecs = {
    A: [
      { day: 'Sunday', period: 2, classType: 'lecture', course: 'CSE-321', teacher: 't-tista', room: 'Room 3403' },
      { day: 'Sunday', period: 3, classType: 'lecture', course: 'CSE-347', teacher: 't-annesha', room: 'Room 3403' },
      { day: 'Sunday', period: 4, classType: 'lab', course: 'CSE-300/CSE-302', teacher: 't-tista', room: 'Network Lab (5th Fl)' },
      { day: 'Sunday', period: 5, classType: 'lab', course: 'CSE-300/CSE-302', teacher: 't-tista', room: 'Network Lab (5th Fl)' },
      { day: 'Sunday', period: 6, classType: 'lab', course: 'CSE-300/CSE-302', teacher: 't-tista', room: 'Network Lab (5th Fl)' },
      { day: 'Sunday', period: 7, classType: 'lab', course: 'CSE-346 A2', teacher: 't-ayesha', room: 'Multimedia Lab (5th Fl)' },
      { day: 'Sunday', period: 8, classType: 'lab', course: 'CSE-346 A2', teacher: 't-ayesha', room: 'Multimedia Lab (5th Fl)' },
      { day: 'Sunday', period: 9, classType: 'lab', course: 'CSE-346 A2', teacher: 't-ayesha', room: 'Multimedia Lab (5th Fl)' },
      { day: 'Monday', period: 1, classType: 'lab', course: 'CSE-346 A1', teacher: 't-ayesha', room: 'Multimedia Lab (5th Fl)' },
      { day: 'Monday', period: 2, classType: 'lab', course: 'CSE-346 A1', teacher: 't-ayesha', room: 'Multimedia Lab (5th Fl)' },
      { day: 'Monday', period: 3, classType: 'lab', course: 'CSE-346 A1', teacher: 't-ayesha', room: 'Multimedia Lab (5th Fl)' },
      { day: 'Monday', period: 4, classType: 'lecture', course: 'CSE-345', teacher: 't-afroza', room: 'Room 3403' },
      { day: 'Monday', period: 5, classType: 'lecture', course: 'CSE-355', teacher: 't-kowsar', room: 'Room 3403' },
      { day: 'Monday', period: 6, classType: 'lecture', course: 'CSE-311', teacher: 't-rashadur', room: 'Room 3403' },
      { day: 'Tuesday', period: 2, classType: 'lecture', course: 'CSE-347', teacher: 't-annesha', room: 'Room 3403' },
      { day: 'Tuesday', period: 4, classType: 'lecture', course: 'CSE-311', teacher: 't-rashadur', room: 'Room 3403' },
      { day: 'Tuesday', period: 5, classType: 'lecture', course: 'CSE-355', teacher: 't-kowsar', room: 'Room 3403' },
      { day: 'Tuesday', period: 6, classType: 'lecture', course: 'CSE-321', teacher: 't-tista', room: 'Room 3403' },
      { day: 'Tuesday', period: 7, classType: 'lab', course: 'CSE-312 A1', teacher: 't-rashadur', room: 'Network Lab (5th Fl)' },
      { day: 'Tuesday', period: 8, classType: 'lab', course: 'CSE-312 A1', teacher: 't-rashadur', room: 'Network Lab (5th Fl)' },
      { day: 'Tuesday', period: 9, classType: 'lab', course: 'CSE-312 A1', teacher: 't-rashadur', room: 'Network Lab (5th Fl)' },
      { day: 'Wednesday', period: 3, classType: 'lecture', course: 'CSE-311', teacher: 't-rashadur', room: 'Room 3403' },
      { day: 'Wednesday', period: 4, classType: 'lecture', course: 'CSE-345', teacher: 't-afroza', room: 'Room 3403' },
      { day: 'Wednesday', period: 5, classType: 'lecture', course: 'CSE-355', teacher: 't-kowsar', room: 'Room 3403' },
      { day: 'Wednesday', period: 6, classType: 'lecture', course: 'CSE-347', teacher: 't-annesha', room: 'Room 3403' },
      { day: 'Wednesday', period: 7, classType: 'lab', course: 'CSE-312 A2', teacher: 't-rashadur', room: 'Network Lab (5th Fl)' },
      { day: 'Wednesday', period: 8, classType: 'lab', course: 'CSE-312 A2', teacher: 't-rashadur', room: 'Network Lab (5th Fl)' },
      { day: 'Wednesday', period: 9, classType: 'lab', course: 'CSE-312 A2', teacher: 't-rashadur', room: 'Network Lab (5th Fl)' },
      { day: 'Thursday', period: 2, classType: 'lecture', course: 'CSE-345', teacher: 't-afroza', room: 'Room 3403' },
      { day: 'Thursday', period: 3, classType: 'lecture', course: 'CSE-321', teacher: 't-tista', room: 'Room 3403' },
      { day: 'Thursday', period: 4, classType: 'lab', course: 'CSE-356-A', teacher: 't-refaj', room: 'Compiler Lab (5th Fl)' },
      { day: 'Thursday', period: 5, classType: 'lab', course: 'CSE-356-A', teacher: 't-refaj', room: 'Compiler Lab (5th Fl)' },
      { day: 'Thursday', period: 6, classType: 'lab', course: 'CSE-356-A', teacher: 't-refaj', room: 'Compiler Lab (5th Fl)' },
    ],
    B: [
      { day: 'Sunday', period: 2, classType: 'lecture', course: 'CSE-347', teacher: 't-annesha', room: 'Room 3305' },
      { day: 'Sunday', period: 3, classType: 'lecture', course: 'CSE-321', teacher: 't-tista', room: 'Room 3305' },
      { day: 'Sunday', period: 4, classType: 'lab', course: 'CSE-346 B1', teacher: 't-ayesha', room: 'Multimedia Lab (5th Fl)' },
      { day: 'Sunday', period: 5, classType: 'lab', course: 'CSE-346 B1', teacher: 't-ayesha', room: 'Multimedia Lab (5th Fl)' },
      { day: 'Sunday', period: 6, classType: 'lab', course: 'CSE-346 B1', teacher: 't-ayesha', room: 'Multimedia Lab (5th Fl)' },
      { day: 'Sunday', period: 7, classType: 'lecture', course: 'CSE-302', teacher: 't-arefin', room: 'Room 3305' },
      { day: 'Sunday', period: 8, classType: 'lecture', course: 'CSE-302', teacher: 't-arefin', room: 'Room 3305' },
      { day: 'Sunday', period: 9, classType: 'lecture', course: 'CSE-302', teacher: 't-arefin', room: 'Room 3305' },
      { day: 'Monday', period: 4, classType: 'lecture', course: 'CSE-311', teacher: 't-rashadur', room: 'Room 3305' },
      { day: 'Monday', period: 5, classType: 'lecture', course: 'CSE-345', teacher: 't-afroza', room: 'Room 3305' },
      { day: 'Monday', period: 6, classType: 'lecture', course: 'CSE-355', teacher: 't-kowsar', room: 'Room 3305' },
      { day: 'Tuesday', period: 3, classType: 'lecture', course: 'CSE-347', teacher: 't-annesha', room: 'Room 3305' },
      { day: 'Tuesday', period: 4, classType: 'lecture', course: 'CSE-321', teacher: 't-tista', room: 'Room 3305' },
      { day: 'Tuesday', period: 5, classType: 'lecture', course: 'CSE-311', teacher: 't-rashadur', room: 'Room 3305' },
      { day: 'Tuesday', period: 6, classType: 'lecture', course: 'CSE-355', teacher: 't-kowsar', room: 'Room 3305' },
      { day: 'Tuesday', period: 7, classType: 'lab', course: 'CSE-356/CSE-300', teacher: 't-refaj', room: 'Multimedia Lab (5th Fl)' },
      { day: 'Tuesday', period: 8, classType: 'lab', course: 'CSE-356/CSE-300', teacher: 't-refaj', room: 'Multimedia Lab (5th Fl)' },
      { day: 'Tuesday', period: 9, classType: 'lab', course: 'CSE-356/CSE-300', teacher: 't-refaj', room: 'Multimedia Lab (5th Fl)' },
      { day: 'Wednesday', period: 2, classType: 'lecture', course: 'CSE-311', teacher: 't-rashadur', room: 'Room 3305' },
      { day: 'Wednesday', period: 4, classType: 'lecture', course: 'CSE-347', teacher: 't-maisha', room: 'Room 3305' },
      { day: 'Wednesday', period: 5, classType: 'lecture', course: 'CSE-345', teacher: 't-afroza', room: 'Room 3305' },
      { day: 'Wednesday', period: 6, classType: 'lecture', course: 'CSE-355', teacher: 't-kowsar', room: 'Room 3305' },
      { day: 'Wednesday', period: 7, classType: 'lab', course: 'CSE-346 B2', teacher: 't-ayesha', room: 'Multimedia Lab (5th Fl)' },
      { day: 'Wednesday', period: 8, classType: 'lab', course: 'CSE-346 B2', teacher: 't-ayesha', room: 'Multimedia Lab (5th Fl)' },
      { day: 'Wednesday', period: 9, classType: 'lab', course: 'CSE-346 B2', teacher: 't-ayesha', room: 'Multimedia Lab (5th Fl)' },
      { day: 'Thursday', period: 2, classType: 'lecture', course: 'CSE-321', teacher: 't-tista', room: 'Room 3305' },
      { day: 'Thursday', period: 3, classType: 'lecture', course: 'CSE-345', teacher: 't-afroza', room: 'Room 3305' },
      { day: 'Thursday', period: 4, classType: 'lab', course: 'CSE-312 B2', teacher: 't-rashadur', room: 'Network Lab (5th Fl)' },
      { day: 'Thursday', period: 5, classType: 'lab', course: 'CSE-312 B2', teacher: 't-rashadur', room: 'Network Lab (5th Fl)' },
      { day: 'Thursday', period: 6, classType: 'lab', course: 'CSE-312 B2', teacher: 't-rashadur', room: 'Network Lab (5th Fl)' },
      { day: 'Thursday', period: 7, classType: 'lab', course: 'CSE-312 B1', teacher: 't-rashadur', room: 'Network Lab (5th Fl)' },
      { day: 'Thursday', period: 8, classType: 'lab', course: 'CSE-312 B1', teacher: 't-rashadur', room: 'Network Lab (5th Fl)' },
      { day: 'Thursday', period: 9, classType: 'lab', course: 'CSE-312 B1', teacher: 't-rashadur', room: 'Network Lab (5th Fl)' },
    ],
  };

  const routineEntries = [];
  for (const sectionName of ['A', 'B']) {
    const sectionDoc = sectionName === 'A' ? sectionA : sectionB;
    for (const spec of routineSpecs[sectionName]) {
      const courseId = courseMap.get(spec.course);
      const teacherId = spec.teacher ? teacherMap.get(spec.teacher) : null;
      routineEntries.push({
        sectionId: sectionDoc._id,
        courseId,
        teacherId,
        day: spec.day,
        period: spec.period,
        startTime: periodKey(spec.period === 0 ? 'P1' : Object.keys(PERIODS)[spec.period - 1]).start,
        endTime: periodKey(spec.period === 0 ? 'P1' : Object.keys(PERIODS)[spec.period - 1]).end,
        room: spec.room,
        classType: spec.classType,
        isBreak: false,
        breakType: null,
        createdBy: coordinator._id,
      });
    }
  }
  await RoutineEntry.insertMany(routineEntries);

  // ---------- Updates ----------
  const now = new Date();
  const hoursAgo = (n) => new Date(now.getTime() - n * 3600 * 1000);
  const daysAgo = (n) => new Date(now.getTime() - n * 24 * 3600 * 1000);

  const updateSpecs = [
    { type: 'ct_reminder', scope: 'department', priority: 'important', title: 'CSE-311 CT-1 next Monday', description: 'CSE-311 Class Test-1 is scheduled for next Monday. Please prepare accordingly.', author: 'coordinator@cuet.ac.bd' },
    { type: 'cancellation', scope: 'section', priority: 'urgent', title: 'CSE-345 class cancelled today', description: 'Today’s CSE-345 lecture is cancelled due to faculty unavailability.', author: 'u2204001@student.cuet.ac.bd', section: 'A' },
    { type: 'time_change', scope: 'section', priority: 'normal', title: 'CSE-355 shifted to 4th period this Thursday', description: 'CSE-355 Software Engineering is shifted to 4th period this Thursday.', author: 'u2204001@student.cuet.ac.bd', section: 'A' },
    { type: 'announcement', scope: 'global', priority: 'normal', title: 'New routine effective 06/07/2026', description: 'The new Level-3 Term-II routine is now effective from 06/07/2026.', author: 'coordinator@cuet.ac.bd' },
    { type: 'assignment_reminder', scope: 'section', priority: 'normal', title: 'CSE-300 weekly progress report due Friday', description: 'Submit the CSE-300 weekly progress report by Friday.', author: 'u2204002@student.cuet.ac.bd', section: 'A' },
    { type: 'room_change', scope: 'section', priority: 'normal', title: 'CSE-321 venue swap for this week', description: 'CSE-321 classes this week will be held in the swapped venue.', author: 'u2204002@student.cuet.ac.bd', section: 'A' },
    { type: 'event', scope: 'section', priority: 'important', title: 'CSE Department Career Talk', description: 'Join the CSE Department Career Talk session to learn about internship and job opportunities from alumni working at top tech companies. RSVP recommended.', eventDateTime: new Date(now.getTime() + 5 * 24 * 3600 * 1000).toISOString(), eventLocation: 'Main Auditorium', author: 'u2204002@student.cuet.ac.bd', section: 'A' },
  ];

  for (let i = 0; i < updateSpecs.length; i++) {
    const spec = updateSpecs[i];
    const author = userById.get(spec.author);
    const sectionDoc = spec.section ? (spec.section === 'A' ? sectionA : sectionB) : null;
    await Update.create({
      authorId: author._id,
      sectionId: sectionDoc ? sectionDoc._id : null,
      batchId: batch._id,
      type: spec.type,
      title: spec.title,
      description: spec.description,
      priority: spec.priority,
      scope: spec.scope,
      departmentCode: 'CSE',
      batchNumber: 22,
      effectiveDate: null,
      eventDateTime: spec.eventDateTime || null,
      eventLocation: spec.eventLocation || null,
      status: 'approved',
      attachments: i === 1 ? ['https://example.com/updates/CSE300_report_guideline.pdf'] : [],
      createdAt: i % 2 === 0 ? hoursAgo(i + 2) : daysAgo(i + 1),
    });
  }

  // ---------- Assignments ----------
  const assignmentSpecs = [
    { course: 'CSE-345', title: 'CSE-345: A* Search on 8-Puzzle', description: 'Implement A* search for the 8-puzzle problem.', priority: 'high', status: 'in_progress', daysAhead: 5 },
    { course: 'CSE-355', title: 'SRS Document (Group)', description: 'Prepare the Software Requirements Specification document for your group project.', priority: 'high', status: 'not_started', daysAhead: 10 },
    { course: 'CSE-347', title: 'Simplex Method Problem Set', description: 'Solve the simplex method problem set.', priority: 'medium', status: 'completed', daysAhead: -1 },
    { course: 'CSE-311', title: 'Socket Programming Lab Report', description: 'Submit the socket programming lab report.', priority: 'medium', status: 'not_started', daysAhead: 14 },
  ];

  for (const user of studentUsers) {
    for (const spec of assignmentSpecs) {
      const courseId = courseMap.get(spec.course);
      const deadline = new Date(now.getTime() + spec.daysAhead * 24 * 3600 * 1000);
      deadline.setHours(12, 0, 0, 0);
      await Assignment.create({
        userId: user._id,
        sectionId: user.sectionId,
        courseId,
        teacherId: null,
        title: spec.title,
        description: spec.description,
        deadline,
        priority: spec.priority,
        status: spec.status,
        attachments: [],
        createdBy: coordinator._id,
      });
    }
  }

  // ---------- Exams ----------
  const examDateFuture = (days) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  await Exam.create({
    sectionId: sectionA._id,
    courseId: courseMap.get('CSE-311'),
    examType: 'CT',
    examDate: examDateFuture(5),
    startTime: '09:00',
    endTime: '10:00',
    room: '3403',
    venue: null,
    createdBy: coordinator._id,
  });

  await Exam.create({
    sectionId: sectionB._id,
    courseId: courseMap.get('CSE-345'),
    examType: 'Final',
    examDate: examDateFuture(12),
    startTime: '10:00',
    endTime: '12:00',
    room: '3305',
    venue: null,
    createdBy: coordinator._id,
  });

  // ---------- Sample attendance ----------
  const attendanceDates = [examDateFuture(-10), examDateFuture(-5), examDateFuture(-2)];
  for (const user of studentUsers) {
    for (let i = 0; i < attendanceDates.length; i++) {
      if (i % 3 === 0) {
        await Attendance.create({
          userId: user._id,
          sectionId: user.sectionId,
          courseId: courseMap.get('CSE-311'),
          date: attendanceDates[i],
          startTime: '09:00',
          endTime: '09:45',
          status: 'absent',
          classType: 'lecture',
          markedBy: coordinator._id,
        });
      }
    }
  }

  // ---------- Study materials ----------
  await StudyMaterial.create({
    title: 'CSE-311 Lecture 4 — TCP/IP',
    description: 'Slides for Transport Layer and TCP/IP model.',
    type: 'slides',
    url: 'https://example.com/study/cse311-lecture4.pdf',
    courseId: courseMap.get('CSE-311'),
    departmentId: department._id,
    uploadedBy: 'Md. Rashadur Rahman',
    createdBy: coordinator._id,
  });

  await StudyMaterial.create({
    title: 'CSE-345 AI Notes',
    description: 'Introductory notes on search and knowledge representation.',
    type: 'notes',
    url: 'https://example.com/study/cse345-notes.pdf',
    courseId: courseMap.get('CSE-345'),
    departmentId: department._id,
    uploadedBy: 'Afroza Akter',
    createdBy: coordinator._id,
  });

  // ---------- Audit logs ----------
  await AuditLog.create({
    action: 'cr_assigned',
    userId: coordinator._id,
    userName: coordinator.name,
    sectionId: sectionB._id,
    details: 'Demo CR assigned as CR for Section B',
  });
  await AuditLog.create({
    action: 'update_approved',
    userId: coordinator._id,
    userName: coordinator.name,
    sectionId: sectionA._id,
    details: 'Approved CSE-345 cancellation notice',
  });
  await AuditLog.create({
    action: 'student_moved',
    userId: coordinator._id,
    userName: coordinator.name,
    sectionId: sectionB._id,
    details: 'Moved a student from Section A to Section B',
  });

  // ---------- Assignment rule ----------
  await AssignmentRule.create({
    termId: term._id,
    sectionId: sectionA._id,
    startId: '2204001',
    endId: '2204066',
    isActive: true,
    createdBy: coordinator._id,
  });
  await AssignmentRule.create({
    termId: term._id,
    sectionId: sectionB._id,
    startId: '2204067',
    endId: '2204132',
    isActive: true,
    createdBy: coordinator._id,
  });

  return {
    department,
    session,
    term,
    batch,
    sections: [sectionA, sectionB],
    users,
    coordinator,
  };
}

// ---------------------------------------------------------------------------
// CLI entry — `node src/seed/seed.js` (merge into an empty DB) or
// `node src/seed/seed.js --fresh` (wipe and rebuild the demo dataset).
// ---------------------------------------------------------------------------
const invokedDirectly = (() => {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(entry).href;
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  const { connectDB } = await import('../config/db.js');
  const mongoose = (await import('mongoose')).default;

  try {
    await connectDB();
    const fresh = process.argv.includes('--fresh');

    if (fresh) {
      // A full reset also drops legacy collections/indexes (e.g. indexes left
      // behind by older schema versions) so the seed rebuilds clean state.
      await mongoose.connection.dropDatabase();
      console.log('[seed] Database dropped');
    } else {
      const userCount = await User.countDocuments({});
      if (userCount > 0) {
        console.error('[seed] Database is not empty — use `node src/seed/seed.js --fresh` to reset the demo data.');
        process.exitCode = 1;
      }
    }

    if (process.exitCode !== 1) {
      const result = await seedDatabase({ clear: false });
      console.log(
        `[seed] ${fresh ? 'Fresh' : 'Initial'} seed complete: ${result.users.length} demo accounts ` +
          `(student, CR, coordinator — password: ${env.demoPassword}), ${result.sections.length} sections, ` +
          'routine, updates, exams, assignments and audit logs.'
      );
      console.log('[seed] Accounts:');
      for (const account of DEMO_ACCOUNTS) {
        console.log(`[seed]   ${account.roles.join('+').padEnd(12)} ${account.email}  /  ${env.demoPassword}`);
      }
    }
  } catch (error) {
    console.error('[seed] failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}
