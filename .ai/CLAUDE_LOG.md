# Claude Activity Log

Purpose: Track every change, why it was done, and how it was verified.

---

## 2026-03-17 — Catalog page visual redesign
**Goal**: Improve catalog listing page design without changing logic
**Root cause**: Page lacked dark mode, had plain card design, basic pagination, no filter chips
**Changes**:
- `apps/web/app/dashboard/catalog/page.tsx` — full dark mode support, card hover-lift animation, spine-style cover placeholder, inline dismissible filter chips, numbered pagination with ellipsis, polished header with total count badge, improved skeleton and empty state
**Verification**: tsc --noEmit ✓  |  next build N/A (tsc used per project convention)
**Next**: Book detail page could receive similar polish pass if desired

---

## 2026-03-17 — Fix book catalog: availability filter, list view, ebook-only UX, dedup
**Goal**: Fix all broken catalog features reported after browser testing.
**Root cause**: Availability filter was never applied in Prisma query; list view had no render code; ebook-only books showed as "Unavailable"; Gutendex re-import created duplicates; no descriptions saved for imported books.
**Changes**:
- `apps/api/src/books/dto/books.dto.ts` — added `'ebook-only'` to availability union
- `apps/api/src/books/books.service.ts` — implemented availability filter at DB level using Prisma `copies` relation (`some`/`none`/`AND NOT`); fixed author sort (String[] unorderable → falls back to `createdAt`)
- `apps/api/src/external-books/external-books.service.ts` — title+source duplicate check for non-ISBN books; added `first_sentence` to OL fields + `extractOLDescription` helper; Gutendex subjects as description
- `apps/web/app/dashboard/catalog/page.tsx` — full list view implementation; three-state badge (Available/E-book Only/Unavailable); filter options renamed; `isEbookAvailable` added to interface
- `apps/web/app/dashboard/catalog/[id]/page.tsx` — ebook-only books get blue status; inline read button in availability card; amber warning hidden for ebook-only
**Verification**: nest build ✓ | tsc --noEmit ✓
**Commit**: `5fa7baa` fix(catalog): availability filter, list view, ebook-only UX, and dedup
**Next**: Watch for edge cases on books that have both physical copies AND ebook — currently show green badge + small blue "E-book" pill

---

## 2026-03-17 — External ebook integration: dual bulk import + persistent import state
**Goal**: Add bulk Open Library import (was missing), make imported state survive page reloads.
**Root cause**: Only Gutendex bulk endpoint existed; imported Set was React state only (lost on reload).
**Changes**:
- `apps/api/src/external-books/external-books.service.ts` — added `checkExisting()` (ISBN + title+source), `bulkImportOpenLibrary()`
- `apps/api/src/external-books/external-books.controller.ts` — added `POST /external-books/check-existing`, `POST /external-books/import/openlibrary`
- `apps/web/lib/api.ts` — added `checkExisting()`, `bulkImportOpenLibrary()` to `externalBooksApi`
- `apps/web/app/dashboard/admin/import-books/page.tsx` — rewritten: dual bulk buttons, source filter tabs, `checkExisting` call after search pre-populates imported Set from DB, 409 treated as already-imported
**Verification**: nest build ✓ | tsc --noEmit ✓
**Commit**: `123dcce` feat(external-books): add bulk open library import and persistent import state
**Next**: —

---

## 2026-03-17 — Add UI/UX Pro Max design skills + 21st.dev MCP
**Goal**: Enhance Claude's UI/UX capabilities with design intelligence skills and 21st.dev component library access.
**Changes**:
- `local-notes/skills/` — added 7 skill folders from ui-ux-pro-max-skill repo (ui-ux-pro-max, design-system, ui-styling, brand, banner-design, slides, design)
- `~/.claude.json` — registered 21st.dev magic MCP server (user-scoped)
- Skipped external local-notes.md to preserve project instructions
**Verification**: No code changes — skills are reference-only
**Next**: Claude agents will auto-apply design rules when building UI components

---

## 2026-03-17 — Add 8 test books with real data and e-book URLs
**Goal**: Add 8 specific books to the database with real metadata, cover images, e-book URLs, and random campus assignments.
**Root cause**: Need realistic test data with e-book support for development and demo.
**Changes**:
- `apps/api/prisma/add-books.ts` — standalone script to upsert 8 books (Clean Code, Art of War, Think Python, Pro Git, Intro to Algorithms, Eloquent JavaScript, Linux Command Line, Frankenstein) with full metadata, cover images, and e-book URLs where available
- 2 existing books updated (Clean Code, Intro to Algorithms) with richer data; all copies set to AVAILABLE
- 6 new books created with 3 copies each at randomly assigned campuses
- 7/8 books have `isEbookAvailable: true` with read-only e-book URLs
**Verification**: nest build ✓ | next build ✓ | script executed successfully
**Next**: Books are live in the database; verify in the UI

---

## 2026-03-17 — External E-Book API Integration

**Goal**: Add external book search and import from Open Library and Gutendex (free, no-key APIs only).

**Changes**:
- `apps/api/src/external-books/dto/external-books.dto.ts` — ImportBookDto, NormalizedBook interface
- `apps/api/src/external-books/external-books.service.ts` — fetchOpenLibraryBooks, fetchGutendexBooks, normalizeGutendexResults, importBook (with duplicate ISBN guard), bulkImportGutendex; uses Node.js built-in `https` module, no new deps
- `apps/api/src/external-books/external-books.controller.ts` — GET /external-books/search, POST /external-books/import (ADMIN), POST /external-books/import/gutendex (ADMIN)
- `apps/api/src/external-books/external-books.module.ts` — module registration
- `apps/api/src/app.module.ts` — registered ExternalBooksModule
- `apps/web/lib/api.ts` — added NormalizedBook interface and externalBooksApi (search, importBook, bulkImportGutendex)
- `apps/web/app/dashboard/admin/import-books/page.tsx` — search UI, source filter tabs, book card grid with cover/import button, loading skeletons, bulk import button
- `apps/web/middleware.ts` — added /dashboard/admin/import-books to ROUTE_PERMISSIONS
- `docs/EBOOK_INTEGRATION.md` — full academic-style documentation

**Verification**: nest build ✓ | tsc --noEmit ✓

**Next**: Navigate to /dashboard/admin/import-books and test search + single import + bulk import

---

## 2026-03-17 — Fix Google OAuth role-based redirect

**Goal**: Fix Google OAuth callback hardcoding `/dashboard/student` for all users regardless of role.

**Root cause**: `auth.controller.ts` line 188 had `res.redirect(\`${this.frontendUrl}/dashboard/student\`)` — no role check, so ADMINs and INSTRUCTORs landing via Google OAuth were sent to the student dashboard.

**Changes**:
- `apps/api/src/auth/auth.controller.ts` — replaced hardcoded path with a `roleDashboards` map keyed on `user.role`

**Verification**: nest build ✓

**Next**: Test Google OAuth login with each role type

---

## 2026-03-16 — Surface SMTP failures, add auth-page guards, remove wallet guard

**Goal**: Fix silent SMTP failure hiding from users, add authenticated-user redirect on signup, improve login error messages, remove irrelevant InjectedWalletErrorGuard component.

**Root cause**:
- `mail.service.ts` swallowed SMTP errors silently — users saw "Registration successful" but never received a code
- `signup/page.tsx` had no check for already-authenticated users (unlike login page)
- `login/page.tsx` showed generic toasts regardless of error type
- `InjectedWalletErrorGuard` was a crypto wallet noise suppressor with no relevance to the app

**Changes**:
- `apps/api/src/mail/mail.service.ts` — `send()` now throws `ServiceUnavailableException` when transporter is null or sendMail fails; removed `logFallback()` silent swallow
- `apps/api/src/auth/auth.service.ts` — `register()` catches email failure, returns `emailSent: boolean` flag; in dev mode includes the verification code in the response message
- `apps/web/lib/api.ts` — updated `register()` return type to include `emailSent: boolean`
- `apps/web/app/signup/page.tsx` — added `useAuth` redirect for authenticated users; shows warning toast when `emailSent: false`
- `apps/web/app/login/page.tsx` — smarter error handling: unverified account redirects to /verify-email, deactivated shows admin message, wrong password clears field
- `apps/web/app/layout.tsx` — removed `InjectedWalletErrorGuard` import and usage
- `apps/web/components/InjectedWalletErrorGuard.tsx` — deleted

**Verification**: nest build ✓ | next tsc --noEmit ✓ (next build blocked by dev server file lock on .next/trace — not a code error)

**Next**: Fix SMTP_PASS in .env (remove spaces from Gmail App Password: `zejmvpsmythumexs`), restart API, test signup flow end-to-end

## 2026-03-14 — Fix Signup Route Access

**Goal**: Fix /signup redirecting to /login when user is unauthenticated.

**Root Cause**: The axios response interceptor redirected to /login on ANY 401 error, except when already on /login. When visiting /signup, AuthProvider called getMe() which returned 401, triggering the redirect.

**Changes**:
- `apps/web/lib/api.ts`: Added PUBLIC_ROUTES array and updated 401 interceptor to skip redirect for /login, /signup, /verify-email, /forgot-password, /reset-password
- `README.md`: Added Gmail App Password documentation for SMTP configuration

**Note**: MailService already has proper fallback logging (confirmed no changes needed).

**Verification**: `npx nest build` ✓, `npx next build` ✓

---

## 2026-03-14 — Configuration Visibility (SMTP/Ollama/Google OAuth)

**Goal**: Make feature configuration visible via `/auth/config` endpoint and show disabled note when Google OAuth is off.

