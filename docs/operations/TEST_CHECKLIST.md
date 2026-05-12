# Test Checklist

Use this checklist to verify all features work correctly before deployment.

**Legend:**
- `[AUTO]` — covered by automated tests (e2e or unit); verify passes, not behavior
- `[MANUAL]` — requires manual browser or API-level verification

---

## Authentication

### Login
- [MANUAL] Page loads at `/login`
- [MANUAL] Form shows validation errors for empty fields
- [MANUAL] Invalid credentials show error message
- [MANUAL] Successful login redirects to correct dashboard by role:
  ADMIN→`/dashboard/admin`, STUDENT→`/dashboard/student`,
  INSTRUCTOR→`/dashboard/instructor`, STAFF→`/dashboard/staff`
- [MANUAL] `access_token` httpOnly cookie is set after login

### Logout
- [MANUAL] Logout clears the `access_token` cookie
- [MANUAL] Redirects to `/login`

### Route protection — frontend middleware
- [MANUAL] Unauthenticated request to any `/dashboard/*` redirects to `/login`
- [MANUAL] Forged/expired token on any `/dashboard/*` redirects to `/login` (JWT signature verified with HS256)
- [MANUAL] STUDENT/INSTRUCTOR/STAFF requesting `/dashboard/admin` redirects to their own dashboard
- [MANUAL] ADMIN can access all `/dashboard/admin/*` routes
- [MANUAL] STAFF can access `/dashboard/staff`, `/dashboard/catalog`,
  `/dashboard/borrowed`, `/dashboard/reservations`, `/dashboard/ai-assistant`,
  `/dashboard/profile`, `/dashboard/notifications`
- [MANUAL] STAFF cannot reach any `/dashboard/admin/*` route
- [MANUAL] `/dashboard/fines`, `/dashboard/history`, `/dashboard/materials` are
  not in `ROUTE_PERMISSIONS` — any authenticated user can navigate to them.
  Backend data-scoping prevents cross-user data exposure, but cross-role UX access
  is possible (low-priority; not a security gap)

### Route protection — backend guards
- [AUTO] `GET /ai/status` returns 401 without auth, 200 with student cookie (`security.e2e-spec.ts`)
- [AUTO] Admin-only reservation actions (approve, reject, mark-ready, collect)
  return 403 for non-admin (`reservations.e2e-spec.ts`)
- [AUTO] `GET /users/:id` returns 403 when a non-admin requests another user's record (`users.controller.spec.ts`)

### Email verification
- [MANUAL] Unverified user cannot log in (if verification required)
- [MANUAL] Verification link confirms the account
- [MANUAL] `POST /auth/resend-verification` is rate-limited (5 req / 60s)

### Password reset
- [MANUAL] `POST /auth/forgot-password` sends reset email
- [MANUAL] Reset link allows setting a new password
- [AUTO] Weak passwords (no uppercase, no digit, <8 chars) rejected with 400 (`security.e2e-spec.ts`)
- [AUTO] `POST /auth/reset-password` is rate-limited to 5 req / 60s (`security.e2e-spec.ts`)

---

## Student / User Features

### Dashboard (`/dashboard/student`)
- [MANUAL] Stats cards show real data
- [MANUAL] Quick action links navigate correctly
- [MANUAL] Current borrows table reflects real data

### Book Catalog (`/dashboard/catalog`)
- [MANUAL] Books load on page open
- [MANUAL] Search filters by title/author
- [MANUAL] Faculty, category, and availability filters work
- [MANUAL] Sort (A-Z, Z-A, Newest, Oldest) works
- [MANUAL] Pagination works
- [MANUAL] Book cards link to detail page

### Book Detail (`/dashboard/catalog/[id]`)
- [MANUAL] Book information (title, authors, ISBN, publisher) displays
- [MANUAL] Campus availability counts are correct
- [MANUAL] Reserve button visible when copies available
- [MANUAL] Campus selector for reservation works

### My Borrowed Books (`/dashboard/borrowed`)
- [MANUAL] Lists user's active borrows with due dates
- [MANUAL] Overdue books highlighted
- [AUTO] Extend borrow works; extension count enforced (`borrows.e2e-spec.ts`)
- [MANUAL] Filter tabs (All, Active, Returned) work

