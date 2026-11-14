import {
  Update,
  Batch,
  Section,
  CRAssignment,
} from '../models/index.js';
import {
  UPDATE_SCOPES,
} from '../constants.js';
import { isAdmin, isCoordinator } from '../middleware/auth.js';
import { idOf } from './access.js';
import { normalizeDate } from '../utils/dates.js';
import { AppError } from '../utils/http.js';
import { logAudit } from './audit.js';

const normalizeScope = (scope) => {
  return UPDATE_SCOPES.includes(scope) ? scope : 'section';
};

const EVENT_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export function normalizeEventFields(body) {
  const type = String(body.type || 'announcement');
  const eventDateTime = body.eventDateTime ? String(body.eventDateTime).trim() : null;
  const eventLocation = body.eventLocation ? String(body.eventLocation).trim() : null;

  if (type === 'event') {
    if (!eventDateTime || !EVENT_DATE_TIME_PATTERN.test(eventDateTime)) {
      throw new AppError(400, 'A valid event date and time is required');
    }
    const parsed = new Date(eventDateTime);
    if (Number.isNaN(parsed.getTime())) {
      throw new AppError(400, 'A valid event date and time is required');
    }
  }

  if (eventLocation && eventLocation.length > 240) {
    throw new AppError(400, 'Event location must be 240 characters or fewer');
  }

  return {
    type,
    eventDateTime: type === 'event' ? eventDateTime : null,
    eventLocation: type === 'event' ? eventLocation : null,
  };
}

/**
 * The human-readable department code ("CSE") for a batch.
 * `departmentCode` is compared against student codes when scoping the feed, so
 * it must never be a Mongo ObjectId.
 */
export async function departmentCodeForBatch(batchId) {
  if (!batchId) return null;
  const batch = await Batch.findById(batchId).populate('departmentId', 'code');
  const code = batch?.departmentId?.code;
  return code ? String(code).toUpperCase() : null;
}

export const updatePopulate = [
  { path: 'authorId', select: 'name role studentId' },
  { path: 'sectionId', select: 'name label termId' },
  { path: 'batchId', select: 'departmentId batchNumber label name' },
  { path: 'courseId', select: 'code title credits departmentId' },
];

export function serializeUpdate(update, currentUserId = null) {
  const raw =
    typeof update.toObject === 'function'
      ? update.toObject({ virtuals: true })
      : { ...update };

  if (raw.authorId && typeof raw.authorId === 'object') {
    raw.author = {
      _id: raw.authorId._id,
      name: raw.authorId.name,
      role: raw.authorId.role,
    };
  }
  if (raw.courseId && typeof raw.courseId === 'object') {
    raw.course = raw.courseId;
    if (raw.courseId.departmentId && typeof raw.courseId.departmentId === 'object') {
      raw.course.department = raw.courseId.departmentId;
    }
  }

  const batch =
    raw.batchId && typeof raw.batchId === 'object' ? raw.batchId : raw.batch;
  if (batch) {
    raw.batchNumber =
      batch.batchNumber ?? raw.batchNumber ?? raw.batchNumber ?? null;
    const label = String(batch.label || batch.name || '');
    const match = label.match(/\d{2,4}/);
    if (match && !raw.batchNumber) raw.batchNumber = Number(match[0]);
  }

  raw.isRead =
    currentUserId != null
      ? Array.isArray(raw.readBy) &&
        raw.readBy.some(
          (id) => String(id._id || id) === String(currentUserId)
        )
      : false;

  return raw;
}

export async function canCreateUpdateForScope(user, scope, batchId, departmentCode) {
  if (scope === 'global') {
    if (!user.roles.includes('coordinator') && !user.roles.includes('admin')) {
      throw new AppError(403, 'Only coordinators and admins can post global announcements');
    }
    return;
  }

  if (scope === 'department') {
    const ownDepartmentCode = String(user.departmentId?.code || '').toUpperCase();
    if (
      user.roles.includes('coordinator') ||
      user.roles.includes('admin') ||
      (ownDepartmentCode &&
        ownDepartmentCode === String(departmentCode || '').toUpperCase())
    ) {
      return;
    }
    throw new AppError(403, 'You cannot post a department announcement for another department');
  }

  const assignment = await CRAssignment.findOne({
    userId: user._id,
  });
  if (!assignment) {
    throw new AppError(400, 'You are not assigned to a section');
  }

  const ownBatch = idOf(user.batchId);
  if (scope === 'batch') {
    if (!batchId || ownBatch !== batchId) {
      throw new AppError(403, 'Batch announcements are limited to your own batch');
    }
    return;
  }
}

