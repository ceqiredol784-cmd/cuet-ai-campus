# CUET AI Campus API

Node.js + Express + MongoDB backend for the CUET AI Campus React web app (`cuet-ai-campus-web`). The web app calls this API at `/api/v1` (Vite dev proxies `/api` to `http://localhost:3000`).

## Requirements

- Node.js >= 20
- MongoDB 7 (local or Atlas)
- npm

## Quick start

```bash
cd cuet-ai-campus-api
cp .env.example .env   # adjust values if needed
npm install

# Option A: run MongoDB with Docker
docker compose up -d

# Option B: local MongoDB at mongodb://127.0.0.1:27017/cuet_ai_campus

# Start the API (auto-seeds demo data on first start in development)
npm run dev
```

The API listens on `http://localhost:3000`. Health: `GET /health`.

## Demo credentials (seeded automatically)

The seed creates exactly three accounts — one per role — all with password `Campus123`
(set `DEMO_PASSWORD` to change). Everything else it creates is content (routine,
courses, exams, assignments, notices); no other users exist.

| Email | Role | Section |
|---|---|---|
| u2204001@student.cuet.ac.bd | Student | A |
| u2204002@student.cuet.ac.bd | Student + CR | A |
| u2204003@student.cuet.ac.bd | Student | B |
| coordinator@cuet.ac.bd | Coordinator | A (department-wide access) |

## Seed

```bash
npm run seed        # idempotent-ish; clears and reseeds demo data
npm run seed:fresh  # same as seed
```

Auto-seed runs on startup when `AUTO_SEED=true` and `NODE_ENV != production` and the database is empty-ish (it always re-seeds on explicit `npm run seed`).

## Project structure

```
src/
  app.js              Express app + route mounting
  server.js           Entry point: connects Mongo, optional auto-seed, listens
  config/env.js       Environment configuration
  config/db.js        Mongoose connection
  constants.js        Roles, permissions, days, update/override enums
  models/             Mongoose schemas (User, Academic, Routine, Update,
                     StudentContent, Schedule, Operations)
  services/           Business logic (profile, schedule, calendar, updates,
                     attendance, access, audit, routineSerializer)
  middleware/         auth, error handling, multer uploads
  routes/             Route modules mounted under /api/v1
  seed/seed.js        Demo data seed (routine from the official L3-T-II seed)
tests/
  api.test.js         Supertest + mongodb-memory-server integration tests
```

## Key design notes

- **Response envelope**: `{"success": true, "data": ...}`. Errors: `{"success": false, "message": "..."}`.
- **Auth**: JWT (`Authorization: Bearer <token>`), bcrypt password hashing, `/auth/login`, `/auth/register`, `/auth/me`, `/auth/set-password`, `/auth/forgot-password`.
- **Profile**: `/auth/me` returns the user with populated `departmentId`, `batchId`, `sectionId` (with `termId` as a string) and `academicSessionId`, matching the React `parseUserProfile` contract.
- **Section scoping**: students/CRs see only their own section; coordinators see their department/batch sections; admins are global. CRs cannot create overrides/announcements for other sections.
- **Calendar/effective schedule**: `GET /api/v1/calendar/day?date=YYYY-MM-DD&sectionId=` merges the official weekly routine with approved overrides (cancellation, room/time change, extra class, auto day off, mid-break) and exams for the date. Original room/time values are preserved in `original`. `GET /calendar/range` returns per-day statuses for month markers.
- **Overrides (CR declarations)**: CRs create date-aware overrides (`POST /api/v1/overrides`), list them (`GET /overrides`), and withdraw them (`DELETE /overrides/:id`). Overrides default to `approved` so calendar behavior matches the React CR Center. Coordinators/admins can review any override.
- **Class tests (CT)**: CRs declare a CT by creating an `extra_class` override with `classType: 'ct'` (the Declare CT dialog in the CR Center). Without explicit times it lands in the section's routine CT slot (period 1) for that weekday. Declared CTs — and the routine CT slot — can then be shifted (`time_change`/`room_change`) or cancelled (`class_cancellation`) by referencing the CT's id in `routineEntryId`. Declared CTs keep `classType: 'ct'` on the calendar and are excluded from attendance tracking like routine CT periods.
- **Updates/announcements**: `GET /updates`, `POST /updates` (multipart `data` + `files[]`), `POST /updates/:id/upvote`, `PUT /updates/:id/read`, `PUT /updates/:id/review`, `DELETE /updates/:id`. Section/batch/department/global scoping; CR posts are approved instantly.
- **Routine PDF**: upload (`POST /routine-pdf`), extraction polling (`/:id/extract`, `/:id/extraction`), publish extracted sections as routine entries (`/:id/publish`), download (`/download/:id`), delete.
- **Coordinator**: sections with counts, students, CR assign/remove, stats, audit logs, quality issues, notices, student-ID-range assignment rules (apply/move student).
- **Admin**: stats, users, audit logs.
- **Others**: assignments, exams, attendance view/mark, study materials, feedback, shared files, chat, notifications, AI chat (deterministic fallback; OpenAI/Gemini when keys are configured).
- **File storage**: local `uploads/` directory, served at `/uploads`; URLs use `PUBLIC_BASE_URL` or the request origin.

## Tests

```bash
npm test
```

Uses `mongodb-memory-server` (downloads a real MongoDB binary on first run) plus `supertest`; no local MongoDB required.

## Production

- Set a strong `JWT_SECRET`.
- Set `NODE_ENV=production` (dev login disabled, auto-seed disabled).
- Point `MONGODB_URI` at your MongoDB instance and `CORS_ORIGINS` at your frontend origin.
- Consider fronting with a reverse proxy (nginx/Caddy) for TLS and static file serving.
