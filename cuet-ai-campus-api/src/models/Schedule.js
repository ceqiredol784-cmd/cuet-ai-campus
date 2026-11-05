import mongoose from 'mongoose';
import { baseOptions } from './options.js';
import { OVERRIDE_STATUSES, OVERRIDE_TYPES } from '../constants.js';

const overrideSchema = new mongoose.Schema(
  {
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
      required: true,
      index: true,
    },
    type: { type: String, enum: OVERRIDE_TYPES, required: true, index: true },
    status: {
      type: String,
      enum: OVERRIDE_STATUSES,
      default: 'approved',
      index: true,
    },
    specificDate: { type: String, default: null, index: true },
    startDate: { type: String, default: null, index: true },
    endDate: { type: String, default: null, index: true },
    startTime: { type: String, default: null },
    endTime: { type: String, default: null },
    room: { type: String, default: null },
    /** Only meaningful for extra_class declarations: 'lecture' (make-up class) or 'ct' (declared class test). */
    classType: { type: String, enum: ['lecture', 'ct'], default: 'lecture' },
    /** Shared id across every section copy of a batch-wide declaration (e.g. a CT). */
    groupId: { type: String, default: null, index: true },
    routineEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RoutineEntry',
      default: null,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      default: null,
    },
    originalValues: {
      startTime: { type: String, default: null },
      endTime: { type: String, default: null },
      room: { type: String, default: null },
    },
    reason: { type: String, default: '', maxlength: 1000 },
    declaredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewNote: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
  },
  baseOptions
);

overrideSchema.index({ sectionId: 1, status: 1, specificDate: 1 });
overrideSchema.index({ sectionId: 1, status: 1, startDate: 1, endDate: 1 });
overrideSchema.index({ declaredBy: 1, createdAt: -1 });

const routinePdfSchema = new mongoose.Schema(
  {
    title: { type: String, default: 'Class Routine', trim: true },
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    path: { type: String, required: true },
    mimeType: { type: String, default: 'application/pdf' },
    size: { type: Number, default: 0 },
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
      default: null,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    extractionStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    extractionError: { type: String, default: null },
    extractionData: { type: mongoose.Schema.Types.Mixed, default: null },
    rawText: { type: String, select: false, default: '' },
    publishedAt: { type: Date, default: null },
  },
  baseOptions
);

export const ScheduleOverride = mongoose.model('ScheduleOverride', overrideSchema);
export const RoutinePdf = mongoose.model('RoutinePdf', routinePdfSchema);
