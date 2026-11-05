import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import mongoose from 'mongoose';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import { CRAssignment, RoutinePdf, Section, User } from '../src/models/index.js';
import { setupDatabase, teardownDatabase } from './helper.js';

let crToken;
let demoCrToken;
let studentAToken;
let coordinatorToken;
let sectionAId;
let sectionBId;

// Shared across the CT declaration flow tests.
let ctDateIso;
let ctDayName;
let ctCourseId;
let ctDeclaredStart;
let ctDeclaredEnd;
let ctOverrideId;
let cancelDateIso;

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const localIsoDate = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** Next teaching date (skips Friday/Saturday) at least `minOffset` days ahead. */
function nextTeachingDate(minOffset = 1) {
  const date = new Date();
  date.setDate(date.getDate() + minOffset);
  while (date.getDay() === 5 || date.getDay() === 6) date.setDate(date.getDate() + 1);
  const dateIso = localIsoDate(date);
  return { dateIso, dayName: DAY_NAMES[date.getDay()] };
}

async function loginAs(email) {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: env.demoPassword });
  assert.strictEqual(res.status, 200, `login ${email}: ${JSON.stringify(res.body)}`);
  return res.body.data.token;
}

async function me(token) {
  const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
  assert.strictEqual(res.status, 200);
  return res.body.data;
}

/**
 * The demo seed creates exactly three accounts (student, CR, coordinator), all
 * in Section A so a CR declaration is visible to the other two demo logins.
 * The suite also needs an admin and a CR outside Section A to prove scoping,
 * so those are fixtures here.
 */
async function createFixtureUsers(sectionAId) {
  const demoStudent = await User.findOne({ email: 'u2204001@student.cuet.ac.bd' });
  assert.ok(demoStudent, 'demo student account should be seeded');
  const sectionB = await Section.findOne({ name: 'B' });
  assert.ok(sectionB, 'Section B should be seeded');
  const passwordHash = await bcrypt.hash(env.demoPassword, 12);
  const profileFields = {
    departmentId: demoStudent.departmentId,
    batchId: demoStudent.batchId,
    academicSessionId: demoStudent.academicSessionId,
    passwordHash,
    hasPassword: true,
    isActive: true,
  };

  const sectionACr = await User.create({
    ...profileFields,
    email: 'u2204010@student.cuet.ac.bd',
    name: 'Fixture Section A CR',
    studentId: '2204010',
    roles: ['student', 'cr'],
    sectionId: sectionAId,
  });

  await CRAssignment.create({
    userId: sectionACr._id,
    sectionId: sectionAId,
    permissions: {
      allowedUpdateTypes: [
        'announcement',
        'event',
        'cancellation',
        'class_cancellation',
        'room_change',
        'time_change',
        'extra_class',
      ],
      directPublishTypes: ['announcement', 'event', 'cancellation', 'class_cancellation'],
    },
    assignedBy: null,
  });

  const sectionBCr = await User.create({
    ...profileFields,
    email: 'u2204020@student.cuet.ac.bd',
    name: 'Fixture Section B CR',
    studentId: '2204020',
    roles: ['student', 'cr'],
    sectionId: sectionB._id,
  });

  await CRAssignment.create({
    userId: sectionBCr._id,
    sectionId: sectionB._id,
    permissions: {
      allowedUpdateTypes: [
        'announcement',
        'event',
        'cancellation',
        'class_cancellation',
        'room_change',
        'time_change',
        'extra_class',
      ],
      directPublishTypes: ['announcement', 'event', 'cancellation', 'class_cancellation'],
    },
    assignedBy: null,
  });

  await User.create({
    ...profileFields,
    email: 'admin@cuet.ac.bd',
    name: 'Fixture Admin',
    roles: ['admin'],
    sectionId: sectionAId,
  });

  return sectionB._id;
}

