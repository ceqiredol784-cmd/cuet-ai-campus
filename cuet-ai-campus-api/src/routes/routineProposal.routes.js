import express from 'express';
import mongoose from 'mongoose';
import { protect, requireCr } from '../middleware/auth.js';
import { Course, RoutineEntry, RoutineProposal, Section } from '../models/index.js';
import { DAYS, PERIOD_TIMES, periodRangeCrossesBreak } from '../constants.js';
import { AppError, asyncHandler, sendData } from '../utils/http.js';
import { assertSectionInCoordinatorScope, assertSectionWritableByCr, idOf, sameId } from '../services/access.js';
import { logAudit } from '../services/audit.js';

const router = express.Router();
router.use(protect);

const isStaff = (user) =>
  Boolean(user?.roles?.includes('coordinator') || user?.roles?.includes('admin'));

const proposalPopulate = [
  { path: 'sectionId', select: 'name label batchId' },
  { path: 'submittedBy', select: 'name role' },
  { path: 'reviewedBy', select: 'name role' },
];

function serializeProposal(proposal) {
  const raw =
    typeof proposal.toObject === 'function'
      ? proposal.toObject({ virtuals: true })
      : { ...proposal };
  raw.id = String(raw._id);
  return raw;
}

/** Validate and normalise the submitted weekly entries — fully manual,
 * period-based (the official 9-period day; times derive from PERIOD_TIMES). */
function normaliseEntries(rawEntries) {
  if (!Array.isArray(rawEntries) || rawEntries.length === 0) {
    throw new AppError(400, 'At least one class entry is required');
  }
  const seen = new Set();
  const entries = [];
  for (const entry of rawEntries) {
    const day = String(entry?.day ?? '').trim();
    const courseCode = String(entry?.courseCode ?? '').trim();
    const period = Number(entry?.period);
    const periodEnd = entry?.periodEnd == null ? period : Number(entry.periodEnd);
    if (!DAYS.includes(day)) {
      throw new AppError(400, `day must be one of: ${DAYS.join(', ')}`);
    }
    if (!Number.isInteger(period) || period < 1 || period > 9) {
      throw new AppError(400, 'Every entry needs a period between 1 and 9');
    }
    if (!Number.isInteger(periodEnd) || periodEnd < period || periodEnd > 9) {
      throw new AppError(400, `Period range is invalid for ${courseCode || 'an entry'} on ${day}`);
    }
    if (periodRangeCrossesBreak(period, periodEnd)) {
      throw new AppError(
        400,
        `A class cannot span Break or Lunch — split ${courseCode || 'the entry'} on ${day} into separate periods`
      );
    }
    if (!courseCode) {
      throw new AppError(400, 'Every entry needs a subject code (e.g. CSE-321)');
    }
    // Overlap check across the whole period span.
    for (let p = period; p <= periodEnd; p += 1) {
      const slotKey = `${day}:${p}`;
      if (seen.has(slotKey)) {
        throw new AppError(409, `Period ${p} on ${day} is already taken by another class`);
      }
      seen.add(slotKey);
    }
    const teachers = (Array.isArray(entry?.teachers) ? entry.teachers : [])
      .map((t) => String(t ?? '').trim())
      .filter(Boolean);
    entries.push({
      day,
      period,
      periodEnd,
      startTime: PERIOD_TIMES[period].startTime,
      endTime: PERIOD_TIMES[periodEnd].endTime,
      courseCode,
      courseTitle: String(entry?.courseTitle ?? '').trim(),
      teachers,
      classType: String(entry?.classType ?? 'lecture').trim() || 'lecture',
      room: entry?.room ? String(entry.room).trim() : null,
    });
  }
  return entries;
}

