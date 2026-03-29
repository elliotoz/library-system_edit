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

  /** Find an available book copy from seed data */
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

      const existing = await prisma.reservation.findFirst({
        where: { status: "PENDING" },
        include: { bookCopy: true },
      });
      if (!existing) throw new Error("Expected a PENDING reservation");

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

      const deadline = new Date(res.body.pickupDeadline);
      const now = new Date();
      const hoursUntil =
        (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
      expect(hoursUntil).toBeGreaterThan(46);
      expect(hoursUntil).toBeLessThan(50);
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

      const borrow = await prisma.borrow.findFirst({
        where: { id: res.body.borrow.id },
      });
      expect(borrow).toBeTruthy();
      expect(borrow!.status).toBe("ACTIVE");
    });
  });

  // ── PATCH /reservations/:id/reject ─────────────────────────────────────

  describe("PATCH /reservations/:id/reject", () => {
    let freshReservationId: string;

    beforeAll(async () => {
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
      const { cookie: instructorCookie } = await loginAs(app, "instructor");
      const copy = await findAvailableCopy();

      const createRes = await request(server)
        .post("/reservations")
        .set("Cookie", instructorCookie)
        .send({ bookId: copy.bookId, branchId: copy.branchId })
        .expect(201);

      const { cookie: studentCookie } = await loginAs(app, "student");

      await request(server)
        .patch(`/reservations/${createRes.body.id}/cancel`)
        .set("Cookie", studentCookie)
        .expect(403);

      // Clean up
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

      const first = res.body[0];
      expect(first).toHaveProperty("id");
      expect(first).toHaveProperty("status");
      expect(first).toHaveProperty("book");
      expect(first).toHaveProperty("branch");
    });
  });
});
