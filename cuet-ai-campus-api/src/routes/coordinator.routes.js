import express from 'express';
import { protect, requireCoordinator } from '../middleware/auth.js';
import { noticePdfUpload, uploadedFileUrl } from '../middleware/upload.js';
import {
  User,
  Section,
  Batch,
  CRAssignment,
  AssignmentRule,
  AuditLog,
  Update,
  ScheduleOverride,
} from '../models/index.js';
import { asyncHandler, sendData } from '../utils/http.js';
import { AppError } from '../utils/http.js';
import {
  assertSectionInCoordinatorScope,
  idOf,
  userBatchId,
  userDepartmentId,
} from '../services/access.js';
import { logAudit } from '../services/audit.js';
import { departmentCodeForBatch, normalizeEventFields } from '../services/updates.js';

const router = express.Router();
router.use(protect);
router.use(requireCoordinator);

router.get(
  '/sections',
  asyncHandler(async (req, res) => {
    const user = req.user;
    const batchId = userBatchId(user);
    const departmentId = userDepartmentId(user);
    const filter = {};
    if (batchId) filter.batchId = batchId;
    else if (departmentId) {
      const batches = await Batch.find({ departmentId }).select('_id');
      filter.batchId = { $in: batches.map((b) => b._id) };
    } else {
      return sendData(res, []);
    }

    const sections = await Section.find(filter)
      .populate('termId', 'label level termNumber')
      .populate('batchId', 'departmentId batchNumber label name')
      .sort({ name: 1 });

    const result = await Promise.all(
      sections.map(async (section) => {
        const raw = section.toObject({ virtuals: true });
        const studentCount = await User.countDocuments({
          sectionId: section._id,
          roles: { $in: ['student'] },
          isActive: true,
        });
        const crCount = await CRAssignment.countDocuments({ sectionId: section._id });
        return {
          ...raw,
          studentCount,
          crCount,
          maxStudents: section.maxStudents,
        };
      })
    );
    sendData(res, result);
  })
);

router.get(
  '/students',
  asyncHandler(async (req, res) => {
    const user = req.user;
    const filter = {
      roles: { $in: ['student'] },
      isActive: true,
    };
    if (req.query.sectionId) filter.sectionId = req.query.sectionId;
    else if (req.query.batchId) filter.batchId = req.query.batchId;
    else {
      const batchId = userBatchId(user);
      if (batchId) filter.batchId = batchId;
    }

    const students = await User.find(filter)
      .populate('sectionId', 'name label termId')
      .sort({ studentId: 1, name: 1 });

    const crAssignments = await CRAssignment.find().lean();
    const crSet = new Set(crAssignments.map((a) => String(a.userId)));

    sendData(
      res,
      students.map((student) => {
        const raw = student.toObject({ virtuals: true });
        const section = raw.sectionId;
        return {
          ...raw,
          id: String(raw._id),
          isCr: crSet.has(String(raw._id)),
          isActive: raw.isActive !== false,
          _sectionId: section ? String(section._id) : null,
          _sectionLabel: section ? section.label : null,
          section: section ? { _id: String(section._id), name: section.name, label: section.label } : null,
        };
      })
    );
  })
);

router.get(
  '/crs',
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.sectionId) filter.sectionId = req.query.sectionId;
    const assignments = await CRAssignment.find(filter)
      .populate('userId', 'name studentId email roles')
      .populate('sectionId', 'name label')
      .sort({ createdAt: -1 });
    sendData(res, assignments);
  })
);