async function assertCanManageProposal(user, proposal) {
  if (isStaff(user)) {
    const section = await Section.findById(proposal.sectionId);
    await assertSectionInCoordinatorScope(user, section);
    return;
  }
  if (!user.roles.includes('cr')) {
    throw new AppError(403, 'Only CRs and coordinators can manage routine proposals');
  }
  // CRs manage proposals of their own section or a sibling in the same batch.
  const section = await Section.findById(proposal.sectionId);
  await assertSectionWritableByCr(user, section);
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = {};
    if (isStaff(req.user)) {
      if (req.query.sectionId) filter.sectionId = req.query.sectionId;
    } else {
      // CRs and students see every proposal of their batch's sections —
      // the batch has two sections and both build routines.
      const batchId = idOf(req.user.batchId);
      if (batchId) {
        const batchSections = await Section.find({ batchId }).select('_id').lean();
        filter.sectionId = { $in: batchSections.map((section) => section._id) };
      } else {
        filter.sectionId = idOf(req.user.sectionId);
      }
    }
    if (req.query.status) filter.status = String(req.query.status);

    const proposals = await RoutineProposal.find(filter)
      .populate(proposalPopulate)
      .sort({ createdAt: -1 })
      .limit(100);

    sendData(res, proposals.map(serializeProposal));
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const proposal = await RoutineProposal.findById(req.params.id).populate(proposalPopulate);
    if (!proposal) throw new AppError(404, 'Routine proposal not found');
    if (!isStaff(req.user)) {
      const section = await Section.findById(proposal.sectionId);
      const sameBatch =
        idOf(req.user.batchId) &&
        sameId(idOf(section?.batchId), idOf(req.user.batchId));
      if (!sameBatch && !sameId(idOf(proposal.sectionId), idOf(req.user.sectionId))) {
        throw new AppError(403, 'You can only view routine proposals of your own batch');
      }
    }
    sendData(res, serializeProposal(proposal));
  })
);

// Submit (or replace the pending) full weekly routine for coordinator review.
router.post(
  '/',
  requireCr,
  asyncHandler(async (req, res) => {
    // Default to the CR's own section; a CR may also build the sibling
    // section's proposal as long as it is in the same batch.
    const requestedSectionId = req.body.sectionId
      ? idOf(req.body.sectionId)
      : idOf(req.user.sectionId);
    if (!requestedSectionId) throw new AppError(400, 'You are not assigned to a section');
    const targetSection = await Section.findById(requestedSectionId);
    if (!targetSection) throw new AppError(404, 'Section not found');
    await assertSectionWritableByCr(req.user, targetSection);
    const sectionId = requestedSectionId;
    const entries = normaliseEntries(req.body.entries);

    // One live proposal per section: resubmitting replaces the pending one.
    let proposal = await RoutineProposal.findOne({ sectionId, status: 'pending' });
    if (proposal) {
      proposal.entries = entries;
      proposal.entryCount = entries.length;
      proposal.submittedBy = req.user._id;
      proposal.reviewNote = null;
      proposal.reviewedBy = null;
      proposal.reviewedAt = null;
    } else {
      proposal = new RoutineProposal({
        sectionId,
        submittedBy: req.user._id,
        status: 'pending',
        entries,
        entryCount: entries.length,
      });
    }
    await proposal.save();

    await logAudit({
      action: 'routine_proposal_submitted',
      user: req.user,
      sectionId,
      targetId: proposal._id,
      details: `Submitted a full weekly routine (${entries.length} entries) for review`,
      req,
    });

    const populated = await RoutineProposal.findById(proposal._id).populate(proposalPopulate);
    sendData(res, serializeProposal(populated), 201);
  })
);

