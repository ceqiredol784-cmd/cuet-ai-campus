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
let crId;
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
    const crProfile = await me(crToken);
    crId = String(crProfile.id ?? crProfile._id);
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

  it('shows a batch-wide day-off once in the CR\'s declaration list (no sibling-copy duplication)', async () => {
    const { dateIso } = nextTeachingDate(3);

    const created = await request(app)
      .post('/api/v1/overrides')
      .send({ type: 'auto_day_off', date: dateIso, reason: 'Batch-wide day off' })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(created.status, 201, JSON.stringify(created.body));
    const dayOffSrcId = String(created.body.data.id ?? created.body.data._id);

    // The CR's own declaration list must show the declaration ONCE — the
    // batch-wide sibling copy (matched via declaredBy) must not duplicate it.
    const crList = await request(app)
      .get('/api/v1/overrides')
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(crList.status, 200);
    const crOverrides = Array.isArray(crList.body) ? crList.body : crList.body.data;
    const dayOffs = crOverrides.filter((o) => o.type === 'auto_day_off');
    assert.strictEqual(
      dayOffs.length,
      1,
      `day-off should appear once in the CR's list, got ${dayOffs.length}`
    );

    // The sibling section still has its own copy (batch-wide semantics).
    const siblingList = await request(app)
      .get('/api/v1/overrides')
      .query({ sectionId: sectionAId })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(siblingList.status, 200);
    const siblingOverrides = Array.isArray(siblingList.body)
      ? siblingList.body
      : siblingList.body.data;
    assert.strictEqual(
      siblingOverrides.filter((o) => o.type === 'auto_day_off').length,
      1,
      'the sibling section copy must exist for batch-wide calendars'
    );

    // A student in the sibling section sees their own section's copy.
    const studentList = await request(app)
      .get('/api/v1/overrides')
      .set('Authorization', `Bearer ${studentAToken}`);
    assert.strictEqual(studentList.status, 200);
    const studentOverrides = Array.isArray(studentList.body)
      ? studentList.body
      : studentList.body.data;
    assert.strictEqual(
      studentOverrides.filter((o) => o.type === 'auto_day_off').length,
      1
    );

    // The Updates feed must carry ONE notice for the declaration (the
    // batch-scoped post), not one per section copy.
    const feed = await request(app)
      .get('/api/v1/updates?limit=50')
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(feed.status, 200);
    const feedItems = feed.body.data?.items ?? [];
    const dayOffNotices = feedItems.filter(
      (u) =>
        u.type === 'cancellation' &&
        /Day off declared on/.test(u.title ?? '') &&
        String(u.sourceOverrideId ?? '') === dayOffSrcId
    );
    assert.strictEqual(
      dayOffNotices.length,
      1,
      `Updates feed should carry one day-off notice, got ${dayOffNotices.length}`
    );

    // Withdrawing the CR's own copy removes the whole batch-wide group.
    const dayOffId = String(
      dayOffs[0].id ?? dayOffs[0]._id ?? dayOffs[0]._id
    );
    const del = await request(app)
      .delete(`/api/v1/overrides/${dayOffId}`)
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(del.status, 200);

    const afterList = await request(app)
      .get('/api/v1/overrides')
      .query({ sectionId: sectionAId })
      .set('Authorization', `Bearer ${crToken}`);
    const after = Array.isArray(afterList.body) ? afterList.body : afterList.body.data;
    assert.strictEqual(
      after.filter((o) => o.type === 'auto_day_off').length,
      0,
      'withdrawing the CR\'s copy must remove the sibling copy too'
    );
  });

  it('is idempotent: a retried identical day-off does not duplicate declaration or notice', async () => {
    const { dateIso } = nextTeachingDate(4);

    const first = await request(app)
      .post('/api/v1/overrides')
      .send({ type: 'auto_day_off', date: dateIso, reason: 'Retry guard' })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(first.status, 201, JSON.stringify(first.body));

    // An outbox retry replays the identical payload — it must return the
    // existing declaration, not create a second one (and a second notice).
    const retry = await request(app)
      .post('/api/v1/overrides')
      .send({ type: 'auto_day_off', date: dateIso, reason: 'Retry guard' })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(retry.status, 200, JSON.stringify(retry.body));
    assert.strictEqual(
      String(retry.body.data.id),
      String(first.body.data.id),
      'the retry must return the original declaration'
    );

    const list = await request(app)
      .get('/api/v1/overrides')
      .set('Authorization', `Bearer ${crToken}`);
    const overrides = Array.isArray(list.body) ? list.body : list.body.data;
    const dayOffs = overrides.filter(
      (o) => o.type === 'auto_day_off' && (o.specificDate === dateIso || o.startDate === dateIso)
    );
    assert.strictEqual(dayOffs.length, 1, 'no duplicate declaration');

    const feed = await request(app)
      .get('/api/v1/updates?limit=50')
      .set('Authorization', `Bearer ${crToken}`);
    const feedItems = feed.body.data?.items ?? [];
    const notices = feedItems.filter(
      (u) => u.type === 'cancellation' && String(u.sourceOverrideId ?? '') === String(first.body.data.id)
    );
    assert.strictEqual(notices.length, 1, 'no duplicate feed notice');

    // A different date is a genuine new declaration, not a retry.
    const other = await request(app)
      .post('/api/v1/overrides')
      .send({ type: 'auto_day_off', date: nextTeachingDate(5).dateIso })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(other.status, 201);

    // Withdraw both (batch-wide groups).
    for (const item of [first.body.data, other.body.data]) {
      const del = await request(app)
        .delete(`/api/v1/overrides/${item.id}`)
        .set('Authorization', `Bearer ${crToken}`);
      assert.strictEqual(del.status, 200);
    }
  });

  it('declares classes-end (DL) batch-wide with exam-period day status', async () => {
    const endDate = localIsoDate(new Date(Date.now() + 12 * 86400000));

    const classesEnd = await request(app)
      .post('/api/v1/overrides')
      .send({ type: 'classes_end', date: endDate, reason: 'Final exam period' })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(classesEnd.status, 201, JSON.stringify(classesEnd.body));

    // Batch-wide: the CR's own section AND the sibling section both show
    // classes_ended from the end date on.
    const dayOwn = await request(app)
      .get('/api/v1/calendar/day')
      .query({ date: endDate })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(dayOwn.status, 200);
    assert.strictEqual(dayOwn.body.data.dayStatus, 'classes_ended');

    const daySibling = await request(app)
      .get('/api/v1/calendar/day')
      .query({ date: endDate, sectionId: sectionAId })
      .set('Authorization', `Bearer ${studentAToken}`);
    assert.strictEqual(daySibling.status, 200);
    assert.strictEqual(daySibling.body.data.dayStatus, 'classes_ended');

    // last_class was removed — the API must reject it now.
    const legacy = await request(app)
      .post('/api/v1/overrides')
      .send({ type: 'last_class', date: endDate })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(legacy.status, 400);
  });

  it('blocks declarations that conflict with existing day-level state', async () => {
    // The DL from the previous test is live from +12 calendar days.
    const dlStart = localIsoDate(new Date(Date.now() + 12 * 86400000));
    const afterDl = localIsoDate(new Date(Date.now() + 15 * 86400000));
    const weekly = await request(app)
      .get('/api/v1/routine/weekly')
      .query({ sectionId: sectionBId })
      .set('Authorization', `Bearer ${crToken}`);
    const courseId = weekly.body.data[0].courseId._id;

    // 1. A day off after DL started is meaningless — classes are already over.
    const inDl = await request(app)
      .post('/api/v1/overrides')
      .send({ type: 'auto_day_off', date: afterDl })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(inDl.status, 400, JSON.stringify(inDl.body));
    assert.match(inDl.body.message, /DL has already started/);

    // 2. Scheduling a class after DL started is equally contradictory.
    const extraInDl = await request(app)
      .post('/api/v1/overrides')
      .send({ type: 'extra_class', date: afterDl, courseId, startTime: '16:00', endTime: '17:30' })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(extraInDl.status, 400, JSON.stringify(extraInDl.body));
    assert.match(extraInDl.body.message, /DL has already started/);

    // 3. A mid-break before the DL start, then an overlapping one.
    const mbStart = localIsoDate(new Date(Date.now() + 5 * 86400000));
    const mbEnd = localIsoDate(new Date(Date.now() + 7 * 86400000));
    const mb = await request(app)
      .post('/api/v1/overrides')
      .send({ type: 'mid_break', startDate: mbStart, endDate: mbEnd })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(mb.status, 201, JSON.stringify(mb.body));

    const overlap = await request(app)
      .post('/api/v1/overrides')
      .send({
        type: 'mid_break',
        startDate: mbEnd,
        endDate: localIsoDate(new Date(Date.now() + 9 * 86400000)),
      })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(overlap.status, 400, JSON.stringify(overlap.body));
    assert.match(overlap.body.message, /overlaps an existing mid-break/);

    // 4. A day off inside the mid-break is redundant.
    const insideBreak = localIsoDate(new Date(Date.now() + 6 * 86400000));
    const dayOffInBreak = await request(app)
      .post('/api/v1/overrides')
      .send({ type: 'auto_day_off', date: insideBreak })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(dayOffInBreak.status, 400, JSON.stringify(dayOffInBreak.body));
    assert.match(dayOffInBreak.body.message, /Mid-break/);

    // 5. A class inside the mid-break contradicts "no classes run that day".
    const extraInBreak = await request(app)
      .post('/api/v1/overrides')
      .send({ type: 'extra_class', date: insideBreak, courseId, startTime: '16:00', endTime: '17:30' })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(extraInBreak.status, 400, JSON.stringify(extraInBreak.body));
    assert.match(extraInBreak.body.message, /Mid-break/);

    // 6. A second DL with a different date would leave two live DL marks.
    const secondDl = await request(app)
      .post('/api/v1/overrides')
      .send({ type: 'classes_end', date: localIsoDate(new Date(Date.now() + 30 * 86400000)) })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(secondDl.status, 400, JSON.stringify(secondDl.body));
    assert.match(secondDl.body.message, new RegExp(`DL is already declared from ${dlStart}`));

    // Cleanup: withdraw the mid-break so later tests are unaffected.
    const list = await request(app)
      .get('/api/v1/overrides')
      .set('Authorization', `Bearer ${crToken}`);
    const overrides = Array.isArray(list.body) ? list.body : list.body.data;
    const mbOverride = overrides.find((o) => o.type === 'mid_break' && o.startDate === mbStart);
    assert.ok(mbOverride, 'mid-break should be listed for withdrawal');
    const del = await request(app)
      .delete(`/api/v1/overrides/${mbOverride.id ?? mbOverride._id}`)
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(del.status, 200);
  });

  it('keeps CR exam requests pending until a coordinator approves them', async () => {
    const weekly = await request(app)
      .get('/api/v1/routine/weekly')
      .query({ sectionId: sectionBId })
      .set('Authorization', `Bearer ${crToken}`);
    const courseId = weekly.body.data[0].courseId._id;
    const examDate = localIsoDate(new Date(Date.now() + 14 * 86400000));

    const created = await request(app)
      .post('/api/v1/exams')
      .send({ courseId, sectionId: sectionBId, examType: 'final', examDate, startTime: '10:00', endTime: '12:00' })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(created.status, 201, JSON.stringify(created.body));
    assert.strictEqual(created.body.data.status, 'pending');
    const examId = String(created.body.data._id);

    // An identical resubmit (builder retry after a partial failure) must
    // return the existing exam, not create a second one.
    const identicalRetry = await request(app)
      .post('/api/v1/exams')
      .send({ courseId, sectionId: sectionBId, examType: 'final', examDate, startTime: '10:00', endTime: '12:00' })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(identicalRetry.status, 200, JSON.stringify(identicalRetry.body));
    assert.strictEqual(
      String(identicalRetry.body.data._id),
      examId,
      'the identical resubmit must return the original exam'
    );

    // A second final within 7 days of the first must be rejected.
    const tooClose = new Date(`${examDate}T12:00:00`);
    tooClose.setDate(tooClose.getDate() + 3);
    const closeAttempt = await request(app)
      .post('/api/v1/exams')
      .send({
        courseId,
        sectionId: sectionBId,
        examType: 'final',
        examDate: localIsoDate(tooClose),
        startTime: '10:00',
        endTime: '12:00',
      })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(closeAttempt.status, 400, JSON.stringify(closeAttempt.body));

    // The CR sees their own pending request in the section list.
    const crList = await request(app)
      .get('/api/v1/exams')
      .set('Authorization', `Bearer ${crToken}`);
    assert.ok(
      (crList.body.data?.items ?? []).some((e) => String(e._id) === examId),
      'CR should see their pending exam request'
    );

    // Rejection works and the CR can revise and resubmit (back to pending).
    const rejected = await request(app)
      .put(`/api/v1/exams/${examId}/review`)
      .send({ decision: 'rejected', note: 'Slot clashes with another section' })
      .set('Authorization', `Bearer ${coordinatorToken}`);
    assert.strictEqual(rejected.status, 200);
    assert.strictEqual(rejected.body.data.status, 'rejected');

    const revised = await request(app)
      .put(`/api/v1/exams/${examId}`)
      .send({ startTime: '11:00' })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(revised.status, 200);
    assert.strictEqual(revised.body.data.status, 'pending');

    // Approval publishes the exam and posts to the Updates feed.
    const approved = await request(app)
      .put(`/api/v1/exams/${examId}/review`)
      .send({ decision: 'approved' })
      .set('Authorization', `Bearer ${coordinatorToken}`);
    assert.strictEqual(approved.status, 200);
    assert.strictEqual(approved.body.data.status, 'approved');

    const day = await request(app)
      .get('/api/v1/calendar/day')
      .query({ date: examDate })
      .set('Authorization', `Bearer ${crToken}`);
    assert.ok(
      (day.body.data?.exams ?? []).some((e) => String(e._id ?? e.id) === examId),
      'Approved exam should appear on the calendar day'
    );

    const feed = await request(app)
      .get('/api/v1/updates?limit=20')
      .set('Authorization', `Bearer ${crToken}`);
    assert.ok(
      (feed.body.data?.items ?? []).some((u) => /exam on/.test(u.title ?? '')),
      'Approval should create an Updates post'
    );

    // PUT enforces the same gap rule: moving this exam next to another
    // section final must be rejected, excluding the exam itself.
    const far = new Date(Date.now() + 40 * 86400000);
    const farIso = localIsoDate(far);
    const second = await request(app)
      .post('/api/v1/exams')
      .send({ courseId, sectionId: sectionBId, examType: 'final', examDate: farIso, startTime: '09:00', endTime: '10:00' })
      .set('Authorization', `Bearer ${coordinatorToken}`);
    assert.strictEqual(second.status, 201, JSON.stringify(second.body));

    const near = new Date(`${farIso}T12:00:00`);
    near.setDate(near.getDate() + 3);
    const moveClose = await request(app)
      .put(`/api/v1/exams/${examId}`)
      .send({ examDate: localIsoDate(near) })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(moveClose.status, 400, JSON.stringify(moveClose.body));

    const delSecond = await request(app)
      .delete(`/api/v1/exams/${String(second.body.data._id)}`)
      .set('Authorization', `Bearer ${coordinatorToken}`);
    assert.strictEqual(delSecond.status, 200);
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

    // Section-scoped: a regular make-up lecture must NOT leak to the sibling
    // section of the same batch.
    const siblingDay = await request(app)
      .get('/api/v1/calendar/day')
      .query({ date: dateIso, sectionId: sectionAId })
      .set('Authorization', `Bearer ${studentAToken}`);
    assert.strictEqual(siblingDay.status, 200);
    const leaked = siblingDay.body.data.classes.find(
      (c) => c.status === 'extra' && c.startTime === '16:30'
    );
    assert.ok(!leaked, 'a regular extra class must stay in the CR own section');
  });

  it('lets a CR aim an extra class at the sibling section explicitly', async () => {
    const { dateIso, dayName } = nextTeachingDate(2);
    // A CR can now READ the sibling section's routine to pick a class from it.
    const weekly = await request(app)
      .get('/api/v1/routine/weekly')
      .query({ sectionId: sectionAId })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(weekly.status, 200);
    const lectures = weekly.body.data.filter(
      (e) => e.day === dayName && e.courseId?.code && e.courseId.code !== 'CT'
    );
    assert.ok(lectures.length > 0, `Section A should teach on ${dayName}`);

    const res = await request(app)
      .post('/api/v1/overrides')
      .send({
        type: 'extra_class',
        date: dateIso,
        sectionId: sectionAId,
        courseId: lectures[0].courseId._id,
        startTime: '17:30',
        endTime: '18:20',
        reason: 'Make-up lecture for Section A',
      })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));

    // It lands on the aimed section's calendar…
    const dayA = await request(app)
      .get('/api/v1/calendar/day')
      .query({ date: dateIso, sectionId: sectionAId })
      .set('Authorization', `Bearer ${studentAToken}`);
    assert.strictEqual(dayA.status, 200);
    const onA = dayA.body.data.classes.find(
      (c) => c.status === 'extra' && c.startTime === '17:30'
    );
    assert.ok(onA, 'the aimed extra class should appear on section A');

    // …and NOT on the CR's own section.
    const dayB = await request(app)
      .get('/api/v1/calendar/day')
      .query({ date: dateIso, sectionId: sectionBId })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(dayB.status, 200);
    const onB = dayB.body.data.classes.find(
      (c) => c.status === 'extra' && c.startTime === '17:30'
    );
    assert.ok(!onB, 'the aimed extra class must not appear on the CR own section');

    // The CR's declaration list includes declarations made for the sibling.
    const list = await request(app)
      .get('/api/v1/overrides')
      .set('Authorization', `Bearer ${crToken}`);
    const entries = Array.isArray(list.body) ? list.body : list.body.data;
    assert.ok(
      entries.some(
        (o) =>
          o.type === 'extra_class' &&
          String(o.sectionId?._id ?? o.sectionId) === String(sectionAId)
      ),
      'the CR should see their sibling-section declaration in the list'
    );
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

    // Batch-wide: the same CT must also appear on the sibling section's
    // calendar through its own override copy.
    const siblingDay = await request(app)
      .get('/api/v1/calendar/day')
      .query({ date: ctDateIso, sectionId: sectionAId })
      .set('Authorization', `Bearer ${studentAToken}`);
    assert.strictEqual(siblingDay.status, 200);
    const siblingCt = siblingDay.body.data.classes.find(
      (c) =>
        c.classType === 'ct' &&
        c.status === 'extra' &&
        String(c.courseId?._id || c.courseId) === ctCourseId
    );
    assert.ok(siblingCt, 'a declared CT should also appear on the sibling section calendar');
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
    // …and Section A announcements are not. The CR's own posts are always
    // visible to them (feed rule: everyone sees their own posts), which
    // includes declarations they aimed at the sibling section.
    assert.ok(
      !bItems.some(
        (update) =>
          update.scope === 'section' &&
          sectionIdOfUpdate(update) === sectionAId &&
          String(update.authorId?._id ?? update.authorId) !== crId
      ),
      'Section B CR must not receive Section A announcements from others'
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

    // A CR manages exams for their OWN section — deleting the section-B exam
    // they can see must work, but a section-A exam must stay out of reach.
    const ownDelete = await request(app)
      .delete(`/api/v1/exams/${examId}`)
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(ownDelete.status, 200);

    const sectionAExam = await request(app)
      .post('/api/v1/exams')
      .send({
        courseId,
        sectionId: sectionAId,
        examType: 'final',
        examDate: '2026-12-06',
        startTime: '09:00',
        endTime: '10:00',
      })
      .set('Authorization', `Bearer ${coordinatorToken}`);
    assert.strictEqual(sectionAExam.status, 201, JSON.stringify(sectionAExam.body));

    const crossDelete = await request(app)
      .delete(`/api/v1/exams/${String(sectionAExam.body.data._id)}`)
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(crossDelete.status, 403);

    const removed = await request(app)
      .delete(`/api/v1/exams/${String(sectionAExam.body.data._id)}`)
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

  it('declares a mid-break batch-wide across sibling sections', async () => {
    const mbStart = localIsoDate(new Date(Date.now() + 5 * 86400000));
    const mbEnd = localIsoDate(new Date(Date.now() + 7 * 86400000));
    const res = await request(app)
      .post('/api/v1/overrides')
      .send({ type: 'mid_break', startDate: mbStart, endDate: mbEnd })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(res.status, 201, JSON.stringify(res.body));
    assert.strictEqual(res.body.data.message, 'Declaration submitted');

    // CR sees exactly one own-section copy carrying a groupId.
    const listA = await request(app)
      .get('/api/v1/overrides')
      .set('Authorization', `Bearer ${crToken}`);
    const itemsA = Array.isArray(listA.body) ? listA.body : listA.body.data;
    const copiesA = itemsA.filter((o) => o.type === 'mid_break' && o.startDate === mbStart);
    assert.strictEqual(copiesA.length, 1, 'CR sees exactly one own-section copy');
    assert.ok(copiesA[0].groupId, 'mid-break copy carries a groupId');

    // One batch-scoped feed post, visible to a student of the batch.
    const feed = await request(app)
      .get('/api/v1/updates?limit=50')
      .set('Authorization', `Bearer ${studentAToken}`);
    assert.strictEqual(feed.status, 200);
    const feedItems = feed.body.data?.items ?? [];
    const matching = feedItems.filter(
      (u) => u.sourceOverrideId && u.sourceOverrideId === copiesA[0].id
    );
    assert.strictEqual(matching.length, 1, 'exactly one mid-break feed post');

    // Withdrawing removes every sibling copy and the feed post.
    const del = await request(app)
      .delete(`/api/v1/overrides/${copiesA[0].id}`)
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(del.status, 200);
    const listB = await request(app)
      .get('/api/v1/overrides')
      .set('Authorization', `Bearer ${crToken}`);
    const itemsB = Array.isArray(listB.body) ? listB.body : listB.body.data;
    assert.strictEqual(
      itemsB.filter((o) => o.type === 'mid_break' && o.startDate === mbStart).length,
      0,
      'withdraw removes the batch-wide group'
    );
  });

  it('runs the full weekly routine proposal flow: submit, review, publish', async () => {
    // Manual, period-based entries — the official 9-period day.
    const threeEntries = [
      {
        day: 'Sunday',
        period: 1,
        courseCode: 'CSE-101',
        courseTitle: 'Introduction to Programming',
        teachers: ['Dr. Ada Lovelace', 'Mr. Alan Turing'],
        room: 'R-101',
      },
      {
        day: 'Sunday',
        period: 2,
        courseCode: 'MAT-101',
        courseTitle: 'Linear Algebra',
        teachers: ['Prof. Gauss'],
      },
      {
        day: 'Monday',
        period: 7,
        periodEnd: 8,
        courseCode: 'CSE-102',
        courseTitle: 'Structured Programming Lab',
        teachers: ['Dr. Hopper'],
        classType: 'lab',
      },
    ];

    // 1. CR submits a full weekly routine for coordinator review.
    const submit = await request(app)
      .post('/api/v1/routine-proposals')
      .send({ entries: threeEntries })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(submit.status, 201, JSON.stringify(submit.body));
    assert.strictEqual(submit.body.data.status, 'pending');
    assert.strictEqual(submit.body.data.entryCount, 3);
    const proposalId = submit.body.data.id;

    // 2. Resubmitting replaces the pending proposal instead of duplicating.
    const resubmit = await request(app)
      .post('/api/v1/routine-proposals')
      .send({ entries: [threeEntries[0]] })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(resubmit.status, 201);
    assert.strictEqual(resubmit.body.data.id, proposalId, 'resubmit replaces the pending proposal');

    // 3. CR edits the pending proposal directly.
    const edit = await request(app)
      .put(`/api/v1/routine-proposals/${proposalId}`)
      .send({ entries: threeEntries })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(edit.status, 200, JSON.stringify(edit.body));
    assert.strictEqual(edit.body.data.entryCount, 3);

    // 4. A CR of a sibling section in the SAME batch can view (and manage)
    // the proposal — the CR team builds both sections' routines.
    const sibling = await request(app)
      .get(`/api/v1/routine-proposals/${proposalId}`)
      .set('Authorization', `Bearer ${demoCrToken}`);
    assert.strictEqual(sibling.status, 200, JSON.stringify(sibling.body));
    assert.strictEqual(sibling.body.data.sectionId.id ?? sibling.body.data.sectionId._id, String(sectionBId));

    // 5. Coordinator approves — the routine is published for the section.
    const review = await request(app)
      .put(`/api/v1/routine-proposals/${proposalId}/review`)
      .send({ decision: 'approved' })
      .set('Authorization', `Bearer ${coordinatorToken}`);
    assert.strictEqual(review.status, 200, JSON.stringify(review.body));
    assert.strictEqual(review.body.data.status, 'approved');

    // 6. The published weekly routine now matches the proposal exactly —
    // the 2-period lab becomes one entry per period (4 entries total).
    const weekly = await request(app)
      .get('/api/v1/routine/weekly')
      .query({ sectionId: sectionBId })
      .set('Authorization', `Bearer ${coordinatorToken}`);
    assert.strictEqual(weekly.status, 200);
    const entries = weekly.body.data;
    assert.strictEqual(entries.length, 4, 'routine replaced by the proposal entries');
    const sundayFirst = entries.find((e) => e.day === 'Sunday' && e.period === 1);
    assert.ok(sundayFirst, 'Sunday period 1 entry exists');
    assert.strictEqual(sundayFirst.course.code, 'CSE-101');
    assert.strictEqual(sundayFirst.startTime, '08:10');
    assert.deepStrictEqual(sundayFirst.instructor, ['Dr. Ada Lovelace', 'Mr. Alan Turing']);
    const mondayLab = entries.filter((e) => e.day === 'Monday');
    assert.strictEqual(mondayLab.length, 2, 'the lab spans periods 7 and 8');
    assert.ok(mondayLab.every((e) => e.classType === 'lab'));
    assert.strictEqual(mondayLab[0].startTime, '13:45');
    assert.strictEqual(mondayLab[1].endTime, '15:15');

    // 7. The CR can edit the published routine directly — no coordinator
    // approval needed for follow-up changes.
    const crEdit = await request(app)
      .put(`/api/v1/routine/${sundayFirst.id}`)
      .send({ room: 'R-999', teacherNames: ['Dr. Ada Lovelace', 'Ms. Grace Hopper'] })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(crEdit.status, 200, JSON.stringify(crEdit.body));
    assert.strictEqual(crEdit.body.data.room, 'R-999');
    assert.deepStrictEqual(crEdit.body.data.instructor, [
      'Dr. Ada Lovelace',
      'Ms. Grace Hopper',
    ]);

    // 8. A second proposal can be rejected with a note.
    const second = await request(app)
      .post('/api/v1/routine-proposals')
      .send({
        entries: [
          {
            day: 'Tuesday',
            period: 1,
            courseCode: 'CSE-103',
            courseTitle: 'Discrete Math',
            teachers: ['Prof. Cantor'],
          },
        ],
      })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(second.status, 201);
    const reject = await request(app)
      .put(`/api/v1/routine-proposals/${second.body.data.id}/review`)
      .send({ decision: 'rejected', note: 'Please include the lab sessions too' })
      .set('Authorization', `Bearer ${coordinatorToken}`);
    assert.strictEqual(reject.status, 200);

    // 9. The sibling CR (Section A) can submit a proposal FOR Section B by
    // naming it — same batch, so it is allowed.
    const forSibling = await request(app)
      .post('/api/v1/routine-proposals')
      .send({
        sectionId: sectionBId,
        entries: [
          {
            day: 'Wednesday',
            period: 2,
            courseCode: 'CSE-104',
            courseTitle: 'Sibling Section Check',
            teachers: ['Prof. Sibling'],
          },
        ],
      })
      .set('Authorization', `Bearer ${demoCrToken}`);
    assert.strictEqual(forSibling.status, 201, JSON.stringify(forSibling.body));
    assert.strictEqual(
      String(forSibling.body.data.sectionId.id ?? forSibling.body.data.sectionId._id),
      String(sectionBId),
      'the proposal targets Section B'
    );
    const withdrawSibling = await request(app)
      .delete(`/api/v1/routine-proposals/${forSibling.body.data.id}`)
      .set('Authorization', `Bearer ${demoCrToken}`);
    assert.strictEqual(withdrawSibling.status, 200);
    assert.strictEqual(reject.body.data.status, 'rejected');
    assert.strictEqual(reject.body.data.reviewNote, 'Please include the lab sessions too');

    // 9. An approved proposal cannot be edited again.
    const editApproved = await request(app)
      .put(`/api/v1/routine-proposals/${proposalId}`)
      .send({ entries: [] })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(editApproved.status, 400);

    // 10. A class can never span the Break (P3→P4) or Lunch (P6→P7) gaps.
    const spanBreak = await request(app)
      .post('/api/v1/routine-proposals')
      .send({
        entries: [
          {
            day: 'Wednesday',
            period: 3,
            periodEnd: 4,
            courseCode: 'CSE-104',
            courseTitle: 'Operating Systems',
            teachers: ['Prof. Tanenbaum'],
          },
        ],
      })
      .set('Authorization', `Bearer ${crToken}`);
    assert.strictEqual(spanBreak.status, 400, JSON.stringify(spanBreak.body));
    assert.match(spanBreak.body.message, /cannot span Break or Lunch/);
  });
});
