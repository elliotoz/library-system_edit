# CURRENT_STATE.md

## Last Completed

* Cookie-based authentication is implemented and server-validated through an `httpOnly` `access_token` cookie, with login, logout, profile, email verification, and password reset flows in place. References: [auth.controller.ts](/C:/Projects/library-system_edit/apps/api/src/auth/auth.controller.ts#L48), [jwt.strategy.ts](/C:/Projects/library-system_edit/apps/api/src/auth/strategies/jwt.strategy.ts#L11), [auth.service.ts](/C:/Projects/library-system_edit/apps/api/src/auth/auth.service.ts#L401)
* Global request validation and a global exception filter are enabled at the NestJS bootstrap layer. References: [main.ts](/C:/Projects/library-system_edit/apps/api/src/main.ts#L57), [global-exception.filter.ts](/C:/Projects/library-system_edit/apps/api/src/common/filters/global-exception.filter.ts#L12)
* Reservation concurrency is hardened end to end. `create()` uses a conditional `updateMany` to claim the copy atomically, a partial unique index (`userId`, `bookId`, `status IN (PENDING, READY_FOR_PICKUP)`) enforces one active reservation per user-book pair at the database level (P2002 returns 409), and all limit checks run inside the transaction. `collect()` acquires a PostgreSQL advisory transaction lock via `$executeRaw` to serialize concurrent collects for the same user, uses a conditional `updateMany` to transition status atomically, and enforces the borrow limit inside the locked transaction before creating the borrow record. `reject()` guards against invalid starting states. References: [reservations.service.ts](/C:/Projects/library-system_edit/apps/api/src/reservations/reservations.service.ts), [migration 20260327](/C:/Projects/library-system_edit/apps/api/prisma/migrations/20260327000001_reservation_book_id_and_active_unique/migration.sql)
* Sensitive auth and reset tokens are never loaded by user-profile queries. All methods in `UsersService` that return data to callers use an explicit `SAFE_USER_SELECT` constant that excludes `password`, `emailVerificationToken`, `emailVerificationExpiry`, `passwordResetToken`, and `passwordResetExpiry` at the query level. References: [users.service.ts](/C:/Projects/library-system_edit/apps/api/src/users/users.service.ts#L11)
* `verify-email` and `resend-verification` endpoints are rate-limited to 5 requests per 60 seconds via `ThrottlerGuard`. References: [auth.controller.ts](/C:/Projects/library-system_edit/apps/api/src/auth/auth.controller.ts#L122)
* API error contract is standardized. The global exception filter returns `{ success: false, message, requestId, timestamp }` for all errors. `message` is extracted from the HttpException response and preserves `string[]` arrays from `ValidationPipe`. `statusCode` and `error` fields are not included in the body. References: [global-exception.filter.ts](/C:/Projects/library-system_edit/apps/api/src/common/filters/global-exception.filter.ts#L24)
* A scheduler now reconciles overdue borrows and expires stale reservations. Active borrows past `dueAt` are transitioned to `OVERDUE`, and stale reservations are expired with reserved copies released back to `AVAILABLE`. References: [borrow-scheduler.service.ts](/C:/Projects/library-system_edit/apps/api/src/borrows/borrow-scheduler.service.ts)
* Overdue fines created by `returnBook` are now set to `PENDING` status. `paidAt` is not written at return time. The admin pay/waive flow (`fine-payments.service.markPaid` / `waive`) is the only path to marking a fine resolved. References: [borrows.service.ts](/C:/Projects/library-system_edit/apps/api/src/borrows/borrows.service.ts#L287)
* `GET /users/:id` is restricted to ADMIN or the requesting user's own record. Any other role requesting a different user's ID receives 403. Self-service profile access via `/auth/me` and `/auth/profile` is unaffected. References: [users.controller.ts](/C:/Projects/library-system_edit/apps/api/src/users/users.controller.ts#L120)
* Reservation lifecycle implements the full APPROVED state. `approve()` transitions PENDING → APPROVED (no pickup deadline), `markReady()` transitions APPROVED → READY_FOR_PICKUP (sets 2-day pickup deadline), and `reject()` accepts PENDING, APPROVED, or READY_FOR_PICKUP reservations. The scheduler expires PENDING/APPROVED by `expiresAt` and READY_FOR_PICKUP by `pickupDeadline`, resolving the timing model gap. Active reservation counts include APPROVED. Admin UI has three tabs (pending, approved, ready) with distinct actions. User UI shows APPROVED as a distinct active state. References: [reservations.service.ts](/C:/Projects/library-system_edit/apps/api/src/reservations/reservations.service.ts), [reservations.controller.ts](/C:/Projects/library-system_edit/apps/api/src/reservations/reservations.controller.ts), [borrow-scheduler.service.ts](/C:/Projects/library-system_edit/apps/api/src/borrows/borrow-scheduler.service.ts)

## In Progress

* None currently identified.

## Production Readiness Score

Score: 8/10

Reason:

* Core concurrency, fine payment state, token leakage, error contract, user endpoint access, and reservation lifecycle are all closed. The remaining open gap is medium-priority — frontend JWT decode for route protection — which is not the security boundary (backend authorization is).

---

## Critical Issues (Fix Immediately)

* None currently identified at critical severity.


## High Priority Issues

* None currently identified at high priority.

## Medium Priority Issues

* Frontend route protection decodes the JWT payload in middleware without signature verification. Backend authorization still protects APIs, so this is not the main security boundary, but frontend role gating can be spoofed at the UI layer. References: [middleware.ts](/C:/Projects/library-system_edit/apps/web/middleware.ts#L37), [middleware.ts](/C:/Projects/library-system_edit/apps/web/middleware.ts#L67)

## Low Priority Improvements

* Validation coverage is uneven. Global DTO validation exists, but some query and body inputs still use ad hoc parsing or primitive body extraction instead of DTOs. References: [main.ts](/C:/Projects/library-system_edit/apps/api/src/main.ts#L61), [users.controller.ts](/C:/Projects/library-system_edit/apps/api/src/users/users.controller.ts#L131), [borrows.controller.ts](/C:/Projects/library-system_edit/apps/api/src/borrows/borrows.controller.ts#L32)
* Some frontend pages still read error messages directly from backend responses rather than a normalized frontend-safe contract. Now that the backend contract is standardized, the frontend can be updated to consume `error.message` consistently. References: [reservations/page.tsx](/C:/Projects/library-system_edit/apps/web/app/dashboard/reservations/page.tsx#L110), [borrowed/page.tsx](/C:/Projects/library-system_edit/apps/web/app/dashboard/borrowed/page.tsx#L119)

---

## System Health by Area

### Auth

* Status: Fair
* Issues:
* JWT is issued and validated through an `httpOnly` cookie correctly.
* `verify-email` and `resend-verification` are now rate-limited.
* Cookie flags are environment-aware, but there is no token rotation or server-side revocation strategy.
* Frontend middleware only decodes the JWT for routing and does not verify signature integrity.

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
* Some frontend pages do not yet consume the standardized shape uniformly.

### Validation

* Status: Fair
* Issues:
* Global `ValidationPipe` with whitelist/forbid settings is enabled.
* DTO validation exists in auth, books, reservations, branches, and other modules.
* Some endpoints still use primitive extraction instead of DTOs.

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

1. Add integration tests (Supertest) for the reservation and borrow HTTP paths to give the test suite real HTTP wiring coverage.
2. Address frontend JWT decode in middleware (medium priority) or accept it as a known non-security-critical gap.

---
