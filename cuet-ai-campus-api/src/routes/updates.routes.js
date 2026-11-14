import express from 'express';
import { protect, requireCr } from '../middleware/auth.js';
import { updateUpload, relativeUploadPath } from '../middleware/upload.js';
import * as updatesService from '../services/updates.js';
import { Update } from '../models/index.js';
import { asyncHandler, sendData } from '../utils/http.js';
import { AppError } from '../utils/http.js';

const router = express.Router();
router.use(protect);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const result = await updatesService.listUpdates(req.query, req.user);
    sendData(res, {
      items: result.items,
      page: result.page,
      limit: result.limit,
      total: result.total,
    });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const update = await Update.findById(req.params.id).populate(
      updatesService.updatePopulate
    );
    if (!update) throw new AppError(404, 'Announcement not found');
    sendData(res, updatesService.serializeUpdate(update, req.user._id));
  })
);

router.post(
  '/',
  requireCr,
  updateUpload.array('files', 6),
  asyncHandler(async (req, res) => {
    // CRs publish directly — no coordinator approval is needed.
    // The React frontend posts plain JSON when the announcement has no
    // attachments, and multipart form-data (data JSON field + files[]) when it
    // does. Accept both shapes here.
    const isMultipart = req.is('multipart/form-data');
    let payload;
    let files = [];

    if (isMultipart) {
      try {
        payload = JSON.parse(req.body.data || '{}');
      } catch {
        throw new AppError(400, 'Invalid data field');
      }
      files = Array.isArray(req.files) ? req.files : [];
    } else {
      payload = { ...req.body };
    }

    // Store host-independent relative paths — the client resolves them
    // against the API origin, so links survive host/port changes.
    const attachmentUrls = files.map((file) => relativeUploadPath(file, 'updates'));
    const attachments =
      files.length > 0
        ? attachmentUrls
        : Array.isArray(payload.attachments)
          ? payload.attachments
          : [];

    const update = await updatesService.createUpdate({
      user: req.user,
      body: { ...payload, attachments },
      files: attachmentUrls,
      req,
    });
    sendData(res, update, 201);
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const update = await Update.findById(req.params.id);
    if (!update) throw new AppError(404, 'Announcement not found');
    if (
      !req.user.roles.includes('admin') &&
      !req.user.roles.includes('coordinator') &&
      String(update.authorId) !== String(req.user._id)
    ) {
      throw new AppError(403, 'You cannot modify this announcement');
    }

    const allowed = [
      'title',
      'description',
      'priority',
      'type',
      'effectiveDate',
      'eventDateTime',
      'eventLocation',
    ];
    for (const field of allowed) {
      if (req.body[field] !== undefined) update[field] = req.body[field];
    }
    const eventFields = updatesService.normalizeEventFields(update);
    update.type = eventFields.type;
    update.eventDateTime = eventFields.eventDateTime;
    update.eventLocation = eventFields.eventLocation;
    await update.save();

    const populated = await Update.findById(update._id).populate(
      updatesService.updatePopulate
    );
    sendData(res, updatesService.serializeUpdate(populated, req.user._id));
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await updatesService.deleteUpdate(req.params.id, req.user);
    sendData(res, { message: 'Announcement deleted' });
  })
);

router.put(
  '/:id/read',
  asyncHandler(async (req, res) => {
    await updatesService.markRead(req.params.id, req.user._id);
    sendData(res, { message: 'Marked as read' });
  })
);

router.post(
  '/:id/upvote',
  asyncHandler(async (req, res) => {
    const result = await updatesService.upvote(req.params.id, req.user._id);
    sendData(res, result);
  })
);

router.put(
  '/:id/review',
  asyncHandler(async (req, res) => {
    const { decision, note } = req.body || {};
    const update = await updatesService.reviewUpdate(
      req.params.id,
      decision,
      note,
      req.user
    );
    sendData(res, update);
  })
);

// The React frontend reviews announcements via POST /updates/:id/review.
router.post(
  '/:id/review',
  asyncHandler(async (req, res) => {
    const { decision, note } = req.body || {};
    const update = await updatesService.reviewUpdate(
      req.params.id,
      decision,
      note,
      req.user
    );
    sendData(res, update);
  })
);

export default router;
