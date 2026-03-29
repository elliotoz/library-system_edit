# E2E Integration Tests — Reservation & Borrow HTTP Paths

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Real DB-backed Supertest integration tests covering the full reservation lifecycle and borrow extend/return paths, using cookie-based auth against a test PostgreSQL database.

**Architecture:** A dedicated `library_system_test` database on the existing Docker Postgres instance. A shared test bootstrap creates the NestJS app once per suite, runs Prisma migrations, and seeds known test data. Auth helpers log in via `POST /auth/login` and capture the `access_token` cookie for reuse. Tables are truncated and re-seeded between test files.

**Tech Stack:** Jest, Supertest, Prisma, NestJS Testing, PostgreSQL (Docker)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `apps/api/.env.test` | Test database URL and JWT config |
| Create | `apps/api/test/jest-e2e.config.ts` | Separate Jest config for e2e tests |
| Create | `apps/api/test/helpers/test-app.ts` | NestJS app bootstrap (compile once, export app + server) |
| Create | `apps/api/test/helpers/auth.helper.ts` | Login as any seeded user, return cookie string |
| Create | `apps/api/test/helpers/db.helper.ts` | Truncate all tables, run seed, Prisma client for assertions |
| Create | `apps/api/test/helpers/setup.ts` | Global setup: create test DB, run migrations, seed |
| Create | `apps/api/test/helpers/teardown.ts` | Global teardown: drop test DB |
| Create | `apps/api/test/reservations.e2e-spec.ts` | Reservation HTTP path integration tests |
| Create | `apps/api/test/borrows.e2e-spec.ts` | Borrow HTTP path integration tests |
| Modify | `apps/api/package.json` | Add `test:e2e` script |

---

## Task 1: Test Database Configuration

**Files:**
- Create: `apps/api/.env.test`
- Create: `apps/api/test/jest-e2e.config.ts`
- Modify: `apps/api/package.json`

- [ ] **Step 1: Create `.env.test`**

```env
DATABASE_URL="postgresql://library_admin:library_password_2024@localhost:5432/library_system_test?schema=public"
JWT_SECRET="test-jwt-secret-e2e"
JWT_EXPIRATION="7d"
NODE_ENV="test"
PORT=3099
CORS_ORIGIN="http://localhost:3099"
```

- [ ] **Step 2: Create `test/jest-e2e.config.ts`**

```typescript
import type { Config } from "jest";

const config: Config = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "..",
  testRegex: "test/.*\\.e2e-spec\\.ts$",
  transform: { "^.+\\.ts$": "ts-jest" },
  testEnvironment: "node",
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
  globalSetup: "<rootDir>/test/helpers/setup.ts",
  globalTeardown: "<rootDir>/test/helpers/teardown.ts",
  testTimeout: 30000,
};

export default config;
```

- [ ] **Step 3: Add `test:e2e` script to `package.json`**

In `apps/api/package.json`, add to the `"scripts"` block:

```json
"test:e2e": "jest --config test/jest-e2e.config.ts --runInBand --no-coverage"
```

- [ ] **Step 4: Verify Jest picks up the config**

Run: `cd apps/api && npx jest --config test/jest-e2e.config.ts --listTests 2>&1`
Expected: no errors, empty test list (no test files yet)

- [ ] **Step 5: Commit**

```bash
git add apps/api/.env.test apps/api/test/jest-e2e.config.ts apps/api/package.json
git commit -m "test(e2e): add test database config and jest e2e config"
```

---

## Task 2: Global Setup and Teardown

**Files:**
- Create: `apps/api/test/helpers/setup.ts`
- Create: `apps/api/test/helpers/teardown.ts`

- [ ] **Step 1: Create `test/helpers/setup.ts`**

This runs once before the entire e2e suite. It creates the test database, runs migrations, and seeds data.

