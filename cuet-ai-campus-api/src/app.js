import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { env } from './config/env.js';
import { notFound, errorHandler } from './middleware/error.js';

import authRoutes from './routes/auth.routes.js';
import usersRoutes from './routes/users.routes.js';
import academicsRoutes from './routes/academics.routes.js';
import routineRoutes from './routes/routine.routes.js';
import updatesRoutes from './routes/updates.routes.js';
import assignmentsRoutes from './routes/assignments.routes.js';
import examsRoutes from './routes/exams.routes.js';
import aiRoutes from './routes/ai.routes.js';
import coordinatorRoutes from './routes/coordinator.routes.js';
import adminRoutes from './routes/admin.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';
import studyMaterialsRoutes from './routes/studyMaterials.routes.js';
import feedbackRoutes from './routes/feedback.routes.js';
import sharedFilesRoutes from './routes/sharedFiles.routes.js';
import chatRoutes from './routes/chat.routes.js';
import routinePdfRoutes from './routes/routinePdf.routes.js';
import calendarRoutes from './routes/calendar.routes.js';
import overridesRoutes from './routes/overrides.routes.js';
import routineProposalRoutes from './routes/routineProposal.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';

const app = express();

app.set('trust proxy', 1);

app.use(compression());
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  })
);
app.use(
  cors({
    origin: env.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

if (!env.isTest) {
  app.use(morgan('dev'));
}

// Public health endpoint used by the frontend debug page at site origin /health
app.get('/health', async (_req, res) => {
  res.json({ status: 'ok', service: 'cuet-ai-campus-api', time: new Date().toISOString() });
});

app.use('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok', service: 'cuet-ai-campus-api', time: new Date().toISOString() });
});

// Serve uploaded files statically (development/local storage)
app.use('/uploads', express.static(env.uploadDir));

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/academics', academicsRoutes);
app.use('/api/v1/routine', routineRoutes);
app.use('/api/v1/updates', updatesRoutes);
app.use('/api/v1/assignments', assignmentsRoutes);
app.use('/api/v1/exams', examsRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/coordinator', coordinatorRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/notifications', notificationsRoutes);
app.use('/api/v1/study-materials', studyMaterialsRoutes);
app.use('/api/v1/feedback', feedbackRoutes);
app.use('/api/v1/shared-files', sharedFilesRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/routine-pdf', routinePdfRoutes);
app.use('/api/v1/calendar', calendarRoutes);
app.use('/api/v1/overrides', overridesRoutes);
app.use('/api/v1/routine-proposals', routineProposalRoutes);
app.use('/api/v1/attendance', attendanceRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
