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

  // ── helper: create a borrow via the full reservation lifecycle ─────────

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

    const createRes = await request(server)
      .post("/reservations")
      .set("Cookie", studentCookie)
      .send({ bookId: copy.bookId, branchId: copy.branchId })
      .expect(201);

    const reservationId = createRes.body.id;

    await request(server)
      .patch(`/reservations/${reservationId}/approve`)
      .set("Cookie", adminCookie)
      .expect(200);

    await request(server)
      .patch(`/reservations/${reservationId}/mark-ready`)
      .set("Cookie", adminCookie)
      .expect(200);

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

      const newDue = new Date(res.body.dueAt);
      const oldDue = new Date(before!.dueAt);
      expect(newDue.getTime()).toBeGreaterThan(oldDue.getTime());
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