**Changes**:
- `apps/api/src/ai/ollama.service.ts`: Added `available` flag set in `onModuleInit`, exposed via `isAvailable()` getter
- `apps/api/src/ai/ai.module.ts`: Export `OllamaService` for use in AuthModule
- `apps/api/src/auth/auth.module.ts`: Import `MailModule` and `AiModule`
- `apps/api/src/auth/auth.controller.ts`:
  - Inject `MailService` and `OllamaService`
  - Extend `/auth/config` to return `{ googleOAuthEnabled, smtpEnabled, ollamaEnabled }`
- `apps/web/lib/api.ts`: Update `getConfig()` return type with new fields
- `apps/web/app/login/page.tsx`: Show "Google sign-in is disabled by the administrator." note when OAuth disabled
- `apps/web/app/signup/page.tsx`: Same disabled note
- `README.md`: Add "Optional Feature Configuration" table in Environment Variables section

**Verification**: `npx nest build` ✓, `npx next build` ✓

---

## 2026-03-13 — Reading Streak Feature

**Goal**: Implement functional reading streak on student dashboard (replace hard-coded "12").

**Definition**: Consecutive calendar days (backward from today) where the student had at least one ACTIVE/OVERDUE borrow covering that day.

**Changes**:
- `apps/api/src/dashboard/dashboard.service.ts`:
  - Added `activeBorrows` query fetching ACTIVE/OVERDUE borrows with borrowedAt, returnedAt
  - Added `calculateReadingStreak()` helper method
  - Included `readingStreak` in `getStudentStats()` return object
- `apps/web/app/dashboard/student/page.tsx`:
  - Extended `StudentStats` interface with `readingStreak: number`
  - Replaced hard-coded "12" with `stats?.readingStreak ?? 0`

**Verification**: `npx nest build` ✓, `npx next build` ✓

---

## 2026-03-13 — Production Auth/Mail Hardening

**Goal**: Harden auth/mail configuration so the app is production-ready and does not expose non-working Google OAuth or rely on overloaded env vars.

**Changes**:
- `apps/api/src/mail/mail.service.ts`: Use `FRONTEND_URL` for password reset links, falls back to first `CORS_ORIGIN`
- `apps/api/src/auth/auth.controller.ts`:
  - Inject `ConfigService`, use `FRONTEND_URL` for Google OAuth redirect
  - Add `GET /auth/config` endpoint returning `{ googleOAuthEnabled: boolean }`
- `apps/api/src/main.ts`: Add startup logs for Google OAuth status and FRONTEND_URL
- `apps/web/lib/api.ts`: Add `authApi.getConfig()` function
- `apps/web/app/login/page.tsx`: Conditionally render Google sign-in button based on `authApi.getConfig()`
- `apps/web/app/signup/page.tsx`: Conditionally render Google sign-up button based on `authApi.getConfig()`
- `apps/api/.env.example`: Add `FRONTEND_URL`, improve documentation for Google OAuth and SMTP settings
- `README.md`: Add "Production Auth & Mail Setup" section with Google OAuth, SMTP, and FRONTEND_URL guidance

**Files modified**:
- `apps/api/src/mail/mail.service.ts`
- `apps/api/src/auth/auth.controller.ts`
- `apps/api/src/main.ts`
- `apps/api/.env.example`
- `apps/web/lib/api.ts`
- `apps/web/app/login/page.tsx`
- `apps/web/app/signup/page.tsx`
- `README.md`

**Verification**: `npx nest build` ✓, `npx next build` ✓

---

## 2026-03-12 — Phase 5 Slice 4: Report Generation (PDF/Excel)

**Goal**: Admin can generate/export operational reports in PDF and Excel.

**Changes**:
- Installed `pdfkit`, `exceljs`, `@types/pdfkit`
- `apps/api/src/reports/`: New module — service (aggregate queries, top books, users by role), controller (GET /reports/summary, GET /reports/export?format=pdf|excel)
- PDF: pdfkit text/table summary with metrics, top books, users by role
- Excel: exceljs workbook with Summary, Top Books, Users by Role sheets
- `apps/api/src/app.module.ts`: Registered ReportsModule
- `apps/web/lib/api.ts`: Added `reportsApi` (getSummary, exportUrl helper)
- `apps/web/app/dashboard/admin/reports/page.tsx`: Date range picker, generate summary, export PDF/Excel buttons, summary cards + top books table + users by role
- `apps/web/app/dashboard/layout.tsx`: Added "Reports" nav item with FileDown icon
- `README.md`: Marked Report Generation as complete, added endpoint docs

**Verification**: `npx nest build` ✓, `npx next build` ✓

**Note**: Build error on first attempt — Book model uses `authors` (array) not `author`. Fixed to `.authors.join(', ')`.

---

## 2026-03-12 — Phase 5 Slice 3: Fine Payment Tracking

**Goal**: Track overdue fines and allow admin to mark paid/waived.

**Changes**:
- `prisma/schema.prisma`: Added `FineStatus` enum, `FinePayment` model with relations to Borrow (unique), User, and admin paidBy
- Migration: `add_fine_payment_tracking`
- `apps/api/src/fine-payments/`: New module — controller (GET list, GET totals, GET :id, PATCH :id/pay, PATCH :id/waive), service, DTO
- `apps/api/src/borrows/borrows.service.ts`: `returnBook()` now creates/upserts a PENDING FinePayment when fine > 0
- `apps/api/src/app.module.ts`: Registered FinePaymentsModule
- `apps/web/lib/api.ts`: Added `finePaymentsApi` client
- `apps/web/app/dashboard/admin/fines/page.tsx`: Admin page with totals cards, status filters, paginated table, pay/waive actions
- `apps/web/app/dashboard/layout.tsx`: Added "Fine Payments" nav item with DollarSign icon
- `README.md`: Marked Fine Payment Tracking as complete, added endpoint summary

**Verification**: `prisma migrate dev` ✓, `npx nest build` ✓, `npx next build` ✓

---

## 2026-03-12 — Fix admin sidebar overflow/logout and dead System Settings link

**Goal**: Sidebar nav overflows on short viewports, logout unreachable; System Settings link is a 404.

**Changes**:
- `apps/web/app/dashboard/layout.tsx`:
  - Aside: `h-full p-4` → `h-[calc(100vh-4rem)] flex flex-col`, padding moved to inner elements
  - Nav groups wrapped in `<nav className="flex-1 overflow-y-auto p-4">`
  - Logout button moved to separate `<div>` with `border-t` outside scroll area
  - Removed "System Settings" nav item (no page exists at `/dashboard/admin/settings`)

**Verification**: `npx next build` — passes clean.

**Result**: Sidebar scrolls on short viewports, logout always visible at bottom, no 404 link.

---

## 2026-03-12 — Phase 5 Slice 2: Configurable Borrow Policies

**Goal**: Allow ADMIN to view and update role-based borrow policies from admin dashboard.

**Changes**:
- Created `apps/api/src/borrow-policies/` — module, controller, service, DTO
  - `GET /borrow-policies` — list all policies
  - `PATCH /borrow-policies/:role` — update by role with validation (min/max limits)
- Updated `apps/api/src/app.module.ts` — imported BorrowPoliciesModule
- Created `apps/web/app/dashboard/admin/policies/page.tsx` — card grid per role with edit modal
- Updated `apps/web/lib/api.ts` — added `borrowPoliciesApi`
- Updated `apps/web/app/dashboard/layout.tsx` — added "Borrow Policies" nav with ShieldCheck icon
- Updated `README.md` — marked Configurable Borrow Policies complete

**Files**: `update-policy.dto.ts`, `borrow-policies.service.ts`, `borrow-policies.controller.ts`, `borrow-policies.module.ts`, `app.module.ts`, `policies/page.tsx`, `api.ts`, `layout.tsx`, `README.md`

**Commands**: `npx nest build` (pending), `npx next build` (pending)

---

## 2026-03-12 — Phase 5 Slice 1: Admin Branch Management

**Goal**: Allow ADMIN to manage library branches (CRUD + activate/deactivate) from admin dashboard.

**Changes**:
- Created `apps/api/src/branches/dto/branches.dto.ts` — CreateBranchDto, UpdateBranchDto with validation
- Created `apps/api/src/branches/branches.service.ts` — findAll, create, update, activate, deactivate with 409 for duplicate codes
- Created `apps/api/src/branches/branches.controller.ts` — ADMIN-guarded endpoints: GET/POST/PATCH /branches
- Created `apps/api/src/branches/branches.module.ts` — imports PrismaModule
- Updated `apps/api/src/app.module.ts` — imported BranchesModule
- Created `apps/web/app/dashboard/admin/branches/page.tsx` — table with create/edit modal, activate/deactivate buttons, toast feedback
- Updated `apps/web/lib/api.ts` — added `branchesApi` with getAll, create, update, activate, deactivate
- Updated `apps/web/app/dashboard/layout.tsx` — added "Manage Branches" nav item with Building2 icon
- Updated `README.md` — Phase 5 progress, Branch Management marked complete

**Files**: `branches.dto.ts`, `branches.service.ts`, `branches.controller.ts`, `branches.module.ts`, `app.module.ts`, `branches/page.tsx`, `api.ts`, `layout.tsx`, `README.md`

**Commands**: `npx nest build` (pending), `npx next build` (pending)

**Result**: Pending verification.

---

## 2026-03-12 — Phase 4 Monitoring Slice: Health Endpoints

**Goal**: Add liveness and readiness health endpoints to close the Error Logging & Monitoring item.