router.put(
  '/assign-cr',
  asyncHandler(async (req, res) => {
    const { studentId, sectionId, permissions } = req.body || {};
    if (!studentId || !sectionId) throw new AppError(400, 'studentId and sectionId are required');

    const user = await User.findById(studentId);
    if (!user) throw new AppError(404, 'Student not found');

    const section = await Section.findById(sectionId);
    if (!section) throw new AppError(404, 'Section not found');

    user.roles = Array.from(new Set([...user.roles, 'cr', 'student']));
    await user.save();

    await CRAssignment.findOneAndUpdate(
      { userId: studentId, sectionId },
      {
        userId: studentId,
        sectionId,
        permissions: permissions || {
          allowedUpdateTypes: [
            'announcement',
            'cancellation',
            'class_cancellation',
            'room_change',
            'time_change',
            'extra_class',
            'teacher_change',
            'lab_change',
            'other',
            'auto_day_off',
            'mid_break',
          ],
          directPublishTypes: ['announcement', 'cancellation', 'class_cancellation'],
        },
      },
      { upsert: true, new: true }
    );

    await logAudit({
      action: 'cr_assigned',
      user: req.user,
      sectionId,
      targetId: studentId,
      details: `${user.name} assigned as CR for Section ${section.name}`,
      req,
    });
    sendData(res, { message: 'CR assigned' });
  })
);

router.put(
  '/remove-cr',
  asyncHandler(async (req, res) => {
    const { studentId, sectionId } = req.body || {};
    if (!studentId || !sectionId) throw new AppError(400, 'studentId and sectionId are required');

    const assignment = await CRAssignment.findOneAndDelete({ userId: studentId, sectionId });
    const user = await User.findById(studentId);
    if (user) {
      user.roles = (user.roles || []).filter((r) => r !== 'cr');
      if (!user.roles.includes('student')) user.roles.push('student');
      user.role = 'student';
      await user.save();
    }

    await logAudit({
      action: 'cr_removed',
      user: req.user,
      sectionId,
      targetId: studentId,
      details: `CR assignment removed for ${user?.name || studentId}`,
      req,
    });
    sendData(res, { message: 'CR removed' });
  })
);

router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const user = req.user;
    const batchId = userBatchId(user);
    const departmentId = userDepartmentId(user);

    let studentFilter = { roles: { $in: ['student'] }, isActive: true };
    let sectionFilter = {};
    let crFilter = {};
    let updateFilter = { status: 'pending' };
    let overrideFilter = { status: 'pending' };

    if (batchId) {
      studentFilter.batchId = batchId;
      sectionFilter.batchId = batchId;
      crFilter.sectionId = { $exists: true };
      updateFilter.batchId = batchId;
      overrideFilter.sectionId = { $exists: true };
    } else if (departmentId) {
      const batches = await Batch.find({ departmentId }).select('_id');
      const batchIds = batches.map((b) => b._id);
      studentFilter.batchId = { $in: batchIds };
      sectionFilter.batchId = { $in: batchIds };
      updateFilter.batchId = { $in: batchIds };
    } else if (!user.roles.includes('admin')) {
      return sendData(res, {
        totalStudents: 0,
        totalSections: 0,
        totalCRs: 0,
        pendingUpdates: 0,
        pendingOverrides: 0,
      });
    } else {
      sectionFilter = {};
      crFilter = {};
      updateFilter = { status: 'pending' };
      overrideFilter = { status: 'pending' };
    }

    const sections = await Section.find(sectionFilter);
    const sectionIds = sections.map((s) => s._id);
    crFilter.sectionId = { $in: sectionIds };
    overrideFilter.sectionId = { $in: sectionIds };

    const [totalStudents, totalCRs, pendingUpdates, pendingOverrides] =
      await Promise.all([
        User.countDocuments(studentFilter),
        CRAssignment.countDocuments(crFilter),
        Update.countDocuments(updateFilter),
        ScheduleOverride.countDocuments(overrideFilter),
      ]);

    sendData(res, {
      totalStudents,
      totalSections: sections.length,
      totalCRs,
      pendingUpdates,
      pendingOverrides,
    });
  })
);

router.get(
  '/audit-logs',
  asyncHandler(async (req, res) => {
    const { action, sectionId, limit = 50, skip = 0 } = req.query;
    const filter = {};
    if (action) filter.action = new RegExp(String(action), 'i');
    if (sectionId) filter.sectionId = sectionId;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate('userId', 'name role')
        .sort({ createdAt: -1 })
        .skip(Number.parseInt(skip, 10) || 0)
        .limit(Math.min(200, Math.max(1, Number.parseInt(limit, 10) || 50))),
      AuditLog.countDocuments(filter),
    ]);

    sendData(res, { logs, total });
  })
);