```typescript
import { execSync } from "child_process";
import { Client } from "pg";

export default async function globalSetup() {
  // Create the test database if it doesn't exist
  const client = new Client({
    host: "localhost",
    port: 5432,
    user: "library_admin",
    password: "library_password_2024",
    database: "postgres",
  });

  await client.connect();

  const dbExists = await client.query(
    "SELECT 1 FROM pg_database WHERE datname = 'library_system_test'"
  );

  if (dbExists.rowCount === 0) {
    await client.query("CREATE DATABASE library_system_test");
  }

  await client.end();

  // Run Prisma migrations and seed against the test DB
  const env = {
    ...process.env,
    DATABASE_URL:
      "postgresql://library_admin:library_password_2024@localhost:5432/library_system_test?schema=public",
  };

  execSync("npx prisma migrate deploy", {
    cwd: process.cwd(),
    env,
    stdio: "pipe",
  });

  execSync("npx prisma db seed", {
    cwd: process.cwd(),
    env,
    stdio: "pipe",
  });
}
```

- [ ] **Step 2: Create `test/helpers/teardown.ts`**

```typescript
import { Client } from "pg";

export default async function globalTeardown() {
  const client = new Client({
    host: "localhost",
    port: 5432,
    user: "library_admin",
    password: "library_password_2024",
    database: "postgres",
  });

  await client.connect();

  // Terminate connections and drop the test database
  await client.query(`
    SELECT pg_terminate_backend(pg_stat_activity.pid)
    FROM pg_stat_activity
    WHERE pg_stat_activity.datname = 'library_system_test'
      AND pid <> pg_backend_pid()
  `);

  await client.query("DROP DATABASE IF EXISTS library_system_test");
  await client.end();
}
```

- [ ] **Step 3: Verify setup/teardown work**

Run: `cd apps/api && npx jest --config test/jest-e2e.config.ts --runInBand --no-coverage 2>&1`
Expected: setup creates DB, runs migrations, seeds data, teardown drops DB. No test files found, but no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/test/helpers/setup.ts apps/api/test/helpers/teardown.ts
git commit -m "test(e2e): add global setup/teardown for test database lifecycle"
```

---

## Task 3: App Bootstrap and DB Helper

**Files:**
- Create: `apps/api/test/helpers/test-app.ts`
- Create: `apps/api/test/helpers/db.helper.ts`

- [ ] **Step 1: Create `test/helpers/test-app.ts`**

Compiles the NestJS app once and exports the HTTP server for Supertest.

```typescript
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as cookieParser from "cookie-parser";
import { AppModule } from "@/app.module";
import { GlobalExceptionFilter } from "@/common/filters/global-exception.filter";

let app: INestApplication;

export async function getApp(): Promise<INestApplication> {
  if (app) return app;

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication();

  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );
  app.useGlobalFilters(new GlobalExceptionFilter());

  await app.init();
  return app;
}

export async function closeApp(): Promise<void> {
  if (app) {
    await app.close();
    app = undefined as any;
  }
}
```

- [ ] **Step 2: Create `test/helpers/db.helper.ts`**

Provides a raw Prisma client for direct DB assertions and a truncate-and-reseed function.

```typescript
import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";

const TEST_DATABASE_URL =
  "postgresql://library_admin:library_password_2024@localhost:5432/library_system_test?schema=public";

let prisma: PrismaClient;

export function getTestPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
  }
  return prisma;
}

export async function disconnectTestPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = undefined as any;
  }
}

export async function resetDatabase(): Promise<void> {
  const db = getTestPrisma();

  // Truncate all tables in dependency order (children first)
  await db.$executeRawUnsafe(`
    TRUNCATE TABLE
      "AiMessage",
      "AiConversation",
      "FinePayment",
      "Notification",
      "InstructorFollower",
      "ReadingListItem",
      "ReadingList",
      "Material",
      "Borrow",
      "Reservation",
      "BookCopy",
      "Book",
      "BorrowPolicy",
      "Course",
      "User",
      "Faculty",
      "LibraryBranch"
    CASCADE
  `);

  // Re-seed
  execSync("npx prisma db seed", {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "pipe",
  });
}
```

- [ ] **Step 3: Verify app bootstrap compiles**

Run: `cd apps/api && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add apps/api/test/helpers/test-app.ts apps/api/test/helpers/db.helper.ts
git commit -m "test(e2e): add NestJS app bootstrap and DB reset helper"
```

---

## Task 4: Auth Helper

**Files:**
- Create: `apps/api/test/helpers/auth.helper.ts`

- [ ] **Step 1: Create `test/helpers/auth.helper.ts`**

Logs in via the real `POST /auth/login` endpoint and extracts the `access_token` cookie for reuse.

```typescript
import * as request from "supertest";
import { INestApplication } from "@nestjs/common";

