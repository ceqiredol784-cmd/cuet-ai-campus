import express from 'express';
import { protect } from '../middleware/auth.js';
import { StudyMaterial } from '../models/index.js';
import { AppError, asyncHandler, parsePagination, sendData } from '../utils/http.js';

const router = express.Router();
router.use(protect);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {};
    if (req.query.courseId) filter.courseId = req.query.courseId;
    if (req.query.type) filter.type = req.query.type;

    const [items, total] = await Promise.all([
      StudyMaterial.find(filter)
        .populate('courseId', 'code title credits')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      StudyMaterial.countDocuments(filter),
    ]);
    sendData(res, { items, page, limit, total });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = req.body;
    if (!body.title || !body.url) {
      throw new AppError(400, 'title and url are required');
    }
    const material = new StudyMaterial({
      title: body.title,
      description: body.description || '',
      type: body.type || 'other',
      url: body.url,
      courseId: body.courseId || null,
      departmentId: body.departmentId || null,
      uploadedBy: req.user.name || 'Campus faculty',
      createdBy: req.user._id,
    });
    await material.save();
    sendData(res, material, 201);
  })
);

export default router;