### My Reservations (`/dashboard/reservations`)
- [MANUAL] Lists reservations with correct status badges: PENDING, APPROVED,
  READY_FOR_PICKUP, COLLECTED, CANCELLED, EXPIRED
- [MANUAL] APPROVED state shows as active (not collectable by user)
- [MANUAL] READY_FOR_PICKUP shows pickup deadline alert
- [MANUAL] Cancel button works for PENDING reservations
- [AUTO] Full lifecycle (create, approve, mark-ready, collect, cancel, reject) covered (`reservations.e2e-spec.ts`)

### Notifications (`/dashboard/notifications`)
- [MANUAL] Notifications load from live API (`GET /api/notifications`)
- [MANUAL] Unread count badge accurate
- [MANUAL] Mark single notification as read works
- [MANUAL] "Mark all as read" button clears unread count
- [MANUAL] Delete individual notification works
- [MANUAL] "Clear read" button appears only when read notifications exist; deletes only read ones
- [MANUAL] NotificationType enum values (e.g. `BORROW_DUE_SOON`,
  `RESERVATION_APPROVED`) map to correct display types
  (warning/success/error/info)

### AI Assistant (`/dashboard/ai-assistant`)
- [MANUAL] Chat interface loads
- [MANUAL] Can send a message and receive a response
- [MANUAL] Conversation list (sidebar) loads and persists across reload
- [MANUAL] Delete conversation removes it from the list
- [MANUAL] New chat starts with model selector set to Auto
- [MANUAL] `GET /ai/models` returns Auto plus the four selectable models
- [MANUAL] Manual Codex Mini selection persists on conversation switch
- [MANUAL] Gemma Free plus an image request shows capability fallback
- [MANUAL] Gemma Free plus a catalog/tool request shows capability fallback
- [MANUAL] Capability fallback does not overwrite the saved manual model
- [MANUAL] Markdown tables, lists, and blockquotes render in assistant replies
- [MANUAL] Math renders with KaTeX for inline and display equations
- [MANUAL] Code blocks render with syntax highlighting and copy button
- [MANUAL] Fenced `graph` JSON renders an interactive Plotly chart
- [MANUAL] Invalid `graph` JSON falls back to source text
- [MANUAL] Fenced `mermaid` content renders a diagram
- [MANUAL] Invalid Mermaid content falls back to source text
- [MANUAL] Chat is rate-limited (15 messages / 60s)
- [AUTO] `GET /ai/status` requires auth (`security.e2e-spec.ts`)

### Profile (`/dashboard/profile`)
- [MANUAL] User info (name, email, role, faculty) displays
- [MANUAL] Edit interests: add/remove tags, save persists
- [MANUAL] Borrow policy card shows correct limits and current usage
- [MANUAL] My fines section shows PENDING fines

---

## Admin Features

### Admin Dashboard (`/dashboard/admin`)
- [MANUAL] Stats cards show real totals (users, books, borrows, reservations)
- [MANUAL] Pending reservations count is accurate
- [MANUAL] Recent activity feed loads

### Manage Reservations (`/dashboard/admin/reservations`)

This page has three tabs: **Pending**, **Approved**, **Ready for Pickup**.

- [MANUAL] **Pending tab** lists PENDING reservations; Approve and Reject buttons present
- [MANUAL] Approve action transitions reservation to APPROVED
- [MANUAL] **Approved tab** lists APPROVED reservations; Mark Ready button present
- [MANUAL] Mark Ready transitions APPROVED → READY_FOR_PICKUP (sets 2-day pickup deadline)
- [MANUAL] **Ready tab** lists READY_FOR_PICKUP reservations; Collect button present
- [MANUAL] Collect creates a borrow record; reservation moves to COLLECTED
- [MANUAL] Reject works from PENDING, APPROVED, or READY_FOR_PICKUP state
- [AUTO] All six transitions covered (`reservations.e2e-spec.ts`)

### Manage Borrows (`/dashboard/admin/borrows`)
- [MANUAL] All active borrows listed with user and book info
- [MANUAL] Admin return flow marks borrow as RETURNED; fine created as PENDING if overdue
- [AUTO] Return creates PENDING fine (not pre-resolved) (`borrows.e2e-spec.ts`)

