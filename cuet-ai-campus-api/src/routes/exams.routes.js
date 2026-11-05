import express from 'express';
import { protect, requireCr } from '../middleware/auth.js';
import { Exam, Section } from '../models/index.js';
import { EXAM_TYPES } from '../constants.js';
import { AppError, asyncHandler, sendData } from '../utils/http.js';
import { assertSectionInCoordinatorScope, idOf, sameId } from '../services/access.js';

const isStaff = (user) =>
  Boolean(user?.roles?.includes('coordinator') || user?.roles?.includes('admin'));

async function assertCanManageExamSection(user, sectionId) {
  if (user?.roles?.includes('cr') && !isStaff(user)) {
    if (!sameId(user.sectionId, sectionId)) {
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

    if (
      req.user.roles.includes('student') &&
      !req.user.roles.includes('coordinator') &&
      !req.user.roles.includes('admin')
    ) {
      filter.sectionId = req.user.sectionId;
    } else if (req.query.sectionId) {
      filter.sectionId = req.query.sectionId;
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

    // Students may only read exams for their own section.
    if (!isStaff(req.user) && idOf(exam.sectionId) !== idOf(req.user.sectionId)) {
      throw new AppError(403, 'You can only view exams for your own section');
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
    await exam.save();
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
