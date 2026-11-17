import express from 'express';
import { isCoordinator, protect } from '../middleware/auth.js';
import { AppError, asyncHandler, sendData } from '../utils/http.js';
import { env } from '../config/env.js';
import { Batch, Exam, RoutineEntry, Section, User } from '../models/index.js';
import { routinePopulate, serializeRoutineEntry } from '../services/routineSerializer.js';
import { serializeExam } from '../services/routineSerializer.js';
import { listUpdates } from '../services/updates.js';
import { idOf } from '../services/access.js';

const router = express.Router();
router.use(protect);

/**
 * AI context scope (read-only). Coordinators see their whole department —
 * every batch and section; students and CRs see their own batch.
 */
async function assistantSectionScope(user) {
  if (isCoordinator(user)) {
    const departmentId = idOf(user.departmentId);
    const ownBatchId = idOf(user.batchId);
    const batches = departmentId
      ? await Batch.find({ departmentId }).select('_id batchNumber').lean()
      : [];
    const batchIds = [
      ...new Set([...batches.map((batch) => String(batch._id)), ownBatchId].filter(Boolean)),
    ];
    if (batchIds.length === 0) {
      return { sections: [], batchNumberById: new Map(), batchIds: [] };
    }
    const sections = await Section.find({ batchId: { $in: batchIds } })
      .select('_id name label batchId')
      .populate('batchId', 'batchNumber')
      .sort({ batchId: 1, name: 1 });
    const batchNumberById = new Map(
      sections.map((section) => [String(section._id), section.batchId?.batchNumber ?? null])
    );
    return { sections, batchNumberById, batchIds };
  }

  const batchId = idOf(user.batchId);
  if (!batchId) return { sections: [], batchNumberById: new Map(), batchIds: [] };
  const sections = await Section.find({ batchId }).select('_id name label').sort({ name: 1 });
  return { sections, batchNumberById: new Map(), batchIds: [batchId] };
}

/**
 * Builds the read-only assistant context. The assistant never writes — this
 * only assembles what it may read for its answers.
 */
async function buildAssistantContext(user) {
  const { sections, batchNumberById } = await assistantSectionScope(user);
  if (sections.length === 0) return null;

  const coordinator = isCoordinator(user);
  const sectionIds = sections.map((section) => section._id);
  const ownSectionId = idOf(user.sectionId);
  const examSectionIds = coordinator ? sectionIds : [...new Set([ownSectionId].filter(Boolean))];

  const [routineRows, exams, updates, users] = await Promise.all([
    RoutineEntry.find({ sectionId: { $in: sectionIds } })
      .populate(routinePopulate)
      .sort({ sectionId: 1, day: 1, period: 1 }),
    examSectionIds.length
      ? Exam.find({ sectionId: { $in: examSectionIds } })
          .populate('courseId', 'code title')
          .sort({ examDate: 1, startTime: 1 })
      : Promise.resolve([]),
    listUpdates({ page: 1, limit: 100 }, user),
    User.find({ sectionId: { $in: sectionIds } })
      .select('roles lastLoginAt isActive sectionId')
      .lean(),
  ]);

  const sectionNameById = new Map(sections.map((section) => [String(section._id), section.name]));
  const routine = routineRows.map((entry) => {
    const serialized = {
      ...serializeRoutineEntry(entry),
      sectionName: sectionNameById.get(String(entry.sectionId)) || '',
    };
    const batchNumber = batchNumberById.get(String(entry.sectionId));
    if (coordinator && batchNumber != null) serialized.batchNumber = batchNumber;
    return serialized;
  });
  const serializedExams = exams.map(serializeExam);

  // Conflicts are per section: two sections sharing a slot is normal in a
  // department view — only clashes inside one section (or with its exam) count.
  const conflicts = [];
  if (coordinator) {
    const rowsBySection = new Map();
    for (const entry of routine) {
      const key = String(entry.sectionId ?? '');
      if (!rowsBySection.has(key)) rowsBySection.set(key, []);
      rowsBySection.get(key).push(entry);
    }
    for (const [key, rows] of rowsBySection) {
      const sectionExams = serializedExams.filter(
        (exam) => String(exam.sectionId?._id ?? exam.sectionId) === key
      );
      conflicts.push(...detectConflicts(rows, sectionExams));
    }
  } else {
    const ownRoutine = routine.filter((entry) => String(entry.sectionId) === ownSectionId);
    conflicts.push(...detectConflicts(ownRoutine, serializedExams));
  }

  const stats = buildUserStats(users, sections, batchNumberById, coordinator);

  const text = buildContextText({
    routine,
    updates: updates.items,
    exams: serializedExams,
    conflicts,
    users: stats.bySection,
    departmentWide: coordinator,
  });

  return {
    batchNumber: user.batchId?.batchNumber ?? null,
    section: sectionNameById.get(ownSectionId) || null,
    departmentWide: coordinator,
    sectionCount: sections.length,
    stats,
    routine,
    updates: updates.items,
    exams: serializedExams,
    conflicts,
    text,
  };
}