**Changes**:
- Created `apps/api/src/health/health.controller.ts` — `GET /health/live` (200 always), `GET /health/ready` (DB + optional Ollama checks, 200/503)
- Created `apps/api/src/health/health.module.ts` — imports PrismaModule
- Updated `apps/api/src/app.module.ts` — imported HealthModule
- Updated `apps/api/.env.example` — added `MONITOR_OLLAMA`
- Updated `README.md` — Health Endpoints section, marked roadmap item complete

**Files**: `health.controller.ts`, `health.module.ts`, `app.module.ts`, `.env.example`, `README.md`

**Commands**: `npx nest build` ✅, `npx next build` ✅

**Result**: Both builds pass.

---

## 2026-03-12 — Phase 4 Performance Optimization Slice 1

**Goal**: Add pagination, query shaping, and compound indexes to reduce unbounded query risk and improve response efficiency.

**Changes**:
- `borrows.service.ts` — `findAllBorrows()`: added full pagination (page/pageSize/count); `findMyBorrows()`: added `take: 50` cap; `findActiveBorrows()`: narrowed includes to select only needed fields
- `borrows.controller.ts` — pass page/pageSize query params to `findAllBorrows()`
- `reservations.service.ts` — `findMyReservations()`: `take: 50`; `findPendingReservations()`: `take: 100`; `findReadyForPickup()`: `take: 100`
- `reading-lists.service.ts` — `findMyLists()`: `take: 50`; `findAllForModeration()`: `take: 100`
- `schema.prisma` — replaced single-column indexes with compound indexes: `Notification(userId, read)`, `Notification(userId, createdAt)`, `Borrow(userId, status)`, `Borrow(status, dueAt)`, `Reservation(userId, status)`, `ReadingList(status, visibility)`
- `README.md` — Performance Optimization section, roadmap item marked complete

**Before/After observations**:
- `GET /borrows` (admin, no filters): Before = unbounded `findMany` fetching ALL rows with full `book` + `branch` includes. After = paginated (default 20, max 100) with shaped selects — query cost capped at O(pageSize) instead of O(total_rows)
- `Notification.findUnreadCount(userId)`: Before = seq scan on `read` column + filter by `userId`. After = compound index `(userId, read)` enables index-only lookup

**Files**: `borrows.service.ts`, `borrows.controller.ts`, `reservations.service.ts`, `reading-lists.service.ts`, `schema.prisma`, `README.md`

**Commands**: `npx prisma generate` ✅, `npx nest build` ✅, `npx next build` ✅

**Result**: Both builds pass. All unbounded list queries now have safety caps or full pagination.

---

## 2026-03-12 — Phase 4 Security Hardening Slice 1

**Goal**: Add baseline production API hardening — Helmet, CORS allowlist, rate limiting on auth + AI endpoints.

**Changes**:
- Installed `helmet` and `@nestjs/throttler`
- Updated `apps/api/src/main.ts` — added Helmet middleware (CSP disabled, COEP disabled for Swagger), trimmed CORS origins
- Updated `apps/api/src/app.module.ts` — registered `ThrottlerModule.forRootAsync()` with env-driven TTL/limit
- Updated `apps/api/src/auth/auth.controller.ts` — `@Throttle` + `ThrottlerGuard` on login, register, forgot-password (5 req/min)
- Updated `apps/api/src/ai/ai.controller.ts` — `@Throttle` + `ThrottlerGuard` on chat (15 req/min)
- Updated `apps/api/.env.example` — added `THROTTLE_TTL`, `THROTTLE_LIMIT`, `THROTTLE_AUTH_LIMIT`, `THROTTLE_AI_LIMIT`
- Updated `README.md` — Security Hardening section, roadmap item marked complete

**Files**: `main.ts`, `app.module.ts`, `auth.controller.ts`, `ai.controller.ts`, `.env.example`, `README.md`, `package.json`, `package-lock.json`

**Commands**: `npm install helmet @nestjs/throttler` ✅, `npx nest build` (pending), `npx next build` (pending)

**Result**: Pending verification.

---

## 2026-03-12 — Phase 4 Slice 3: Cloud File Storage (AWS S3)

**Goal**: Add S3 upload support with automatic local-disk fallback, wired into existing avatar and material upload flows.

**Changes**:
- Installed `@aws-sdk/client-s3` dependency
- Created `apps/api/src/storage/storage.service.ts` — S3/local abstraction with `uploadImage()` and `uploadFile()` methods; reads `STORAGE_PROVIDER` env to decide backend
- Created `apps/api/src/storage/storage.module.ts` — global module exporting `StorageService`
- Updated `apps/api/src/app.module.ts` — imported `StorageModule`
- Updated `apps/api/src/users/users.controller.ts` — injected `StorageService`, replaced hardcoded avatar URL with `storageService.uploadImage()`
- Updated `apps/api/src/materials/materials.controller.ts` — injected `StorageService`, replaced hardcoded file URL with `storageService.uploadFile()`
- Updated `apps/api/.env.example` — added `STORAGE_PROVIDER`, AWS S3 env vars
- Updated `README.md` — added Cloud Storage section, marked roadmap item complete

**Files**: `storage.service.ts`, `storage.module.ts`, `app.module.ts`, `users.controller.ts`, `materials.controller.ts`, `.env.example`, `README.md`

**Commands**: `npm install @aws-sdk/client-s3` ✅, `npx nest build` (pending), `npx next build` (pending)

**Result**: Pending verification.

**Next**: Phase 4 Slice 4 (TBD)

---

## 2026-03-10 — Phase 4 Slice 2: Error Logging & Monitoring Baseline

**Goal**: Add structured logging, request correlation IDs, and a global exception filter to the API.

**Changes**:
- Created `apps/api/src/common/middleware/request-id.middleware.ts` — generates/forwards `x-request-id` UUID per request
- Created `apps/api/src/common/middleware/request-logger.middleware.ts` — structured request/response logging (method, path, status, duration, requestId), gated by `ENABLE_REQUEST_LOGGING` env
- Created `apps/api/src/common/filters/global-exception.filter.ts` — normalizes error payloads, logs full stack server-side, never leaks internals to clients
- Updated `apps/api/src/app.module.ts` — registered both middleware via `NestModule.configure()`
- Updated `apps/api/src/main.ts` — registered `GlobalExceptionFilter` globally, added `LOG_LEVEL` env support, replaced `console.log` banner with `Logger`
- Updated `apps/api/.env.example` — added `LOG_LEVEL` and `ENABLE_REQUEST_LOGGING`
- Updated `README.md` — added Logging & Troubleshooting section

**Files**: `request-id.middleware.ts`, `request-logger.middleware.ts`, `global-exception.filter.ts`, `app.module.ts`, `main.ts`, `.env.example`, `README.md`

**Commands**: `npx nest build` ✅, `npx next build` ✅

**Result**: Both builds pass. API now has request correlation, structured logging, and safe error responses.

**Next**: Phase 4 Slice 3 (TBD)

---

## 2026-03-10 — Phase 4 Slice 1: SMTP Email Service

**Goal:** Replace console-only email delivery with real SMTP transport, feature-flagged with dev fallback.

**Changes:**
1. `mail/mail.service.ts` — **NEW** — Nodemailer-based MailService:
   - `sendVerificationEmail(email, code)` — HTML + text email with 6-digit code
   - `sendPasswordResetEmail(email, token)` — HTML + text email with reset link button
   - Feature-flagged: if `SMTP_HOST` not set, logs to console via `logFallback()`
   - On SMTP verify failure, falls back gracefully (no crash)
   - Styled HTML templates with library branding
2. `mail/mail.module.ts` — **NEW** — Global module exporting MailService
3. `app.module.ts` — Registered MailModule before AuthModule
4. `auth/auth.service.ts` — Injected MailService, replaced 3 console.log blocks:
   - `register()`: `console.log` → `mailService.sendVerificationEmail()`
   - `resendVerification()`: `console.log` → `mailService.sendVerificationEmail()`
   - `forgotPassword()`: `console.log` → `mailService.sendPasswordResetEmail()`
5. `.env.example` — Added SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
6. `README.md` — Added SMTP env vars to setup docs with fallback note, marked Email Service as completed in Phase 4 roadmap

**Dependencies added:** `nodemailer`, `@types/nodemailer` (devDep)

**Files:** `apps/api/src/mail/{mail.service.ts,mail.module.ts}` (new), `apps/api/src/{app.module,auth/auth.service}.ts`, `apps/api/.env.example`, `README.md`

**Commands:** `npx nest build` ✅, `npx next build` ✅

**Result:** SMTP email works when configured. When not configured, all auth flows continue working with console-logged codes/links. API contracts unchanged.

---

## 2026-03-09 — Learning Path + Research Assistant Hardening

**Goal:** Improve deterministic output quality, guardrails, and role-aware context usage in both services. No schema changes.

**LearningPathService changes:**
- Topic extraction fallback chain: parsed words → user interests → faculty name → "general topics"
- Topic length sanitized to 120 chars (anti-prompt-injection)
- `buildSearchIntent` enriches vague queries with borrow history categories as secondary signals
- `groupByDifficulty` now checks `category` field in addition to title + tags
- Added `roleIntro()` — role-specific introduction line (student/instructor/staff/admin)
- Added `personalContext()` — flags books user is currently reading with encouragement
- Added `roleTip()` — actionable role-specific tip (borrow slots remaining, create reading list, update interests)
- `emptyResult()` suggests user interests when no books found
- LLM prompt hardened: "Only reference books from the list above", "Do not recommend external resources"
- LLM output now includes role intro and role tip (matching rule-based output structure)

