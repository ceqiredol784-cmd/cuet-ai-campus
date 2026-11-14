import { AppError } from '../utils/http.js';
import { Section, Batch } from '../models/index.js';
import { isAdmin, isCoordinator, hasRole } from '../middleware/auth.js';

export const idOf = (value) => String(value?._id || value || '');

export const sameId = (left, right) =>
  Boolean(left && right && String(left) === String(right));

export function userSectionId(user) {
  return idOf(user?.sectionId);
}

export function userBatchId(user) {
  return idOf(user?.batchId);
}

export function userDepartmentId(user) {
  return idOf(user?.departmentId);
}

/**
 * A CR may manage the routine (and routine proposals) of their own section or
 * a sibling section of the same batch — batches have two sections and the CR
 * team builds both routines.
 */
export async function assertSectionWritableByCr(user, section) {
  if (!section) throw new AppError(404, 'Section not found');
  if (isAdmin(user) || isCoordinator(user)) return;
  if (sameId(userSectionId(user), section._id)) return;
  const crBatch = userBatchId(user);
  const sectionBatch = idOf(section.batchId?._id ?? section.batchId);
  if (hasRole(user, 'cr') && crBatch && sectionBatch && sameId(crBatch, sectionBatch)) return;
  throw new AppError(403, 'You can only manage routines of sections in your own batch');
}

 /** Resolves and authorizes a section for a schedule/calendar request. */
export async function resolveSectionForUser(user, requestedSectionId = null) {
  if (requestedSectionId) {
    const section = await Section.findById(requestedSectionId).populate(
      'batchId',
      'departmentId batchNumber label'
    );
    if (!section) throw new AppError(404, 'Section not found');

    if (!isAdmin(user)) {
      const ownSection = userSectionId(user);
      if (isCoordinator(user)) {
        const coordinatorBatch = userBatchId(user);
        const coordinatorDepartment = userDepartmentId(user);
        const batchDepartment = idOf(section.batchId?.departmentId);
        const allowed =
          (coordinatorBatch && sameId(section.batchId?._id, coordinatorBatch)) ||
          (coordinatorDepartment && batchDepartment === coordinatorDepartment);
        if (!allowed) {
          throw new AppError(403, 'This section is outside your department');
        }
      } else if (!sameId(ownSection, section._id)) {
        // A CR may READ the schedule of a sibling section in their own batch —
        // they need it to aim class declarations at that section.
        const crBatch = userBatchId(user);
        const sectionBatch = idOf(section.batchId?._id ?? section.batchId);
        const crMayView =
          hasRole(user, 'cr') && crBatch && sectionBatch && sameId(crBatch, sectionBatch);
        if (!crMayView) {
          throw new AppError(403, 'You can only view your own section');
        }
      }
    }

    return section;
  }

  const own = userSectionId(user);
  if (!own) {
    throw new AppError(400, 'Complete your academic profile to view your schedule');
  }
  const section = await Section.findById(own).populate(
    'batchId',
    'departmentId batchNumber label'
  );
  if (!section) throw new AppError(404, 'Section not found');
  return section;
}

export async function assertSectionInCoordinatorScope(user, sectionId) {
  if (isAdmin(user)) {
    const section = await Section.findById(sectionId);
    if (!section) throw new AppError(404, 'Section not found');
    return section;
  }

  if (!isCoordinator(user)) {
    throw new AppError(403, 'Coordinator access required');
  }

  const section = await Section.findById(sectionId).populate(
    'batchId',
    'departmentId batchNumber label'
  );
  if (!section) throw new AppError(404, 'Section not found');

  const coordinatorBatch = userBatchId(user);
  const coordinatorDepartment = userDepartmentId(user);
  const allowed =
    (coordinatorBatch && sameId(section.batchId?._id, coordinatorBatch)) ||
    (coordinatorDepartment &&
      idOf(section.batchId?.departmentId) === coordinatorDepartment);
  if (!allowed) {
    throw new AppError(403, 'This section is outside your department');
  }
  return section;
}

export async function coordinatorSectionIds(user) {
  if (isAdmin(user)) return null;
  if (!isCoordinator(user)) throw new AppError(403, 'Coordinator access required');

  const batchId = userBatchId(user);
  if (batchId) {
    const sections = await Section.find({ batchId }).select('_id').lean();
    return sections.map((section) => section._id);
  }

  const departmentId = userDepartmentId(user);
  if (!departmentId) return [];
  const batches = await Batch.find({ departmentId }).select('_id').lean();
  const sections = await Section.find({
    batchId: { $in: batches.map((batch) => batch._id) },
  })
    .select('_id')
    .lean();
  return sections.map((section) => section._id);
}

export async function assertCanManageUpdates(user, update) {
  if (isAdmin(user) || isCoordinator(user)) return true;
  if (hasRole(user, 'cr') && sameId(update.authorId, user._id)) return true;
  if (sameId(update.authorId, user._id)) return true;
  throw new AppError(403, 'You cannot modify this announcement');
}