/**
 * Read-only people stats for the assistant. CRs are counted separately (they
 * are also students), "loggedIn" counts accounts that have signed in at least
 * once (lastLoginAt set).
 */
function buildUserStats(users, sections, batchNumberById, coordinator) {
  const bySection = sections.map((section) => {
    const key = String(section._id);
    const members = users.filter((u) => String(u.sectionId) === key);
    const students = members.filter((u) => u.roles?.includes('student'));
    const crs = members.filter((u) => u.roles?.includes('cr'));
    const loggedIn = members.filter(
      (u) => u.lastLoginAt != null && u.roles?.includes('student')
    );
    return {
      sectionId: key,
      sectionName: section.name,
      batchNumber: coordinator ? (batchNumberById.get(key) ?? null) : null,
      students: students.length,
      cr: crs.length,
      loggedIn: loggedIn.length,
    };
  });
  return {
    totalStudents: bySection.reduce((sum, s) => sum + s.students, 0),
    totalCr: bySection.reduce((sum, s) => sum + s.cr, 0),
    loggedIn: bySection.reduce((sum, s) => sum + s.loggedIn, 0),
    totalAccounts: users.length,
    bySection,
  };
}

router.get(
  '/context',
  asyncHandler(async (req, res) => {
    const context = await buildAssistantContext(req.user);
    if (!context) {
      throw new AppError(400, 'Complete your academic profile to use the campus assistant');
    }
    sendData(res, context);
  })
);

router.post(
  '/chat',
  asyncHandler(async (req, res) => {
    const { message, history } = req.body || {};
    if (!message || !String(message).trim()) {
      throw new AppError(400, 'message is required');
    }

    let context = null;
    try {
      context = await buildAssistantContext(req.user);
    } catch {
      context = null;
    }

    const reply =
      (await generateChatReply({ message, history, user: req.user, headers: req.headers, context })) ||
      deterministicReply(message, req.user, context);
    sendData(res, { reply });
  })
);

router.get(
  '/suggestions',
  asyncHandler(async (_req, res) => {
    sendData(res, {
      suggestions: [
        {
          id: 'attend-next-class',
          title: 'Attend your next class',
          body: 'Check today’s routine and head to the assigned room on time.',
        },
        {
          id: 'review-attendance',
          title: 'Review your attendance',
          body: "Keep your attendance above 85% to stay eligible for exams.",
        },
        {
          id: 'check-assignments',
          title: 'Check upcoming assignments',
          body: 'Finish assignments before their deadlines to avoid last-minute stress.',
        },
      ],
    });
  })
);

router.post(
  '/study-plan',
  asyncHandler(async (_req, res) => {
    sendData(res, {
      plan: [
        { day: 'Today', focus: 'Review today’s class topics and complete pending assignments' },
        { day: 'Tomorrow', focus: 'Prepare for tomorrow’s routine and any scheduled exam' },
        { day: 'This week', focus: 'Catch up on overdue readings and lab work' },
      ],
    });
  })
);

