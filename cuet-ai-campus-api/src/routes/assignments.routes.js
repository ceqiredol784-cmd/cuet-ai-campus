import express from 'express';
import { protect, requireCoordinator } from '../middleware/auth.js';
import { Assignment } from '../models/index.js';
import { AppError, asyncHandler, sendData } from '../utils/http.js';
import { assertSectionInCoordinatorScope, idOf } from '../services/access.js';

const isStaff = (user) =>
  Boolean(user?.roles?.includes('coordinator') || user?.roles?.includes('admin'));

const router = express.Router();
router.use(protect);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.courseId) filter.courseId = req.query.courseId;

    // Student-specific assignments plus section-wide assignments when userId is null.
    if (req.user.roles.includes('student') && !req.user.roles.includes('coordinator')) {
      filter.$or = [
        { userId: req.user._id },
        { userId: { $exists: false } },
        { userId: null },
      ];
      if (req.user.sectionId) filter.sectionId = req.user.sectionId;
    } else if (req.query.sectionId) {
      filter.sectionId = req.query.sectionId;
    }

    const [items, total] = await Promise.all([
      Assignment.find(filter)
        .populate('courseId', 'code title credits')
        .populate('teacherId', 'name designation')
        .populate('sectionId', 'name label')
        .sort({ deadline: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Assignment.countDocuments(filter),
    ]);

    const serialized = items.map((item) => {
      const raw = item.toObject({ virtuals: true });
      if (raw.courseId && typeof raw.courseId === 'object') raw.course = raw.courseId;
      if (raw.teacherId && typeof raw.teacherId === 'object')
        raw.teacher = raw.teacherId;
      return raw;
    });

    sendData(res, { items: serialized, page, limit, total });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const assignment = await Assignment.findById(req.params.id)
      .populate('courseId', 'code title credits')
      .populate('teacherId', 'name designation');
    if (!assignment) throw new AppError(404, 'Assignment not found');
    if (!isStaff(req.user) && idOf(assignment.sectionId) !== idOf(req.user.sectionId)) {
      throw new AppError(403, 'You can only view assignments for your own section');
    }
    sendData(res, assignment);
  })
);

router.post(
  '/',
  requireCoordinator,
  asyncHandler(async (req, res) => {
    const body = req.body;
    if (!body.title || !body.sectionId || !body.deadline) {
      throw new AppError(400, 'title, sectionId, and deadline are required');
    }
    await assertSectionInCoordinatorScope(req.user, body.sectionId);

    const assignment = new Assignment({
      userId: body.userId || null,
      sectionId: body.sectionId,
      courseId: body.courseId || null,
      teacherId: body.teacherId || null,
      title: body.title,
      description: body.description || '',
      deadline: new Date(body.deadline),
      priority: body.priority || 'medium',
      status: body.status || 'not_started',
      attachments: Array.isArray(body.attachments) ? body.attachments : [],
      createdBy: req.user._id,
    });
    await assignment.save();
    sendData(res, assignment, 201);
  })
);

router.put(
  '/:id',
  requireCoordinator,
  asyncHandler(async (req, res) => {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) throw new AppError(404, 'Assignment not found');
    await assertSectionInCoordinatorScope(req.user, assignment.sectionId);

    const allowed = [
      'title',
      'description',
      'courseId',
      'teacherId',
      'deadline',
      'priority',
      'status',
      'attachments',
    ];
    for (const field of allowed) {
      if (req.body[field] !== undefined) assignment[field] = req.body[field];
    }
    await assignment.save();
    sendData(res, assignment);
  })
);

router.delete(
  '/:id',
  requireCoordinator,
  asyncHandler(async (req, res) => {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) throw new AppError(404, 'Assignment not found');
    await assertSectionInCoordinatorScope(req.user, assignment.sectionId);
    await Assignment.findByIdAndDelete(req.params.id);
    sendData(res, { message: 'Assignment deleted' });
  })
);

export default router;