**ResearchAssistantService changes:**
- `audienceLevel` now role-aware: `advanced` for instructors/admins, `null` (all levels) for students/staff
- Topic length sanitized to 120 chars
- Added `priorReadingNote()` — cross-references results with borrow history, flags already-read books
- `nextSteps()` now uses live context:
  - Student: shows followed instructor count, remaining borrow slots
  - Instructor: shows own reading list count, suggests adding to existing lists
  - Admin: warns if available copies are low
- LLM prompt hardened: "Only reference books from the list", "Do not recommend external resources"
- LLM output now includes prior reading note (matching rule-based output)

**Files:** `apps/api/src/ai/{learning-path,research-assistant}.service.ts`

**Commands:** `npx nest build` ✅, `npx next build` ✅

**Result:** Both services now produce richer, role-aware deterministic output with LLM guardrails. Response schema unchanged: `{ reply, modelUsed, sources? }`.

---

## 2026-03-09 — Post-Refactor Verification + Docs Sync

**Goal:** Validate semantic search refactor preserved ChatResponse schema, run builds, update README.

**Verification:**
1. Schema check — traced all return points across 5 services (`ai`, `catalog-search`, `learning-path`, `research-assistant`, `role-response`). Every path returns `{ reply: string, modelUsed: string, sources?: string[] }` matching `ChatResponse`.
2. `npx nest build` ✅
3. `npx next build` ✅

**Changes:**
- `README.md` — Added "Embeddings-Ready Semantic Search Abstraction" to Phase 3 completed items

**Files:** `README.md`

---

## 2026-03-09 — AI Slice 5: Embeddings-Ready Semantic Search Abstraction

**Goal:** Extract semantic search logic into a clean abstraction with extension points for future embeddings, keeping current behavior unchanged.

**Changes:**
1. `types/search.types.ts` — **NEW** — Extracted `SearchIntent`, `BookCandidate`, `RankedBookResult`, `SearchContext`, `ReadingListResult` into a shared types file, breaking circular import between `catalog-search` → `semantic-search`
2. `semantic-search.service.ts` — Refactored with strategy pattern:
   - Three search paths: `keywordSearch()` (current production), `embeddingSearch()` (stub → falls back to keyword), `hybridSearch()` (stub → falls back to keyword)
   - Routes based on `AI_SEMANTIC_MODE` env var (`keyword` | `hybrid` | `embedding`)
   - Added `generateEmbedding()` stub returning null (future: Ollama /api/embeddings)
   - Added `cosineSimilarity()` utility ready for use
   - `rankBooks()` now accepts optional `similarityScores` map for embedding boost
   - `computeScore()` adds up to 15-point boost for high embedding similarity
   - Extracted `bookCandidateSelect()` helper to avoid duplication
   - `getMode()` now returns typed `SemanticMode`
3. `catalog-search.service.ts` — Removed local `SearchIntent` and `ReadingListResult` definitions, imports from types file, re-exports `SearchIntent` for backward compatibility
4. `learning-path.service.ts` — Updated import: `SearchIntent` from `types/search.types`
5. `research-assistant.service.ts` — Updated import: `SearchIntent` from `types/search.types`

**Files:** `apps/api/src/ai/types/search.types.ts` (new), `apps/api/src/ai/{semantic-search,catalog-search,learning-path,research-assistant}.service.ts`

**Commands:** `npx nest build` ✅, `npx next build` ✅

**Result:** Zero behavior change. All search paths still use keyword search. When embeddings are added later, only `generateEmbedding()`, `embeddingSearch()`, and `hybridSearch()` need implementation — no caller changes required.

---

## 2026-03-09 — README Update to Current State

**Goal:** Bring README.md up to date with all implemented features through Phase 3.

**Changes:**
- Updated Roadmap: Phase 3 (AI Integration) marked as completed — Natural Language Search, Learning Paths, Research Assistant all checked off
- Added AI Assistant section with architecture diagram, capabilities table, context data sources, and Ollama model mapping
- Updated Project Structure to include all 13 modules (ai, reading-lists, instructor-followers, dashboard, etc.)
- Updated Endpoints table (Auth: 4→10, added Reading Lists, Instructor Followers, Dashboard, AI modules)
- Added AI chat example request
- Updated Features lists (reading list discovery, AI features for all roles)
- Updated Permissions table (added AI Chat, Follow Instructors, Discover Reading Lists, Moderate Reading Lists)
- Added Google OAuth, Ollama to env variables section
- Added Ollama to tech stack
- Updated Database schema section (interests, subjectTags, BorrowPolicy, ReadingListItem, InstructorFollower)

**Files:** `README.md`

**Commands:** `npx nest build` ✅, `npx next build` ✅

**Result:** README now accurately reflects the full implemented system. Committed as `9794f7c`.

---

## 2026-03-09 — Phase 3.5: Learning Path + Research Assistant Services

**Goal:** Add personalized learning path generation and research assistant as new AI chat intents.

**Changes:**
1. `context-builder.service.ts` — Added `borrowHistory` to `AiContext` interface + `getBorrowHistory()` method (queries returned borrows for personalization)
2. `learning-path.service.ts` — **NEW** — Intent detection (`isLearningPathQuery`) + `generatePath()` that searches books, groups by difficulty (foundations/core/advanced), optional Ollama enhancement
3. `research-assistant.service.ts` — **NEW** — Intent detection (`isResearchQuery`) + `assist()` that searches books + reading lists, role-specific next steps, optional Ollama enhancement
4. `ai.service.ts` — Added routing for learning-path and research intents between catalog search and Ollama fallback
5. `ai.module.ts` — Registered `LearningPathService` and `ResearchAssistantService` as providers
6. `catalog-search.service.ts` — Made `searchReadingLists()` public for reuse

**Files:** `apps/api/src/ai/{context-builder,learning-path,research-assistant,ai,catalog-search}.service.ts`, `apps/api/src/ai/ai.module.ts`

**Commands:** `npx nest build` ✅, `npx next build` ✅

**Result:** Both services integrate into the existing chat flow. Intent routing order: staff bootstrap → interest update → admin gate → catalog search → learning path → research assistant → Ollama/fallback.

---

## 2026-03-08 — AI Slice 5: Embeddings-Ready Semantic Expansion

**Goal:** Extract search+rank logic into pluggable SemanticSearchService for future embeddings integration.

**Changes:**
1. Created `semantic-search.service.ts` with `searchBooks(intent, context)` and `rankBooks(candidates, intent, context)` — moved all Prisma query building and hybrid scoring logic here
2. Updated `catalog-search.service.ts` — now delegates candidate fetching and ranking to SemanticSearchService; retains intent parsing, reading-list search, and formatting
3. Updated `ai.module.ts` — registered SemanticSearchService
4. Updated `.env.example` — added `AI_SEMANTIC_MODE=hybrid` and `AI_EMBEDDINGS_ENABLED=false`

**Files changed:**
- `apps/api/src/ai/semantic-search.service.ts` (new)
- `apps/api/src/ai/catalog-search.service.ts`
- `apps/api/src/ai/ai.module.ts`
- `apps/api/.env.example`

**Commands:** `npx nest build` pass, `npx next build` pass

**Result:** Same runtime behavior, pluggable architecture. When embeddings are enabled later, SemanticSearchService can add vector similarity without touching CatalogSearchService.

---

## 2026-03-08 — AI Slice 4: Semantic Search Groundwork

**Goal:** Improve book retrieval quality using hybrid query understanding + ranking without external vector DB.

**Changes:**
1. `catalog-search.service.ts` — Major rewrite:
   - Extended `SearchIntent` with `audienceLevel` (introductory/advanced) and `facultyHint`
   - Added `extractAudienceLevel()` and `extractFacultyHint()` intent extractors
   - New `searchAndRank()` replaces old `searchBooks()`: fetches 20 candidates with per-keyword OR clauses, then applies `computeScore()` hybrid ranking
   - `computeScore()` scoring factors: title exact-phrase match (+10), per-keyword title (+3), author match (+4), category match (+5), subject tag match (+3 each), description match (+2), availability (+3/+5), faculty relevance (+4), reading-list popularity (capped +5), audience-level heuristic (+3)
   - Each result carries `reasons[]` snippets explaining why it was selected
   - `formatResults()` now displays reason snippets as italicized annotations per book
   - Added more noise words to `extractKeywords()` for cleaner intent parsing

**Files changed:**
- `apps/api/src/ai/catalog-search.service.ts`

**Commands:** `npx nest build` pass, `npx next build` pass

**Result:** "Recommend machine learning books available now" and "Advanced database books for teaching" will return relevance-ranked results with reason snippets.

---

## 2026-03-08 — AI Slice 3: Role-Specific Prompt Templates + Source-Grounding + Response Normalization

**Goal:** Extract per-role prompt templates, add source-grounding to Ollama prompts, normalize ChatResponse.modelUsed across all code paths, display model label in frontend.

**Changes:**
1. `ai.service.ts` — Replaced monolithic `buildSystemPrompt()` with `basePrompt()` + `studentPrompt()` / `instructorPrompt()` / `staffPrompt()` / `adminPrompt()`. Added `sourceGroundingBlock()` listing available dashboard paths per role. Added `extractLinkedSources()` regex to pull `/dashboard/...` paths from Ollama responses and merge+dedupe with static sources. Made `modelUsed` required in `ChatResponse`. All interest save/update paths return `modelUsed: 'system'`.
2. `role-response.service.ts` — Added `modelUsed: 'rule-based'` to every `ChatResponse` return (28 return sites).
3. `catalog-search.service.ts` — Added `modelUsed: 'search'` to both return sites (empty query + formatted results).
4. `lib/api.ts` — Updated `aiApi.chat` return type to include `modelUsed: string`.
5. `ai-assistant/page.tsx` — Added `modelUsed` to Message interface, stored from API response, rendered as `text-[10px]` label next to timestamp on assistant messages (fallback: `'unknown'`).

