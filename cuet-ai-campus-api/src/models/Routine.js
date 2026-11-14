import mongoose from 'mongoose';
import { baseOptions } from './options.js';
import { DAYS } from '../constants.js';

const routineEntrySchema = new mongoose.Schema(
  {
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
      required: true,
      index: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      default: null,
    },
    day: { type: String, enum: DAYS, required: true, index: true },
    period: { type: Number, required: true, min: 0, max: 12 },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    room: { type: String, default: null },
    classType: { type: String, default: 'lecture', trim: true },
    // Free-text teacher list — a class may be taken by one, two or more
    // teachers (used when no single Teacher record is linked).
    teacherNames: { type: [String], default: [] },
    isBreak: { type: Boolean, default: false },
    breakType: { type: String, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  baseOptions
);

routineEntrySchema.index(
  { sectionId: 1, day: 1, period: 1 },
  { unique: true }
);
routineEntrySchema.index({ sectionId: 1, day: 1, startTime: 1 });
routineEntrySchema.index({ teacherId: 1, day: 1, period: 1 });

export const RoutineEntry = mongoose.model('RoutineEntry', routineEntrySchema);

/**
 * A CR's full weekly class routine submitted for coordinator review. On
 * approval the proposal's entries replace the section's published routine.
 */
const routineProposalSchema = new mongoose.Schema(
  {
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
      required: true,
      index: true,
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    entries: [
      {
        day: { type: String, enum: DAYS, required: true },
        // Period-based: the official 9-period day; times derive from
        // PERIOD_TIMES. A class may span consecutive periods (labs).
        period: { type: Number, required: true, min: 1, max: 9 },
        periodEnd: { type: Number, min: 1, max: 9, default: null },
        startTime: { type: String, required: true },
        endTime: { type: String, required: true },
        courseCode: { type: String, required: true, trim: true },
        courseTitle: { type: String, default: '', trim: true },
        teachers: { type: [String], default: [] },
        classType: { type: String, default: 'lecture', trim: true },
        room: { type: String, default: null },
      },
    ],
    entryCount: { type: Number, default: 0 },
    reviewNote: { type: String, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
  },
  baseOptions
);

routineProposalSchema.index({ sectionId: 1, status: 1 });

export const RoutineProposal = mongoose.model('RoutineProposal', routineProposalSchema);