router.get(
  '/quality',
  asyncHandler(async (req, res) => {
    const sections = await Section.find().populate('batchId', 'label name batchNumber');
    const issues = [];
    let high = 0;
    let medium = 0;
    let low = 0;

    for (const section of sections) {
      const crCount = await CRAssignment.countDocuments({ sectionId: section._id });
      if (crCount === 0) {
        issues.push({
          id: `quality-${section._id}-missing-cr`,
          severity: 'medium',
          title: 'No CR assigned',
          detail: `Section ${section.name} (${section.batchId?.label || section.batchId?.name || 'batch'}) has no course representative.`,
        });
        medium++;
      }
    }

    const studentCount = await User.countDocuments({
      roles: { $in: ['student'] },
      isActive: true,
      sectionId: { $exists: false },
    });
    if (studentCount > 0) {
      issues.push({
        id: 'quality-unassigned-students',
        severity: 'high',
        title: 'Unassigned students',
        detail: `${studentCount} student(s) are not assigned to any section.`,
      });
      high++;
    }

    sendData(res, {
      summary: { total: issues.length, high, medium, low, scannedSections: sections.length },
      issues,
    });
  })
);

router.post(
  '/notices',
  noticePdfUpload.single('file'),
  asyncHandler(async (req, res) => {
    let payload = req.body || {};
    if (typeof payload.data === 'string') {
      try {
        payload = JSON.parse(payload.data);
      } catch {
        throw new AppError(400, 'Invalid data field');
      }
    }
    const {
      audience,
      title,
      body,
      priority = 'normal',
      sectionId,
      type = 'announcement',
      eventDateTime,
      eventLocation,
    } = payload;
    if (!title) throw new AppError(400, 'title is required');

    let targetSectionId = null;
    let batchId = null;
    let departmentCode = null;

    if (audience === 'section') {
      if (!sectionId) throw new AppError(400, 'sectionId is required for section audience');
      const section = await assertSectionInCoordinatorScope(req.user, sectionId);
      targetSectionId = section._id;
      batchId = idOf(section.batchId);
      departmentCode = await departmentCodeForBatch(batchId);
    } else if (audience === 'batch') {
      batchId = userBatchId(req.user);
      const batch = batchId ? await Batch.findById(batchId) : null;
      if (!batch) throw new AppError(400, 'Coordinator batch not found');
      departmentCode = await departmentCodeForBatch(batch._id);
    } else {
      throw new AppError(400, 'audience must be section or batch');
    }

    const eventFields = normalizeEventFields({
      type,
      eventDateTime,
      eventLocation,
    });
    const update = new Update({
      authorId: req.user._id,
      sectionId: targetSectionId,
      batchId,
      type: eventFields.type,
      title,
      description: body || '',
      priority,
      scope: audience === 'batch' ? 'batch' : 'section',
      departmentCode,
      status: 'approved',
      eventDateTime: eventFields.eventDateTime,
      eventLocation: eventFields.eventLocation,
      attachments: req.file ? [uploadedFileUrl(req.file, 'updates')] : [],
    });
    await update.save();

    await logAudit({
      action: 'notice_published',
      user: req.user,
      sectionId: targetSectionId,
      details: `Published notice: ${title}`,
      req,
    });
    sendData(res, { message: 'Notice published' });
  })
);

router.get(
  '/assignment-rules',
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.termId) filter.termId = req.query.termId;
    const rules = await AssignmentRule.find(filter)
      .populate('sectionId', 'name label')
      .populate('termId', 'label level termNumber')
      .sort({ createdAt: -1 });
    sendData(res, rules);
  })
);

