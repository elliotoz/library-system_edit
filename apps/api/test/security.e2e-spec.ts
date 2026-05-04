import * as request from "supertest";
import * as fs from "fs";
import * as path from "path";
import { INestApplication } from "@nestjs/common";
import { getApp, closeApp } from "./helpers/test-app";
import { loginAs, clearAuthCache } from "./helpers/auth.helper";
import { resetDatabase, disconnectTestPrisma } from "./helpers/db.helper";

const UPLOADS_MATERIALS_DIR = path.resolve(__dirname, "../uploads/materials");

function safeDeleteUpload(fileUrl: string): void {
  if (!fileUrl.startsWith("/uploads/materials/")) return;
  const filename = path.basename(fileUrl);
  const target = path.resolve(UPLOADS_MATERIALS_DIR, filename);
  if (!target.startsWith(UPLOADS_MATERIALS_DIR + path.sep) && target !== UPLOADS_MATERIALS_DIR) return;
  try { fs.unlinkSync(target); } catch { /* ignore missing */ }
}

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

  // ── Query DTO validation — GET /reservations ─────────────────────────────

  describe("GET /reservations — query DTO validation", () => {
    it("rejects page=0 with 400", async () => {
      const { cookie } = await loginAs(app, "admin");
      await request(server)
        .get("/reservations?page=0")
        .set("Cookie", cookie)
        .expect(400);
    });

    it("rejects pageSize=200 with 400", async () => {
      const { cookie } = await loginAs(app, "admin");
      await request(server)
        .get("/reservations?pageSize=200")
        .set("Cookie", cookie)
        .expect(400);
    });

    it("rejects pageSize=abc with 400", async () => {
      const { cookie } = await loginAs(app, "admin");
      await request(server)
        .get("/reservations?pageSize=abc")
        .set("Cookie", cookie)
        .expect(400);
    });
  });

  // ── Query DTO validation — GET /notifications ─────────────────────────────

  describe("GET /notifications — query DTO validation", () => {
    it("rejects limit=0 with 400", async () => {
      const { cookie } = await loginAs(app, "student");
      await request(server)
        .get("/notifications?limit=0")
        .set("Cookie", cookie)
        .expect(400);
    });

    it("rejects limit=200 with 400", async () => {
      const { cookie } = await loginAs(app, "student");
      await request(server)
        .get("/notifications?limit=200")
        .set("Cookie", cookie)
        .expect(400);
    });

    it("rejects limit=abc with 400", async () => {
      const { cookie } = await loginAs(app, "student");
      await request(server)
        .get("/notifications?limit=abc")
        .set("Cookie", cookie)
        .expect(400);
    });
  });

  // ── Query DTO validation — GET /fine-payments ─────────────────────────────

  describe("GET /fine-payments — query DTO validation", () => {
    it("rejects page=0 with 400", async () => {
      const { cookie } = await loginAs(app, "admin");
      await request(server)
        .get("/fine-payments?page=0")
        .set("Cookie", cookie)
        .expect(400);
    });

    it("rejects pageSize=999 with 400", async () => {
      const { cookie } = await loginAs(app, "admin");
      await request(server)
        .get("/fine-payments?pageSize=999")
        .set("Cookie", cookie)
        .expect(400);
    });

    it("rejects status=INVALID with 400", async () => {
      const { cookie } = await loginAs(app, "admin");
      await request(server)
        .get("/fine-payments?status=INVALID")
        .set("Cookie", cookie)
        .expect(400);
    });
  });

  // ── Materials role enforcement — POST /materials ─────────────────────────

  describe("POST /materials — role enforcement", () => {
    const validDto = {
      title: "Test Material",
      type: "RESEARCH_PAPER",
      authorName: "Test Author",
      accessLevel: "PUBLIC",
    };

    it("returns 403 when a student creates a material", async () => {
      const { cookie } = await loginAs(app, "student");
      await request(server)
        .post("/materials")
        .set("Cookie", cookie)
        .send(validDto)
        .expect(403);
    });

    it("returns 403 when staff creates a material", async () => {
      const { cookie } = await loginAs(app, "staff");
      await request(server)
        .post("/materials")
        .set("Cookie", cookie)
        .send(validDto)
        .expect(403);
    });

    it("returns 201 when an instructor creates a material", async () => {
      const { cookie } = await loginAs(app, "instructor");
      await request(server)
        .post("/materials")
        .set("Cookie", cookie)
        .send(validDto)
        .expect(201);
    });

    it("returns 201 when an admin creates a material", async () => {
      const { cookie } = await loginAs(app, "admin");
      await request(server)
        .post("/materials")
        .set("Cookie", cookie)
        .send(validDto)
        .expect(201);
    });
  });

  // ── Materials upload role enforcement — POST /materials/upload ────────────

  describe("POST /materials/upload — role enforcement", () => {
    const uploadedFiles: string[] = [];

    afterAll(() => {
      uploadedFiles.forEach(safeDeleteUpload);
    });

    it("returns 403 when a student uploads a material file", async () => {
      const { cookie } = await loginAs(app, "student");
      await request(server)
        .post("/materials/upload")
        .set("Cookie", cookie)
        .attach("file", Buffer.from("fake pdf"), { filename: "test.pdf", contentType: "application/pdf" })
        .expect(403);
    });

    it("returns 403 when staff uploads a material file", async () => {
      const { cookie } = await loginAs(app, "staff");
      await request(server)
        .post("/materials/upload")
        .set("Cookie", cookie)
        .attach("file", Buffer.from("fake pdf"), { filename: "test.pdf", contentType: "application/pdf" })
        .expect(403);
    });

    it("returns 201 when an instructor uploads a material file", async () => {
      const { cookie } = await loginAs(app, "instructor");
      const res = await request(server)
        .post("/materials/upload")
        .set("Cookie", cookie)
        .attach("file", Buffer.from("%PDF-1.4 fake"), { filename: "test.pdf", contentType: "application/pdf" })
        .expect(201);
      if (res.body.fileUrl) uploadedFiles.push(res.body.fileUrl as string);
    });

    it("returns 201 when an admin uploads a material file", async () => {
      const { cookie } = await loginAs(app, "admin");
      const res = await request(server)
        .post("/materials/upload")
        .set("Cookie", cookie)
        .attach("file", Buffer.from("%PDF-1.4 fake"), { filename: "test.pdf", contentType: "application/pdf" })
        .expect(201);
      if (res.body.fileUrl) uploadedFiles.push(res.body.fileUrl as string);
    });
  });

  // ── Auth config response shape — GET /auth/config ────────────────────────

  describe("GET /auth/config — response shape", () => {
    it("returns googleOAuthEnabled, smtpEnabled, and aiEnabled (not ollamaEnabled)", async () => {
      const res = await request(server).get("/auth/config").expect(200);
      expect(typeof res.body.googleOAuthEnabled).toBe("boolean");
      expect(typeof res.body.smtpEnabled).toBe("boolean");
      expect(typeof res.body.aiEnabled).toBe("boolean");
      expect(res.body).not.toHaveProperty("ollamaEnabled");
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