// CR edits their own pending proposal without coordinator involvement.
router.put(
  '/:id',
  requireCr,
  asyncHandler(async (req, res) => {
    const proposal = await RoutineProposal.findById(req.params.id);
    if (!proposal) throw new AppError(404, 'Routine proposal not found');
    await assertCanManageProposal(req.user, proposal);
    if (proposal.status !== 'pending') {
      throw new AppError(400, 'Only pending proposals can be edited — submit a new one instead');
    }
    proposal.entries = normaliseEntries(req.body.entries);
    proposal.entryCount = proposal.entries.length;
    await proposal.save();

    const populated = await RoutineProposal.findById(proposal._id).populate(proposalPopulate);
    sendData(res, serializeProposal(populated));
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const proposal = await RoutineProposal.findById(req.params.id);
    if (!proposal) throw new AppError(404, 'Routine proposal not found');
    await assertCanManageProposal(req.user, proposal);
    await RoutineProposal.findByIdAndDelete(proposal._id);
    sendData(res, { message: 'Routine proposal withdrawn' });
  })
);

// Coordinator review: approval publishes the routine as the section's
// official weekly class routine.
router.put(
  '/:id/review',
  asyncHandler(async (req, res) => {
    if (!isStaff(req.user)) {
      throw new AppError(403, 'Only coordinators can review routine proposals');
    }
    const decision = String(req.body.decision || '').toLowerCase();
    if (!['approved', 'rejected'].includes(decision)) {
      throw new AppError(400, 'decision must be approved or rejected');
    }
    const proposal = await RoutineProposal.findById(req.params.id).populate(proposalPopulate);
    if (!proposal) throw new AppError(404, 'Routine proposal not found');
    await assertSectionInCoordinatorScope(req.user, proposal.sectionId?._id || proposal.sectionId);
    if (proposal.status !== 'pending') {
      throw new AppError(400, `This proposal was already ${proposal.status}`);
    }

    proposal.status = decision;
    proposal.reviewedBy = req.user._id;
    proposal.reviewedAt = new Date();
    proposal.reviewNote = req.body.note ? String(req.body.note).trim() : null;

    if (decision === 'approved') {
      // Publish: replace the section's weekly routine with the proposal.
      const sectionId = idOf(proposal.sectionId?._id ?? proposal.sectionId);
      const sectionDoc = await Section.findById(sectionId).populate(
        'batchId',
        'departmentId'
      );
      const departmentId = idOf(sectionDoc?.batchId?.departmentId);
      const existing = await RoutineEntry.find({ sectionId }).select('_id');
      const existingIds = existing.map((e) => e._id);
      if (existingIds.length > 0) {
        await RoutineEntry.deleteMany({ _id: { $in: existingIds } });
      }

      // Resolve course documents by code (creating missing ones), then insert
      // one entry per period so labs collapse back into single display blocks.
      let created = 0;
      for (const entry of proposal.entries) {
        let course = await Course.findOne({
          code: { $regex: `^${entry.courseCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
        });
        if (!course) {
          if (!departmentId) {
            throw new AppError(
              400,
              `Cannot resolve a department for course ${entry.courseCode} — cannot publish`
            );
          }
          course = await Course.create({
            code: entry.courseCode,
            title: entry.courseTitle || entry.courseCode,
            credits: 0,
            departmentId,
          });
        }
        // One entry per period: labs spanning periods collapse back into a
        // single block for display, matching the official routine PDF.
        for (let period = entry.period; period <= entry.periodEnd; period += 1) {
          await RoutineEntry.create({
            sectionId,
            courseId: course._id,
            teacherId: null,
            teacherNames: entry.teachers,
            day: entry.day,
            period,
            startTime: PERIOD_TIMES[period].startTime,
            endTime: PERIOD_TIMES[period].endTime,
            room: entry.room || null,
            classType: entry.classType || 'lecture',
            createdBy: req.user._id,
          });
          created += 1;
        }
      }

      await logAudit({
        action: 'routine_proposal_published',
        user: req.user,
        sectionId,
        targetId: proposal._id,
        details: `Approved and published a weekly routine (${created} entries)`,
        req,
      });
    }

    await proposal.save();
    const populated = await RoutineProposal.findById(proposal._id).populate(proposalPopulate);
    sendData(res, serializeProposal(populated));
  })
);

export default router;
