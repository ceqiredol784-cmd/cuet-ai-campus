import express from 'express';
import pdfParse from 'pdf-parse';
import { protect, requireCoordinator } from '../middleware/auth.js';
import { routinePdfUpload } from '../middleware/upload.js';
import { RoutinePdf, RoutineEntry, Section, Course, Teacher } from '../models/index.js';
import fs from 'node:fs';
import path from 'node:path';
import { asyncHandler, sendData } from '../utils/http.js';
import { AppError } from '../utils/http.js';
import { logAudit } from '../services/audit.js';

const router = express.Router();
router.use(protect);

router.get(
  '/latest',
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.sectionId) filter.sectionId = req.query.sectionId;
    const pdf = await RoutinePdf.findOne(filter).sort({ createdAt: -1 });
    if (!pdf) throw new AppError(404, 'No routine PDF uploaded yet');
    sendData(res, {
      _id: String(pdf._id),
      title: pdf.title,
      filename: pdf.filename,
      originalName: pdf.originalName,
      size: pdf.size,
      createdAt: pdf.createdAt,
      extraction: { status: pdf.extractionStatus, error: pdf.extractionError },
      extractionStatus: pdf.extractionStatus,
      status: pdf.extractionStatus,
    });
  })
);

router.post(
  '/',
  requireCoordinator,
  routinePdfUpload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new AppError(400, 'PDF file is required');

    const pdf = new RoutinePdf({
      title: req.body.title || req.file.originalname,
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      mimeType: req.file.mimetype,
      size: req.file.size,
      sectionId: req.body.sectionId || null,
      uploadedBy: req.user._id,
      extractionStatus: 'pending',
    });
    await pdf.save();

    // Kick off extraction in the background so the client can poll quickly.
    setImmediate(() => {
      extractPdfText(pdf._id.toString()).catch((error) => {
        console.error('[pdf] extraction failed:', error.message);
      });
    });

    await logAudit({
      action: 'routine_pdf_uploaded',
      user: req.user,
      sectionId: pdf.sectionId,
      targetId: pdf._id,
      details: `Uploaded routine PDF: ${req.file.originalname}`,
      req,
    });

    sendData(
      res,
      {
        _id: String(pdf._id),
        extractionStatus: 'pending',
        status: 'pending',
      },
      201
    );
  })
);

router.delete(
  '/:id',
  requireCoordinator,
  asyncHandler(async (req, res) => {
    const pdf = await RoutinePdf.findById(req.params.id);
    if (!pdf) throw new AppError(404, 'Routine PDF not found');
    try {
      fs.unlinkSync(pdf.path);
    } catch {
      /* ignore missing file */
    }
    await RoutinePdf.findByIdAndDelete(req.params.id);
    sendData(res, { message: 'Routine PDF deleted' });
  })
);

router.post(
  '/:id/extract',
  requireCoordinator,
  asyncHandler(async (req, res) => {
    const pdf = await RoutinePdf.findById(req.params.id);
    if (!pdf) throw new AppError(404, 'Routine PDF not found');
    pdf.extractionStatus = 'processing';
    await pdf.save();
    await extractPdfText(pdf._id.toString());
    const refreshed = await RoutinePdf.findById(pdf._id);
    sendData(res, {
      status: refreshed.extractionStatus,
      error: refreshed.extractionError,
      data: refreshed.extractionData,
    });
  })
);

router.get(
  '/:id/extraction',
  requireCoordinator,
  asyncHandler(async (req, res) => {
    const pdf = await RoutinePdf.findById(req.params.id);
    if (!pdf) throw new AppError(404, 'Routine PDF not found');
    sendData(res, {
      status: pdf.extractionStatus,
      error: pdf.extractionError,
      data: pdf.extractionData,
    });
  })
);