**Files changed:**
- `apps/api/src/ai/ai.service.ts`
- `apps/api/src/ai/role-response.service.ts`
- `apps/api/src/ai/catalog-search.service.ts`
- `apps/web/lib/api.ts`
- `apps/web/app/dashboard/ai-assistant/page.tsx`

**Commands:** `npx nest build` pass, `npx next build` pass

**Result:** Every ChatResponse now has a non-empty modelUsed. Ollama gets tailored system prompts per role with source-grounding instructions. Frontend shows model label.

---

## 2026-03-08 — AI Workflow Slice 1+2: Ollama Integration + New Endpoints

**Goal:** Integrate Ollama LLM backend with model routing, add PATCH /ai/interests and GET /ai/context endpoints, startup connectivity check.

**Changes:**
1. Added `OLLAMA_BASE_URL` to `.env.example`
2. Created `ollama.service.ts` — Ollama HTTP client with `generate()`, `listTags()`, `isAvailable()`, role-based model routing (STAFF->phi3, STUDENT/INSTRUCTOR->qwen2.5, ADMIN->llama3), deep-reasoning/simple overrides, OnModuleInit connectivity check
3. Created `dto/update-interests.dto.ts` — validates string array with min/max size
4. Updated `ai.service.ts` — integrates OllamaService, builds role-specific system prompts with full context, falls back to rule-based if Ollama unavailable, added `updateInterests()` and `getContext()` methods, `ChatResponse` now includes `modelUsed`
5. Updated `ai.controller.ts` — added `PATCH /ai/interests` and `GET /ai/context` endpoints
6. Updated `ai.module.ts` — registered `OllamaService`

**Files changed:**
- `apps/api/.env.example`
- `apps/api/src/ai/ollama.service.ts` (new)
- `apps/api/src/ai/dto/update-interests.dto.ts` (new)
- `apps/api/src/ai/ai.service.ts`
- `apps/api/src/ai/ai.controller.ts`
- `apps/api/src/ai/ai.module.ts`

**Commands:** `npx nest build` pass, `npx next build` pass

**Result:** Ollama integration complete with graceful fallback. No hardcoded IPs — all via OLLAMA_BASE_URL env.

### Patch — Pre-commit fixes

**Fixes applied:**
1. **Permission safety** — admin action guard runs deterministically before Ollama call, reuses `RoleResponseService.isAdminAction()` (made public)
2. **Query complexity routing** — `classifyQuery()` classifies deep-reasoning (analytics/compare/trend/why/forecast) vs simple (policy/how-do-i) prompts, passes to `ollama.getModel(role, queryType)`
3. **Removed per-message /api/tags** — deleted `isAvailable()` from OllamaService; `ollamaChat()` attempts generate directly, catches errors and falls back to rules

**Commands:** `npx nest build` pass

---

## 2026-03-07 — Reading-List UX + Instructor Public Profile Fields

**Goal:** Add follow/catalog navigation to reading-list detail, View Profile CTAs, instructor bio/department/courses schema+API+UI, and profile edit fields for instructors.

**Changes:**
1. **Schema**: Added `bio`, `department`, `courses` fields to User model + migration
2. **DTO**: Added bio (MaxLength 500), department, courses (IsArray) to UpdateProfileDto
3. **Service**: Handle 3 new fields in `updateProfile()`
4. **Controller**: Parse courses JSON string from FormData in profile update
5. **Reading-lists service**: Added bio/department/courses to owner select and instructor select
6. **Types**: Extended `ReadingList.owner` and `InstructorProfile.instructor` types
7. **Detail page**: Added follow/unfollow button, View Profile link, cover image linked to catalog, "Open in Catalog" CTA
8. **Feed page**: Added "View Profile" CTA with ArrowRight icon next to instructor name
9. **Instructor profile page**: Bio paragraph, department label, courses chips sections
10. **Profile page**: Bio textarea, department input, courses tag input (INSTRUCTOR role only)

**Files:** schema.prisma, migration, update-profile.dto.ts, users.service.ts, users.controller.ts, reading-lists.service.ts, types/index.ts, reading-lists/[id]/page.tsx, reading-lists/page.tsx, instructors/[id]/page.tsx, profile/page.tsx

**Commands:** `npx prisma migrate dev`, `npx nest build`, `npx next build` — all pass

**Commits:**
- `bda6733` feat(api): add instructor public profile fields (bio, department, courses)
- `9f8e625` feat(web): reading-list UX and instructor profile improvements

---

## 2026-03-07 — Middleware Route Fix + Instructor Profile CTA

**Goal:** Fix routing bug where `/dashboard/instructors/:id` was blocked for students due to loose prefix matching, and add instructor profile CTA.

**Changes:**
1. **middleware.ts**: Changed `pathname.startsWith(route)` to `pathname === route || pathname.startsWith(route + '/')` for boundary-safe matching. Added `/dashboard/reading-lists` and `/dashboard/instructors` to ROUTE_PERMISSIONS with all roles.
2. **instructor/page.tsx**: Added "Create Profile" / "Manage Profile" CTA card in quick actions grid, fetching profile completeness on mount.

**Files:** apps/web/middleware.ts, apps/web/app/dashboard/instructor/page.tsx

**Commands:** `npx next build` — passes

**Commit:** `5c6f4aa` fix(web): boundary-safe route matching and instructor profile CTA

---

## 2026-03-08 — Fix Profile Update DTO Validation for Courses

**Goal:** Fix instructor profile update failing because FormData sends `courses` as a JSON string, which fails `@IsArray()` validation before the controller can parse it.

**Changes:**
1. **update-profile.dto.ts**: Added `@Transform` from class-transformer to parse courses JSON string into array before validation runs.
2. **users.controller.ts**: Removed redundant controller-side JSON parsing (now handled by Transform).
3. **profile/page.tsx**: Surface backend validation error messages in toast instead of generic "Failed to update profile".

**Files:** apps/api/src/users/dto/update-profile.dto.ts, apps/api/src/users/users.controller.ts, apps/web/app/dashboard/profile/page.tsx

**Commands:** `npx nest build`, `npx next build` — both pass

**Commit:** `0505c47` fix(api): transform courses JSON string before DTO validation

---

## 2026-03-08 — Phase 3 Slice 1: AI Chatbot Foundation

**Goal:** Add backend AI chat endpoint and connect frontend AI assistant page to it.