router.post(
  '/assignment-rules',
  asyncHandler(async (req, res) => {
    const { termId, sectionId, startId, endId } = req.body || {};
    if (!termId || !sectionId || !startId || !endId) {
      throw new AppError(400, 'termId, sectionId, startId, and endId are required');
    }
    const start = String(startId).replace(/\D/g, '');
    const end = String(endId).replace(/\D/g, '');
    if (!/^\d{7}$/.test(start) || !/^\d{7}$/.test(end) || Number(start) > Number(end)) {
      throw new AppError(400, 'startId and endId must be valid 7-digit IDs with startId <= endId');
    }
    const section = await Section.findById(sectionId).select('batchId');
    if (!section) throw new AppError(404, 'Section not found');
    const existingRules = await AssignmentRule.find({ termId, isActive: true })
      .populate('sectionId', 'batchId');
    const overlaps = existingRules.some((existing) => {
      if (String(existing.sectionId?.batchId) !== String(section.batchId)) return false;
      return Number(start) <= Number(existing.endId) && Number(existing.startId) <= Number(end);
    });
    if (overlaps) {
      throw new AppError(409, 'This student ID range overlaps an active coordinator rule');
    }
    const rule = new AssignmentRule({
      termId,
      sectionId,
      startId: start,
      endId: end,
      isActive: req.body.isActive !== false,
      createdBy: req.user._id,
    });
    await rule.save();
    sendData(res, rule, 201);
  })
);

router.put(
  '/assignment-rules/:id',
  asyncHandler(async (req, res) => {
    const rule = await AssignmentRule.findById(req.params.id);
    if (!rule) throw new AppError(404, 'Rule not found');
    if (req.body.startId != null) rule.startId = String(req.body.startId);
    if (req.body.endId != null) rule.endId = String(req.body.endId);
    if (req.body.isActive != null) rule.isActive = Boolean(req.body.isActive);
    await rule.save();
    sendData(res, rule);
  })
);

router.delete(
  '/assignment-rules/:id',
  asyncHandler(async (req, res) => {
    const rule = await AssignmentRule.findById(req.params.id);
    if (!rule) throw new AppError(404, 'Rule not found');
    await AssignmentRule.findByIdAndDelete(req.params.id);
    sendData(res, { message: 'Rule deleted' });
  })
);

router.post(
  '/assignment-rules/:id/apply',
  asyncHandler(async (req, res) => {
    const rule = await AssignmentRule.findById(req.params.id);
    if (!rule) throw new AppError(404, 'Rule not found');
    if (!rule.isActive) throw new AppError(400, 'Cannot apply an inactive assignment rule');

    const section = await Section.findById(rule.sectionId).select('batchId');
    if (!section) throw new AppError(404, 'Rule section not found');

    const students = await User.find({
      roles: { $in: ['student'] },
      batchId: section.batchId,
      studentId: { $gte: rule.startId, $lte: rule.endId },
    });

    let assignedCount = 0;
    let alreadyAssignedCount = 0;
    const moved = [];

    for (const student of students) {
      if (String(student.sectionId) === String(rule.sectionId)) {
        alreadyAssignedCount++;
        continue;
      }
      student.sectionId = rule.sectionId;
      await student.save();
      assignedCount++;
      moved.push({ userId: String(student._id), studentId: student.studentId });
    }

    await logAudit({
      action: 'assignment_rule_applied',
      user: req.user,
      sectionId: rule.sectionId,
      targetId: rule._id,
      details: `Applied rule ${rule._id}: ${assignedCount} assigned, ${alreadyAssignedCount} already assigned`,
      req,
    });
    sendData(res, { assignedCount, alreadyAssignedCount, moved });
  })
);

router.put(
  '/students/move',
  asyncHandler(async (req, res) => {
    const { studentId, targetSectionId } = req.body || {};
    if (!studentId || !targetSectionId) throw new AppError(400, 'studentId and targetSectionId are required');

    const student = await User.findById(studentId);
    if (!student) throw new AppError(404, 'Student not found');

    const target = await Section.findById(targetSectionId);
    if (!target) throw new AppError(404, 'Target section not found');

    const previousSectionId = idOf(student.sectionId);
    student.sectionId = target._id;
    if (target.batchId) student.batchId = target.batchId;
    await student.save();

    if (previousSectionId && String(previousSectionId) !== String(target._id)) {
      await CRAssignment.deleteMany({ userId: studentId, sectionId: previousSectionId });
    }

    await logAudit({
      action: 'student_moved',
      user: req.user,
      sectionId: target._id,
      targetId: studentId,
      details: `Moved ${student.name} from Section ${previousSectionId || 'unknown'} to Section ${target.name}`,
      req,
    });
    sendData(res, { message: 'Student moved' });
  })
);

export default router;