### Manage Fines (`/dashboard/admin/fines`)
- [MANUAL] Fines list loads with status (PENDING, PAID, WAIVED)
- [MANUAL] Mark Paid transitions fine to PAID
- [MANUAL] Waive transitions fine to WAIVED (optional note saved)
- [MANUAL] Student `GET /fine-payments/my` shows user's own fines
- [MANUAL] PENDING fines on student profile accurately reflect overdue return fines

### Manage Users (`/dashboard/admin/users`)
- [MANUAL] Users list loads with search and role/status filters
- [AUTO] `GET /users/:id` restricted to ADMIN or own record (`users.controller.spec.ts`)
- [MANUAL] Activate/Deactivate toggles work; status updates immediately

### Manage Books (`/dashboard/admin/books`)
- [MANUAL] Book list loads with search and pagination
- [MANUAL] Edit navigates to book detail editor
- [MANUAL] Delete works with confirmation
- [AUTO] `POST /books` with `branches[].numberOfCopies > 50` returns 400 (`security.e2e-spec.ts`)

### Policies (`/dashboard/admin/policies`)
- [MANUAL] Borrow limits and fine amounts load correctly
- [MANUAL] Saving a policy change persists

### Reports / Statistics (`/dashboard/admin/reports`, `/dashboard/admin/statistics`)
- [MANUAL] Pages load without contract errors
- [MANUAL] Charts/tables render real data

### Admin AI Scan (`POST /ai/scan-cover`)
- [MANUAL] Returns 403 for non-admin users
- [MANUAL] Admin can upload a book cover image and receive extracted metadata

---

## API Endpoint Reference

All endpoints below require a valid `access_token` cookie unless noted.

### Auth
- [MANUAL] `POST /auth/login` — sets cookie
- [MANUAL] `POST /auth/logout` — clears cookie
- [MANUAL] `GET /auth/me` — returns own profile
- [AUTO] `POST /auth/register` — weak password → 400
- [AUTO] `POST /auth/reset-password` — weak password → 400, rate-limited

### Books
- [MANUAL] `GET /books` — list with filters
- [MANUAL] `GET /books/:id` — single book detail
- [MANUAL] `GET /books/categories` — categories
- [MANUAL] `GET /books/faculties` — faculties

### Borrows
- [AUTO] `GET /borrows/my` — user's borrows
- [AUTO] `PATCH /borrows/:id/extend` — extend (limits enforced)
- [AUTO] `PATCH /borrows/:id/return` — admin return; PENDING fine if overdue
- [MANUAL] `GET /borrows/admin/active` — all active borrows (admin)
- [MANUAL] `GET /borrows/admin/history` — borrow history (admin)
- [MANUAL] `GET /borrows/stats`, `admin/statistics`, `admin/most-borrowed`, `admin/trends` — admin analytics

### Reservations
- [AUTO] `GET /reservations/my` — user's reservations
- [AUTO] `POST /reservations` — create; duplicate active blocked (409)
- [AUTO] `PATCH /reservations/:id/cancel` — cancel own
- [AUTO] `PATCH /reservations/:id/approve` — PENDING → APPROVED (admin)
- [AUTO] `PATCH /reservations/:id/mark-ready` — APPROVED → READY_FOR_PICKUP (admin)
- [AUTO] `PATCH /reservations/:id/collect` — READY_FOR_PICKUP → COLLECTED, creates borrow (admin)
- [AUTO] `PATCH /reservations/:id/reject` — from any active state (admin)
- [MANUAL] `GET /reservations/pending`, `approved`, `ready` — admin tabs

### Notifications
- [MANUAL] `GET /notifications` — fetch with optional `limit` (1–100; invalid → 400)
- [MANUAL] `GET /notifications/unread-count` — badge count
- [MANUAL] `PATCH /notifications/:id/read` — mark single read
- [MANUAL] `PATCH /notifications/read-all` — mark all read
- [MANUAL] `DELETE /notifications/:id` — delete one
- [MANUAL] `DELETE /notifications/clear-read` — delete all read

### Fine Payments
- [MANUAL] `GET /fine-payments/my` — user's own fines
- [MANUAL] `GET /fine-payments` — all fines (admin); invalid `status`/`page`/`pageSize` → 400
- [AUTO] `PATCH /fine-payments/:id/pay` — admin mark paid
- [AUTO] `PATCH /fine-payments/:id/waive` — admin waive

