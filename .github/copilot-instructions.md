# Copilot instructions for CUET AI Campus

## Repository shape

This repository contains two independent npm packages:

- `cuet-ai-campus-api/` — Node.js 20+ ES-module API using Express and Mongoose.
- `cuet-ai-campus-web/` — React 19 + React Router 7 frontend built with Vite 8 and Tailwind CSS 4.

There is no root `package.json`; run npm commands from the package they belong to.

## Build, test, and run commands

### API

From `cuet-ai-campus-api/`:

```bash
npm install
npm run dev
npm start
npm test
node --test --test-concurrency=1 --test-name-pattern="calendar" tests/api.test.js
npm run seed
npm run seed:fresh
```

`npm test` runs the Node test runner against `tests/*.test.js` with concurrency 1. The tests use `mongodb-memory-server`, so they do not require a separate local MongoDB instance, although the first run may download a MongoDB binary. There is no API lint script configured.

The normal development server requires MongoDB and loads `.env` values. Copy `.env.example` to `.env` when setting up a local environment. The API listens on port 3000 by default and exposes `/health` plus versioned endpoints below `/api/v1`.

### Web

From `cuet-ai-campus-web/`:

```bash
npm install
npm run dev
npm run build
npm run preview
```

There is no frontend test or lint script configured. `npm run build` is the primary static validation for the web package.

## Architecture

### Backend request flow

`src/server.js` is the process entry point. It connects to MongoDB, optionally auto-seeds development data, and starts the HTTP listener. `src/app.js` constructs the Express application, applies security/body/logging middleware, serves local uploads, mounts route modules, and installs the not-found/error handlers.

Routes are deliberately thin endpoint modules under `src/routes/`. Shared business rules belong in `src/services/`; database persistence is represented by Mongoose schemas under `src/models/`. Authentication and authorization are split between JWT middleware in `src/middleware/auth.js` and access/scoping helpers in `src/services/access.js`. Configuration is centralized in `src/config/env.js`, and database connection setup is in `src/config/db.js`.

All API responses use the envelope `{ success: true, data: ... }`; failures use `{ success: false, message: "..." }`. Preserve this contract when adding or changing endpoints. The frontend expects populated profile relationships and normalized identifiers from `/auth/me`.

The most important backend domain flow is the effective schedule: routine data, date-aware overrides, and exams are merged by calendar services/routes. Overrides cover cancellations, room/time changes, extra classes, day off, and breaks. Attendance must use the effective schedule so cancelled classes are excluded and restored classes can be tracked again.

### Frontend request and rendering flow

`src/main.jsx` mounts the provider tree. `src/App.jsx` defines lazy-loaded routes, route guards, and the authenticated app/coordinator shells. Feature screens live under `src/features/`; reusable UI and layout are under `src/components/`.

`src/api/client.js` is the single fetch layer. It adds the JWT, handles timeouts and API error mapping, broadcasts expired-session 401s, and supports multipart uploads. Endpoint paths and feature-facing API wrappers are kept in `src/api/endpoints.js` and `src/hooks/useApi.js`.

The frontend is intentionally offline-capable. Auth, cache, event, routine, override, reminder, and AI behavior is implemented through `src/lib/` helpers plus `src/data/seedData.js`. An `offline-test-session` must never be treated as a live server token. Screens that require server-only data should show an explicit error rather than fabricate data.

Routine and calendar UI must use the effective schedule, including permanent local routine edits and date-aware CR declarations. The frontend applies local-first changes immediately and synchronizes them with the API on a best-effort basis.

## Codebase-specific conventions

- Keep API route mounting under `/api/v1`; add a route module and mount it in `src/app.js` rather than embedding large feature handlers there.
- Put cross-route business logic in services and reuse existing validation/date/access helpers instead of duplicating role or section checks.
- Enforce section/batch/department scope on the server. Students and CRs are section-scoped, coordinators are department/batch-scoped, and admins are global. Never rely only on frontend route guards for authorization.
- Preserve the API response envelope and the frontend parsers/models that consume it.
- Use the existing role names and permission constants from `src/constants.js`; do not introduce ad-hoc role strings in new backend authorization logic.
- Keep date handling consistent with the configured `APP_TIME_ZONE` (`Asia/Dhaka` by default) and existing utilities in `src/utils/dates.js` and `cuet-ai-campus-web/src/lib/datetime.js`.
- For authenticated frontend requests, use `apiClient`/endpoint helpers rather than calling `fetch` directly. Use `upload()` for multipart data so browser boundaries are preserved.
- Treat offline data as a real fallback path: update local caches and render immediately where the feature supports it, then attempt synchronization without replacing successful local state with fake server-shaped data.
- Preserve the distinction between permanent weekly routine edits and one-off date-aware overrides. A withdrawn one-off override must restore the original schedule.
- CR announcements have only Section and Batch audiences; retain the same filtering rules in both server and offline/local-first paths.
- Lazy-load feature pages through `React.lazy` in `src/App.jsx`, keeping large optional dependencies such as Leaflet out of the main bundle.
- Follow the existing plain JavaScript/JSX style and existing UI primitives; this project does not use TypeScript or a separate state-management library.
- When changing an endpoint or response shape, update the corresponding frontend endpoint/parser/cache behavior and add or adjust an integration test in `cuet-ai-campus-api/tests/api.test.js`.

## Important environment behavior

Development demo accounts and automatic seed behavior are controlled by API environment variables. `ENABLE_DEV_LOGIN` is disabled in production, and `AUTO_SEED` should not be enabled in production. The web app can use the Vite `/api` and `/health` proxies in development; deployed builds can set `VITE_API_BASE_URL`.
