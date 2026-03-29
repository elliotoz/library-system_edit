import * as request from "supertest";
import { INestApplication } from "@nestjs/common";
import { getApp, closeApp } from "./helpers/test-app";
import { loginAs, clearAuthCache } from "./helpers/auth.helper";
import { resetDatabase, disconnectTestPrisma } from "./helpers/db.helper";

describe("Security E2E", () => {
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

  // ── Password strength — POST /auth/register ───────────────────────────────

  describe("POST /auth/register — password strength", () => {
    it("rejects a password with no uppercase letter", async () => {
      const res = await request(server)
        .post("/auth/register")
        .send({ name: "Test User", email: "test1@example.com", password: "weakpass1" });
      expect(res.status).toBe(400);
      expect(res.body.message).toEqual(
        expect.arrayContaining([
          expect.stringContaining("uppercase"),
        ])
      );
    });

    it("rejects a password shorter than 8 characters", async () => {
      await request(server)
        .post("/auth/register")
        .send({ name: "Test User", email: "test2@example.com", password: "Weak1" })
        .expect(400);
    });

    it("rejects a password with no digit", async () => {
      await request(server)
        .post("/auth/register")
        .send({ name: "Test User", email: "test3@example.com", password: "Weakpassword" })
        .expect(400);
    });
  });

  // ── Password strength — POST /auth/reset-password ────────────────────────

  describe("POST /auth/reset-password — password strength", () => {
    it("rejects a weak new password (no uppercase, no digit)", async () => {
      await request(server)
        .post("/auth/reset-password")
        .send({ token: "any-token", password: "weakpassword" })
        .expect(400);
    });

    it("rejects a new password shorter than 8 characters", async () => {
      await request(server)
        .post("/auth/reset-password")
        .send({ token: "any-token", password: "Weak1" })
        .expect(400);
    });
  });

  // ── Book branch copy count — POST /books ─────────────────────────────────

  describe("POST /books — branch copy count validation", () => {
    it("rejects branches[].numberOfCopies > 50 with 400", async () => {
      const { cookie } = await loginAs(app, "admin");

      const res = await request(server)
        .post("/books")
        .set("Cookie", cookie)
        .send({
          title: "Test Book",
          authors: ["Author Name"],
          branches: [{ branchId: "fake-branch-id", numberOfCopies: 51 }],
        });

      expect(res.status).toBe(400);
    });
  });

  // ── AI status endpoint auth ───────────────────────────────────────────────

  describe("GET /ai/status", () => {
    it("returns 401 without authentication", async () => {
      await request(server).get("/ai/status").expect(401);
    });

    it("returns 200 with a valid authenticated user (student role)", async () => {
      const { cookie } = await loginAs(app, "student");

      await request(server)
        .get("/ai/status")
        .set("Cookie", cookie)
        .expect(200);
    });
  });

  // ── reset-password rate limiting ──────────────────────────────────────────

  describe("POST /auth/reset-password — rate limiting", () => {
    it("returns 429 after the rate limit is exceeded", async () => {
      // ThrottlerGuard (limit: 5 per 60s) runs before ValidationPipe, so every
      // request to this endpoint — including the password-strength tests above —
      // increments the counter. Fire 10 requests to guarantee crossing the limit
      // regardless of how many prior calls this test run has already made.
      const statuses: number[] = [];
      for (let i = 0; i < 10; i++) {
        const res = await request(server)
          .post("/auth/reset-password")
          .send({ token: `tok-${i}`, password: "ValidPass1" });
        statuses.push(res.status);
      }
      expect(statuses).toContain(429);
    });
  });
});
