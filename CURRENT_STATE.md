# CURRENT_STATE.md

## Last Completed

* Cookie-based authentication is implemented and server-validated through an `httpOnly` `access_token` cookie, with login, logout, profile, email verification, and password reset flows in place. References: [auth.controller.ts](/C:/Projects/library-system_edit/apps/api/src/auth/auth.controller.ts#L48), [jwt.strategy.ts](/C:/Projects/library-system_edit/apps/api/src/auth/strategies/jwt.strategy.ts#L11), [auth.service.ts](/C:/Projects/library-system_edit/apps/api/src/auth/auth.service.ts#L401)
* Global request validation and a global exception filter are enabled at the NestJS bootstrap layer. References: [main.ts](/C:/Projects/library-system_edit/apps/api/src/main.ts#L57), [global-exception.filter.ts](/C:/Projects/library-system_edit/apps/api/src/common/filters/global-exception.filter.ts#L12)
* Reservation concurrency is hardened end to end. `create()` uses a conditional `updateMany` to claim the copy atomically, a partial unique index (`userId`, `bookId`, `status IN (PENDING, READY_FOR_PICKUP)`) enforces at most one `PENDING`/`READY_FOR_PICKUP` reservation per user-book pair at the database level (P2002 returns 409), and all limit checks run inside the transaction. `collect()` acquires a PostgreSQL advisory transaction lock via `$executeRaw` to serialize concurrent collects for the same user, uses a conditional `updateMany` to transition status atomically, and enforces the borrow limit inside the locked transaction before creating the borrow record. `reject()` guards against invalid starting states. References: [reservations.service.ts](/C:/Projects/library-system_edit/apps/api/src/reservations/reservations.service.ts), [migration 20260327](/C:/Projects/library-system_edit/apps/api/prisma/migrations/20260327000001_reservation_book_id_and_active_unique/migration.sql)
* Sensitive auth and reset tokens are never loaded by user-profile queries. All methods in `UsersService` that return data to callers use an explicit `SAFE_USER_SELECT` constant that excludes `password`, `emailVerificationToken`, `emailVerificationExpiry`, `passwordResetToken`, and `passwordResetExpiry` at the query level. References: [users.service.ts](/C:/Projects/library-system_edit/apps/api/src/users/users.service.ts#L11)
* `verify-email` and `resend-verification` endpoints are rate-limited to 5 requests per 60 seconds via `ThrottlerGuard`. References: [auth.controller.ts](/C:/Projects/library-system_edit/apps/api/src/auth/auth.controller.ts#L122)
* API error contract is standardized. The global exception filter returns `{ success: false, message, requestId, timestamp }` for all errors. `message` is extracted from the HttpException response and preserves `string[]` arrays from `ValidationPipe`. `statusCode` and `error` fields are not included in the body. References: [global-exception.filter.ts](/C:/Projects/library-system_edit/apps/api/src/common/filters/global-exception.filter.ts#L24)
* A scheduler now reconciles overdue borrows and expires stale reservations. Active borrows past `dueAt` are transitioned to `OVERDUE`, and stale reservations are expired with reserved copies released back to `AVAILABLE`. References: [borrow-scheduler.service.ts](/C:/Projects/library-system_edit/apps/api/src/borrows/borrow-scheduler.service.ts)
* Overdue fines created by `returnBook` are now set to `PENDING` status. `paidAt` is not written at return time. The admin pay/waive flow (`fine-payments.service.markPaid` / `waive`) is the only path to marking a fine resolved. References: [borrows.service.ts](/C:/Projects/library-system_edit/apps/api/src/borrows/borrows.service.ts#L287)
* `GET /users/:id` is restricted to ADMIN or the requesting user's own record. Any other role requesting a different user's ID receives 403. Self-service profile access via `/auth/me` and `/auth/profile` is unaffected. References: [users.controller.ts](/C:/Projects/library-system_edit/apps/api/src/users/users.controller.ts#L120)
* Reservation lifecycle implements the full APPROVED state. `approve()` transitions PENDING → APPROVED (no pickup deadline), `markReady()` transitions APPROVED → READY_FOR_PICKUP (sets 2-day pickup deadline), and `reject()` accepts PENDING, APPROVED, or READY_FOR_PICKUP reservations. The scheduler expires PENDING/APPROVED by `expiresAt` and READY_FOR_PICKUP by `pickupDeadline`, resolving the timing model gap. Active reservation counts include APPROVED. Admin UI has three tabs (pending, approved, ready) with distinct actions. User UI shows APPROVED as a distinct active state. References: [reservations.service.ts](/C:/Projects/library-system_edit/apps/api/src/reservations/reservations.service.ts), [reservations.controller.ts](/C:/Projects/library-system_edit/apps/api/src/reservations/reservations.controller.ts), [borrow-scheduler.service.ts](/C:/Projects/library-system_edit/apps/api/src/borrows/borrow-scheduler.service.ts)
* Real DB-backed integration tests (Supertest + PostgreSQL) cover the full reservation lifecycle (20 tests: create, approve, mark-ready, collect, reject, cancel, my reservations) and borrow operations (8 tests: extend, return, overdue fine with PENDING status). Test harness includes global setup/teardown, NestJS app bootstrap with scheduler disabled, cookie auth helpers, and dynamic table truncation. References: [reservations.e2e-spec.ts](/C:/Projects/library-system_edit/apps/api/test/reservations.e2e-spec.ts), [borrows.e2e-spec.ts](/C:/Projects/library-system_edit/apps/api/test/borrows.e2e-spec.ts)
* Frontend middleware now verifies JWT signatures using `jose` with HS256 algorithm constraint, replacing raw base64 decode. Forged tokens redirect to login (fail-closed). Missing `JWT_SECRET` also fails closed. All admin routes are covered in `ROUTE_PERMISSIONS` (borrows, branches, fines, materials, policies, reports, statistics, reading-lists added). References: [middleware.ts](/C:/Projects/library-system_edit/apps/web/middleware.ts)
* DTO validation gaps closed. `PATCH /users/interests` validates via `UpdateInterestsDto` (`@IsArray`, `@IsString({ each: true })`). Borrow query endpoints use `BorrowQueryDto`, `BorrowHistoryQueryDto`, `MostBorrowedQueryDto`, and `TrendsQueryDto` with `@Type(() => Number)` coercion and `@Max` caps; service-side clamping added to `findMyHistory` and `findAllHistory`. Frontend error handlers consolidated via `extractApiError` (fetch) and `extractAxiosError` (axios) helpers that normalize `string | string[]` backend messages across 11 pages. References: [update-interests.dto.ts](/C:/Projects/library-system_edit/apps/api/src/users/dto/update-interests.dto.ts), [borrows.dto.ts](/C:/Projects/library-system_edit/apps/api/src/borrows/dto/borrows.dto.ts), [api-error.ts](/C:/Projects/library-system_edit/apps/web/lib/api-error.ts)
* Security hardening: `RegisterDto` and `ResetPasswordDto` require `@MinLength(8)` and `@Matches` enforcing at least one uppercase, lowercase, and digit — weak passwords now return 400 with an explicit message. `CreateBookDto.branches` adds `@ValidateNested({ each: true })` + `@Type(() => BranchCopiesDto)` so `@Max(50)` on `numberOfCopies` is actually enforced. `POST /auth/reset-password` is rate-limited to 5 req/60s (matches `forgot-password`). `GET /ai/status` requires `JwtAuthGuard` (any authenticated role; not admin-only). Covered by 9 new e2e tests in `security.e2e-spec.ts`. References: [auth.dto.ts](/C:/Projects/library-system_edit/apps/api/src/auth/dto/auth.dto.ts), [books.dto.ts](/C:/Projects/library-system_edit/apps/api/src/books/dto/books.dto.ts), [auth.controller.ts](/C:/Projects/library-system_edit/apps/api/src/auth/auth.controller.ts), [ai.controller.ts](/C:/Projects/library-system_edit/apps/api/src/ai/ai.controller.ts), [security.e2e-spec.ts](/C:/Projects/library-system_edit/apps/api/test/security.e2e-spec.ts)

## In Progress

* None currently identified.

## Production Readiness Score

Score: 10/10

Reason:

* All previously identified gaps are closed. Core concurrency, fine payment state, token leakage, error contract, user endpoint access, reservation lifecycle, integration test coverage, frontend JWT verification, DTO validation coverage, and frontend error normalization are all complete.

---

## Critical Issues (Fix Immediately)

* None currently identified at critical severity.


## High Priority Issues

* None currently identified at high priority.

## Medium Priority Issues

* None currently identified at medium priority.

## Low Priority Improvements

* None currently identified.

---

## System Health by Area

### Auth

* Status: Good
* Issues:
* JWT is issued and validated through an `httpOnly` cookie correctly.
* `verify-email` and `resend-verification` are now rate-limited.
* Cookie flags are environment-aware, but there is no token rotation or server-side revocation strategy.
* Frontend middleware verifies JWT signatures using `jose` (HS256) and fails closed on missing secret or invalid tokens. All admin routes are covered in `ROUTE_PERMISSIONS`.

### Borrow System

* Status: Good
* Issues:
* Core borrow creation goes through reservation collection.
* Extension flow checks ownership, status, overdue condition, and extension count correctly.
* Overdue borrows are transitioned to `OVERDUE` by the scheduler.
* Return flow creates overdue fines as `PENDING`; admin pay/waive flow is the resolution path.
* Borrow-limit enforcement inside `collect()` is transaction-safe.

### Reservation System

* Status: Good
* Issues:
* Duplicate active reservation per user-book pair is prevented at the DB level by partial unique index.
* Copy claim in `create()` is atomic. Borrow-limit check in `collect()` is inside the advisory-locked transaction.
* The scheduler expires PENDING/APPROVED reservations by `expiresAt` and READY_FOR_PICKUP reservations by `pickupDeadline`.
* Full APPROVED lifecycle is implemented: PENDING → APPROVED → READY_FOR_PICKUP → COLLECTED, with reject allowed from any active state.

### Error Handling

* Status: Good
* Issues:
* Global exception handling exists and returns a consistent `{ success: false, message, requestId, timestamp }` shape.
* `ValidationPipe` error arrays are preserved in the `message` field.
* All frontend pages now consume the standardized `{ success, message }` shape via `extractApiError`/`extractAxiosError` helpers.

### Validation

* Status: Good
* Issues:
* Global `ValidationPipe` with whitelist/forbid settings is enabled.
* DTO validation is uniform across all endpoints. Borrow query endpoints use typed DTOs with `@Type(() => Number)` coercion and `@Max` caps. `PATCH /users/interests` uses `UpdateInterestsDto`.

### Database

* Status: Fair
* Issues:
* Transactions are used in core write flows.
* Reservation create and collect are protected against duplicate concurrent actions by DB-level unique index and advisory lock.
* Overdue borrows and stale reservations are reconciled by the scheduler.
* All known write-consistency gaps are closed. Fine payment state is correct; reservation concurrency is DB-enforced.

### Role Enforcement

* Status: Good
* Issues:
* Admin reservation and borrow actions are protected with `RolesGuard`.
* `GET /users/:id` is restricted to ADMIN or own record; arbitrary profile fetch is blocked.
* `PATCH /users/interests` updates only the authenticated user's own record via `@CurrentUser`.
* Frontend role gating should not be treated as a security boundary.

---

## Next Best Actions (Ordered)

* No outstanding production issues identified.

---