router.post(
  '/workload',
  asyncHandler(async (_req, res) => {
    sendData(res, {
      totalAssignments: 0,
      overdueAssignments: 0,
      upcomingExams: 0,
      estimatedHoursPerWeek: 15,
      note: 'Connect real schedule data for personalized workload estimates.',
    });
  })
);

const TEACHING_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

function minutesOf(value) {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value || ''));
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/**
 * Finds the next class for the deterministic assistant: the first class still
 * running/upcoming today, otherwise the first class of the next teaching day.
 */
function nextClassEntry(routine) {
  const own = (routine || []).filter((entry) => entry.day && !entry.isBreak);
  if (own.length === 0) return null;

  const now = new Date();
  const todayName = now.toLocaleDateString('en-US', { weekday: 'long', timeZone: env.timeZone });
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const todayEntries = own
    .filter((entry) => String(entry.day).toLowerCase() === todayName.toLowerCase())
    .sort((a, b) => (minutesOf(a.startTime) ?? 0) - (minutesOf(b.startTime) ?? 0));
  const upcoming = todayEntries.find((entry) => {
    const end = minutesOf(entry.endTime);
    return end == null || end > nowMinutes;
  });
  if (upcoming) return upcoming;

  const startIndex = TEACHING_DAYS.indexOf(todayName);
  for (let offset = 1; offset <= TEACHING_DAYS.length; offset += 1) {
    const dayName = TEACHING_DAYS[(Math.max(startIndex, 0) + offset) % TEACHING_DAYS.length];
    const first = own
      .filter((entry) => String(entry.day).toLowerCase() === dayName.toLowerCase())
      .sort((a, b) => (minutesOf(a.startTime) ?? 0) - (minutesOf(b.startTime) ?? 0))[0];
    if (first) return first;
  }
  return null;
}

