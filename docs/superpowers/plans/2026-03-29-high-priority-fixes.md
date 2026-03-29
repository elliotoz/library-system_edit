# High Priority Fixes: Fine Status + User Endpoint Access Control

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two high-priority production issues: overdue fines are created as PAID (bypassing admin pay/waive flow), and user profile endpoints are accessible to any authenticated user regardless of role.

**Architecture:** Both fixes are isolated with no shared dependency. Task 1 is a two-line change in `BorrowsService.returnBook()`, covered by a new unit test. Task 2 adds `@Roles` decorators to two endpoints in `UsersController` — guard behavior is verified via typecheck and the existing critical suite. Each is committed separately.

**Tech Stack:** NestJS, Prisma, Jest + ts-jest, `FineStatus` Prisma enum, `RolesGuard` (wired at class level), `createPrismaMock` test helper.

**Verification order for every task:**
```powershell
cd apps/api
npm run typecheck
npm run test:critical
npx nest build
```

---

## File Map

| File | Change |
|---|---|
| `apps/api/src/borrows/borrows.service.ts` | Change `FineStatus.PAID` → `FineStatus.PENDING`, remove `paidAt: now` from upsert |
| `apps/api/src/borrows/borrows.service.spec.ts` | New — test that `returnBook` creates fine as PENDING |
| `apps/api/src/users/users.controller.ts` | Add `@Roles(Role.ADMIN, Role.STAFF)` to `GET :id` and `PATCH interests` |
| `CURRENT_STATE.md` | Update after both tasks are verified and committed |

---

## Task 1: Fix returnBook — Create Overdue Fines as PENDING

**Problem:** `returnBook()` upserts fine records with `status: FineStatus.PAID` and `paidAt: now`. `fine-payments.service.markPaid()` guards `if (fine.status !== FineStatus.PENDING)` — so fines created as PAID are permanently stuck and can never go through the admin pay/waive flow.

**Root cause:** Lines 294–302 of `borrows.service.ts` hard-code `FineStatus.PAID` and `paidAt: now` in both branches of the upsert.

**Files:**
- Modify: `apps/api/src/borrows/borrows.service.ts`
- Create: `apps/api/src/borrows/borrows.service.spec.ts`

---

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/borrows/borrows.service.spec.ts`:

```typescript
import { BorrowStatus, BookCopyStatus, FineStatus } from "@prisma/client";
import { BorrowsService } from "./borrows.service";
import { createPrismaMock } from "../test-utils/create-prisma-mock";

function createNotificationsMock() {
  return { create: jest.fn() };
}