// Known seed credentials (from prisma/seed.ts — password is "password123" for all)
export const USERS = {
  admin: { email: "admin@uskudar.edu.tr", password: "password123" },
  student: { email: "efe.demir@std.uskudar.edu.tr", password: "password123" },
  instructor: { email: "kemal.sahin@uskudar.edu.tr", password: "password123" },
  staff: { email: "ayse.yildiz@uskudar.edu.tr", password: "password123" },
} as const;

export type UserRole = keyof typeof USERS;

interface LoginResult {
  cookie: string;
  userId: string;
  role: string;
}

const tokenCache = new Map<string, LoginResult>();

export async function loginAs(
  app: INestApplication,
  role: UserRole
): Promise<LoginResult> {
  const cached = tokenCache.get(role);
  if (cached) return cached;

  const creds = USERS[role];
  const res = await request(app.getHttpServer())
    .post("/auth/login")
    .send({ email: creds.email, password: creds.password })
    .expect(200);

  const setCookie = res.headers["set-cookie"];
  const cookieHeader = Array.isArray(setCookie) ? setCookie[0] : setCookie;

  // Extract just the access_token=... part for reuse
  const cookie = cookieHeader.split(";")[0];

  const result: LoginResult = {
    cookie,
    userId: res.body.user.id,
    role: res.body.user.role,
  };

  tokenCache.set(role, result);
  return result;
}

