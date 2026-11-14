import express from 'express';
import { protect, requireCr } from '../middleware/auth.js';
import { Exam, Section, Update } from '../models/index.js';
import { EXAM_TYPES } from '../constants.js';
import { AppError, asyncHandler, sendData } from '../utils/http.js';
import { assertSectionInCoordinatorScope, idOf, sameId } from '../services/access.js';

const isStaff = (user) =>
  Boolean(user?.roles?.includes('coordinator') || user?.roles?.includes('admin'));

/** Minimum gap in days between two final exams of the same section. */
const EXAM_MIN_GAP_DAYS = 7;

/** Shift a YYYY-MM-DD date by N days, staying in ISO format. */
function shiftIsoDate(iso, days) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function assertCanManageExamSection(user, sectionId) {
  if (user?.roles?.includes('cr') && !isStaff(user)) {
    // user.sectionId is a populated Section document — compare ids, not
    // stringified objects (String(document) is "[object Object]").
    if (!sameId(idOf(user.sectionId), idOf(sectionId))) {
      throw new AppError(403, 'CRs can only manage exams for their own section');
    }
    return Section.findById(sectionId);
  }
  return assertSectionInCoordinatorScope(user, sectionId);
}

const router = express.Router();
router.use(protect);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.type) filter.examType = String(req.query.type).toLowerCase();
    if (req.query.courseId) filter.courseId = req.query.courseId;

    // Staff see exams across their scope; CRs see their section including
    // their own pending requests; students only see approved exams.
    if (isStaff(req.user)) {
      if (req.query.sectionId) filter.sectionId = req.query.sectionId;
    } else if (req.user.roles.includes('cr')) {
      // req.user.sectionId is a populated document — always filter by its id.
      filter.sectionId = idOf(req.user.sectionId);
    } else {
      filter.sectionId = idOf(req.user.sectionId);
      filter.status = 'approved';
    }

    const [items, total] = await Promise.all([
      Exam.find(filter)
        .populate('courseId', 'code title credits')
        .populate('sectionId', 'name label')
        .sort({ examDate: 1, startTime: 1 })
        .skip(skip)
        .limit(limit),
      Exam.countDocuments(filter),
    ]);

    sendData(res, { items: items.map((e) => e.toObject({ virtuals: true })), page, limit, total });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const exam = await Exam.findById(req.params.id)
      .populate('courseId', 'code title credits')
      .populate('sectionId', 'name label');
    if (!exam) throw new AppError(404, 'Exam not found');

    // Students may only read approved exams for their own section.
    if (!isStaff(req.user) && idOf(exam.sectionId) !== idOf(req.user.sectionId)) {
      throw new AppError(403, 'You can only view exams for your own section');
    }
    if (
      !isStaff(req.user) &&
      !req.user.roles.includes('cr') &&
      exam.status !== 'approved'
    ) {
      throw new AppError(404, 'Exam not found');
    }
    sendData(res, exam);
  })
);

router.post(
  '/',
  requireCr,
  asyncHandler(async (req, res) => {
    const body = req.body;
    if (!body.courseId || !body.sectionId || !body.examDate || !body.startTime || !body.endTime) {
      throw new AppError(400, 'courseId, sectionId, examDate, startTime, and endTime are required');
    }
    const examType = String(body.examType || 'final').trim().toLowerCase();
    if (!EXAM_TYPES.includes(examType)) {
      throw new AppError(400, `examType must be one of: ${EXAM_TYPES.join(', ')}`);
    }
    await assertCanManageExamSection(req.user, body.sectionId);
    // Idempotent: a client retry (e.g. the routine builder resubmitting after
    // a partial failure) must not create a second identical exam slot.
    const identical = await Exam.findOne({
      sectionId: body.sectionId,
      courseId: body.courseId,
      examType,
      examDate: body.examDate,
      startTime: body.startTime,
      endTime: body.endTime,
      status: { $ne: 'rejected' },
    })
      .populate('courseId', 'code title credits')
      .populate('sectionId', 'name label');
    if (identical) {
      return sendData(res, identical, 200);
    }
    // Academic rule: two final exams of a section must be at least 7 days
    // apart (e.g. the 14th and then the 21st or later).
    if (examType === 'final') {
      const clash = await Exam.findOne({
        sectionId: body.sectionId,
        examType: 'final',
        status: { $ne: 'rejected' },
        examDate: {
          $gte: shiftIsoDate(body.examDate, -(EXAM_MIN_GAP_DAYS - 1)),
          $lte: shiftIsoDate(body.examDate, EXAM_MIN_GAP_DAYS - 1),
        },
      }).populate('courseId', 'code title');
      if (clash) {
        throw new AppError(
          400,
          `Final exams must be at least ${EXAM_MIN_GAP_DAYS} days apart — ${clash.courseId?.code ?? 'another exam'} is on ${clash.examDate}`
        );
      }
    }
    // CR-submitted exams need coordinator approval before they appear on
    // calendars; coordinators/admins publish directly.
    const crSubmission = !isStaff(req.user);
    const exam = new Exam({
      sectionId: body.sectionId,
      courseId: body.courseId,
      examType,
      examDate: body.examDate,
      startTime: body.startTime,
      endTime: body.endTime,
      room: body.room || null,
      venue: body.venue || null,
      createdBy: req.user._id,
      status: crSubmission ? 'pending' : 'approved',
      ...(crSubmission
        ? {}
        : { reviewedBy: req.user._id, reviewedAt: new Date() }),
    });
    await exam.save();
    sendData(res, exam, 201);
  })
);