describe("BorrowsService.returnBook", () => {
  it("creates overdue fine as PENDING, not PAID", async () => {
    const prisma = createPrismaMock();
    const notifications = createNotificationsMock();

    const overdueBorrow = {
      id: "borrow-1",
      userId: "user-1",
      bookCopyId: "copy-1",
      status: BorrowStatus.OVERDUE,
      dueAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      extensionCount: 0,
      user: { id: "user-1", name: "Test User", email: "test@test.com" },
      bookCopy: {
        book: { id: "book-1", title: "Clean Code" },
      },
    };

    prisma.borrow.findUnique.mockResolvedValue(overdueBorrow as any);

    // Capture what ops are passed to $transaction
    let capturedOps: any[] = [];
    prisma.$transaction.mockImplementation(async (ops: any) => {
      capturedOps = ops;
      // Return the updated borrow as first element
      return [{ ...overdueBorrow, status: BorrowStatus.RETURNED, returnedAt: new Date() }];
    });

    const service = new BorrowsService(prisma as any, notifications as any);
    await service.returnBook("borrow-1");

    // Find the finePayment upsert op — it will be the third op (index 2)
    const fineUpsert = capturedOps.find((op: any) =>
      // Prisma upsert ops don't expose the model name directly;
      // we check that no op has status PAID
      JSON.stringify(op).includes('"status"')
    );

    // Verify PAID is never written to fine status
    expect(JSON.stringify(capturedOps)).not.toContain(FineStatus.PAID);
    expect(JSON.stringify(capturedOps)).toContain(FineStatus.PENDING);
  });

  it("does not create a fine when borrow is returned on time", async () => {
    const prisma = createPrismaMock();
    const notifications = createNotificationsMock();

    const onTimeBorrow = {
      id: "borrow-2",
      userId: "user-1",
      bookCopyId: "copy-1",
      status: BorrowStatus.ACTIVE,
      dueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      extensionCount: 0,
      user: { id: "user-1", name: "Test User", email: "test@test.com" },
      bookCopy: {
        book: { id: "book-1", title: "Clean Code" },
      },
    };

    prisma.borrow.findUnique.mockResolvedValue(onTimeBorrow as any);
    prisma.$transaction.mockImplementation(async (ops: any) => [
      { ...onTimeBorrow, status: BorrowStatus.RETURNED, returnedAt: new Date() },
    ]);

    const service = new BorrowsService(prisma as any, notifications as any);
    await service.returnBook("borrow-2");

    // Transaction should only contain 2 ops (borrow update + bookCopy update), no fine upsert
    const transactionArg = (prisma.$transaction as jest.Mock).mock.calls[0][0];
    expect(transactionArg).toHaveLength(2);
  });
});
```

---

- [ ] **Step 2: Run the test to confirm it fails**

```powershell
cd apps/api
npx jest borrows.service.spec.ts --no-coverage
```

Expected: FAIL — `expect(received).not.toContain(expected)` — because PAID is currently written.

---

- [ ] **Step 3: Apply the fix**

In `apps/api/src/borrows/borrows.service.ts`, replace the fine upsert block (inside `if (fine > 0)`):

```typescript
if (fine > 0) {
  txOps.push(
    this.prisma.finePayment.upsert({
      where: { borrowId },
      create: {
        borrowId,
        userId: borrow.user.id,
        amount: fine,
        status: FineStatus.PENDING,
      },
      update: {
        amount: fine,
        status: FineStatus.PENDING,
        paidAt: null,
      },
    }),
  );
}
```

`paidAt: null` in the `update` branch corrects any fine that was previously written as PAID.

---

- [ ] **Step 4: Run tests and typecheck**

```powershell
cd apps/api
npm run typecheck
npm run test:critical
npx nest build
```

Expected: all green, zero TypeScript errors.

---

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/borrows/borrows.service.ts apps/api/src/borrows/borrows.service.spec.ts
git commit -m "fix(borrows): create overdue fines as PENDING so admin pay/waive flow is not bypassed"
```

---

## Task 2: Restrict GET /users/:id and PATCH /users/interests

**Problem:**
- `GET /users/:id` — any authenticated user (student, instructor) can fetch any other user's full profile
- `PATCH /users/interests` — any authenticated user can call this; comments describe it as staff-only

`RolesGuard` is already wired at the class level (`@UseGuards(JwtAuthGuard, RolesGuard)` on line 43). Adding `@Roles(...)` to a handler is the entire fix — no new guards or imports needed.

**Decisions:**
- `GET :id` → `ADMIN, STAFF` only. Other roles use `/auth/me` or `/auth/profile` for their own data.
- `PATCH interests` → `ADMIN, STAFF` only. Students and instructors update their own interests via `PATCH /ai/interests`, which is separately available.

**Note:** This is a decorator-only change. There is no service-level logic to unit test. Correctness is verified via typecheck (confirms decorators exist) and the existing critical suite (confirms no regressions in adjacent service behavior).

**Files:**
- Modify: `apps/api/src/users/users.controller.ts`

---

- [ ] **Step 1: Apply the role decorators**

In `apps/api/src/users/users.controller.ts`, replace the two handlers:

```typescript
@Get(':id')
@Roles(Role.ADMIN, Role.STAFF)
@ApiOperation({ summary: 'Get user by ID (admin/staff only)' })
@ApiResponse({ status: 200, description: 'User retrieved' })
@ApiResponse({ status: 403, description: 'Forbidden' })
@ApiResponse({ status: 404, description: 'User not found' })
async findById(@Param('id') id: string) {
  return this.usersService.findById(id);
}

@Patch('interests')
@Roles(Role.ADMIN, Role.STAFF)
@ApiOperation({ summary: 'Update user interests (admin/staff only)' })
@ApiResponse({ status: 200, description: 'Interests updated' })
@ApiResponse({ status: 403, description: 'Forbidden' })
async updateMyInterests(
  @CurrentUser('id') userId: string,
  @Body('interests') interests: string[],
) {
  return this.usersService.updateInterests(userId, interests);
}
```

---

- [ ] **Step 2: Run typecheck and critical suite**

```powershell
cd apps/api
npm run typecheck
npm run test:critical
npx nest build
```

Expected: all green.

---

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/users/users.controller.ts
git commit -m "fix(users): restrict GET /users/:id and PATCH /users/interests to admin/staff"
```

---

## Task 3: Update CURRENT_STATE.md

- [ ] **Step 1: Remove the three closed High Priority issues**

Remove from `## High Priority Issues`:
- `returnBook sets overdue fines directly to PAID...`
- `GET /users/:id is accessible to any authenticated user...`
- `PATCH /users/interests is not role-restricted...`

Replace section with: `* None currently identified at high priority.`

- [ ] **Step 2: Remove the closed In Progress bullets**

Remove from `## In Progress`:
- `Overdue fine handling is not fully reconciled with the scheduler...`
- `Role enforcement on user endpoints is not at least-privilege...`

The lifecycle timing bullet stays — it is still real.

- [ ] **Step 3: Add completed items to Last Completed**

Add two bullets to `## Last Completed`:
- `Overdue fines created by returnBook are now set to PENDING status. The admin pay/waive flow is the only path to marking a fine resolved. References: borrows.service.ts`
- `GET /users/:id and PATCH /users/interests are restricted to ADMIN and STAFF roles. Other roles use /auth/me for self-profile and /ai/interests for interest updates. References: users.controller.ts`

- [ ] **Step 4: Update System Health areas**

**Borrow System:** Remove the fine/PAID bullet. Status stays `Fair` (return flow fine state is fixed; return flow itself still has no test for full HTTP path).

**Role Enforcement:** Remove the two user-endpoint bullets. Keep the frontend JWT decode bullet. Status upgrades from `Fair` → `Good` — the only remaining gap is a frontend concern, not a backend enforcement gap.

**Database:** Remove "fine payment state is still corrupted" — now closed.

- [ ] **Step 5: Update score**

Both High Priority issues are closed. Remaining open items are all Medium or Low. Score moves from **6/10 → 7/10**. Update `## Production Readiness Score` reason to reflect this.

- [ ] **Step 6: Commit**

```bash
git add CURRENT_STATE.md
git commit -m "docs(state): reflect fine status fix and user endpoint access control as completed; score 7/10"
```

---

## Self-Review

**Spec coverage:**
- Fix fine status PENDING → Task 1 ✓
- Test for fine status → Task 1 ✓
- Restrict `GET :id` → Task 2 ✓
- Restrict `PATCH interests` → Task 2 ✓
- CURRENT_STATE.md update → Task 3 ✓

**Placeholder scan:** None. All steps have explicit code or commands.

**Type consistency:**
- `FineStatus.PENDING` — already imported in `borrows.service.ts` alongside `FineStatus.PAID` (line 7)
- `Role.ADMIN`, `Role.STAFF` — already imported in `users.controller.ts` (line 26)
- `BorrowsService` constructor signature in test matches actual constructor: `(prisma, notificationsService)`

**Adjacent risk check:**
- `fine-payments.service.markPaid()` guards `status !== PENDING` → works correctly with PENDING fines ✓
- `fine-payments.service.waive()` — guards same way ✓
- No frontend admin page fetches `GET /users/:id` with a student token — no breakage ✓
- `PATCH /ai/interests` remains unrestricted for all roles — student interest updates unaffected ✓
