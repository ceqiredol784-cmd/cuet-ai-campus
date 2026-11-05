import express from 'express';
import { protect } from '../middleware/auth.js';
import { Notification } from '../models/index.js';
import { AppError, asyncHandler, parsePagination, sendData } from '../utils/http.js';

const router = express.Router();
router.use(protect);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query);
    const [items, total] = await Promise.all([
      Notification.find({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments({ userId: req.user._id }),
    ]);
    sendData(res, { items, page, limit, total });
  })
);

router.put(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const notification = await Notification.findById(req.params.id);
    if (!notification) throw new AppError(404, 'Notification not found');
    if (String(notification.userId) !== String(req.user._id)) {
      throw new AppError(403, 'You cannot modify this notification');
    }
    notification.readAt = new Date();
    await notification.save();
    sendData(res, { message: 'Marked as read' });
  })
);

export default router;