router.put(
  '/:id',
  requireCr,
  asyncHandler(async (req, res) => {
    const exam = await Exam.findById(req.params.id);
    if (!exam) throw new AppError(404, 'Exam not found');
    await assertCanManageExamSection(req.user, exam.sectionId);
    if (req.body.sectionId && idOf(req.body.sectionId) !== idOf(exam.sectionId)) {
      await assertCanManageExamSection(req.user, req.body.sectionId);
    }

    const allowed = [
      'courseId',
      'sectionId',
      'examType',
      'examDate',
      'startTime',
      'endTime',
      'room',
      'venue',
    ];
    if (req.body.examType !== undefined) {
      const examType = String(req.body.examType).trim().toLowerCase();
      if (!EXAM_TYPES.includes(examType)) {
        throw new AppError(400, `examType must be one of: ${EXAM_TYPES.join(', ')}`);
      }
      req.body.examType = examType;
    }
    for (const field of allowed) {
      if (req.body[field] !== undefined) exam[field] = req.body[field];
    }
    // Academic rule: two final exams of a section must be at least 7 days
    // apart. Checked after fields are applied, excluding this exam itself.
    if (exam.examType === 'final') {
      const clash = await Exam.findOne({
        _id: { $ne: exam._id },
        sectionId: exam.sectionId,
        examType: 'final',
        status: { $ne: 'rejected' },
        examDate: {
          $gte: shiftIsoDate(exam.examDate, -(EXAM_MIN_GAP_DAYS - 1)),
          $lte: shiftIsoDate(exam.examDate, EXAM_MIN_GAP_DAYS - 1),
        },
      }).populate('courseId', 'code title');
      if (clash) {
        throw new AppError(
          400,
          `Final exams must be at least ${EXAM_MIN_GAP_DAYS} days apart — ${clash.courseId?.code ?? 'another exam'} is on ${clash.examDate}`
        );
      }
    }
    // A CR editing an approved or rejected exam changes the request — send
    // it back to the coordinator for (re-)approval.
    if (!isStaff(req.user) && exam.status !== 'pending') {
      exam.status = 'pending';
      exam.reviewedBy = null;
      exam.reviewedAt = null;
      exam.reviewNote = null;
    }
    await exam.save();
    sendData(res, exam);
  })
);

router.put(
  '/:id/review',
  asyncHandler(async (req, res) => {
    if (!isStaff(req.user)) {
      throw new AppError(403, 'Only coordinators can review exam requests');
    }
    const decision = String(req.body.decision || '').toLowerCase();
    if (!['approved', 'rejected'].includes(decision)) {
      throw new AppError(400, 'decision must be approved or rejected');
    }
    const exam = await Exam.findById(req.params.id)
      .populate('courseId', 'code title credits')
      .populate('sectionId', 'name label batchId');
    if (!exam) throw new AppError(404, 'Exam not found');
    await assertSectionInCoordinatorScope(req.user, exam.sectionId?._id || exam.sectionId);

    exam.status = decision;
    exam.reviewedBy = req.user._id;
    exam.reviewedAt = new Date();
    exam.reviewNote = req.body.note ? String(req.body.note).trim() : null;
    await exam.save();

    // Approval announces the exam to the section's Updates feed.
    if (decision === 'approved') {
      const code = exam.courseId?.code || 'Course';
      const title = exam.courseId?.title || '';
      const section = await Section.findById(idOf(exam.sectionId?._id || exam.sectionId)).select('batchId');
      const batchId = idOf(section?.batchId) || idOf(req.user.batchId);
      try {
        await Update.create({
          authorId: req.user._id,
          sectionId: idOf(exam.sectionId?._id || exam.sectionId),
          batchId: batchId || null,
          courseId: exam.courseId?._id || exam.courseId || null,
          type: 'exam_reminder',
          title: `${code} ${exam.examType} exam on ${exam.examDate}`,
          description: `${exam.startTime}–${exam.endTime}${exam.room ? ` · Room ${exam.room}` : ''}${title ? ` · ${title}` : ''}`,
          priority: 'important',
          scope: 'section',
          departmentCode: String(req.user.departmentId?.code || '').toUpperCase() || null,
          status: 'approved',
        });
      } catch {
        /* feed post is best-effort; the exam itself is saved */
      }
    }

    sendData(res, exam);
  })
);

router.delete(
  '/:id',
  requireCr,
  asyncHandler(async (req, res) => {
    const exam = await Exam.findById(req.params.id);
    if (!exam) throw new AppError(404, 'Exam not found');
    await assertCanManageExamSection(req.user, exam.sectionId);
    await Exam.findByIdAndDelete(req.params.id);
    sendData(res, { message: 'Exam deleted' });
  })
);

export default router;
