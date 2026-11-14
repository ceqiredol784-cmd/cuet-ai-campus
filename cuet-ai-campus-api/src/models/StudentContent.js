import mongoose from 'mongoose';
import { baseOptions } from './options.js';
import {
  ASSIGNMENT_PRIORITIES,
  ASSIGNMENT_STATUSES,
  STUDY_MATERIAL_TYPES,
} from '../constants.js';

const assignmentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
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
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', default: null },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    deadline: { type: Date, required: true, index: true },
    priority: {
      type: String,
      enum: ASSIGNMENT_PRIORITIES,
      default: 'medium',
    },
    status: {
      type: String,
      enum: ASSIGNMENT_STATUSES,
      default: 'not_started',
    },
    attachments: { type: [String], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  baseOptions
);
assignmentSchema.index({ userId: 1, deadline: 1 });
assignmentSchema.index({ sectionId: 1, deadline: 1 });

const examSchema = new mongoose.Schema(
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
    examType: { type: String, default: 'final', trim: true, index: true },
    examDate: { type: String, required: true, index: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    room: { type: String, default: null },
    venue: { type: String, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // CR-submitted exams stay `pending` until a coordinator approves them;
    // coordinator/admin-created exams are approved immediately.
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'approved',
      index: true,
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: null },
  },
  baseOptions
);
examSchema.index({ sectionId: 1, examDate: 1 });

const attendanceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
      required: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    date: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    status: {
      type: String,
      enum: ['present', 'absent'],
      default: 'absent',
    },
    classType: { type: String, default: 'lecture' },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  baseOptions
);
attendanceSchema.index(
  { userId: 1, courseId: 1, date: 1, startTime: 1 },
  { unique: true }
);

const studyMaterialSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    type: {
      type: String,
      enum: STUDY_MATERIAL_TYPES,
      default: 'other',
    },
    url: { type: String, required: true, trim: true },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      default: null,
      index: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
    uploadedBy: { type: String, default: 'Campus faculty' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  baseOptions
);

export const Assignment = mongoose.model('Assignment', assignmentSchema);
export const Exam = mongoose.model('Exam', examSchema);
export const Attendance = mongoose.model('Attendance', attendanceSchema);
export const StudyMaterial = mongoose.model('StudyMaterial', studyMaterialSchema);
