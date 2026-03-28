# CURRENT_STATE.md

## Last Completed

* Cookie-based authentication is implemented and server-validated through an `httpOnly` `access_token` cookie, with login, logout, profile, email verification, and password reset flows in place. References: [auth.controller.ts](/C:/Projects/library-system_edit/apps/api/src/auth/auth.controller.ts#L48), [jwt.strategy.ts](/C:/Projects/library-system_edit/apps/api/src/auth/strategies/jwt.strategy.ts#L11), [auth.service.ts](/C:/Projects/library-system_edit/apps/api/src/auth/auth.service.ts#L401)
* Global request validation and a global exception filter are enabled at the NestJS bootstrap layer. References: [main.ts](/C:/Projects/library-system_edit/apps/api/src/main.ts#L57), [global-exception.filter.ts](/C:/Projects/library-system_edit/apps/api/src/common/filters/global-exception.filter.ts#L12)
* Reservation concurrency is hardened end to end. `create()` uses a conditional `updateMany` to claim the copy atomically, a partial unique index (`userId`, `bookId`, `status IN (PENDING, READY_FOR_PICKUP)`) enforces one active reservation per user-book pair at the database level (P2002 returns 409), and all limit checks run inside the transaction. `collect()` acquires a PostgreSQL advisory transaction lock via `$executeRaw` to serialize concurrent collects for the same user, uses a conditional `updateMany` to transition status atomically, and enforces the borrow limit inside the locked transaction before creating the borrow record. `reject()` guards against invalid starting states. References: [reservations.service.ts](/C:/Projects/library-system_edit/apps/api/src/reservations/reservations.service.ts), [migration 20260327](/C:/Projects/library-system_edit/apps/api/prisma/migrations/20260327000001_reservation_book_id_and_active_unique/migration.sql)
* Sensitive auth and reset tokens are never loaded by user-profile queries. All methods in `UsersService` that return data to callers use an explicit `SAFE_USER_SELECT` constant that excludes `password`, `emailVerificationToken`, `emailVerificationExpiry`, `passwordResetToken`, and `passwordResetExpiry` at the query level. References: [users.service.ts](/C:/Projects/library-system_edit/apps/api/src/users/users.service.ts#L11)
* `verify-email` and `resend-verification` endpoints are rate-limited to 5 requests per 60 seconds via `ThrottlerGuard`. References: [auth.controller.ts](/C:/Projects/library-system_edit/apps/api/src/auth/auth.controller.ts#L122)
* API error contract is standardized. The global exception filter returns `{ success: false, message, requestId, timestamp }` for all errors. `message` is extracted from the HttpException response and preserves `string[]` arrays from `ValidationPipe`. `statusCode` and `error` fields are not included in the body. References: [global-exception.filter.ts](/C:/Projects/library-system_edit/apps/api/src/common/filters/global-exception.filter.ts#L24)
* Overdue state transition and reservation expiration are enforced by a scheduler. `BorrowStatus.ACTIVE` records past their `dueAt` are bulk-transitioned to `OVERDUE` each hour. Stale `PENDING` and `READY_FOR_PICKUP` reservations past `expiresAt` are expired per-record in a transaction that also frees the reserved copy back to `AVAILABLE`. References: [borrow-scheduler.service.ts](/C:/Projects/library-system_edit/apps/api/src/borrows/borrow-scheduler.service.ts)

## In Progress

* Overdue fine handling is not fully reconciled with the scheduler. The scheduler now sets borrows to `OVERDUE` and sends notifications, but `returnBook` still auto-upserts the fine as `PAID` immediately on return, which bypasses the explicit admin pay/waive flow. The `OVERDUE` state transition is real; the fine payment state is still incorrect.
* Role enforcement on user endpoints is not at least-privilege. Any authenticated user can call `GET /users/:id` and retrieve another user's full profile. `PATCH /users/interests` is not role-restricted despite being described as a staff action.

## Production Readiness Score

Score: 6/10

Reason:

* Core concurrency risks in the reservation and borrow path are closed. Sensitive token leakage and the error contract are fixed. The remaining gaps — fine payment state corruption on return, lifecycle gaps in the reservation model, and incomplete least-privilege on user endpoints — are real production issues but are not data-destroying or auth-bypassing.

---

## Critical Issues (Fix Immediately)

* Reservation expiration enforcement has a lifecycle gap. The scheduler now expires stale reservations and frees copies, but the reservation model has no separate `APPROVED` state. The workflow goes `PENDING -> READY_FOR_PICKUP -> COLLECTED`, skipping the intended `APPROVED` step. `expiresAt` is set at creation and covers the pickup window, but there is no approval gate. This is a known model gap, not a crash risk, but it means the reservation lifecycle does not match the intended design. References: [schema.prisma](/C:/Projects/library-system_edit/apps/api/prisma/schema.prisma#L33), [reservations.service.ts](/C:/Projects/library-system_edit/apps/api/src/reservations/reservations.service.ts#L323)

## High Priority Issues

* `returnBook` sets overdue fines directly to `PAID` on return. When a borrow is returned late, the service upserts a fine record with `status: PAID`, which means the fine is never visible in the unpaid state that triggers the admin pay/waive flow. This corrupts the meaning of fine payment status. References: [borrows.service.ts](/C:/Projects/library-system_edit/apps/api/src/borrows/borrows.service.ts#L295)
* `GET /users/:id` is accessible to any authenticated user. There is no guard preventing a student from fetching another user's full profile by ID. The query now excludes tokens, but name, email, interests, faculty, and role are still returned for arbitrary IDs. References: [users.controller.ts](/C:/Projects/library-system_edit/apps/api/src/users/users.controller.ts#L120)
* `PATCH /users/interests` is not role-restricted. The endpoint is described as a staff action in comments but has no `RolesGuard`. References: [users.controller.ts](/C:/Projects/library-system_edit/apps/api/src/users/users.controller.ts#L128)

## Medium Priority Issues

* Reservation workflow does not implement the `APPROVED` state. The code goes directly from `PENDING` to `READY_FOR_PICKUP`; there is no `APPROVED` status in the enum or service logic. References: [schema.prisma](/C:/Projects/library-system_edit/apps/api/prisma/schema.prisma#L33), [reservations.service.ts](/C:/Projects/library-system_edit/apps/api/src/reservations/reservations.service.ts#L323)
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

* Status: Fair
* Issues:
* Core borrow creation goes through reservation collection.
* Extension flow checks ownership, status, overdue condition, and extension count correctly.
* Overdue borrows are now transitioned to `OVERDUE` by the scheduler.
* Return flow still sets overdue fines directly to `PAID`, bypassing the pay/waive flow.
* Borrow-limit enforcement inside `collect()` is now transaction-safe.

### Reservation System

* Status: Fair
* Issues:
* Duplicate active reservation per user-book pair is prevented at the DB level by partial unique index.
* Copy claim in `create()` is atomic. Borrow-limit check in `collect()` is inside the advisory-locked transaction.
* Stale reservations are expired and copies freed by the scheduler.
* No separate `APPROVED` state exists in the lifecycle.

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
* Reservation create and collect are now protected against duplicate concurrent actions.
* Overdue borrows and stale reservations are reconciled by the scheduler.
* Fine payment state is still corrupted by `returnBook`.

### Role Enforcement

* Status: Fair
* Issues:
* Admin reservation and borrow actions are protected with `RolesGuard`.
* `GET /users/:id` is accessible to any authenticated user.
* `PATCH /users/interests` is not role-restricted.
* Frontend role gating should not be treated as a security boundary.

---

## Next Best Actions (Ordered)

1. Fix `returnBook` to create overdue fines as `UNPAID` so the admin pay/waive flow is not bypassed.
2. Restrict `GET /users/:id` to admin/staff or the requesting user themselves, and add a `RolesGuard` to `PATCH /users/interests`.
3. Add the `APPROVED` reservation state and the corresponding admin-approve transition.

---