export function clearAuthCache(): void {
  tokenCache.clear();
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/test/helpers/auth.helper.ts
git commit -m "test(e2e): add auth helper with cookie-based login"
```

---

## Task 5: Reservation E2E Tests — Setup and Create

**Files:**
- Create: `apps/api/test/reservations.e2e-spec.ts`

- [ ] **Step 1: Write the test file scaffold with beforeAll/afterAll and the first test (create reservation)**

```typescript
import * as request from "supertest";
import { INestApplication } from "@nestjs/common";
import { getApp, closeApp } from "./helpers/test-app";
import { loginAs, clearAuthCache } from "./helpers/auth.helper";
import {
  getTestPrisma,
  resetDatabase,
  disconnectTestPrisma,
} from "./helpers/db.helper";

describe("Reservations E2E", () => {
  let app: INestApplication;
  let server: any;

  beforeAll(async () => {
    process.env.DATABASE_URL =
      "postgresql://library_admin:library_password_2024@localhost:5432/library_system_test?schema=public";

    await resetDatabase();
    clearAuthCache();

    app = await getApp();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
    await closeApp();
  });

  // ── helpers ──────────────────────────────────────────────────────────────

  /** Find an available book copy for a given branch from seed data */
  async function findAvailableCopy() {
    const prisma = getTestPrisma();
    const copy = await prisma.bookCopy.findFirst({
      where: { status: "AVAILABLE" },
      include: { book: true, branch: true },
    });
    if (!copy) throw new Error("No available copy in seed data");
    return copy;
  }

  // ── POST /reservations ───────────────────────────────────────────────────

  describe("POST /reservations", () => {
    it("requires authentication", async () => {
      await request(server).post("/reservations").send({}).expect(401);
    });

    it("validates the request body", async () => {
      const { cookie } = await loginAs(app, "student");

      await request(server)
        .post("/reservations")
        .set("Cookie", cookie)
        .send({})
        .expect(400);
    });

    it("creates a reservation as a student", async () => {
      const { cookie } = await loginAs(app, "student");
      const copy = await findAvailableCopy();

      const res = await request(server)
        .post("/reservations")
        .set("Cookie", cookie)
        .send({ bookId: copy.bookId, branchId: copy.branchId })
        .expect(201);

      expect(res.body).toMatchObject({
        id: expect.any(String),
        status: "PENDING",
      });
    });

    it("rejects duplicate reservation for the same book", async () => {
      const { cookie } = await loginAs(app, "student");
      const prisma = getTestPrisma();

      // Find a book the student already reserved
      const existing = await prisma.reservation.findFirst({
        where: { status: "PENDING" },
        include: { bookCopy: true },
      });
      if (!existing) throw new Error("Expected a PENDING reservation from prior test");

      // Try to reserve same book at any branch
      const otherCopy = await prisma.bookCopy.findFirst({
        where: { bookId: existing.bookCopy.bookId, status: "AVAILABLE" },
      });

      if (otherCopy) {
        await request(server)
          .post("/reservations")
          .set("Cookie", cookie)
          .send({ bookId: otherCopy.bookId, branchId: otherCopy.branchId })
          .expect(409);
      }
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it works against the real DB**

Run: `cd apps/api && npx jest --config test/jest-e2e.config.ts --runInBand --no-coverage 2>&1`
Expected: 3-4 tests pass (auth, validation, create, duplicate)

- [ ] **Step 3: Commit**

```bash
git add apps/api/test/reservations.e2e-spec.ts
git commit -m "test(e2e): reservation create with auth, validation, and duplicate checks"
```

---

## Task 6: Reservation E2E Tests — Approve, Mark Ready, Collect

**Files:**
- Modify: `apps/api/test/reservations.e2e-spec.ts`

- [ ] **Step 1: Add the full lifecycle tests after the create block**

Append these `describe` blocks inside the outer `describe("Reservations E2E")`, after the `POST /reservations` block:

```typescript
  // ── PATCH /reservations/:id/approve ────────────────────────────────────

  describe("PATCH /reservations/:id/approve", () => {
    it("rejects non-admin users", async () => {
      const { cookie: studentCookie } = await loginAs(app, "student");
      const prisma = getTestPrisma();

      const pending = await prisma.reservation.findFirst({
        where: { status: "PENDING" },
      });

      await request(server)
        .patch(`/reservations/${pending!.id}/approve`)
        .set("Cookie", studentCookie)
        .expect(403);
    });

    it("approves a pending reservation", async () => {
      const { cookie: adminCookie } = await loginAs(app, "admin");
      const prisma = getTestPrisma();

      const pending = await prisma.reservation.findFirst({
        where: { status: "PENDING" },
      });

      const res = await request(server)
        .patch(`/reservations/${pending!.id}/approve`)
        .set("Cookie", adminCookie)
        .expect(200);

      expect(res.body.status).toBe("APPROVED");
      expect(res.body.pickupDeadline).toBeNull();
    });

    it("rejects approving a non-PENDING reservation", async () => {
      const { cookie: adminCookie } = await loginAs(app, "admin");
      const prisma = getTestPrisma();

      const approved = await prisma.reservation.findFirst({
        where: { status: "APPROVED" },
      });

      await request(server)
        .patch(`/reservations/${approved!.id}/approve`)
        .set("Cookie", adminCookie)
        .expect(400);
    });
  });

  // ── PATCH /reservations/:id/mark-ready ─────────────────────────────────

  describe("PATCH /reservations/:id/mark-ready", () => {
    it("rejects non-admin users", async () => {
      const { cookie: studentCookie } = await loginAs(app, "student");
      const prisma = getTestPrisma();

      const approved = await prisma.reservation.findFirst({
        where: { status: "APPROVED" },
      });

      await request(server)
        .patch(`/reservations/${approved!.id}/mark-ready`)
        .set("Cookie", studentCookie)
        .expect(403);
    });

    it("marks an approved reservation as ready for pickup", async () => {
      const { cookie: adminCookie } = await loginAs(app, "admin");
      const prisma = getTestPrisma();

      const approved = await prisma.reservation.findFirst({
        where: { status: "APPROVED" },
      });

      const res = await request(server)
        .patch(`/reservations/${approved!.id}/mark-ready`)
        .set("Cookie", adminCookie)
        .expect(200);

      expect(res.body.status).toBe("READY_FOR_PICKUP");
      expect(res.body.pickupDeadline).toBeTruthy();

      // Verify pickupDeadline is ~2 days from now
      const deadline = new Date(res.body.pickupDeadline);
      const now = new Date();
      const hoursUntil =
        (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
      expect(hoursUntil).toBeGreaterThan(46);
      expect(hoursUntil).toBeLessThan(50);
    });

    it("rejects marking a non-APPROVED reservation as ready", async () => {
      const { cookie: adminCookie } = await loginAs(app, "admin");
      const prisma = getTestPrisma();

      const pending = await prisma.reservation.findFirst({
        where: { status: "PENDING" },
      });

      // If no PENDING left, create a fresh one
      if (!pending) return;

      await request(server)
        .patch(`/reservations/${pending.id}/mark-ready`)
        .set("Cookie", adminCookie)
        .expect(400);
    });
  });

  // ── PATCH /reservations/:id/collect ────────────────────────────────────

  describe("PATCH /reservations/:id/collect", () => {
    it("rejects non-admin users", async () => {
      const { cookie: studentCookie } = await loginAs(app, "student");
      const prisma = getTestPrisma();

      const ready = await prisma.reservation.findFirst({
        where: { status: "READY_FOR_PICKUP" },
      });

      await request(server)
        .patch(`/reservations/${ready!.id}/collect`)
        .set("Cookie", studentCookie)
        .expect(403);
    });

    it("collects a ready reservation and creates a borrow", async () => {
      const { cookie: adminCookie } = await loginAs(app, "admin");
      const prisma = getTestPrisma();

      const ready = await prisma.reservation.findFirst({
        where: { status: "READY_FOR_PICKUP" },
      });

      const res = await request(server)
        .patch(`/reservations/${ready!.id}/collect`)
        .set("Cookie", adminCookie)
        .expect(200);

      expect(res.body.reservation.status).toBe("COLLECTED");
      expect(res.body.borrow).toMatchObject({
        id: expect.any(String),
        borrowedAt: expect.any(String),
        dueAt: expect.any(String),
      });

      // Verify borrow exists in DB
      const borrow = await prisma.borrow.findFirst({
        where: { id: res.body.borrow.id },
      });
      expect(borrow).toBeTruthy();
      expect(borrow!.status).toBe("ACTIVE");
    });
  });
```

- [ ] **Step 2: Run the tests**

Run: `cd apps/api && npx jest --config test/jest-e2e.config.ts --runInBand --no-coverage 2>&1`
Expected: all reservation tests pass in sequence (create → approve → mark-ready → collect)

- [ ] **Step 3: Commit**

```bash
git add apps/api/test/reservations.e2e-spec.ts
git commit -m "test(e2e): reservation approve, mark-ready, and collect lifecycle"
```

---

## Task 7: Reservation E2E Tests — Reject, Cancel, My Reservations

**Files:**
- Modify: `apps/api/test/reservations.e2e-spec.ts`

- [ ] **Step 1: Add reject, cancel, and my-reservations tests**

Append these `describe` blocks inside the outer `describe("Reservations E2E")`:

```typescript
  // ── PATCH /reservations/:id/reject ─────────────────────────────────────

  describe("PATCH /reservations/:id/reject", () => {
    let freshReservationId: string;

    beforeAll(async () => {
      // Create a fresh reservation to reject
      const { cookie } = await loginAs(app, "student");
      const copy = await findAvailableCopy();

      const res = await request(server)
        .post("/reservations")
        .set("Cookie", cookie)
        .send({ bookId: copy.bookId, branchId: copy.branchId })
        .expect(201);

      freshReservationId = res.body.id;
    });

    it("rejects non-admin users", async () => {
      const { cookie: studentCookie } = await loginAs(app, "student");

      await request(server)
        .patch(`/reservations/${freshReservationId}/reject`)
        .set("Cookie", studentCookie)
        .send({ reason: "test" })
        .expect(403);
    });

    it("requires a reason", async () => {
      const { cookie: adminCookie } = await loginAs(app, "admin");

      await request(server)
        .patch(`/reservations/${freshReservationId}/reject`)
        .set("Cookie", adminCookie)
        .send({})
        .expect(400);
    });

    it("rejects a pending reservation with reason", async () => {
      const { cookie: adminCookie } = await loginAs(app, "admin");

      const res = await request(server)
        .patch(`/reservations/${freshReservationId}/reject`)
        .set("Cookie", adminCookie)
        .send({ reason: "Book is damaged" })
        .expect(200);

      expect(res.body.status).toBe("CANCELLED");

      // Verify the book copy was released back to AVAILABLE
      const prisma = getTestPrisma();
      const reservation = await prisma.reservation.findUnique({
        where: { id: freshReservationId },
        include: { bookCopy: true },
      });
      expect(reservation!.bookCopy.status).toBe("AVAILABLE");
    });

    it("rejects a COLLECTED reservation", async () => {
      const { cookie: adminCookie } = await loginAs(app, "admin");
      const prisma = getTestPrisma();

      const collected = await prisma.reservation.findFirst({
        where: { status: "COLLECTED" },
      });

      if (collected) {
        await request(server)
          .patch(`/reservations/${collected.id}/reject`)
          .set("Cookie", adminCookie)
          .send({ reason: "Too late" })
          .expect(400);
      }
    });
  });

  // ── PATCH /reservations/:id/cancel ─────────────────────────────────────

  describe("PATCH /reservations/:id/cancel", () => {
    let cancelReservationId: string;

    beforeAll(async () => {
      const { cookie } = await loginAs(app, "student");
      const copy = await findAvailableCopy();

      const res = await request(server)
        .post("/reservations")
        .set("Cookie", cookie)
        .send({ bookId: copy.bookId, branchId: copy.branchId })
        .expect(201);

      cancelReservationId = res.body.id;
    });

    it("requires authentication", async () => {
      await request(server)
        .patch(`/reservations/${cancelReservationId}/cancel`)
        .expect(401);
    });

    it("allows the owner to cancel their reservation", async () => {
      const { cookie: studentCookie } = await loginAs(app, "student");

      const res = await request(server)
        .patch(`/reservations/${cancelReservationId}/cancel`)
        .set("Cookie", studentCookie)
        .expect(200);

      expect(res.body.status).toBe("CANCELLED");
    });

    it("does not allow cancelling another user's reservation", async () => {
      // Create a reservation as instructor
      const { cookie: instructorCookie } = await loginAs(app, "instructor");
      const copy = await findAvailableCopy();

      const createRes = await request(server)
        .post("/reservations")
        .set("Cookie", instructorCookie)
        .send({ bookId: copy.bookId, branchId: copy.branchId })
        .expect(201);

      // Try to cancel as student
      const { cookie: studentCookie } = await loginAs(app, "student");

      await request(server)
        .patch(`/reservations/${createRes.body.id}/cancel`)
        .set("Cookie", studentCookie)
        .expect(403);

      // Clean up — cancel as the owner
      await request(server)
        .patch(`/reservations/${createRes.body.id}/cancel`)
        .set("Cookie", instructorCookie)
        .expect(200);
    });
  });

  // ── GET /reservations/my ───────────────────────────────────────────────

  describe("GET /reservations/my", () => {
    it("requires authentication", async () => {
      await request(server).get("/reservations/my").expect(401);
    });

    it("returns the authenticated user's reservations", async () => {
      const { cookie } = await loginAs(app, "student");

      const res = await request(server)
        .get("/reservations/my")
        .set("Cookie", cookie)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);

      // Verify shape
      const first = res.body[0];
      expect(first).toHaveProperty("id");
      expect(first).toHaveProperty("status");
      expect(first).toHaveProperty("book");
      expect(first).toHaveProperty("branch");
    });
  });
```

- [ ] **Step 2: Run the tests**

Run: `cd apps/api && npx jest --config test/jest-e2e.config.ts --runInBand --no-coverage 2>&1`
Expected: all reservation tests pass

- [ ] **Step 3: Commit**

```bash
git add apps/api/test/reservations.e2e-spec.ts
git commit -m "test(e2e): reservation reject, cancel, and my-reservations"
```

---

## Task 8: Borrow E2E Tests — Extend, Return, Overdue Fine, Role Enforcement

**Files:**
- Create: `apps/api/test/borrows.e2e-spec.ts`

- [ ] **Step 1: Write the full borrows e2e test file**

This file creates its own reservation→collect flow to get a borrow, then tests extend and return.

```typescript
import * as request from "supertest";
import { INestApplication } from "@nestjs/common";
import { getApp, closeApp } from "./helpers/test-app";
import { loginAs, clearAuthCache } from "./helpers/auth.helper";
import {
  getTestPrisma,
  resetDatabase,
  disconnectTestPrisma,
} from "./helpers/db.helper";

describe("Borrows E2E", () => {
  let app: INestApplication;
  let server: any;

  beforeAll(async () => {
    process.env.DATABASE_URL =
      "postgresql://library_admin:library_password_2024@localhost:5432/library_system_test?schema=public";

    await resetDatabase();
    clearAuthCache();

    app = await getApp();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
    await closeApp();
  });

  // ── helper: create a borrow via the reservation lifecycle ──────────────

  async function createBorrowViaReservation(): Promise<{
    borrowId: string;
    reservationId: string;
    bookCopyId: string;
    userId: string;
  }> {
    const prisma = getTestPrisma();
    const { cookie: studentCookie, userId } = await loginAs(app, "student");
    const { cookie: adminCookie } = await loginAs(app, "admin");

    const copy = await prisma.bookCopy.findFirst({
      where: { status: "AVAILABLE" },
    });
    if (!copy) throw new Error("No available copy");

    // Create reservation
    const createRes = await request(server)
      .post("/reservations")
      .set("Cookie", studentCookie)
      .send({ bookId: copy.bookId, branchId: copy.branchId })
      .expect(201);

    const reservationId = createRes.body.id;

    // Approve
    await request(server)
      .patch(`/reservations/${reservationId}/approve`)
      .set("Cookie", adminCookie)
      .expect(200);

    // Mark ready
    await request(server)
      .patch(`/reservations/${reservationId}/mark-ready`)
      .set("Cookie", adminCookie)
      .expect(200);

    // Collect
    const collectRes = await request(server)
      .patch(`/reservations/${reservationId}/collect`)
      .set("Cookie", adminCookie)
      .expect(200);

    return {
      borrowId: collectRes.body.borrow.id,
      reservationId,
      bookCopyId: copy.id,
      userId,
    };
  }

  // ── PATCH /borrows/:id/extend ──────────────────────────────────────────

  describe("PATCH /borrows/:id/extend", () => {
    let borrowId: string;

    beforeAll(async () => {
      const result = await createBorrowViaReservation();
      borrowId = result.borrowId;
    });

    it("requires authentication", async () => {
      await request(server).patch(`/borrows/${borrowId}/extend`).expect(401);
    });

    it("rejects extend by a non-owner non-admin", async () => {
      const { cookie: instructorCookie } = await loginAs(app, "instructor");

      await request(server)
        .patch(`/borrows/${borrowId}/extend`)
        .set("Cookie", instructorCookie)
        .expect(400);
    });

    it("extends the borrow as the owner", async () => {
      const { cookie: studentCookie } = await loginAs(app, "student");

      const prisma = getTestPrisma();
      const before = await prisma.borrow.findUnique({
        where: { id: borrowId },
      });

      const res = await request(server)
        .patch(`/borrows/${borrowId}/extend`)
        .set("Cookie", studentCookie)
        .expect(200);

      // Due date should be extended
      const newDue = new Date(res.body.dueAt);
      const oldDue = new Date(before!.dueAt);
      expect(newDue.getTime()).toBeGreaterThan(oldDue.getTime());

      // Extension count should increment
      expect(res.body.extensionCount).toBe(before!.extensionCount + 1);
    });

    it("rejects extending an overdue borrow", async () => {
      const prisma = getTestPrisma();

      // Force the borrow to be overdue
      await prisma.borrow.update({
        where: { id: borrowId },
        data: { dueAt: new Date("2020-01-01") },
      });

      const { cookie: studentCookie } = await loginAs(app, "student");

      const res = await request(server)
        .patch(`/borrows/${borrowId}/extend`)
        .set("Cookie", studentCookie)
        .expect(400);

      expect(res.body.message).toContain("overdue");

      // Restore due date for subsequent tests
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      await prisma.borrow.update({
        where: { id: borrowId },
        data: { dueAt: futureDate, status: "ACTIVE" },
      });
    });
  });

  // ── PATCH /borrows/:id/return ──────────────────────────────────────────

  describe("PATCH /borrows/:id/return", () => {
    let returnBorrowId: string;

    beforeAll(async () => {
      const result = await createBorrowViaReservation();
      returnBorrowId = result.borrowId;
    });

    it("rejects non-admin users", async () => {
      const { cookie: studentCookie } = await loginAs(app, "student");

      await request(server)
        .patch(`/borrows/${returnBorrowId}/return`)
        .set("Cookie", studentCookie)
        .expect(403);
    });

    it("returns an active borrow (on time, no fine)", async () => {
      const { cookie: adminCookie } = await loginAs(app, "admin");

      const res = await request(server)
        .patch(`/borrows/${returnBorrowId}/return`)
        .set("Cookie", adminCookie)
        .expect(200);

      expect(res.body.status).toBe("RETURNED");
      expect(res.body.wasOverdue).toBe(false);
      expect(res.body.fine).toBe(0);
    });

    it("rejects returning an already returned borrow", async () => {
      const { cookie: adminCookie } = await loginAs(app, "admin");

      await request(server)
        .patch(`/borrows/${returnBorrowId}/return`)
        .set("Cookie", adminCookie)
        .expect(400);
    });
  });

  // ── overdue return creates PENDING fine ────────────────────────────────

  describe("overdue return creates PENDING fine", () => {
    let overdueBorrowId: string;
    let overdueUserId: string;

    beforeAll(async () => {
      const result = await createBorrowViaReservation();
      overdueBorrowId = result.borrowId;
      overdueUserId = result.userId;

      // Make the borrow overdue by backdating dueAt
      const prisma = getTestPrisma();
      await prisma.borrow.update({
        where: { id: overdueBorrowId },
        data: {
          dueAt: new Date("2025-01-01"),
          status: "OVERDUE",
        },
      });
    });

    it("creates a PENDING fine on overdue return", async () => {
      const { cookie: adminCookie } = await loginAs(app, "admin");

      const res = await request(server)
        .patch(`/borrows/${overdueBorrowId}/return`)
        .set("Cookie", adminCookie)
        .expect(200);

      expect(res.body.status).toBe("RETURNED");
      expect(res.body.wasOverdue).toBe(true);
      expect(res.body.overdueDays).toBeGreaterThan(0);
      expect(res.body.fine).toBeGreaterThan(0);

      // Verify fine record in DB is PENDING (not PAID)
      const prisma = getTestPrisma();
      const fineRecord = await prisma.finePayment.findUnique({
        where: { borrowId: overdueBorrowId },
      });

      expect(fineRecord).toBeTruthy();
      expect(fineRecord!.status).toBe("PENDING");
      expect(fineRecord!.paidAt).toBeNull();
      expect(fineRecord!.userId).toBe(overdueUserId);
    });
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `cd apps/api && npx jest --config test/jest-e2e.config.ts --runInBand --no-coverage 2>&1`
Expected: all reservation and borrow tests pass

- [ ] **Step 3: Verify unit tests still pass**

Run: `cd apps/api && npm run test:critical 2>&1`
Expected: 24/24 pass (no regressions)

- [ ] **Step 4: Verify typecheck**

Run: `cd apps/api && npm run typecheck 2>&1`
Expected: pass

- [ ] **Step 5: Verify nest build**

Run: `cd apps/api && npx nest build 2>&1`
Expected: pass

- [ ] **Step 6: Commit**

```bash
git add apps/api/test/borrows.e2e-spec.ts
git commit -m "test(e2e): borrow extend, return, overdue fine, and role enforcement"
```

---

## Task 9: Final Verification and Test Script

- [ ] **Step 1: Run the full verification suite**

```bash
cd apps/api
npm run typecheck
npm run test:critical
npm run test:e2e
npx nest build
```

All four must be green.

- [ ] **Step 2: Add `test:e2e` to root `package.json`**

Add to root `package.json` scripts:

```json
"test:api:e2e": "cd apps/api && npm run test:e2e"
```

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add root test:api:e2e script"
```