function deterministicReply(message, user, context = null) {
  const text = String(message || '').toLowerCase();
  const name = user?.name || 'there';

  // Identity questions first, so they are never swallowed by topic branches.
  if (/who are you|what are you|your name|introduce yourself|about yourself/.test(text)) {
    return [
      `Hi **${name}**! I'm the **CUET AI Campus assistant** — the built-in helper of this app.`,
      '',
      'I answer from your real campus data (read-only). Try asking about:',
      '- **Routine** — *"Show me my Monday schedule"*',
      '- **Next class** — *"What is my next class?"*',
      '- **Exams** — *"When is my next exam?"*',
      '- **Notices** — *"Any new notices?"*',
      ...(isCoordinator(user)
        ? [
            '',
            'As a **coordinator**, I can see the schedule and exams of every section and batch in your department.',
          ]
        : []),
    ].join('\n');
  }

  // Conflict/problem questions — tolerate common typos ("confict", "conflct").
  const asksAboutProblems =
    /(conflic|conflc|confic|clash|overlap|collision)/.test(text) ||
    (/(routine|schedule|timetable|class(es)?)/.test(text) &&
      /(problem|issue|wrong|mistake|error|mismatch|confuse)/.test(text));
  if (asksAboutProblems) {
    if (context?.conflicts?.length) {
      return [
        `I found **${context.conflicts.length} schedule conflict${context.conflicts.length === 1 ? '' : 's'}** in your routine:`,
        '',
        ...context.conflicts.map((conflict) => `- ${conflict.description}`),
        '',
        'Open **Routine → Conflicts** to review them in detail.',
      ].join('\n');
    }
    return (
      "I checked your routine — **no schedule conflicts** were found. Classes don't overlap " +
      'and no exam clashes with a class. Ask me about a specific day for the full timetable.'
    );
  }

  // People/stats questions: "total student?", "how many students logged in?"
  const asksPeople =
    /(how many|total|count|number of|strength|list)/.test(text) &&
    /(student|user|account|login|logged|sign(ed)? in|people|classmate|cr\b)/.test(text);
  if (asksPeople && context?.stats) {
    const stats = context.stats;
    if (/login|logged|sign(ed)? in/.test(text)) {
      const lines = stats.bySection.map(
        (s) =>
          `- Section ${s.sectionName}${s.batchNumber != null ? ` (batch ${s.batchNumber})` : ''}: **${s.loggedIn} of ${s.students}** logged in`
      );
      return [
        `**${stats.loggedIn} of ${stats.totalStudents}** student accounts have logged in at least once.`,
        '',
        ...lines,
      ].join('\n');
    }
    const lines = stats.bySection.map(
      (s) =>
        `- Section ${s.sectionName}${s.batchNumber != null ? ` (batch ${s.batchNumber})` : ''}: **${s.students}** ${s.students === 1 ? 'student' : 'students'}${s.cr ? ` (incl. ${s.cr} CR)` : ''}`
    );
    return [
      `There are **${stats.totalStudents} student${stats.totalStudents === 1 ? '' : 's'}**${
        stats.totalCr ? ` (${stats.totalCr} of them CR${stats.totalCr === 1 ? '' : 's'})` : ''
      } across ${stats.bySection.length} section${stats.bySection.length === 1 ? '' : 's'}.`,
      '',
      ...lines,
    ].join('\n');
  }

  // Exams — word boundaries so "ct" no longer matches inside words like "conflict".
  if (context?.exams?.length && /\b(exam|exams|test|quiz|ct|midterm|final|assessment)\b/.test(text)) {
    return [
      '### Your upcoming exams',
      '',
      '| Course | Type | Date | Time | Room |',
      '| --- | --- | --- | --- | --- |',
      ...context.exams.map(
        (exam) =>
          `| ${exam.course?.code || exam.courseId} | ${exam.examType || 'exam'} | ${exam.examDate} | ${exam.startTime}–${exam.endTime} | ${exam.room || '—'} |`
      ),
    ].join('\n');
  }
  if (context?.updates?.length && /notice|announcement|update/.test(text)) {
    if (/last|latest|most recent/.test(text)) {
      const latest = context.updates[0];
      return ['### Latest notice', '', `**${latest.title}**`, '', latest.description || ''].join(
        '\n'
      );
    }
    return [
      '### Latest notices',
      '',
      ...context.updates
        .slice(0, 10)
        .map((update) => `- **${update.title}** — ${update.description}`),
    ].join('\n');
  }
  const requestedDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'].find((day) =>
    text.includes(day)
  );
  if (requestedDay && /routine|schedule|class|timetable/.test(text)) {
    const sectionName = String(user.sectionId?.name || user.sectionId?.label || '');
    const entries = context?.routine?.filter(
      (entry) =>
        entry.sectionName === sectionName &&
        String(entry.day || '').toLowerCase() === requestedDay
    );
    const dayLabel = `${requestedDay[0].toUpperCase()}${requestedDay.slice(1)}`;
    if (entries?.length) {
      return [
        `### ${dayLabel} routine — Section ${sectionName}`,
        '',
        '| Time | Course | Room |',
        '| --- | --- | --- |',
        ...entries.map(
          (entry) =>
            `| ${entry.startTime}–${entry.endTime} | ${entry.course?.code || entry.courseId} | ${entry.room || '—'} |`
        ),
      ].join('\n');
    }
    return `No routine entries were found for **${dayLabel}** in your section.`;
  }
  if (/next class/.test(text)) {
    const next = nextClassEntry(context?.routine?.filter((entry) => entry.sectionName === String(user.sectionId?.name || user.sectionId?.label || '')));
    if (next) {
      const code = next.course?.code || next.courseId;
      const isToday = String(next.day).toLowerCase() === new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: env.timeZone }).toLowerCase();
      return [
        `Hi **${name}**, here is what your routine shows:`,
        '',
        `- **${code}** at **${next.startTime}–${next.endTime}**${next.room ? ` in ${next.room}` : ''} (${isToday ? 'today' : `next ${next.day}`})`,
        '',
        'Open the **Calendar** for the full date-aware schedule.',
      ].join('\n');
    }
    return `Hi **${name}**, I could not find a class in your current routine.`;
  }
  if (/attendance/.test(text)) {
    return [
      `Hi **${name}**! To check your attendance:`,
      '',
      '1. Open the **Attendance** page from the bottom navigation.',
      '2. Your overall percentage and per-course breakdown appear at the top.',
      `3. Aim to stay **above 85%** to remain eligible for exams.`,
    ].join('\n');
  }
  if (/exam/.test(text)) {
    return [
      `Hi **${name}**! Your exams appear in two places:`,
      '',
      '- **Calendar** — exam days are marked on the month grid.',
      '- **Exams page** — the full list with dates, times and rooms.',
      '',
      'Ask me *"when is my next exam?"* and I will list them here.',
    ].join('\n');
  }
  if (/assign/.test(text)) {
    return [
      `Hi **${name}**! Open the **Assignments** page to see deadlines and mark work as complete.`,
      '',
      'The **Home screen** also counts how many assignments are due within the next 7 days.',
    ].join('\n');
  }
  if (/hello|hi|hey/.test(text)) {
    return [
      `Hi **${name}**! I'm your campus assistant. I can help with:`,
      '',
      '- **Next class** — *"What is my next class?"*',
      '- **Routine** — *"Show me my Monday schedule"*',
      '- **Exams** — *"When is my next exam?"*',
      '- **Notices** — *"Any new notices?"*',
    ].join('\n');
  }

  return [
    `Hi **${name}**! I received your message, but right now I can only answer from your campus data. Try asking about:`,
    '',
    '- Your **next class** or weekly routine',
    '- **Attendance** status',
    '- Upcoming **exams**',
    '- **Assignments** and deadlines',
  ].join('\n');
}