export async function resolveAudience(user, payload) {
  const scope = normalizeScope(payload.scope || 'section');
  let sectionId = null;
  let batchId = null;
  let departmentCode = (payload.departmentCode || '').toUpperCase() || null;

  const assignment = await CRAssignment.findOne({ userId: user._id }).populate(
    'sectionId'
  );
  const ownSection = assignment?.sectionId ? idOf(assignment.sectionId._id) : null;
  const ownBatch = idOf(user.batchId);
  const ownDepartmentCode = String(user.departmentId?.code || '').toUpperCase();

  if (scope === 'section' || scope === 'batch') {
    if (payload.sectionId) {
      const sectionDoc = await Section.findById(payload.sectionId);
      if (!sectionDoc) throw new AppError(400, 'Unknown section');
      sectionId = sectionDoc._id;
      if (
        user.roles.includes('admin') ||
        user.roles.includes('coordinator') ||
        (user.roles.includes('cr') && ownSection && ownSection === sectionDoc._id.toString())
      ) {
        batchId = idOf(sectionDoc.batchId);
        departmentCode = (await departmentCodeForBatch(batchId)) || departmentCode;
      } else {
        throw new AppError(403, 'You cannot post for that section');
      }
    } else if (ownSection) {
      sectionId = ownSection;
      const sectionDoc = await Section.findById(sectionId);
      if (sectionDoc) {
        batchId = idOf(sectionDoc.batchId);
        departmentCode =
          ownDepartmentCode || (await departmentCodeForBatch(batchId)) || departmentCode;
      } else {
        departmentCode = ownDepartmentCode || departmentCode;
      }
    } else {
      throw new AppError(400, 'You are not assigned to a section');
    }

    if (scope === 'batch') {
      batchId = payload.batchId || batchId;
      if (!batchId) throw new AppError(400, 'Batch ID is required');
      if (
        user.roles.includes('admin') ||
        user.roles.includes('coordinator')
      ) {
        return { sectionId: null, batchId, departmentCode };
      }
      if (!ownBatch || ownBatch !== batchId) {
        throw new AppError(403, 'Batch announcements are limited to your own batch');
      }
    }
  }

  if (scope === 'department') {
    departmentCode = departmentCode || ownDepartmentCode || null;
  }

  return { sectionId, batchId, departmentCode };
}

export async function serializeNewUpdate(update) {
  const populated = await Update.findById(update._id).populate(updatePopulate);
  return serializeUpdate(populated);
}

export async function createUpdate({ user, body, files = [], req = null }) {
  const scope = normalizeScope(body.scope || 'section');
  await canCreateUpdateForScope(user, scope, body.batchId, body.departmentCode);

  const { sectionId, batchId, departmentCode } = await resolveAudience(user, body);
  const eventFields = normalizeEventFields(body);

  const batchDoc = batchId ? await Batch.findById(batchId) : null;
  const batchNumber =
    (batchDoc && batchDoc.batchNumber) ||
    (body.batchNumber != null ? Number(body.batchNumber) : null);

  const update = new Update({
    authorId: user._id,
    sectionId,
    batchId,
    courseId: body.courseId || null,
    type: eventFields.type,
    title: body.title,
    description: body.description || '',
    priority: body.priority || 'normal',
    scope,
    departmentCode,
    batchNumber: batchNumber != null ? Number(batchNumber) : null,
    effectiveDate: normalizeDate(body.effectiveDate),
    eventDateTime: eventFields.eventDateTime,
    eventLocation: eventFields.eventLocation,
    status: 'approved',
    attachments: Array.isArray(files) && files.length
      ? files.map((f) => (typeof f === 'string' ? f : f.url))
      : Array.isArray(body.attachments)
        ? body.attachments
        : [],
  });

  await update.save();
  await logAudit({
    action: 'update_created',
    user,
    sectionId,
    details: `Created ${scope} announcement: ${body.title}`,
    req,
  });

  return serializeNewUpdate(update);
}