describe('CUET AI Campus API', () => {
  before(async () => {
    await setupDatabase();

    studentAToken = await loginAs('u2204001@student.cuet.ac.bd');
    const studentAProfile = await me(studentAToken);
    assert.ok(studentAProfile.roles.includes('student'));
    assert.ok(!studentAProfile.roles.includes('cr'), 'the demo student must not be a CR');
    assert.ok(studentAProfile.sectionId, 'Student profile should include section');
    sectionAId = studentAProfile.sectionId._id;

    // The demo CR shares Section A with the demo student and coordinator, so
    // manual cross-account checks of a declared CT/notice actually line up.
    demoCrToken = await loginAs('u2204002@student.cuet.ac.bd');
    const demoCrProfile = await me(demoCrToken);
    assert.ok(demoCrProfile.roles.includes('cr'), 'the demo CR account should have the cr role');
    assert.ok(demoCrProfile.sectionId, 'CR profile should include section');
    assert.strictEqual(
      String(demoCrProfile.sectionId._id),
      String(sectionAId),
      'demo CR and demo student must share a section'
    );

    coordinatorToken = await loginAs('coordinator@cuet.ac.bd');
    const coordinatorProfile = await me(coordinatorToken);
    assert.ok(coordinatorProfile.roles.includes('coordinator'));

    sectionBId = String(await createFixtureUsers(String(sectionAId)));
    crToken = await loginAs('u2204020@student.cuet.ac.bd');
  });

  after(async () => {
    await teardownDatabase();
  });

  it('health endpoint responds', async () => {
    const res = await request(app).get('/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ok');
  });

  it('registers a new student and logs in', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'u2204050@student.cuet.ac.bd',
      name: 'Test User',
      password: 'StrongPass1',
    });
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));

    const login = await request(app).post('/api/v1/auth/login').send({
      email: 'u2204050@student.cuet.ac.bd',
      password: 'StrongPass1',
    });
    assert.strictEqual(login.status, 200);
    assert.ok(login.body.data.token);

    const profile = await me(login.body.data.token);
    assert.ok(profile.departmentId, 'student email should resolve its department');
    assert.ok(profile.batchId, 'student email should resolve its batch');
    assert.equal(profile.sectionId.name, 'A', 'coordinator ID-range rule should assign Section A');

    const completed = await request(app)
      .post('/api/v1/users/complete-profile')
      .set('Authorization', `Bearer ${login.body.data.token}`)
      .send({
        name: 'Test User',
        studentId: '2204050',
        department: 'CSE',
        batch: '2022',
      });
    assert.strictEqual(completed.status, 200, JSON.stringify(completed.body));
    assert.equal(completed.body.data.sectionId.name, 'A');

    const routine = await request(app)
      .get('/api/v1/routine/weekly')
      .set('Authorization', `Bearer ${login.body.data.token}`);
    assert.strictEqual(routine.status, 200);
    assert.ok(routine.body.data.length > 0);
  });

  it('rejects duplicate registration', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'u2204050@student.cuet.ac.bd',
      name: 'Test User',
      password: 'StrongPass1',
    });
    assert.strictEqual(res.status, 409);
  });

  it('lists weekly routine for Section B', async () => {
    const res = await request(app)
      .get('/api/v1/routine/weekly')
      .query({ sectionId: sectionBId })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.data) && res.body.data.length > 0);
    const sunday = res.body.data.find((e) => e.day === 'Sunday');
    assert.ok(sunday);
    assert.ok(sunday.courseId && sunday.courseId.code);
  });

  it('returns today\'s routine when no day is given', async () => {
    const res = await request(app)
      .get('/api/v1/routine/daily')
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(res.status, 200, JSON.stringify(res.body));
    assert.ok(Array.isArray(res.body.data));
    const todayName = DAY_NAMES[new Date().getDay()];
    assert.ok(
      res.body.data.every((entry) => entry.day === todayName),
      `expected only ${todayName} entries`
    );
  });

  it('gets calendar day for Section B', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await request(app)
      .get('/api/v1/calendar/day')
      .query({ date: today, sectionId: sectionBId })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(res.status, 200);
    const dayBody = res.body.data;
    if (!['regular', 'auto_day_off', 'mid_break'].includes(dayBody?.dayStatus)) {
      console.error('DEBUG calendar body:', JSON.stringify(res.body).slice(0, 600));
    }
    assert.ok(['regular', 'auto_day_off', 'mid_break'].includes(dayBody.dayStatus));
    assert.ok(Array.isArray(dayBody.classes));
  });

  it('creates a class cancellation override as CR and sees it on the calendar', async () => {
    const { dateIso, dayName } = nextTeachingDate(1);
    cancelDateIso = dateIso;

    const weekly = await request(app)
      .get('/api/v1/routine/weekly')
      .query({ sectionId: sectionBId })
      .set('Authorization', `Bearer ${crToken}`);
    const dayEntries = weekly.body.data.filter((e) => e.day === dayName);
    assert.ok(dayEntries.length > 0);
    const entry = dayEntries[0];

    const res = await request(app)
      .post('/api/v1/overrides')
      .send({
        type: 'class_cancellation',
        date: dateIso,
        routineEntryId: entry.id,
        courseId: entry.courseId._id || entry.courseId,
        reason: 'Cancelled for verification',
      })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));
    assert.ok(res.body.data.id || res.body.data._id);

    const day = await request(app)
      .get('/api/v1/calendar/day')
      .query({ date: dateIso, sectionId: sectionBId })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(day.status, 200);
    const dayBody = day.body.data;
    const classes = Array.isArray(dayBody.classes) ? dayBody.classes : dayBody;
    const cancelled = classes.find(
      (c) => String(c._id || c.id) === String(entry.id)
    );
    assert.ok(cancelled, 'Cancelled class should appear on calendar');
    assert.strictEqual(cancelled.status, 'cancelled');
  });

  it('does not leak Section B cancellation to Section A students', async () => {
    const res = await request(app)
      .get('/api/v1/calendar/day')
      .query({ date: cancelDateIso, sectionId: sectionAId })
      .set('Authorization', `Bearer ${studentAToken}`);
    assert.strictEqual(res.status, 200);
    const cancelled = res.body.data.classes.filter((c) => c.status === 'cancelled');
    assert.strictEqual(cancelled.length, 0);
  });

  it('withdraws an override by id', async () => {
    const list = await request(app)
      .get('/api/v1/overrides')
      .set('Authorization', `Bearer ${crToken}`);
    const overrides = Array.isArray(list.body) ? list.body : list.body.data;
    const override = overrides.find((o) => o.type === 'class_cancellation');
    assert.ok(override);

    const del = await request(app)
      .delete(`/api/v1/overrides/${override.id}`)
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(del.status, 200);

    const day = await request(app)
      .get('/api/v1/calendar/day')
      .query({ date: cancelDateIso, sectionId: sectionBId })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(day.body.data.classes.filter((c) => c.status === 'cancelled').length, 0);
  });

  it('schedules an extra lecture as CR and surfaces it as an extra class', async () => {
    const { dateIso, dayName } = nextTeachingDate(1);
    const weekly = await request(app)
      .get('/api/v1/routine/weekly')
      .query({ sectionId: sectionBId })
      .set('Authorization', `Bearer ${crToken}`);
    const lectures = weekly.body.data.filter(
      (e) => e.day === dayName && e.courseId?.code && e.courseId.code !== 'CT'
    );
    assert.ok(lectures.length > 0, `Section B should teach on ${dayName}`);

    const res = await request(app)
      .post('/api/v1/overrides')
      .send({
        type: 'extra_class',
        date: dateIso,
        courseId: lectures[0].courseId._id,
        startTime: '16:30',
        endTime: '17:30',
        room: 'Room 3305',
        reason: 'Make-up lecture',
      })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));

    const day = await request(app)
      .get('/api/v1/calendar/day')
      .query({ date: dateIso, sectionId: sectionBId })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(day.status, 200);
    const extra = day.body.data.classes.find(
      (c) =>
        String(c.courseId?._id || c.courseId) === String(lectures[0].courseId._id) &&
        c.status === 'extra'
    );
    assert.ok(extra, 'extra class should appear on the calendar');
    assert.strictEqual(extra.startTime, '16:30');
  });

  it('rejects a CT declaration without a course', async () => {
    const { dateIso } = nextTeachingDate(3);
    const res = await request(app)
      .post('/api/v1/overrides')
      .send({ type: 'extra_class', classType: 'ct', date: dateIso, reason: 'no course given' })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(res.status, 400);
  });

  it('rejects a CT declaration without times', async () => {
    const { dateIso } = nextTeachingDate(3);
    const weekly = await request(app)
      .get('/api/v1/routine/weekly')
      .query({ sectionId: sectionBId })
      .set('Authorization', `Bearer ${crToken}`);
    const lecture = weekly.body.data.find(
      (e) => e.courseId?.code && e.courseId.code !== 'CT'
    );
    const res = await request(app)
      .post('/api/v1/overrides')
      .send({
        type: 'extra_class',
        classType: 'ct',
        date: dateIso,
        courseId: String(lecture.courseId._id || lecture.courseId),
        reason: 'a declared CT always carries its own times',
      })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(res.status, 400);
  });

  it('declares a CT as CR with explicit times and shows it on the calendar', async () => {
    const found = nextTeachingDate(4);
    ctDateIso = found.dateIso;
    ctDayName = found.dayName;

    const weekly = await request(app)
      .get('/api/v1/routine/weekly')
      .query({ sectionId: sectionBId })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(weekly.status, 200);
    const lecture = weekly.body.data.find(
      (e) => e.day === ctDayName && e.courseId?.code && e.courseId.code !== 'CT'
    );
    assert.ok(lecture);
    ctCourseId = String(lecture.courseId._id || lecture.courseId);

    // The routine no longer carries a fixed CT slot: a declared CT always
    // carries the CR's explicit times and lands on both sections' calendars.
    ctDeclaredStart = '11:00';
    ctDeclaredEnd = '11:30';

    const res = await request(app)
      .post('/api/v1/overrides')
      .send({
        type: 'extra_class',
        classType: 'ct',
        date: ctDateIso,
        courseId: ctCourseId,
        startTime: ctDeclaredStart,
        endTime: ctDeclaredEnd,
        reason: 'CSE CT-1 · chapters 1–3',
      })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));
    ctOverrideId = String(res.body.data.id || res.body.data._id);
    assert.ok(ctOverrideId);

    const day = await request(app)
      .get('/api/v1/calendar/day')
      .query({ date: ctDateIso, sectionId: sectionBId })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(day.status, 200);
    const declared = day.body.data.classes.find(
      (c) => String(c._id || c.id) === ctOverrideId
    );
    assert.ok(declared, 'declared CT should appear on the calendar');
    assert.strictEqual(declared.classType, 'ct');
    assert.strictEqual(declared.status, 'extra');
    assert.strictEqual(declared.startTime, ctDeclaredStart);
    assert.strictEqual(declared.endTime, ctDeclaredEnd);
    assert.strictEqual(String(declared.courseId?._id || declared.courseId), ctCourseId);
  });

  it('shifts a declared CT with time_change preserving the original time', async () => {
    const res = await request(app)
      .post('/api/v1/overrides')
      .send({
        type: 'time_change',
        date: ctDateIso,
        routineEntryId: ctOverrideId,
        startTime: '15:00',
        endTime: '16:00',
        reason: 'Teacher unavailable in first period',
      })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));

    const day = await request(app)
      .get('/api/v1/calendar/day')
      .query({ date: ctDateIso, sectionId: sectionBId })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(day.status, 200);
    const shifted = day.body.data.classes.find(
      (c) => String(c._id || c.id) === ctOverrideId
    );
    assert.ok(shifted, 'shifted CT should stay on the calendar');
    assert.strictEqual(shifted.status, 'updated');
    assert.strictEqual(shifted.classType, 'ct');
    assert.strictEqual(shifted.startTime, '15:00');
    assert.strictEqual(shifted.endTime, '16:00');
    assert.strictEqual(shifted.original?.startTime, ctDeclaredStart);
    assert.strictEqual(shifted.original?.endTime, ctDeclaredEnd);
  });

  it('cancels a declared CT and keeps its effective time as original', async () => {
    const res = await request(app)
      .post('/api/v1/overrides')
      .send({
        type: 'class_cancellation',
        date: ctDateIso,
        routineEntryId: ctOverrideId,
        reason: 'Postponed by the course teacher',
      })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));

    const day = await request(app)
      .get('/api/v1/calendar/day')
      .query({ date: ctDateIso, sectionId: sectionBId })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(day.status, 200);
    const cancelled = day.body.data.classes.find(
      (c) => String(c._id || c.id) === ctOverrideId
    );
    assert.ok(cancelled, 'cancelled CT should still appear on the calendar');
    assert.strictEqual(cancelled.status, 'cancelled');
    assert.strictEqual(cancelled.classType, 'ct');
    assert.strictEqual(cancelled.original?.startTime, '15:00');
  });

  it('shows a CT declared in one section to the whole batch (both sections)', async () => {
    // CT declarations are batch-wide: the Section B CR's CT must appear on
    // Section A's calendar too, at the same declared slot. A fresh date is
    // used because the earlier CT has been cancelled by this point.
    const { dateIso } = nextTeachingDate(5);
    const weekly = await request(app)
      .get('/api/v1/routine/weekly')
      .query({ sectionId: sectionBId })
      .set('Authorization', `Bearer ${crToken}`);
    const courseId = weekly.body.data[0].courseId._id;

    const created = await request(app)
      .post('/api/v1/overrides')
      .send({
        type: 'extra_class',
        classType: 'ct',
        date: dateIso,
        courseId,
        startTime: '09:10',
        endTime: '09:50',
        reason: 'Batch-wide visibility check',
      })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(created.status, 201, JSON.stringify(created.body));
    assert.ok(
      (created.body.data.sectionIds ?? []).length >= 2,
      'one request must create a copy per batch section'
    );

    for (const [sectionToken, id] of [
      [studentAToken, sectionAId],
      [crToken, sectionBId],
    ]) {
      // eslint-disable-next-line no-await-in-loop
      const day = await request(app)
        .get('/api/v1/calendar/day')
        .query({ date: dateIso, sectionId: id })
        .set('Authorization', `Bearer ${sectionToken}`);
      assert.strictEqual(day.status, 200);
      const ct = day.body.data.classes.find(
        (cls) => cls.status === 'extra' && cls.classType === 'ct' && cls.startTime === '09:10'
      );
      assert.ok(ct, `calendar of section ${id} must show the batch-wide CT`);
    }
  });

  it('shows a demo CR CT to the student and coordinator across accounts', async () => {
    const { dateIso, dayName } = nextTeachingDate(2);
    const weekly = await request(app)
      .get('/api/v1/routine/weekly')
      .set('Authorization', `Bearer ${demoCrToken}`);
    assert.strictEqual(weekly.status, 200);
    const dayEntries = weekly.body.data.filter(
      (entry) => entry.day === dayName && entry.courseId?.code !== 'CT'
    );
    assert.ok(dayEntries.length > 0, `Section A should teach on ${dayName}`);
    const courseId = dayEntries[0].courseId._id || dayEntries[0].courseId;

    const created = await request(app)
      .post('/api/v1/overrides')
      .send({
        type: 'extra_class',
        classType: 'ct',
        date: dateIso,
        courseId,
        startTime: '10:30',
        endTime: '10:50',
        reason: 'Regression check for cross-account CT visibility',
      })
      .set('Authorization', `Bearer ${demoCrToken}`);
    assert.strictEqual(created.status, 201, JSON.stringify(created.body));
    const overrideId = created.body.data.id;
    const updateId = created.body.data.updateId;
    assert.ok(updateId, 'declaration should create a linked updates-feed post');

    // The student (same section) sees it in Updates…
    const studentUpdates = await request(app)
      .get('/api/v1/updates')
      .set('Authorization', `Bearer ${studentAToken}`);
    const notice = studentUpdates.body.data.items.find(
      (item) => String(item.id ?? item._id) === String(updateId)
    );
    assert.ok(notice, 'student should see the CT declaration in Updates');
    assert.strictEqual(notice.type, 'ct_reminder');
    // The feed post targets the whole batch so BOTH sections see it.
    assert.strictEqual(notice.scope, 'batch');
    assert.ok(String(notice.batchId?._id || notice.batchId), 'batch id must be set');

    // …and on their calendar for that date.
    const studentDay = await request(app)
      .get('/api/v1/calendar/day')
      .query({ date: dateIso })
      .set('Authorization', `Bearer ${studentAToken}`);
    assert.strictEqual(studentDay.status, 200);
    const ct = studentDay.body.data.classes.find(
      (cls) => cls.status === 'extra' && cls.classType === 'ct' && cls.startTime === '10:30'
    );
    assert.ok(ct, 'student calendar should show the CR-declared CT');

    // The coordinator sees the linked notice too.
    const coordinatorUpdates = await request(app)
      .get('/api/v1/updates')
      .set('Authorization', `Bearer ${coordinatorToken}`);
    assert.ok(
      coordinatorUpdates.body.data.items.some(
        (item) => String(item.id ?? item._id) === String(updateId)
      ),
      'coordinator should see the CT declaration'
    );

    // Withdrawing the declaration removes the feed post as well.
    const withdrawn = await request(app)
      .delete(`/api/v1/overrides/${overrideId}`)
      .set('Authorization', `Bearer ${demoCrToken}`);
    assert.strictEqual(withdrawn.status, 200);
    const after = await request(app)
      .get('/api/v1/updates')
      .set('Authorization', `Bearer ${studentAToken}`);
    assert.ok(
      !after.body.data.items.some((item) => String(item.id ?? item._id) === String(updateId)),
      'withdrawn declaration must disappear from Updates'
    );
  });

  it('coordinator can list sections and stats', async () => {
    const sections = await request(app)
      .get('/api/v1/coordinator/sections')
      .set('Authorization', `Bearer ${coordinatorToken}`);
    assert.strictEqual(sections.status, 200);
    assert.ok(Array.isArray(sections.body.data) && sections.body.data.length >= 2);

    const stats = await request(app)
      .get('/api/v1/coordinator/stats')
      .set('Authorization', `Bearer ${coordinatorToken}`);
    assert.strictEqual(stats.status, 200);
    assert.ok(typeof stats.body.data.totalStudents === 'number');
  });

  it('coordinator can create and delete an exam', async () => {
    const weekly = await request(app)
      .get('/api/v1/routine/weekly')
      .query({ sectionId: sectionAId })
      .set('Authorization', `Bearer ${coordinatorToken}`);
    const courseId = weekly.body.data[0].courseId._id;

    const created = await request(app)
      .post('/api/v1/exams')
      .send({
        courseId,
        sectionId: sectionAId,
        examType: 'final',
        examDate: '2026-12-01',
        startTime: '09:00',
        endTime: '10:00',
        room: '3403',
      })
      .set('Authorization', `Bearer ${coordinatorToken}`);
    assert.strictEqual(created.status, 201, JSON.stringify(created.body));
    const examId = created.body.data._id;

    const exams = await request(app)
      .get('/api/v1/exams')
      .query({ sectionId: sectionAId })
      .set('Authorization', `Bearer ${studentAToken}`);
    assert.strictEqual(exams.status, 200);

    const removed = await request(app)
      .delete(`/api/v1/exams/${examId}`)
      .set('Authorization', `Bearer ${coordinatorToken}`);
    assert.strictEqual(removed.status, 200);
  });

  it('updates feed is scoped to the student section', async () => {
    const sectionIdOfUpdate = (update) =>
      String(update.sectionId?._id ?? update.sectionId ?? '');

    const studentAUpdates = await request(app)
      .get('/api/v1/updates')
      .set('Authorization', `Bearer ${studentAToken}`);
    assert.strictEqual(studentAUpdates.status, 200);
    const aItems = studentAUpdates.body.data.items;
    assert.ok(Array.isArray(aItems));

    // Section A announcements are delivered to Section A students…
    assert.ok(
      aItems.some(
        (update) => update.scope === 'section' && sectionIdOfUpdate(update) === sectionAId
      ),
      'Section A student should see Section A announcements'
    );
    // …and Section B announcements are not.
    assert.ok(
      !aItems.some(
        (update) => update.scope === 'section' && sectionIdOfUpdate(update) === sectionBId
      ),
      'Section B announcements must not leak to Section A'
    );

    const crBUpdates = await request(app)
      .get('/api/v1/updates')
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(crBUpdates.status, 200);
    assert.ok(crBUpdates.body.data.items.length > 0);
    const bItems = crBUpdates.body.data.items;
    // Section B CR sees Section B announcements when they exist…
    assert.ok(
      bItems.some(
        (update) =>
          (update.scope === 'section' && sectionIdOfUpdate(update) === sectionBId) ||
          // CT declarations are batch-wide: the CR's own CT post is batch-scoped.
          (update.scope === 'batch' && update.type === 'ct_reminder')
      ),
      'Section B CR should see Section B announcements / their batch CT'
    );
    // …and Section A announcements are not.
    assert.ok(
      !bItems.some(
        (update) => update.scope === 'section' && sectionIdOfUpdate(update) === sectionAId
      ),
      'Section B CR must not receive Section A announcements'
    );
  });

  it('attendance view resolves course codes and titles', async () => {
    const res = await request(app)
      .get('/api/v1/attendance/view')
      .query({ days: 90 })
      .set('Authorization', `Bearer ${studentAToken}`);
    assert.strictEqual(res.status, 200, JSON.stringify(res.body));
    const courses = res.body.data.courses;
    assert.ok(Array.isArray(courses) && courses.length > 0);
    for (const course of courses) {
      assert.ok(course.code, `course ${course.courseId} is missing its code`);
      assert.ok(course.title, `course ${course.courseId} is missing its title`);
    }
  });

  it('marks an update as read', async () => {
    const list = await request(app)
      .get('/api/v1/updates')
      .set('Authorization', `Bearer ${studentAToken}`);
    const first = list.body.data.items[0];
    assert.ok(first);

    const read = await request(app)
      .put(`/api/v1/updates/${first.id}/read`)
      .set('Authorization', `Bearer ${studentAToken}`);
    assert.strictEqual(read.status, 200);

    const refreshed = await request(app)
      .get(`/api/v1/updates/${first.id}`)
      .set('Authorization', `Bearer ${studentAToken}`);
    assert.strictEqual(refreshed.body.data.isRead, true);
  });

  it('admin stats and audit logs work', async () => {
    const adminToken = await loginAs('admin@cuet.ac.bd');
    const stats = await request(app)
      .get('/api/v1/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(stats.status, 200);
    assert.ok(stats.body.data.roleCounts);

    const logs = await request(app)
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(logs.status, 200);
    assert.ok(Array.isArray(logs.body.data.logs));
  });

  it('study materials, feedback and AI chat work', async () => {
    const materials = await request(app)
      .get('/api/v1/study-materials')
      .set('Authorization', `Bearer ${studentAToken}`);
    assert.strictEqual(materials.status, 200);

    const feedback = await request(app)
      .post('/api/v1/feedback')
      .send({ type: 'bug', subject: 'Test', description: 'This is a test feedback message.' })
      .set('Authorization', `Bearer ${studentAToken}`);
    assert.strictEqual(feedback.status, 201);

    const ai = await request(app)
      .post('/api/v1/ai/chat')
      .send({ message: 'What is my next class?' })
      .set('Authorization', `Bearer ${studentAToken}`);
    assert.strictEqual(ai.status, 200);
    assert.ok(typeof ai.body.data.reply === 'string' && ai.body.data.reply.length > 0);
  });

  it('provides batch routine, notices, exams and conflicts to the AI context', async () => {
    const context = await request(app)
      .get('/api/v1/ai/context')
      .set('Authorization', `Bearer ${studentAToken}`);
    assert.strictEqual(context.status, 200, JSON.stringify(context.body));
    assert.equal(context.body.data.batchNumber, 22);
    assert.ok(context.body.data.routine.length > 0);
    assert.ok(context.body.data.updates.length > 0);
    assert.ok(context.body.data.exams.length > 0);
    assert.ok(typeof context.body.data.text === 'string');
    assert.ok(Array.isArray(context.body.data.conflicts));
  });

  it('requires coordinator rights and section scope to manage exams', async () => {
    const blocked = await request(app)
      .post('/api/v1/exams')
      .send({
        courseId: '000000000000000000000000',
        sectionId: sectionAId,
        examType: 'final',
        examDate: '2026-12-05',
        startTime: '09:00',
        endTime: '10:00',
      })
      .set('Authorization', `Bearer ${studentAToken}`);
    assert.strictEqual(blocked.status, 403, JSON.stringify(blocked.body));

    const weekly = await request(app)
      .get('/api/v1/routine/weekly')
      .query({ sectionId: sectionBId })
      .set('Authorization', `Bearer ${crToken}`);
    const courseId = weekly.body.data[0].courseId._id;

    const created = await request(app)
      .post('/api/v1/exams')
      .send({
        courseId,
        sectionId: sectionBId,
        examType: 'final',
        examDate: '2026-12-05',
        startTime: '09:00',
        endTime: '10:00',
      })
      .set('Authorization', `Bearer ${coordinatorToken}`);
    assert.strictEqual(created.status, 201, JSON.stringify(created.body));
    const examId = String(created.body.data._id);

    const crossRead = await request(app)
      .get(`/api/v1/exams/${examId}`)
      .set('Authorization', `Bearer ${studentAToken}`);
    assert.strictEqual(crossRead.status, 403);

    const crossDelete = await request(app)
      .delete(`/api/v1/exams/${examId}`)
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(crossDelete.status, 403);

    const removed = await request(app)
      .delete(`/api/v1/exams/${examId}`)
      .set('Authorization', `Bearer ${coordinatorToken}`);
    assert.strictEqual(removed.status, 200);
  });

  it('rejects midterm exams because only final and coordinator/CR-scheduled exam types are supported', async () => {
    const course = await mongoose.connection.collection('courses').findOne({ code: 'CSE-311' });
    const res = await request(app)
      .post('/api/v1/exams')
      .set('Authorization', 'Bearer ' + coordinatorToken)
      .send({
        sectionId: sectionAId,
        courseId: String(course._id),
        examType: 'midterm',
        examDate: '2026-12-01',
        startTime: '09:00',
        endTime: '10:00',
      });
    assert.strictEqual(res.status, 400);
  });

  it('blocks students from reading another section calendar', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const crossSection = await request(app)
      .get('/api/v1/calendar/day')
      .query({ date: today, sectionId: sectionBId })
      .set('Authorization', `Bearer ${studentAToken}`);
    assert.strictEqual(crossSection.status, 403, JSON.stringify(crossSection.body));

    const ownSection = await request(app)
      .get('/api/v1/calendar/day')
      .query({ date: today })
      .set('Authorization', `Bearer ${studentAToken}`);
    assert.strictEqual(ownSection.status, 200);
  });

  it('excludes cancelled classes from attendance and clears restored absences', async () => {
    const crAToken = await loginAs('u2204010@student.cuet.ac.bd');
    const past = new Date();
    past.setDate(past.getDate() - 1);
    while (past.getDay() === 5 || past.getDay() === 6) past.setDate(past.getDate() - 1);
    const dateIso = localIsoDate(past);
    const dayName = DAY_NAMES[past.getDay()];

    const weekly = await request(app)
      .get('/api/v1/routine/weekly')
      .set('Authorization', `Bearer ${studentAToken}`);
    const target = weekly.body.data.find(
      (entry) => entry.day === dayName && entry.classType !== 'ct' && entry.courseId?.code
    );
    assert.ok(target, `Section A should have a class on ${dayName}`);

    const before = await request(app)
      .get('/api/v1/attendance/view')
      .query({ days: 90 })
      .set('Authorization', `Bearer ${studentAToken}`);
    assert.strictEqual(before.status, 200, JSON.stringify(before.body));
    const eligibleBefore = before.body.data.overall.eligible;
    assert.ok(eligibleBefore > 0);

    const cancelled = await request(app)
      .post('/api/v1/overrides')
      .send({
        type: 'class_cancellation',
        date: dateIso,
        routineEntryId: target.id,
        reason: 'Attendance regression check',
      })
      .set('Authorization', `Bearer ${crAToken}`);
    assert.strictEqual(cancelled.status, 201, JSON.stringify(cancelled.body));
    const overrideId = String(cancelled.body.data.id || cancelled.body.data._id);

    const after = await request(app)
      .get('/api/v1/attendance/view')
      .query({ days: 90 })
      .set('Authorization', `Bearer ${studentAToken}`);
    assert.strictEqual(after.status, 200);
    assert.strictEqual(
      after.body.data.overall.eligible,
      eligibleBefore - 1,
      'a cancelled class must leave the attendance denominator'
    );

    const session = {
      courseId: String(target.courseId._id || target.courseId),
      date: dateIso,
      startTime: target.startTime,
      endTime: target.endTime,
    };
    const markedAbsent = await request(app)
      .post('/api/v1/attendance/mark')
      .send({ ...session, status: 'absent' })
      .set('Authorization', `Bearer ${studentAToken}`);
    assert.strictEqual(markedAbsent.status, 200, JSON.stringify(markedAbsent.body));

    const withAbsence = await request(app)
      .get('/api/v1/attendance/view')
      .query({ days: 90 })
      .set('Authorization', `Bearer ${studentAToken}`);
    assert.ok(
      withAbsence.body.data.absences.some(
        (absence) => absence.date === dateIso && absence.startTime === target.startTime
      ),
      'an absent session should be listed'
    );

    const restored = await request(app)
      .post('/api/v1/attendance/mark')
      .send({ ...session, status: 'present' })
      .set('Authorization', `Bearer ${studentAToken}`);
    assert.strictEqual(restored.status, 200);

    const afterRestore = await request(app)
      .get('/api/v1/attendance/view')
      .query({ days: 90 })
      .set('Authorization', `Bearer ${studentAToken}`);
    assert.ok(
      !afterRestore.body.data.absences.some(
        (absence) => absence.date === dateIso && absence.startTime === target.startTime
      ),
      'restored sessions must disappear from the absences list'
    );

    const withdrawn = await request(app)
      .delete(`/api/v1/overrides/${overrideId}`)
      .set('Authorization', `Bearer ${crAToken}`);
    assert.strictEqual(withdrawn.status, 200);
  });

  it('lets a CR post a department announcement and delivers it to students', async () => {
    const created = await request(app)
      .post('/api/v1/updates')
      .send({
        type: 'announcement',
        scope: 'department',
        departmentCode: 'CSE',
        title: 'Department regression notice',
        description: 'Department-wide notice used to verify feed scoping.',
      })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(created.status, 201, JSON.stringify(created.body));
    assert.strictEqual(created.body.data.departmentCode, 'CSE');

    const feed = await request(app)
      .get('/api/v1/updates')
      .set('Authorization', `Bearer ${studentAToken}`);
    assert.strictEqual(feed.status, 200);
    assert.ok(
      feed.body.data.items.some(
        (item) =>
          item.title === 'Department regression notice' && item.scope === 'department'
      ),
      'department announcement should reach students of that department'
    );
  });

  it('stores the department code (not an ObjectId) on coordinator notices', async () => {
    const created = await request(app)
      .post('/api/v1/coordinator/notices')
      .send({
        audience: 'batch',
        title: 'Batch regression notice',
        body: 'Batch scoping check',
        priority: 'normal',
      })
      .set('Authorization', `Bearer ${coordinatorToken}`);
    assert.strictEqual(created.status, 200, JSON.stringify(created.body));

    const feed = await request(app)
      .get('/api/v1/updates')
      .query({ limit: 50 })
      .set('Authorization', `Bearer ${studentAToken}`);
    assert.strictEqual(feed.status, 200);
    const notice = feed.body.data.items.find(
      (item) => item.title === 'Batch regression notice'
    );
    assert.ok(notice, 'batch notice should reach the batch');
    assert.strictEqual(notice.departmentCode, 'CSE');
  });

  it('publishes an event update with schedule details for a CR', async () => {
    const created = await request(app)
      .post('/api/v1/updates')
      .send({
        type: 'event',
        scope: 'section',
        title: 'Section orientation',
        description: 'Bring your student ID.',
        eventDateTime: '2030-01-15T10:30',
        eventLocation: 'Gallery 204',
      })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(created.status, 201, JSON.stringify(created.body));
    assert.strictEqual(created.body.data.type, 'event');
    assert.strictEqual(created.body.data.eventDateTime, '2030-01-15T10:30');
    assert.strictEqual(created.body.data.eventLocation, 'Gallery 204');
  });

  it('publishes a coordinator event with an optional PDF attachment', async () => {
    const created = await request(app)
      .post('/api/v1/coordinator/notices')
      .field(
        'data',
        JSON.stringify({
          audience: 'batch',
          title: 'Batch briefing',
          body: 'Attendance is required.',
          type: 'event',
          eventDateTime: '2030-02-20T14:00',
          eventLocation: 'Seminar room',
        })
      )
      .attach('file', Buffer.from('%PDF-1.4 test'), 'briefing.pdf')
      .set('Authorization', `Bearer ${coordinatorToken}`);
    assert.strictEqual(created.status, 200, JSON.stringify(created.body));

    const feed = await request(app)
      .get('/api/v1/updates')
      .query({ limit: 50 })
      .set('Authorization', `Bearer ${coordinatorToken}`);
    assert.strictEqual(feed.status, 200);
    const notice = feed.body.data.items.find((item) => item.title === 'Batch briefing');
    assert.ok(notice);
    assert.strictEqual(notice.type, 'event');
    assert.strictEqual(notice.eventDateTime, '2030-02-20T14:00');
    assert.strictEqual(notice.attachments.length, 1);
  });

  it('rejects an empty AI chat message with a 400', async () => {
    const res = await request(app)
      .post('/api/v1/ai/chat')
      .send({ message: '   ' })
      .set('Authorization', `Bearer ${studentAToken}`);
    assert.strictEqual(res.status, 400);
  });

  it('routine PDF latest returns 404 when none uploaded', async () => {
    const res = await request(app)
      .get('/api/v1/routine-pdf/latest')
      .set('Authorization', `Bearer ${coordinatorToken}`);
    assert.strictEqual(res.status, 404);
  });

  it('publishes an extracted routine without period collisions', async () => {
    const pdf = await RoutinePdf.create({
      title: 'Publish regression routine',
      filename: 'regression.pdf',
      originalName: 'regression.pdf',
      path: 'uploads/routine/regression.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      uploadedBy: new mongoose.Types.ObjectId(),
      extractionStatus: 'completed',
    });

    // Extracted rows carry period 0, so two rows on the same day used to hit
    // the (section, day, period) unique index and fail the whole publish.
    const res = await request(app)
      .post(`/api/v1/routine-pdf/${pdf._id}/publish`)
      .send({
        replace: true,
        sections: [
          {
            name: 'A',
            entries: [
              {
                courseCode: 'CSE-311',
                day: 'Sunday',
                period: 0,
                startTime: '08:10',
                endTime: '09:00',
                classType: 'lecture',
              },
              {
                courseCode: 'CSE-321',
                day: 'Sunday',
                period: 0,
                startTime: '09:00',
                endTime: '09:45',
                classType: 'lecture',
              },
            ],
          },
        ],
      })
      .set('Authorization', `Bearer ${coordinatorToken}`);
    assert.strictEqual(res.status, 200, JSON.stringify(res.body));
    assert.strictEqual(res.body.data.published, 2);

    const weekly = await request(app)
      .get('/api/v1/routine/weekly')
      .query({ sectionId: sectionAId })
      .set('Authorization', `Bearer ${coordinatorToken}`);
    assert.strictEqual(weekly.status, 200);
    const sunday = weekly.body.data.filter((entry) => entry.day === 'Sunday');
    assert.strictEqual(sunday.length, 2);
    const periods = sunday.map((entry) => entry.period);
    assert.strictEqual(new Set(periods).size, 2, 'periods must be unique per day');
    assert.ok(periods.every((period) => period > 0));

    await RoutinePdf.findByIdAndDelete(pdf._id);
  });
});