function buildContextText({ routine, updates, exams, conflicts, users = [], departmentWide = false }) {
  const sectionLabel = (entry) =>
    `Section ${entry.sectionName}${departmentWide && entry.batchNumber != null ? ` (batch ${entry.batchNumber})` : ''}`;
  const routineText = routine
    .map(
      (entry) =>
        `${sectionLabel(entry)}: ${entry.day} P${entry.period} ${entry.course?.code || entry.courseId} ${entry.startTime}-${entry.endTime}${entry.room ? ` @${entry.room}` : ''}`
    )
    .join('\n');
  const noticesText = updates
    .map((update) => `${update.title}: ${update.description}`)
    .join('\n');
  const examsText = exams
    .map(
      (exam) =>
        `${exam.course?.code || exam.courseId} ${exam.examType} on ${exam.examDate} ${exam.startTime}-${exam.endTime}${exam.room ? ` @${exam.room}` : ''}`
    )
    .join('\n');
  const conflictsText = conflicts.map((conflict) => conflict.description).join('\n');
  const usersText = users
    .map((section) => {
      const label = `Section ${section.sectionName}${departmentWide && section.batchNumber != null ? ` (batch ${section.batchNumber})` : ''}`;
      return `${label}: ${section.students} student${section.students === 1 ? '' : 's'}, ${section.cr} CR, ${section.loggedIn} logged in`;
    })
    .join('\n');
  const totals = {
    students: users.reduce((sum, s) => sum + s.students, 0),
    crs: users.reduce((sum, s) => sum + s.cr, 0),
    loggedIn: users.reduce((sum, s) => sum + s.loggedIn, 0),
  };
  return [
    'ROUTINE:',
    routineText || 'No routine entries found.',
    'NOTICES:',
    noticesText || 'No notices found.',
    'EXAMS:',
    examsText || 'No exams found.',
    'CONFLICTS:',
    conflictsText || 'No conflicts found.',
    'STUDENTS:',
    usersText || 'No student accounts found.',
    `TOTAL: ${totals.students} students, ${totals.crs} CRs, ${totals.loggedIn} have logged in.`,
  ].join('\n');
}