export async function listUpdates(query, currentUser = null) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, Number.parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const type = String(query.type || '');
  const status = String(query.status || '');
  const courseId = query.courseId || null;

  const currentUserId = currentUser?._id ?? currentUser ?? null;
  const isStaff =
    Boolean(currentUser?._id) &&
    (isAdmin(currentUser) || isCoordinator(currentUser));

  let filter = {};
  if (currentUser) {
    // Coordinators/admins see everything matching filters; students and CRs
    // see approved announcements addressed to them (global, their section,
    // their batch, their department) plus their own posts.
    if (isStaff) {
      if (status) filter.status = status;
      if (query.sectionId) filter.sectionId = query.sectionId;
    } else {
      const audience = [{ scope: 'global' }, { authorId: currentUserId }];
      const sectionId = idOf(currentUser.sectionId);
      const batchId = idOf(currentUser.batchId);
      const departmentCode = String(
        currentUser.departmentId?.code || ''
      ).toUpperCase();

      if (sectionId) audience.push({ scope: 'section', sectionId });
      if (batchId) audience.push({ scope: 'batch', batchId });
      if (departmentCode) audience.push({ scope: 'department', departmentCode });

      filter = { status: status || 'approved', $or: audience };
    }
  } else if (status) {
    filter.status = status;
  }

  if (type) filter.type = type;
  if (courseId) filter.courseId = courseId;

  const [items, total] = await Promise.all([
    Update.find(filter)
      .populate(updatePopulate)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Update.countDocuments(filter),
  ]);

  return {
    items: items.map((item) => serializeUpdate(item, currentUserId)),
    total,
    page,
    limit,
  };
}

export async function markRead(updateId, userId) {
  const update = await Update.findById(updateId);
  if (!update) throw new AppError(404, 'Announcement not found');
  await Update.findByIdAndUpdate(updateId, { $addToSet: { readBy: userId } });
  return { message: 'Marked as read' };
}

export async function upvote(updateId, userId) {
  const update = await Update.findById(updateId);
  if (!update) throw new AppError(404, 'Announcement not found');
  const upvoted = Array.isArray(update.upvotedBy)
    ? update.upvotedBy.map(String).includes(String(userId))
    : false;

  const updateData = upvoted
    ? { $pull: { upvotedBy: userId }, $inc: { upvotes: -1 } }
    : { $addToSet: { upvotedBy: userId }, $inc: { upvotes: 1 } };
  await Update.findByIdAndUpdate(updateId, updateData);
  return { message: upvoted ? 'Removed vote' : 'Voted' };
}

export async function reviewUpdate(updateId, decision, note, user) {
  const update = await Update.findById(updateId);
  if (!update) throw new AppError(404, 'Announcement not found');
  if (!['approved', 'rejected', 'draft'].includes(decision)) {
    throw new AppError(400, 'Invalid decision');
  }

  update.status = decision;
  update.reviewNote = note || null;
  update.reviewedBy = user._id;
  update.reviewedAt = new Date();
  await update.save();

  await logAudit({
    action: 'update_reviewed',
    user,
    sectionId: update.sectionId,
    targetId: update._id,
    details: `${decision} update: ${update.title}`,
  });

  const populated = await Update.findById(update._id).populate(updatePopulate);
  return serializeUpdate(populated, user._id);
}

export async function deleteUpdate(updateId, user) {
  const update = await Update.findById(updateId);
  if (!update) throw new AppError(404, 'Announcement not found');
  if (
    !user.roles.includes('admin') &&
    !user.roles.includes('coordinator') &&
    idOf(update.authorId) !== idOf(user._id)
  ) {
    throw new AppError(403, 'You cannot modify this announcement');
  }
  await Update.findByIdAndDelete(updateId);
  return { message: 'Announcement deleted' };
}