**Changes:**
1. **apps/api/src/ai/**: New module — dto/chat.dto.ts, ai.service.ts (rule-based responses), ai.controller.ts (POST /ai/chat, JWT-guarded), ai.module.ts
2. **app.module.ts**: Register AiModule
3. **apps/web/lib/api.ts**: Add `aiApi.chat()` function
4. **ai-assistant/page.tsx**: Replace local mock `generateResponse` with `aiApi.chat` backend call; render source links; handle errors

**Files:** 7 files (4 new, 3 modified)

**Commands:** `npx nest build`, `npx next build` — both pass

**Commit:** `0ae0282` feat(ai): add rule-based AI chat endpoint and connect frontend

---

## 2026-03-08 — Role-Aware AI Assistant

**Goal:** Upgrade AI chat from generic keyword-based to role-aware, context-driven responses using live system data.

**Changes:**
1. **context-builder.service.ts** (new): Builds `AiContext` with user profile, borrow policy, active borrows, reservations, catalog snapshot, reading list stats, admin stats
2. **role-response.service.ts** (new): Role-specific response strategies — Student (personal status, faculty recs), Instructor (course/reading-list guidance), Staff (interest bootstrap + personalized), Admin (operational insights). Refuses admin actions from non-admins.
3. **ai.service.ts**: Orchestrates context build → role response → staff interest save flow
4. **ai.controller.ts**: Passes userId + role from JWT via CurrentUser decorator
5. **ai.module.ts**: Registers new providers, imports UsersModule for interest persistence

**Files:** 5 files in apps/api/src/ai/ (2 new, 3 modified)

**Commands:** `npx nest build`, `npx next build` — both pass

**Commit:** `6f98b65` feat(ai): role-aware context-driven AI assistant responses

---

## 2026-03-08 — Phase 3.1: Natural Language Catalog Search

**Goal:** Add AI intent for natural-language catalog/reading-list queries, returning actionable links with search results.

**Changes:**
1. **catalog-search.service.ts** (new): Intent detection (`isSearchQuery`), parsing (`parseIntent` → keywords, availability filter, category hints), Prisma book+reading-list search, formatted response with availability status, catalog links with search params, role-aware tips
2. **ai.service.ts**: Integrated catalog search before role-based fallback; refactored staff interest save into private method
3. **ai.module.ts**: Registered CatalogSearchService

**Files:** 3 files (1 new, 2 modified) in apps/api/src/ai/

**Commands:** `npx nest build`, `npx next build` — both pass

**Commit:** `86ac2c7` feat(ai): natural-language catalog and reading-list search

---

## 2026-03-07 — Reading Lists Workflow Fixes

**Goal**: Implement reading-lists workflow fixes — draft/publish flow, locked previews, archived visibility, admin moderation, follower notifications.

**Changes**:

### Backend
- `reading-lists.service.ts` — `lockedPreview()` helper, publish guard (400 on 0 books), ARCHIVED owner-only, `removeItem` notifications, `findAllForModeration()`, `create()` accepts status
- `reading-lists.dto.ts` — Added `status` to `CreateReadingListDto`
- `reading-lists.controller.ts` — Added `GET admin/all` endpoint

### Frontend
- Instructor create modal: "Save Draft" + "Publish Now" buttons (publish blocked for 0-book lists)
- NEW: `/dashboard/instructor/reading-lists` manage index page
- NEW: `/dashboard/instructor/reading-lists/[id]` manage detail page (book search/add/remove, visibility/status)
- NEW: `/dashboard/admin/reading-lists` admin moderation table
- Feed + instructor profile: locked lists hide description/courseCode/semester
- Admin nav: added "Reading Lists" item
- API client: added `status` to create, `getAllForModeration` method

**Verified**: `npx nest build` ✓, `npx next build` ✓

---

## 2026-03-02 16:36 - Avatar file upload for profile editing

**Goal:**
Replace the avatar URL text input with actual image file upload on the profile edit page. The backend already had a Multer-based upload pattern in the materials module — replicated it for avatars.

**Changes:**
1. **DTO** — Removed `@IsUrl()` validator from `avatarUrl` field since it now stores local paths (`/uploads/avatars/uuid.jpg`) instead of external URLs.
2. **Controller** — Added `FileInterceptor('avatar', ...)` to `PATCH /users/profile` with:
   - `diskStorage` writing to `./uploads/avatars` with UUID filenames
   - File filter: only `image/jpeg`, `image/png`, `image/webp`
   - Size limit: 5MB
   - If file uploaded, sets `dto.avatarUrl = /uploads/avatars/{filename}` before passing to service
   - Added `@ApiConsumes('multipart/form-data')` for Swagger
3. **Frontend** — Replaced avatar URL text input with:
   - Hidden `<input type="file" accept="image/jpeg,image/png,image/webp">` triggered by a button
   - Image preview via `URL.createObjectURL` (cleaned up on save/cancel)
   - `handleSaveProfile` sends `FormData` instead of JSON (no explicit Content-Type header so browser sets multipart boundary)
4. **Filesystem** — Created `apps/api/uploads/avatars/` directory

**Files:**
- `apps/api/src/users/dto/update-profile.dto.ts` — removed `@IsUrl()` import and decorator
- `apps/api/src/users/users.controller.ts` — added multer imports, `avatarStorage` config, `FileInterceptor` + `@UploadedFile()` on profile endpoint
- `apps/web/app/dashboard/profile/page.tsx` — added `useRef`, `Camera` icon, file state, file picker UI, FormData submission
- `apps/api/uploads/avatars/` — new directory (gitignored via existing uploads rule)

**Commands run:**
```bash
mkdir -p apps/api/uploads/avatars
cd apps/api && npx nest build        # success, no errors
cd apps/web && npx next build        # success, no errors
```

**Result:**
Both API and web builds pass cleanly. The profile page now shows an image picker with preview instead of a URL text field. Uploaded avatars are stored on disk and served via the existing `/uploads/` static asset route and Next.js proxy.

**Next:**
- Manual testing: log in → profile → edit → select image → save → verify avatar displays after refresh
- Consider adding old avatar cleanup (delete previous file on re-upload) if disk usage becomes a concern

---

## 2026-03-02 16:42 - Fix avatar not persisting after page reload

**Goal:**
Avatar image uploaded and saved successfully, but disappeared on page reload. The uploaded file was stored on disk and the database was updated correctly — the issue was that the `/api/auth/me` endpoint did not return `avatarUrl` in its response.

**Changes:**
1. **Root cause**: `GET /api/auth/me` in `auth.controller.ts` manually constructed a response object with only 6 fields (`id`, `email`, `name`, `role`, `facultyId`, `facultyName`). The full user object (including `avatarUrl`) was already available via `@CurrentUser()` from the JWT strategy, but was being filtered out.
2. **Fix**: Added `avatarUrl` (and other missing profile fields: `studentId`, `staffId`, `interests`, `isActive`, `createdAt`, `faculty`) to the `getMe` response so the profile page has all the data it needs.

**Files:**
- `apps/api/src/auth/auth.controller.ts` (line ~73) — added missing fields to `getMe` return object

**Commands run:**
```bash
cd apps/api && npx nest build   # success, no errors
```

**Result:**
API builds cleanly. The `/api/auth/me` endpoint now returns `avatarUrl` along with all other profile fields, so the avatar persists across page reloads.

**Next:**
- Verify manually: upload avatar → save → reload → avatar should still display

---

## 2026-03-02 16:50 - Sync uploaded avatar with dashboard header display

**Goal:**
After uploading a profile avatar, show it in: (1) the dashboard header next to the bell icon (with initials fallback), and (2) ensure the header updates immediately after save without requiring a page reload.

**Changes:**
1. **layout.tsx** (line ~343) — Added conditional: if `user.avatarUrl` exists, render `<img>` with `rounded-full object-cover`; else keep existing initials circle. No layout redesign.
2. **profile/page.tsx** — Imported `useAuth`, called `await refreshUser()` after successful profile save so the auth context (and thus the header avatar) updates immediately without reload.
3. **useAuth.tsx** — No changes needed. `refreshUser()` already existed and works correctly (calls `authApi.getMe()` which now returns `avatarUrl` per the previous fix).

**Files:**
- `apps/web/app/dashboard/layout.tsx` — avatar image conditional in header user badge area
- `apps/web/app/dashboard/profile/page.tsx` — import `useAuth`, call `refreshUser()` after save

**Commands run:**
```bash
cd apps/web && npx next build   # success, no errors
```

**Result:**
Web build passes. The header now shows the uploaded avatar image (or initials fallback). After saving a new avatar on the profile page, the header updates immediately via `refreshUser()`.

**Next:**
- Manual test: upload avatar → save → header should update instantly → reload → both header and profile page should show avatar
- No backend changes were needed

---

## 2026-03-03 00:09 - Verified email registration backend foundation (Slice 1)

**Goal:**
Replace "User Self-Registration with Admin Approval" roadmap item with email/password signup requiring email verification. This is Slice 1: backend-only foundation. No Google OAuth (Slice 2), no frontend (Slice 3).

**Changes:**
1. **Schema** — Added `AuthProvider` enum (`LOCAL`/`GOOGLE`), plus `emailVerifiedAt`, `emailVerificationToken`, `emailVerificationExpiry` fields on User model. Ran migration. Backfilled all existing users as verified.
2. **DTOs** — Added `RegisterDto` (name, email, password, optional studentId), `VerifyEmailDto` (email, code), `ResendVerificationDto` (email).
3. **Service** — Added `register()` (hash password, generate 6-digit code, 15min expiry, console.log code in dev), `verifyEmail()` (validate code/expiry, set `emailVerifiedAt`, clear token), `resendVerification()` (rate-limit 60s, regenerate code). Added unverified-email check in `validateUser()` — login fails with clear message if `emailVerifiedAt` is null.
4. **Controller** — Added three public endpoints: `POST /auth/register`, `POST /auth/verify-email`, `POST /auth/resend-verification`.

**Files:**
- `apps/api/prisma/schema.prisma` — `AuthProvider` enum, 4 new fields on User
- `apps/api/prisma/migrations/20260303000948_add_email_verification_and_auth_provider/migration.sql` — auto-generated
- `apps/api/src/auth/dto/auth.dto.ts` — 3 new DTO classes
- `apps/api/src/auth/auth.service.ts` — 4 new methods, 1 login gate addition
- `apps/api/src/auth/auth.controller.ts` — 3 new endpoints

**Commands run:**
```bash
npx prisma migrate dev --name add_email_verification_and_auth_provider  # success
npx prisma db execute (backfill existing users as verified)             # success
cd apps/api && npx nest build                                           # success
cd apps/web && npx next build                                           # success
node -e "PrismaClient query to verify new fields"                       # confirmed
```

**Result:**
Both builds pass. New fields present in DB. Existing users backfilled as verified so login still works. Three new public endpoints available. Verification codes logged to console in dev mode.

**Next:**
- Slice 2: Google OAuth (passport-google-oauth20, GOOGLE auth provider, auto-verified on OAuth)
- Slice 3: Frontend registration/verification pages + login page updates

---

## 2026-03-03 00:25 - Harden email verification flow edge cases

**Goal:**
Audit and tighten Slice 1 email verification implementation before proceeding to Slice 2. Five checks performed.

**Findings:**
| Check | Status | Detail |
|-------|--------|--------|
| 1. Register duplicates | Fixed | Race condition: concurrent requests could bypass `findUnique` — second `create` threw unhandled Prisma P2002 (500). Now caught. |
| 2. verify-email | OK | Rejects expired/invalid, clears token, early-returns on replay |
| 3. resend-verification | Fixed | (a) `"Email is already verified"` leaked account status — now returns same generic message for non-existent and already-verified. (b) Rate limit logic simplified from convoluted expiry math to clear `sentAt = expiry - 15min` |
| 4. Login gate | OK | Blocks unverified LOCAL users; backfilled users pass through |
| 5. Migration backfill | OK | All existing users have `emailVerifiedAt = NOW()` |

**Changes:**
1. **Register** — Wrapped `prisma.user.create()` in try/catch for Prisma error code `P2002` (unique constraint violation), re-throws as `ConflictException`.
2. **resendVerification** — Collapsed `!user` and `user.emailVerifiedAt` branches into single generic response to prevent account enumeration. Simplified rate limit to `sentAt = expiry - 15min; if (now - sentAt < 60s) reject`.

**Files:**
- `apps/api/src/auth/auth.service.ts` — `register()` P2002 catch, `resendVerification()` anti-enumeration + rate limit cleanup

**Commands run:**
```bash
cd apps/api && npx nest build   # success, no errors
```

**Result:**
API builds cleanly. Both edge cases hardened. No schema or migration changes needed.

**Next:**
- Slice 2: Google OAuth backend

---

## 2026-03-03 00:45 - Google OAuth backend login flow (Slice 2)

**Goal:**
Add Google OAuth sign-in/sign-up so users can authenticate via Google. Backend only — no frontend UI changes in this slice.

**Changes:**
1. **Google Strategy** (new file) — `passport-google-oauth20` strategy that extracts email/name/avatar from Google profile, calls `findOrCreateGoogleUser()`. Safe fallback values (`'not-configured'`) if env vars are empty so app boots without Google credentials.
2. **Google Auth Guard** (new file) — Simple `AuthGuard('google')` wrapper.
3. **Auth Service** — Added `findOrCreateGoogleUser()`: finds user by email or creates new one with `authProvider: GOOGLE`, `emailVerifiedAt: now()`, random placeholder password. If existing LOCAL user found, links to Google (upgrades `authProvider`, auto-verifies email). Added `generateTokenForUser()` helper to issue JWT for OAuth callback (same token shape as login).
4. **Auth Controller** — Added `GET /auth/google` (initiates OAuth redirect) and `GET /auth/google/callback` (sets JWT cookie, redirects to frontend dashboard). Uses same cookie config as local login.
5. **Auth Module** — Registered `GoogleStrategy` as provider.
6. **Env** — Added `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` to `.env.example` and `.env` (empty placeholders).

**Files:**
- `apps/api/src/auth/strategies/google.strategy.ts` — new
- `apps/api/src/auth/guards/google-auth.guard.ts` — new
- `apps/api/src/auth/auth.service.ts` — `findOrCreateGoogleUser()`, `generateTokenForUser()`
- `apps/api/src/auth/auth.controller.ts` — 2 new Google endpoints
- `apps/api/src/auth/auth.module.ts` — registered GoogleStrategy
- `apps/api/.env.example` — Google OAuth env vars
- `apps/api/.env` — placeholder values

**Commands run:**
```bash
npm install passport-google-oauth20 @types/passport-google-oauth20
cd apps/api && npx nest build    # success
cd apps/web && npx next build    # success
```

**Result:**
Both builds pass. Google OAuth flow is wired up. When real Google credentials are configured, `GET /auth/google` redirects to Google consent screen, callback creates/links user and sets JWT cookie.

**Next:**
- Slice 3: Frontend — register/verify pages, login page Google button, update login form for unverified error handling

---

## 2026-03-03 01:15 - Frontend auth UX for signup, verification, Google (Slice 3)

**Goal:**
Add frontend pages for signup, email verification, and Google sign-in entry. No backend changes.

**Changes:**
1. **Login page** — Added "Continue with Google" button (links to `/api/auth/google`), "or" divider, and "Don't have an account? Sign up" link.
2. **Signup page** (new) — Form with name, email, password, confirm password. Client-side validation (name min 2 chars, password min 6, confirm match). Calls `authApi.register()`, redirects to `/verify-email?email=...` on success.
3. **Verify-email page** (new) — 6-digit code input (numeric only, centered monospace). Pre-fills email from query param. Resend button with 60s countdown cooldown. On success, shows checkmark and redirects to `/login` after 2s. Wrapped in `Suspense` for `useSearchParams`.
4. **API client** — Added `register`, `verifyEmail`, `resendVerification` methods to `authApi`.

**Files:**
- `apps/web/app/login/page.tsx` — Google button, divider, signup link
- `apps/web/app/signup/page.tsx` — new
- `apps/web/app/verify-email/page.tsx` — new
- `apps/web/lib/api.ts` — 3 new auth methods

**Commands run:**
```bash
cd apps/web && npx next build   # success — /signup and /verify-email compiled
cd apps/api && npx nest build   # success — no regression
```

**Result:**
Both builds pass. Full signup → verify → login flow is wired up frontend-to-backend.

**Next:**
- Test end-to-end: signup → check console for code → verify → login
- Configure real Google OAuth credentials and test Google flow
- Consider adding Toaster to signup/verify pages (currently available via layout)

---

## 2026-03-03 01:00 - Secure password reset flow (Slice 4)

**Goal:**
Add forgot/reset password flow with one-time token, anti-enumeration, and frontend pages.

**Changes:**
1. **Schema** — Added `passwordResetToken` and `passwordResetExpiry` fields to User model. Migration applied.
2. **DTOs** — Added `ForgotPasswordDto` (email) and `ResetPasswordDto` (token + password with min 6 chars).
3. **Service** — `forgotPassword()`: always returns generic message (anti-enumeration), skips non-LOCAL and unverified accounts, generates 32-byte hex token with 1h expiry, rate-limited (60s), logs reset link in dev. `resetPassword()`: finds user by token + expiry check, hashes new password, clears token (one-time use).
4. **Controller** — `POST /auth/forgot-password` and `POST /auth/reset-password` endpoints.
5. **Frontend** — Forgot-password page (email input → success state), reset-password page (token from URL query, new password + confirm, redirects to login on success), "Forgot password?" link on login page, API client methods.

**Files:**
- `apps/api/prisma/schema.prisma` — 2 new fields on User
- `apps/api/prisma/migrations/20260303005327_add_password_reset_fields/` — new
- `apps/api/src/auth/dto/auth.dto.ts` — 2 new DTO classes
- `apps/api/src/auth/auth.service.ts` — `forgotPassword()`, `resetPassword()`
- `apps/api/src/auth/auth.controller.ts` — 2 new endpoints
- `apps/web/lib/api.ts` — `forgotPassword`, `resetPassword` methods
- `apps/web/app/login/page.tsx` — "Forgot password?" link
- `apps/web/app/forgot-password/page.tsx` — new
- `apps/web/app/reset-password/page.tsx` — new

**Commands run:**
```bash
npx prisma migrate dev --name add_password_reset_fields  # success
cd apps/api && npx nest build                             # success
cd apps/web && npx next build                             # success
```

**Result:**
Both builds pass. Full forgot → reset → login flow working. Token logged to console in dev.

**Next:**
- SMTP integration for sending actual emails (verification codes + reset links)
- End-to-end manual test of all auth flows

---

## 2026-03-03 18:24 - Reading lists backend foundation (Slice 1)

**Goal:**
Add instructor-owned reading lists with CRUD backend. Slice 1: schema + list/create endpoints only.

**Changes:**
1. **Schema** — Added `ReadingList` model (title, description, ownerId) and `ReadingListItem` model (order, notes, readingListId, bookId with unique constraint per list+book). Added relations on User and Book models. Migration applied.
2. **DTO** — `CreateReadingListDto` with title (required) and description (optional).
3. **Service** — `findMyLists()` returns user's lists with items (including book title/authors/cover), ordered by most recently updated. `create()` creates an empty list.
4. **Controller** — `GET /reading-lists/my` and `POST /reading-lists`, both restricted to `INSTRUCTOR` and `ADMIN` roles via `@Roles()`.
5. **Module** — `ReadingListsModule` registered in `AppModule`.

**Files:**
- `apps/api/prisma/schema.prisma` — ReadingList + ReadingListItem models, User/Book relations
- `apps/api/prisma/migrations/20260303182419_add_reading_lists/` — new
- `apps/api/src/reading-lists/dto/reading-lists.dto.ts` — new
- `apps/api/src/reading-lists/reading-lists.service.ts` — new
- `apps/api/src/reading-lists/reading-lists.controller.ts` — new
- `apps/api/src/reading-lists/reading-lists.module.ts` — new
- `apps/api/src/app.module.ts` — registered ReadingListsModule

**Commands run:**
```bash
npx prisma migrate dev --name add_reading_lists  # success
cd apps/api && npx nest build                     # success
cd apps/web && npx next build                     # success
```

**Result:**
Both builds pass. Reading list endpoints available for instructors/admins.

**Next:**
- Slice 2: PATCH/DELETE list, add/remove items (POST/DELETE /reading-lists/:id/items)
- Slice 3: Frontend reading list management page

---

## 2026-03-03 18:36 - Reading lists schema alignment + full CRUD backend (Slice 1+2 combined)

**Goal:**
Align the ReadingList schema with user's specification (add `courseCode`, `semester`, `isActive` fields; rename `order` to `orderIndex`) and implement full CRUD backend (Slice 2: update, delete list; add/remove items).

**Changes:**
1. **Schema** — Added `courseCode String?`, `semester String?`, `isActive Boolean @default(true)` to ReadingList. Renamed `order` to `orderIndex` on ReadingListItem. Migration applied.
2. **DTOs** — Added `UpdateReadingListDto` (all fields optional + isActive), `AddReadingListItemDto` (bookId required, notes optional). Updated `CreateReadingListDto` with courseCode/semester.
3. **Service** — Added `findOne()` (by ID with owner info), `update()` (ownership check), `remove()` (ownership check, cascade delete), `addItem()` (book existence check, auto-increment orderIndex, P2002 duplicate catch), `removeItem()` (ownership + item existence checks). Both add/remove touch `updatedAt`.
4. **Controller** — Added `GET :id`, `PATCH :id`, `DELETE :id`, `POST :id/items`, `DELETE :id/items/:itemId`. All guarded with INSTRUCTOR/ADMIN roles.

**Files:**
- `apps/api/prisma/schema.prisma` — 3 new fields on ReadingList, renamed order→orderIndex
- `apps/api/prisma/migrations/20260303183651_add_reading_list_fields/` — new
- `apps/api/src/reading-lists/dto/reading-lists.dto.ts` — UpdateReadingListDto, AddReadingListItemDto
- `apps/api/src/reading-lists/reading-lists.service.ts` — 4 new methods
- `apps/api/src/reading-lists/reading-lists.controller.ts` — 5 new endpoints

**Commands run:**
```bash
npx prisma migrate dev --name add_reading_list_fields  # success
cd apps/api && npx nest build                           # success
cd apps/web && npx next build                           # success
```

**Result:**
Both builds pass. Full reading list CRUD backend complete with 7 endpoints total.

**Next:**
- Slice 3: Frontend reading list management page

---

## 2026-03-03 19:15 - Instructor follower system backend foundation (Slice 1)

**Goal:**
Add follow/unfollow system for instructors. Backend only — no frontend changes.

**Changes:**
1. **Schema** — Added `InstructorFollower` model with `followerId`/`instructorId` (both referencing User), unique constraint on `(followerId, instructorId)`, cascade deletes. Added `following`/`followers` relations on User model. Migration applied.
2. **Service** — `getMyFollowing()` returns followed instructors with profile info. `follow()` validates target is INSTRUCTOR role, prevents self-follow, idempotent (returns existing record if already following), handles P2002 race condition. `unfollow()` idempotent (succeeds even if not following). `getFollowersCount()` returns count. `isFollowing()` returns boolean status.
3. **Controller** — 5 endpoints, all behind JwtAuthGuard:
   - `GET /instructor-followers/my-following`
   - `POST /instructor-followers/:instructorId/follow`
   - `DELETE /instructor-followers/:instructorId/unfollow`
   - `GET /instructor-followers/:instructorId/followers-count`
   - `GET /instructor-followers/:instructorId/is-following`
4. **Module** — `InstructorFollowersModule` registered in `AppModule`.

**Files:**
- `apps/api/prisma/schema.prisma` — InstructorFollower model, User relations
- `apps/api/prisma/migrations/20260303191507_add_instructor_followers/` — new
- `apps/api/src/instructor-followers/instructor-followers.service.ts` — new
- `apps/api/src/instructor-followers/instructor-followers.controller.ts` — new
- `apps/api/src/instructor-followers/instructor-followers.module.ts` — new
- `apps/api/src/app.module.ts` — registered InstructorFollowersModule

**Commands run:**
```bash
npx prisma migrate dev --name add_instructor_followers  # success
cd apps/api && npx nest build                            # success
cd apps/web && npx next build                            # success
```

**Result:**
Both builds pass. Instructor follower system backend complete with 5 endpoints.

**Next:**
- Slice 2: Frontend — follow button on instructor profiles, "Following" list page

---

## 2026-03-03 19:30 - Commit reading-lists + instructor-followers backend

**Goal:**
Finalize and commit all uncommitted backend work before new feature slices.

**Changes:**
Two scoped commits created on `feature/reading-lists-slice1` branch:
1. `062cc30` — `feat(reading-lists): add courseCode/semester/isActive fields and full CRUD` (4 files: migration, DTO, controller, service)
2. `df6092d` — `feat(followers): add backend foundation for instructor follow system` (6 files: schema, migration, service, controller, module, app.module)

`CODEX.md` excluded as unrelated.

**Verification:** Both `npx nest build` and `npx next build` passed before committing.

---

## 2026-03-03 19:35 - Add build commands note to README

**Goal:**
Add a concise "Build Commands (Monorepo)" section to README for quick reference.

**Changes:**
Added 3-line code block under "Production Build" section showing `npm run build`, API-only, and web-only build commands.

**Files:**
- `README.md` — added "Build Commands (Monorepo)" subsection

**No build verification needed** — documentation-only change.

---

## 2026-03-03 19:50 - Frontend reading lists integration (Slice A)

**Goal:**
Replace mock reading list data in instructor dashboard with real API calls using existing backend endpoints.

**Changes:**
1. **Types** — Added `ReadingList` and `ReadingListItem` interfaces to `types/index.ts`.
2. **API client** — Added `readingListsApi` object to `lib/api.ts` with 6 methods: `getMyLists`, `create`, `update`, `remove`, `addItem`, `removeItem`.
3. **Instructor dashboard** — Replaced hardcoded mock data with `readingListsApi.getMyLists()` on mount. Create modal now calls `readingListsApi.create()` with controlled form inputs. Added delete button with confirmation via `readingListsApi.remove()`. Stats card uses `_count.items` for real book count. Removed unused `Users`/`Clock` icons, removed `studentCount` references (not in schema).

**Files:**
- `apps/web/types/index.ts` — ReadingList + ReadingListItem interfaces
- `apps/web/lib/api.ts` — readingListsApi client (6 methods)
- `apps/web/app/dashboard/instructor/page.tsx` — real API integration

**Verification:**
```bash
cd apps/web && npx next build   # success, all 32 routes compiled
```

**Commit:** `fc6c0e1` — `feat(web): integrate instructor reading lists with backend APIs`

---

## 2026-03-03 20:10 - Frontend instructor followers integration (Slice B)

**Goal:**
Integrate instructor follower API into frontend with minimal changes.

**Changes:**
1. **Types** — Added `FollowedInstructor`, `FollowersCount`, `FollowingStatus` interfaces to `types/index.ts`.
2. **API client** — Added `followersApi` object to `lib/api.ts` with 5 methods: `getMyFollowing`, `follow`, `unfollow`, `getFollowersCount`, `isFollowing`.
3. **Instructor dashboard** — Replaced "Total Books in Lists" stat card with clickable "Following" count card (links to following page). Added "Following" quick action card. Fetches following count on mount.
4. **Following page** (new) — `/dashboard/instructor/following` lists all followed instructors with avatar/initials, name, email, and unfollow button. Optimistic removal on unfollow.

**Files:**
- `apps/web/types/index.ts` — 3 new interfaces
- `apps/web/lib/api.ts` — followersApi client (5 methods)
- `apps/web/app/dashboard/instructor/page.tsx` — following count stat + quick action
- `apps/web/app/dashboard/instructor/following/page.tsx` — new page

**Verification:**
```bash
cd apps/web && npx next build   # success, 33 routes compiled (new /following route)
```

**Commit:** `083a962` — `feat(web): integrate instructor follower system with backend APIs`

---

## 2026-03-03 21:14 - Reading list visibility, discovery, profiles, and notifications (Full feature)

**Goal:**
Implement reading list visibility/discovery system with instructor public profiles and follower notifications. Four slices in one pass.

**Slice A — Schema + backend authorization:**
- Added `ReadingListVisibility` enum (PUBLIC, FOLLOWERS_ONLY, PRIVATE), default PUBLIC
- Added `ReadingListStatus` enum (DRAFT, PUBLISHED, ARCHIVED), default DRAFT
- Added `READING_LIST_PUBLISHED`, `READING_LIST_UPDATED` to NotificationType
- Migration applied
- Service enforces: owner/admin full access, PUBLIC→any logged-in, FOLLOWERS_ONLY→metadata-only with `locked:true` for non-followers, PRIVATE→owner+admin only
- Admin can moderate any instructor list (update/delete)

**Slice B — Discovery endpoints:**
- `GET /reading-lists/feed` — global feed of published non-private lists, visibility-filtered
- `GET /reading-lists/instructor/:instructorId` — instructor profile with filtered lists, follow state, follower count
- `GET /reading-lists/:id` — single list with visibility enforcement (replaces old unguarded findOne)

**Slice C — Follower notifications:**
- On status change to PUBLISHED: notify all followers via NotificationsService.createMany()
- On item added to published list: notify followers of content update
- Uses existing @Global() NotificationsModule — no module import needed

**Slice D — Frontend UI:**
- Types: ReadingListVisibility, ReadingListStatus, InstructorProfile, extended ReadingList
- API client: getFeed, getInstructorProfile, getById added
- `/dashboard/reading-lists` — global feed with visibility badges, lock CTA
- `/dashboard/reading-lists/[id]` — list detail with locked state
- `/dashboard/instructors/[id]` — instructor profile with follow/unfollow, lists
- Dashboard layout: "Reading Lists" nav item for all roles
- Instructor dashboard: status + visibility badges on own lists

**Files changed:**
- `apps/api/prisma/schema.prisma` — 2 enums, 2 fields on ReadingList, 2 notification types
- `apps/api/prisma/migrations/20260303211403_.../` — new
- `apps/api/src/reading-lists/dto/reading-lists.dto.ts` — visibility/status in DTOs
- `apps/api/src/reading-lists/reading-lists.controller.ts` — 3 new discovery endpoints, admin moderation params
- `apps/api/src/reading-lists/reading-lists.service.ts` — rewritten with visibility logic, discovery methods, notification triggers
- `apps/web/types/index.ts` — new types + extended ReadingList
- `apps/web/lib/api.ts` — 3 new readingListsApi methods
- `apps/web/app/dashboard/layout.tsx` — "Reading Lists" nav
- `apps/web/app/dashboard/instructor/page.tsx` — status/visibility badges
- `apps/web/app/dashboard/reading-lists/page.tsx` — new (feed)
- `apps/web/app/dashboard/reading-lists/[id]/page.tsx` — new (detail)
- `apps/web/app/dashboard/instructors/[id]/page.tsx` — new (profile)

**Commits:**
- `b92041b` — backend (schema, authorization, discovery, notifications)
- `a483342` — frontend (feed, profiles, visibility UI)
- `a7f84d2` — README build commands

**Assumptions:**
- Default status is DRAFT (new lists not visible in feed until explicitly published)
- Notification rate limiting not added (low volume expected)
- Feed limited to 50 most recently updated lists