function detectConflicts(routine, exams) {
  const conflicts = [];
  const byDay = new Map();
  for (const entry of routine) {
    if (!entry.day || entry.isBreak) continue;
    const entries = byDay.get(entry.day) || [];
    for (const other of entries) {
      if (overlaps(entry.startTime, entry.endTime, other.startTime, other.endTime)) {
        conflicts.push({
          type: 'time_overlap',
          description: `${entry.course?.code || entry.courseId} and ${other.course?.code || other.courseId} overlap on ${entry.day}`,
        });
      }
    }
    entries.push(entry);
    byDay.set(entry.day, entries);
  }
  for (const exam of exams) {
    const day = new Date(`${exam.examDate}T00:00:00`).toLocaleDateString('en-US', {
      weekday: 'long',
      timeZone: env.timeZone,
    });
    for (const entry of routine) {
      if (entry.day === day && overlaps(exam.startTime, exam.endTime, entry.startTime, entry.endTime)) {
        conflicts.push({
          type: 'exam_conflict',
          description: `${exam.course?.code || exam.courseId} exam overlaps ${entry.course?.code || entry.courseId} on ${exam.examDate}`,
        });
      }
    }
  }
  return conflicts;
}

function overlaps(startA, endA, startB, endB) {
  const toMinutes = (value) => {
    const match = /^(\d{1,2}):(\d{2})/.exec(String(value || ''));
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  };
  const a = [toMinutes(startA), toMinutes(endA)];
  const b = [toMinutes(startB), toMinutes(endB)];
  return (
    a[0] != null &&
    a[1] != null &&
    b[0] != null &&
    b[1] != null &&
    a[0] < b[1] &&
    b[0] < a[1]
  );
}

/**
 * Optional LLM-backed reply. The frontend forwards a per-user Gemini key via
 * the `x-gemini-api-key` header (fallback: server env). Uses the OpenAI chat
 * completions wire format, which Gemini also exposes
 * (https://generativelanguage.googleapis.com/v1beta/openai/). Falls back to the
 * deterministic campus assistant reply when no key is configured or the call
 * fails.
 */
async function generateChatReply({ message, history, user, headers, context }) {
  const headerKey = String(headers?.['x-gemini-api-key'] ?? '');
  const openAiKey = String(headers?.['x-openai-api-key'] ?? '');
  const key = (headerKey || openAiKey || String(env.geminiApiKey || '')).trim();
  if (!key) return null;

  const baseUrl = String(env.openaiBaseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const model = String(env.openaiModel || 'gpt-4o-mini');
  const systemPrompt = [
    'You are the CUET AI Campus assistant. Answer student questions about their class',
    'schedule, attendance, exams, assignments, and notices using only the context they',
    'provide. Keep replies short and helpful. Batch numbers are numeric cohort codes such as 22, not years.',
    ...(isCoordinator(user)
      ? [
          'You are assisting a department COORDINATOR. The context covers every section and',
          'batch in their whole department (read-only overview). When answering about a',
          'section, mention its section name and batch number. You can only read and report',
          'this data — never claim to have changed or created anything.',
        ]
      : []),
    'Formatting rules (follow them exactly):',
    '- Reply in clean Markdown that renders in a chat bubble.',
    '- Start with one short direct answer sentence.',
    '- Use ### headings, **bold labels** and bullet lists to organise details.',
    '- When listing classes, exams or notices, prefer a Markdown table',
    '  (columns: Course | Day/Date | Time | Room).',
    '- Keep replies under ~180 words. Never dump raw unstructured text.',
    'If asked who you are, what your name is, or which model powers you, always answer as',
    'the CUET AI Campus assistant — the built-in helper of this app that answers from the',
    'campus data provided. Never reveal or confirm the underlying model or vendor behind you.',
    context?.text || '',
  ].join('\n');

  const messages = [{ role: 'system', content: systemPrompt }];
  if (Array.isArray(history)) {
    for (const turn of history) {
      if (!turn) continue;
      if (typeof turn === 'string') {
        messages.push({ role: 'user', content: turn });
      } else if (turn.role && turn.content) {
        messages.push({ role: turn.role, content: turn.content });
      }
    }
  }
  messages.push({ role: 'user', content: String(message) });

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ model, messages, temperature: 0.3 }),
    });
    if (!response.ok) return null;
    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content === 'string' && content.trim()) return content.trim();
  } catch {
    // Network/API failures fall through to the deterministic assistant.
  }
  return null;
}

export default router;