router.post(
  '/:id/publish',
  requireCoordinator,
  asyncHandler(async (req, res) => {
    const { sections, replace } = req.body || {};
    if (!Array.isArray(sections) || !sections.length) {
      throw new AppError(400, 'sections is required');
    }

    const published = [];
    const unresolved = [];

    for (const section of sections) {
      // RoutineEntry is unique per (section, day, period). Extracted rows often
      // carry period 0, so assign a free period per day instead of letting the
      // second row of a day collide and fail the whole publish.
      const usedPeriods = new Map();
      const periodFor = (day, requested) => {
        const used = usedPeriods.get(day) ?? new Set();
        let period = Number(requested) || 0;
        if (period <= 0 || used.has(period)) {
          period = 1;
          while (used.has(period)) period += 1;
        }
        used.add(period);
        usedPeriods.set(day, used);
        return period;
      };
      const sectionDoc = await Section.findOne({
        name: String(section.name).trim(),
      });
      if (!sectionDoc) {
        unresolved.push(`Section ${section.name}`);
        continue;
      }

      if (replace) {
        await RoutineEntry.deleteMany({ sectionId: sectionDoc._id });
      }

      for (const entry of section.entries || []) {
        const course = await findCourse(entry.courseCode, entry.courseTitle);
        if (!course) {
          unresolved.push(entry.courseCode);
          continue;
        }

        const teacher = await findTeacher(entry.instructor);
        const routineEntry = new RoutineEntry({
          sectionId: sectionDoc._id,
          courseId: course._id,
          teacherId: teacher ? teacher._id : null,
          day: entry.day,
          period: periodFor(entry.day, entry.period),
          startTime: entry.startTime,
          endTime: entry.endTime,
          room: entry.room || null,
          classType: entry.classType || 'lecture',
          isBreak: Boolean(entry.isBreak),
          breakType: entry.breakType || null,
          createdBy: req.user._id,
        });
        await routineEntry.save();
        published.push(routineEntry);
      }
    }

    await RoutinePdf.findByIdAndUpdate(req.params.id, { publishedAt: new Date() });
    await logAudit({
      action: 'routine_pdf_published',
      user: req.user,
      targetId: req.params.id,
      details: `Published ${published.length} routine entries`,
    });

    sendData(res, { published: published.length, unresolvedCourses: unresolved });
  })
);

router.get(
  '/download/:id',
  asyncHandler(async (req, res) => {
    const pdf = await RoutinePdf.findById(req.params.id);
    if (!pdf) throw new AppError(404, 'Routine PDF not found');

    // Keep the PDF available to the browser's embedded viewer instead of
    // forcing every request to become an attachment download.
    const filename = path.basename(pdf.originalName || 'routine.pdf').replace(/["\r\n]/g, '');
    res.type('application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`
    );
    res.sendFile(path.resolve(pdf.path));
  })
);

async function extractPdfText(pdfId) {
  const pdf = await RoutinePdf.findById(pdfId);
  if (!pdf) return;

  try {
    const dataBuffer = fs.readFileSync(pdf.path);
    const data = await pdfParse(dataBuffer);

    const text = data.text || '';
    pdf.rawText = text.slice(0, 200_000);

    const sections = parseRoutineText(text);
    pdf.extractionData = {
      title: pdf.title,
      stats: { sections: sections.length, entries: sections.reduce((sum, s) => sum + s.entries.length, 0) },
      warnings: [],
      sections,
    };
    pdf.extractionStatus = 'completed';
    pdf.extractionError = null;
  } catch (error) {
    pdf.extractionStatus = 'failed';
    pdf.extractionError = error.message || 'Extraction failed';
  }
  await pdf.save();
}

function findCourse(code, title) {
  if (!code) return null;
  const escape = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const filter = { code: new RegExp(`^${escape(String(code).trim())}$`, 'i') };
  if (title) filter.title = new RegExp(`^${escape(String(title).trim())}$`, 'i');
  return Course.findOne(filter);
}

async function findTeacher(name) {
  if (!name) return null;
  const escape = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return Teacher.findOne({ name: new RegExp(`^${escape(String(name).trim())}$`, 'i') });
}

function parseRoutineText(text) {
  // Heuristic extraction: the official CUET routine PDF is a table that
  // pdf-parse may or may not linearize reliably. This produces best-effort
  // entries so the coordinator review page has something to work with.
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const dayRe = /^(Sunday|Monday|Tuesday|Wednesday|Thursday)\b/i;
  const entryRe =
    /(CSE-\d{3}[A-Z0-9/\\-]*|\bCT\b)\s+(.{0,60}?)\s+(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/i;

  const sections = [];
  let currentSection = null;
  let currentDay = null;

  for (const line of lines) {
    const dayMatch = line.match(dayRe);
    if (dayMatch) {
      currentDay = dayMatch[1].charAt(0).toUpperCase() + dayMatch[1].slice(1).toLowerCase();
      continue;
    }

    const entryMatch = line.match(entryRe);
    if (entryMatch && currentDay) {
      if (!currentSection) {
        currentSection = { name: 'A', entries: [] };
        sections.push(currentSection);
      }
      currentSection.entries.push({
        courseCode: entryMatch[1].trim(),
        courseTitle: entryMatch[2].replace(/\s+/g, ' ').trim(),
        day: currentDay,
        period: 0,
        startTime: entryMatch[3],
        endTime: entryMatch[4],
        room: null,
        instructor: null,
        classType: 'lecture',
      });
    }
  }

  if (sections.length === 0) {
    sections.push({ name: 'A', entries: [] });
  }
  return sections;
}

export default router;