### Users
- [MANUAL] `GET /users` — list (admin)
- [AUTO] `GET /users/:id` — own record or admin only; 403 otherwise
- [MANUAL] `PATCH /users/profile` — update own profile
- [MANUAL] `PATCH /users/interests` — update interests
- [MANUAL] `PATCH /users/:id/activate`, `deactivate` — admin

### AI
- [AUTO] `GET /ai/status` — auth required (any role); 401 without cookie
- [MANUAL] `GET /ai/conversations` — list conversations
- [MANUAL] `POST /ai/conversations` — create conversation
- [MANUAL] `DELETE /ai/conversations/:id` — delete conversation
- [MANUAL] `GET /ai/history?conversationId=` — messages for a conversation
- [MANUAL] `GET /ai/models` — list public selectable model metadata
- [MANUAL] `PATCH /ai/conversations/:id/model` — update model preference
- [MANUAL] `POST /ai/chat` — streaming SSE response; rate-limited 15/60s
- [MANUAL] `POST /ai/scan-cover` — admin only

---

## Query Validation (boundary checks)

These should all return 400:

- [AUTO] `GET /reservations?page=0` (admin)
- [AUTO] `GET /reservations?pageSize=200` (admin)
- [AUTO] `GET /reservations?pageSize=abc` (admin)
- [AUTO] `GET /notifications?limit=0`
- [AUTO] `GET /notifications?limit=200`
- [AUTO] `GET /notifications?limit=abc`
- [AUTO] `GET /fine-payments?page=0` (admin)
- [AUTO] `GET /fine-payments?pageSize=999` (admin)
- [AUTO] `GET /fine-payments?status=INVALID` (admin)

---

## UI/UX

### Responsive Design
- [MANUAL] Desktop (1920px), laptop (1366px), tablet (768px), mobile (375px) layouts work

### Navigation
- [MANUAL] Sidebar collapses on mobile; mobile menu toggle works
- [MANUAL] Active route highlighted; all links navigate correctly

### Feedback
- [MANUAL] Success toasts appear (green) and auto-dismiss
- [MANUAL] Error toasts appear (red) with backend error message (not generic "unknown error")
- [MANUAL] Buttons show loading state during processing
- [MANUAL] Empty states display when no data

---

## Scheduler (automated background jobs)

- [AUTO] Overdue borrows transition to `OVERDUE` status (`borrow-scheduler.service.spec.ts`)
- [AUTO] Stale PENDING/APPROVED reservations expire by `expiresAt`;
  READY_FOR_PICKUP by `pickupDeadline` (`borrow-scheduler.service.spec.ts`)
- [MANUAL] After scheduler run: expired reservations show EXPIRED in user's list; reserved copies return to AVAILABLE

---

## Docker / Deployment

- [MANUAL] `docker-compose up -d` starts all services
- [MANUAL] Frontend accessible at `localhost:3000`
- [MANUAL] API accessible at `localhost:3001`
- [MANUAL] Database connects and migrations run
- [MANUAL] Seed data populates correctly

---

## Notes

### Automated Test Coverage Summary
| Suite                              | Tests | Scope                                                       |
| ---------------------------------- | ----- | ----------------------------------------------------------- |
| `reservations.e2e-spec.ts`         | 20    | Full reservation lifecycle                                  |
| `borrows.e2e-spec.ts`              | 8     | Extend, return, overdue fine                                |
| `security.e2e-spec.ts`             | 18    | Auth guards, password policy, rate limits, query validation |
| `users.service.spec.ts`            | —     | Safe select, interests                                      |
| `users.controller.spec.ts`         | —     | GET /users/:id access control                               |
| `reservations.service.spec.ts`     | —     | Service-layer concurrency                                   |
| `borrow-scheduler.service.spec.ts` | —     | Overdue + expiry scheduler                                  |
| `model-registry.spec.ts`           | 31    | AI model registry and fallback behavior                     |
| `global-exception.filter.spec.ts`  | —     | Error contract shape                                        |

### Known Issues
- (List any issues found during manual pass here)

### Test Environment
- **OS:**
- **Browser:**
- **Node Version:**
- **Date Tested:**

---

## Sign-Off

- [ ] All critical paths manually verified
- [ ] Automated test suite passes (`npm run test:api:critical` + `npm run test:api:e2e`)
- [ ] No blocking bugs found
- [ ] Ready for deployment

**Approved by:** _________________ **Date:** _________________
