const PptxGenJS = require("C:/nvm4w/nodejs/node_modules/pptxgenjs");
const React = require("C:/nvm4w/nodejs/node_modules/react");
const ReactDOMServer = require("C:/nvm4w/nodejs/node_modules/react-dom/server");
const sharp = require("C:/nvm4w/nodejs/node_modules/sharp");

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  navy:       "12253A",
  navyMid:    "1A3A5C",
  navyLight:  "1E4F82",
  teal:       "0891B2",
  tealLight:  "38BDF8",
  sky:        "BAE6FD",
  white:      "FFFFFF",
  offWhite:   "F0F7FF",
  lightBg:    "F8FAFC",
  textDark:   "0F172A",
  textMid:    "334155",
  textLight:  "475569",
  muted:      "94A3B8",
  mutedDark:  "E0ECF8",  // for secondary text on dark slides
  green:      "059669",
  amber:      "D97706",
  red:        "DC2626",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const mkShadow    = () => ({ type: "outer", blur: 8,  offset: 3, angle: 135, color: "000000", opacity: 0.10 });
const mkCardShadow = () => ({ type: "outer", blur: 10, offset: 3, angle: 135, color: "000000", opacity: 0.07 });

function lightSlide(sl) { sl.background = { color: C.lightBg }; }
function darkSlide(sl)  { sl.background = { color: C.navy };    }

function sectionHeader(sl, label) {
  sl.addShape("rect", { x: 0, y: 0, w: 10, h: 0.52, fill: { color: C.navyMid }, line: { color: C.navyMid } });
  sl.addShape("rect", { x: 0, y: 0, w: 0.2,  h: 0.52, fill: { color: C.teal }, line: { color: C.teal } });
  sl.addText(label, { x: 0.35, y: 0, w: 9, h: 0.52, fontSize: 10.5, bold: true, color: C.sky, valign: "middle", margin: 0, charSpacing: 2 });
}

function slideTitle(sl, title, dark = false) {
  sl.addText(title, {
    x: 0.45, y: 0.62, w: 9.1, h: 0.68,
    fontSize: 27, bold: true, fontFace: "Georgia",
    color: dark ? C.white : C.textDark, valign: "middle", margin: 0,
  });
  sl.addShape("rect", { x: 0.45, y: 1.34, w: 0.5, h: 0.05, fill: { color: C.teal }, line: { color: C.teal } });
}

function card(sl, x, y, w, h, opts = {}) {
  sl.addShape("rect", {
    x, y, w, h,
    fill: { color: opts.fill || C.white },
    line: { color: opts.border || "CBD5E1", width: opts.borderW || 1.2 },
    shadow: opts.shadow !== false ? mkCardShadow() : undefined,
  });
}

// ─── BUILD ────────────────────────────────────────────────────────────────────
async function build() {
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_16x9";
  pres.title = "Library System — AI-Integrated University Platform";

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 1 — Title
  // ══════════════════════════════════════════════════════════════════════════
  {
    const sl = pres.addSlide();
    darkSlide(sl);

    sl.addShape("rect", { x: 0, y: 0, w: 0.28, h: 5.625, fill: { color: C.teal }, line: { color: C.teal } });
    sl.addShape("ellipse", { x: 7.2, y: -1.2, w: 5.0, h: 5.0, fill: { color: C.navyMid, transparency: 60 }, line: { color: C.navyMid, transparency: 60 } });
    sl.addShape("ellipse", { x: 8.1, y: 3.0, w: 2.5, h: 2.5, fill: { color: C.navyLight, transparency: 70 }, line: { color: C.navyLight, transparency: 70 } });

    sl.addText("Library System", {
      x: 0.65, y: 1.1, w: 7.5, h: 1.1,
      fontSize: 50, bold: true, fontFace: "Georgia",
      color: C.white, valign: "middle", margin: 0,
    });
    sl.addText("AI-Integrated University Library Platform", {
      x: 0.65, y: 2.35, w: 7.5, h: 0.5,
      fontSize: 19, fontFace: "Calibri", color: C.sky, valign: "middle", margin: 0,
    });
    sl.addShape("rect", { x: 0.65, y: 3.0, w: 2.0, h: 0.05, fill: { color: C.teal }, line: { color: C.teal } });
    sl.addText("Üsküdar University  ·  Full-Stack  ·  Node.js Monorepo", {
      x: 0.65, y: 3.18, w: 8.5, h: 0.38,
      fontSize: 13, fontFace: "Calibri", color: C.mutedDark, valign: "middle", margin: 0,
    });
    sl.addText("NestJS  ·  Next.js 14  ·  PostgreSQL  ·  Prisma  ·  OpenRouter AI  ·  Docker", {
      x: 0.65, y: 3.65, w: 8.5, h: 0.32,
      fontSize: 11.5, fontFace: "Calibri", color: C.mutedDark, margin: 0,
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 2 — Project Overview
  // ══════════════════════════════════════════════════════════════════════════
  {
    const sl = pres.addSlide();
    lightSlide(sl);
    sectionHeader(sl, "PROJECT OVERVIEW");
    slideTitle(sl, "What Is the Library System?");

    sl.addText("A full-stack Node.js monorepo built for Üsküdar University, covering every aspect of modern library management — from catalog browsing and physical borrowing to AI-powered study assistance.", {
      x: 0.45, y: 1.52, w: 5.2, h: 1.0,
      fontSize: 12.5, fontFace: "Calibri", color: C.textMid, valign: "top", margin: 0,
    });

    const apps = [
      { label: "apps/api", desc: "NestJS 10 · Prisma ORM · PostgreSQL · JWT Auth · Swagger · S3 · AI Services" },
      { label: "apps/web", desc: "Next.js 14 App Router · React 18 · Tailwind CSS · SWR · Framer Motion" },
    ];
    apps.forEach((a, i) => {
      const y = 2.65 + i * 0.88;
      card(sl, 0.45, y, 5.2, 0.72);
      sl.addShape("rect", { x: 0.45, y, w: 0.12, h: 0.72, fill: { color: C.teal }, line: { color: C.teal } });
      sl.addText(a.label, { x: 0.7, y: y + 0.06, w: 4.8, h: 0.3, fontSize: 12.5, bold: true, fontFace: "Calibri", color: C.navy, margin: 0 });
      sl.addText(a.desc,  { x: 0.7, y: y + 0.37, w: 4.8, h: 0.26, fontSize: 10,   fontFace: "Calibri", color: C.textLight, margin: 0 });
    });

    // Stats grid — aligned top with left content
    const stats = [
      { n: "4",    label: "User Roles" },
      { n: "20",   label: "Backend Modules" },
      { n: "30+",  label: "Frontend Routes" },
      { n: "100+", label: "API Endpoints" },
      { n: "15",   label: "AI Tools" },
      { n: "14",   label: "Test Suites" },
    ];
    stats.forEach((s, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 6.1 + col * 1.82;
      const y = 1.52 + row * 1.32;
      card(sl, x, y, 1.62, 1.15);
      sl.addText(s.n,     { x, y: y + 0.06, w: 1.62, h: 0.62, fontSize: 34, bold: true, fontFace: "Georgia", color: C.teal, align: "center", valign: "middle", margin: 0 });
      sl.addText(s.label, { x, y: y + 0.7,  w: 1.62, h: 0.36, fontSize: 10, fontFace: "Calibri", color: C.textMid, align: "center", margin: 0 });
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 3 — System Architecture
  // ══════════════════════════════════════════════════════════════════════════
  {
    const sl = pres.addSlide();
    lightSlide(sl);
    sectionHeader(sl, "ARCHITECTURE");
    slideTitle(sl, "System Architecture");

    const box = (x, y, w, h, bg, border, label, sub, textColor = C.white) => {
      sl.addShape("rect", { x, y, w, h, fill: { color: bg }, line: { color: border, width: 1.5 }, shadow: mkShadow() });
      sl.addText(label, { x, y: y + 0.1, w, h: 0.38, fontSize: 13, bold: true, fontFace: "Calibri", color: textColor, align: "center", margin: 0 });
      if (sub) sl.addText(sub, { x, y: y + 0.5, w, h: 0.3, fontSize: 9.5, fontFace: "Calibri", color: textColor === C.white ? C.sky : C.textLight, align: "center", margin: 0 });
    };

    const hArrow = (x1, y, x2) => {
      sl.addShape("rect", { x: x1, y: y - 0.025, w: x2 - x1 - 0.12, h: 0.05, fill: { color: C.teal }, line: { color: C.teal } });
      sl.addShape("rect", { x: x2 - 0.12, y: y - 0.1, w: 0.12, h: 0.2, fill: { color: C.teal }, line: { color: C.teal } });
    };
    const vArrow = (x, y1, y2) => {
      sl.addShape("rect", { x: x - 0.025, y: y1, w: 0.05, h: y2 - y1 - 0.1, fill: { color: C.teal }, line: { color: C.teal } });
      sl.addShape("rect", { x: x - 0.1, y: y2 - 0.1, w: 0.2, h: 0.1, fill: { color: C.teal }, line: { color: C.teal } });
    };

    // Browser
    box(0.35, 1.9, 1.5, 0.95, C.navyMid, C.teal, "Browser", "User / Client");
    hArrow(1.85, 2.38, 2.65);

    // Next.js
    box(2.65, 1.9, 1.9, 0.95, C.navyLight, C.tealLight, "Next.js 14", "Port 3000");
    sl.addText("proxy /api/* → 3001", { x: 2.65, y: 2.88, w: 1.9, h: 0.2, fontSize: 8.5, fontFace: "Calibri", color: C.textMid, align: "center", margin: 0 });
    hArrow(4.55, 2.38, 5.3);

    // NestJS API
    box(5.3, 1.65, 2.05, 1.4, C.teal, C.tealLight, "NestJS API", "Port 3001");
    sl.addText("20 Modules · Prisma · JWT", { x: 5.3, y: 2.65, w: 2.05, h: 0.28, fontSize: 9, fontFace: "Calibri", color: C.white, align: "center", margin: 0 });

    // PostgreSQL
    vArrow(6.33, 3.05, 3.7);
    box(5.3, 3.7, 2.05, 0.85, C.navyMid, C.teal, "PostgreSQL", "Port 5432 · Prisma ORM");

    // OpenRouter — right side, aligned
    sl.addShape("rect", { x: 7.65, y: 1.65, w: 1.95, h: 0.85, fill: { color: "7C3AED" }, line: { color: "A78BFA", width: 1.5 }, shadow: mkShadow() });
    sl.addText("OpenRouter AI", { x: 7.65, y: 1.68, w: 1.95, h: 0.35, fontSize: 12, bold: true, color: C.white, align: "center", margin: 0 });
    sl.addText("Gemma · Gemini · Claude", { x: 7.65, y: 2.05, w: 1.95, h: 0.28, fontSize: 9, color: "DDD6FE", align: "center", margin: 0 });
    hArrow(7.35, 2.08, 7.67);

    // S3 — aligned with OpenRouter
    sl.addShape("rect", { x: 7.65, y: 2.72, w: 1.95, h: 0.78, fill: { color: "B45309" }, line: { color: "FCD34D", width: 1.5 }, shadow: mkShadow() });
    sl.addText("S3 / Local Storage", { x: 7.65, y: 2.76, w: 1.95, h: 0.32, fontSize: 11, bold: true, color: C.white, align: "center", margin: 0 });
    sl.addText("Files · PDFs · Covers", { x: 7.65, y: 3.1, w: 1.95, h: 0.28, fontSize: 9, color: "FEF3C7", align: "center", margin: 0 });
    sl.addShape("line", { x: 7.35, y: 3.11, w: 0.3, h: 0, line: { color: C.teal, width: 1.5, dashType: "sysDot" } });

    // Legend — with proper bottom margin
    const legY = 5.05;
    sl.addShape("rect", { x: 0.35, y: legY, w: 0.22, h: 0.12, fill: { color: C.navyLight }, line: { color: C.navyLight } });
    sl.addText("Frontend",    { x: 0.65, y: legY - 0.02, w: 1.2, h: 0.2, fontSize: 9, color: C.textMid, margin: 0 });
    sl.addShape("rect", { x: 2.1,  y: legY, w: 0.22, h: 0.12, fill: { color: C.teal }, line: { color: C.teal } });
    sl.addText("Backend",     { x: 2.4,  y: legY - 0.02, w: 1.2, h: 0.2, fontSize: 9, color: C.textMid, margin: 0 });
    sl.addShape("rect", { x: 3.8,  y: legY, w: 0.22, h: 0.12, fill: { color: "7C3AED" }, line: { color: "7C3AED" } });
    sl.addText("AI Provider", { x: 4.1,  y: legY - 0.02, w: 1.2, h: 0.2, fontSize: 9, color: C.textMid, margin: 0 });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 4 — Role System & Auth
  // ══════════════════════════════════════════════════════════════════════════
  {
    const sl = pres.addSlide();
    lightSlide(sl);
    sectionHeader(sl, "ROLES & AUTHENTICATION");
    slideTitle(sl, "Role System & Auth");

    const roles = [
      { label: "STUDENT",    color: "0369A1", desc: "Catalog · Borrow · Reserve\nFines · AI Assistant\nReading Lists · Notifications" },
      { label: "INSTRUCTOR", color: "065F46", desc: "All Student features\nUpload Materials for Approval\nCreate Reading Lists · Followers" },
      { label: "STAFF",      color: "6B4C1A", desc: "Catalog · Borrows\nReservations · AI Assistant\nProfile & Notifications" },
      { label: "ADMIN",      color: "7C2D12", desc: "Full system access\nUsers · Policies · Reports\nBranches · AI Cover Scan" },
    ];

    roles.forEach((r, i) => {
      const x = 0.35 + i * 2.35;
      const cardH = 2.1;
      card(sl, x, 1.52, 2.15, cardH, { border: r.color });
      sl.addShape("rect", { x, y: 1.52, w: 2.15, h: 0.48, fill: { color: r.color }, line: { color: r.color } });
      sl.addText(r.label, { x, y: 1.52, w: 2.15, h: 0.48, fontSize: 13, bold: true, fontFace: "Calibri", color: C.white, align: "center", valign: "middle", margin: 0 });
      sl.addText(r.desc,  { x: x + 0.15, y: 2.1, w: 1.85, h: 1.4, fontSize: 11.5, fontFace: "Calibri", color: C.textMid, valign: "top", margin: 0 });
    });

    // Auth bar
    card(sl, 0.35, 3.85, 9.3, 0.72, { fill: C.navyMid, shadow: false, border: C.navyMid });
    sl.addText("Authentication:", { x: 0.55, y: 3.9, w: 1.7, h: 0.3, fontSize: 11, bold: true, color: C.sky, margin: 0 });
    sl.addText("Email/Password + Email Verification  ·  Google OAuth (optional)  ·  HttpOnly JWT Cookie  ·  Role-gated middleware (frontend + backend guards)", {
      x: 2.2, y: 3.9, w: 7.2, h: 0.52, fontSize: 11, fontFace: "Calibri", color: C.white, valign: "middle", margin: 0,
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 5 — UX: User Journeys
  // ══════════════════════════════════════════════════════════════════════════
  {
    const sl = pres.addSlide();
    lightSlide(sl);
    sectionHeader(sl, "USER EXPERIENCE");
    slideTitle(sl, "User Journeys by Role");

    // Step dimensions — 6 steps must stay within 9.5" right boundary:
    // roleBox(1.15) + gap(0.15) + 6*(sw=0.95 + gap=0.26) = 1.3 + 6*1.21 = 8.56 ✓ right margin ~0.45"
    const SW = 0.95;   // step width
    const SG = 0.26;   // gap between steps (incl. arrow)
    const STEP_TOTAL = SW + SG;

    const journeys = [
      { role: "Student",    color: "0369A1", bg: "EFF6FF", steps: ["Sign Up", "Verify Email", "Browse Catalog", "Reserve Copy", "Collect Borrow", "Return / Fine"] },
      { role: "Instructor", color: "065F46", bg: "ECFDF5", steps: ["Log In", "Upload Material", "Await Approval", "Create Reading List", "Manage Followers"] },
      { role: "Admin",      color: "7C2D12", bg: "FFF7ED", steps: ["Log In", "Manage Users", "Approve Materials", "Handle Borrows", "Export Reports"] },
    ];

    journeys.forEach((j, ji) => {
      const rowY = 1.5 + ji * 1.22;
      const boxH = 0.42;
      sl.addShape("rect", { x: 0.35, y: rowY, w: 1.15, h: boxH, fill: { color: j.color }, line: { color: j.color } });
      sl.addText(j.role, { x: 0.35, y: rowY, w: 1.15, h: boxH, fontSize: 11, bold: true, color: C.white, align: "center", valign: "middle", margin: 0 });

      j.steps.forEach((step, si) => {
        const stepX = 1.6 + si * STEP_TOTAL;
        const isLast = si === j.steps.length - 1;
        if (!isLast) {
          sl.addShape("rect", { x: stepX + SW + 0.04, y: rowY + boxH / 2 - 0.025, w: SG - 0.1, h: 0.05, fill: { color: C.muted }, line: { color: C.muted } });
          sl.addShape("rect", { x: stepX + SW + SG - 0.1, y: rowY + boxH / 2 - 0.1, w: 0.1, h: 0.2, fill: { color: C.muted }, line: { color: C.muted } });
        }
        sl.addShape("rect", { x: stepX, y: rowY + 0.02, w: SW, h: boxH - 0.04, fill: { color: j.bg }, line: { color: j.color, width: 1 } });
        sl.addText(step, { x: stepX, y: rowY + 0.02, w: SW, h: boxH - 0.04, fontSize: 9, fontFace: "Calibri", color: j.color, align: "center", valign: "middle", margin: 0 });
      });

      if (ji === 0) {
        sl.addText("+ AI Assistant is available throughout all student journeys", {
          x: 1.6, y: rowY + 0.5, w: 8.0, h: 0.2,
          fontSize: 8.5, fontFace: "Calibri", color: C.textLight, italic: true, margin: 0,
        });
      }
    });

    // Staff note — with proper bottom margin
    card(sl, 0.35, 5.08, 9.3, 0.22, { fill: "F1F5F9", shadow: false, border: "CBD5E1" });
    sl.addText("Staff: shared access to catalog, borrows, reservations, AI assistant, notifications, and settings via role-gated middleware.", {
      x: 0.55, y: 5.08, w: 9.0, h: 0.22, fontSize: 9.5, fontFace: "Calibri", color: C.textMid, valign: "middle", margin: 0,
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 6 — UI Overview (pages)
  // ══════════════════════════════════════════════════════════════════════════
  {
    const sl = pres.addSlide();
    lightSlide(sl);
    sectionHeader(sl, "UI & UX");
    slideTitle(sl, "Frontend Interface — Key Surfaces");

    const sections = [
      { title: "Public / Auth", color: "475569",
        pages: ["/login", "/signup", "/verify-email", "/forgot-password", "/reset-password"] },
      { title: "Student", color: "0369A1",
        pages: ["/dashboard/catalog", "/dashboard/borrowed", "/dashboard/reservations", "/dashboard/fines", "/dashboard/history", "/dashboard/ai-assistant"] },
      { title: "Instructor", color: "065F46",
        pages: ["/instructor", "/instructor/submit-material", "/instructor/reading-lists", "/instructor/my-submissions", "/instructor/following"] },
      { title: "Admin", color: "7C2D12",
        pages: ["/admin/books", "/admin/users", "/admin/borrows", "/admin/reservations", "/admin/reports", "/admin/statistics"] },
    ];

    sections.forEach((sec, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 0.35 + col * 4.88;
      const y = 1.52 + row * 1.97;
      card(sl, x, y, 4.68, 1.82);
      sl.addShape("rect", { x, y, w: 4.68, h: 0.42, fill: { color: sec.color }, line: { color: sec.color } });
      sl.addText(sec.title, { x: x + 0.15, y, w: 4.4, h: 0.42, fontSize: 12, bold: true, color: C.white, valign: "middle", margin: 0 });
      sec.pages.forEach((p, pi) => {
        const px = x + 0.2 + (pi % 2) * 2.26;
        const py = y + 0.52 + Math.floor(pi / 2) * 0.38;
        sl.addText("› " + p, { x: px, y: py, w: 2.18, h: 0.3, fontSize: 9, fontFace: "Calibri", color: C.textMid, margin: 0 });
      });
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 7 — Core Library Features
  // ══════════════════════════════════════════════════════════════════════════
  {
    const sl = pres.addSlide();
    lightSlide(sl);
    sectionHeader(sl, "CORE FEATURES");
    slideTitle(sl, "Core Library Operations");

    // Reservation lifecycle
    card(sl, 0.35, 1.52, 4.6, 1.68);
    sl.addText("Reservation Lifecycle", { x: 0.55, y: 1.57, w: 4.2, h: 0.34, fontSize: 12.5, bold: true, color: C.navy, margin: 0 });
    const rStates = ["PENDING", "APPROVED", "READY", "COLLECTED", "CANCELLED"];
    const rColors = ["D97706", "059669", "0891B2", C.navy, "DC2626"];
    rStates.forEach((s, i) => {
      sl.addShape("rect", { x: 0.55 + i * 0.84, y: 1.99, w: 0.76, h: 0.3, fill: { color: rColors[i] }, line: { color: rColors[i] } });
      sl.addText(s, { x: 0.55 + i * 0.84, y: 1.99, w: 0.76, h: 0.3, fontSize: 7.5, color: C.white, align: "center", valign: "middle", margin: 0 });
    });
    sl.addText("Unique partial index prevents duplicate active reservations per user/book", {
      x: 0.55, y: 2.38, w: 4.2, h: 0.26, fontSize: 9.5, fontFace: "Calibri", color: C.textLight, margin: 0,
    });
    sl.addText([{ text: "Scheduler", options: { bold: true } }, { text: " auto-expires reservations and marks overdue borrows", options: {} }],
      { x: 0.55, y: 2.68, w: 4.2, h: 0.26, fontSize: 9.5, fontFace: "Calibri", color: C.textMid, margin: 0 });

    // Borrow lifecycle
    card(sl, 5.1, 1.52, 4.55, 1.68);
    sl.addText("Borrow Lifecycle", { x: 5.3, y: 1.57, w: 4.2, h: 0.34, fontSize: 12.5, bold: true, color: C.navy, margin: 0 });
    const bStates = ["ACTIVE", "OVERDUE", "RETURNED"];
    const bColors = ["059669", "DC2626", C.navyMid];
    bStates.forEach((s, i) => {
      sl.addShape("rect", { x: 5.3 + i * 1.38, y: 1.99, w: 1.18, h: 0.3, fill: { color: bColors[i] }, line: { color: bColors[i] } });
      sl.addText(s, { x: 5.3 + i * 1.38, y: 1.99, w: 1.18, h: 0.3, fontSize: 10, color: C.white, align: "center", valign: "middle", margin: 0 });
    });
    sl.addText("Borrow policies configurable per role (max active, days, extensions)", {
      x: 5.3, y: 2.38, w: 4.2, h: 0.26, fontSize: 9.5, fontFace: "Calibri", color: C.textLight, margin: 0,
    });
    sl.addText("Overdue return → pending fine record created automatically", {
      x: 5.3, y: 2.68, w: 4.2, h: 0.26, fontSize: 9.5, fontFace: "Calibri", color: C.textMid, margin: 0,
    });

    // Fines & Notifications
    card(sl, 0.35, 3.38, 4.6, 1.88);
    sl.addText("Fines & Notifications", { x: 0.55, y: 3.43, w: 4.2, h: 0.34, fontSize: 12.5, bold: true, color: C.navy, margin: 0 });
    ["Fine states: PENDING · PAID · WAIVED", "Unread notification badge counts", "Types: reservation, borrow, list, system", "Read / delete / clear-read operations"].forEach((t, i) => {
      sl.addText("• " + t, { x: 0.65, y: 3.86 + i * 0.3, w: 4.1, h: 0.26, fontSize: 10.5, fontFace: "Calibri", color: C.textMid, margin: 0 });
    });

    // Catalog & Books
    card(sl, 5.1, 3.38, 4.55, 1.88);
    sl.addText("Catalog & Books", { x: 5.3, y: 3.43, w: 4.2, h: 0.34, fontSize: 12.5, bold: true, color: C.navy, margin: 0 });
    ["Metadata, ISBN, authors, cover images, tags", "E-book & PDF URLs, max 50 copies/branch", "Faculty, category, subject classification", "External import: OpenLibrary, Gutendex"].forEach((t, i) => {
      sl.addText("• " + t, { x: 5.3, y: 3.86 + i * 0.3, w: 4.3, h: 0.26, fontSize: 10.5, fontFace: "Calibri", color: C.textMid, margin: 0 });
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 8 — AI Assistant Overview
  // ══════════════════════════════════════════════════════════════════════════
  {
    const sl = pres.addSlide();
    sl.background = { color: C.navy };
    sectionHeader(sl, "AI ASSISTANT");

    sl.addText("AI Library Assistant", {
      x: 0.45, y: 0.62, w: 9.1, h: 0.82,
      fontSize: 33, bold: true, fontFace: "Georgia", color: C.white, margin: 0,
    });
    sl.addShape("rect", { x: 0.45, y: 1.48, w: 0.5, h: 0.05, fill: { color: C.teal }, line: { color: C.teal } });
    sl.addText("Powered by OpenRouter  ·  Streaming SSE  ·  Tool Calling  ·  Study Sessions  ·  5 Response Modes", {
      x: 0.45, y: 1.62, w: 9.1, h: 0.32, fontSize: 12.5, fontFace: "Calibri", color: C.sky, margin: 0,
    });

    // Model tiers
    sl.addText("Model Tiers (Auto-Selected)", { x: 0.45, y: 2.05, w: 5.5, h: 0.32, fontSize: 12.5, bold: true, color: C.sky, margin: 0 });
    const tiers = [
      { tier: "FREE",  model: "google/gemma-4-31b-it:free",           when: "Simple greetings, short Q&A",       color: "047857" },
      { tier: "CHEAP", model: "google/gemini-3.1-flash-lite-preview", when: "Tool calling, catalog queries",      color: "0369A1" },
      { tier: "SMART", model: "anthropic/claude-3-haiku",              when: "Deep reasoning & analysis",          color: "7C3AED" },
      { tier: "STUDY", model: "anthropic/claude-3-haiku (same as SMART)", when: "Study session guide generation", color: "BE185D" },
    ];
    tiers.forEach((t, i) => {
      const y = 2.46 + i * 0.61;
      sl.addShape("rect", { x: 0.45, y, w: 0.88, h: 0.48, fill: { color: t.color }, line: { color: t.color } });
      sl.addText(t.tier, { x: 0.45, y, w: 0.88, h: 0.48, fontSize: 11, bold: true, color: C.white, align: "center", valign: "middle", margin: 0 });
      sl.addShape("rect", { x: 1.36, y, w: 5.85, h: 0.48, fill: { color: C.navyMid }, line: { color: C.navyMid } });
      sl.addText(t.model, { x: 1.48, y, w: 3.2, h: 0.48, fontSize: 9.5, fontFace: "Calibri", color: C.tealLight, valign: "middle", margin: 0 });
      sl.addText(t.when,  { x: 4.8,  y, w: 2.55, h: 0.48, fontSize: 9.5, fontFace: "Calibri", color: C.mutedDark, valign: "middle", margin: 0 });
    });

    // Key capabilities — aligned at same y as "Model Tiers" label
    sl.addText("Key Capabilities", { x: 7.4, y: 2.05, w: 2.35, h: 0.32, fontSize: 12.5, bold: true, color: C.sky, margin: 0 });
    const caps = ["SSE Streaming chat", "Auto + manual model select", "5 response modes", "15 callable tools", "Book PDF reading", "Study sessions (per book)", "Conversation history", "Admin cover scan (vision)", "Rate limit: 15 req / 60s"];
    caps.forEach((c, i) => {
      sl.addText("› " + c, { x: 7.4, y: 2.46 + i * 0.32, w: 2.35, h: 0.28, fontSize: 10, fontFace: "Calibri", color: C.white, margin: 0 });
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 9 — AI Tools  (FIXED: compact cards so all 15 fit above footer)
  // ══════════════════════════════════════════════════════════════════════════
  {
    const sl = pres.addSlide();
    lightSlide(sl);
    sectionHeader(sl, "AI ASSISTANT");
    slideTitle(sl, "AI Tools & Response Modes");

    const tools = [
      { name: "search_catalog",          desc: "Keyword search across the library catalog" },
      { name: "get_book_details",         desc: "Full details and availability for a book" },
      { name: "read_ebook",               desc: "Read an e-book or PDF for summaries/quotes" },
      { name: "fetch_webpage",            desc: "Fetch any public URL" },
      { name: "get_my_borrows",           desc: "Active borrows and due dates for the user" },
      { name: "get_catalog_stats",        desc: "Total book, copy, and e-book counts" },
      { name: "get_active_borrows",       desc: "All active borrows + top 5 most borrowed" },
      { name: "get_active_reservations",  desc: "All active reservations (pending/ready)" },
      { name: "get_user_stats",           desc: "Registered user counts by role" },
      { name: "get_reading_lists",        desc: "Published instructor reading lists" },
      { name: "get_my_reading_lists",     desc: "Instructor's own lists including drafts" },
      { name: "search_study_material",    desc: "Full-text search across material chunks" },
      { name: "list_study_materials",     desc: "List all indexed study materials" },
      { name: "get_chunk_context",        desc: "Neighbouring chunks around a material chunk" },
      { name: "get_material_outline",     desc: "Opening chunks of a study material" },
    ];

    // 3 cols × 5 rows. card h=0.56, row spacing=0.62
    // row 4 ends at 1.52 + 4*0.62 + 0.56 = 4.56 → footer at 4.68 → slide bottom 5.625 ✓
    const CW = 2.95, CG = 0.2, CH = 0.56, RS = 0.62;
    tools.forEach((t, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 0.35 + col * (CW + CG);
      const y = 1.52 + row * RS;
      card(sl, x, y, CW, CH, { border: "CBD5E1" });
      sl.addShape("rect", { x, y, w: 0.1, h: CH, fill: { color: C.teal }, line: { color: C.teal } });
      sl.addText(t.name, { x: x + 0.18, y: y + 0.04, w: CW - 0.25, h: 0.22, fontSize: 9, bold: true, fontFace: "Calibri", color: C.navy, margin: 0 });
      sl.addText(t.desc, { x: x + 0.18, y: y + 0.3,  w: CW - 0.25, h: 0.22, fontSize: 8.5, fontFace: "Calibri", color: C.textLight, margin: 0 });
    });

    // Response modes bar — with clear bottom margin
    const footY = 4.48;
    sl.addShape("rect", { x: 0.35, y: footY, w: 9.3, h: 0.42, fill: { color: C.navyMid }, line: { color: C.navyMid } });
    sl.addText("Response Modes:", { x: 0.55, y: footY + 0.04, w: 1.55, h: 0.33, fontSize: 10, bold: true, color: C.sky, valign: "middle", margin: 0 });
    const modes = ["learning", "explanatory", "planning", "formal", "concise"];
    const mColors = ["047857", "0369A1", "7C3AED", "BE185D", "B45309"];
    modes.forEach((m, i) => {
      sl.addShape("rect", { x: 2.22 + i * 1.43, y: footY + 0.06, w: 1.28, h: 0.3, fill: { color: mColors[i] }, line: { color: mColors[i] } });
      sl.addText(m, { x: 2.22 + i * 1.43, y: footY + 0.06, w: 1.28, h: 0.3, fontSize: 10, color: C.white, align: "center", valign: "middle", margin: 0 });
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 10 — Instructor & Materials
  // ══════════════════════════════════════════════════════════════════════════
  {
    const sl = pres.addSlide();
    lightSlide(sl);
    sectionHeader(sl, "INSTRUCTOR FEATURES");
    slideTitle(sl, "Instructor & Research Materials");

    // Left — reading lists
    card(sl, 0.35, 1.52, 4.6, 3.78);
    sl.addShape("rect", { x: 0.35, y: 1.52, w: 4.6, h: 0.46, fill: { color: "065F46" }, line: { color: "065F46" } });
    sl.addText("Reading Lists", { x: 0.5, y: 1.52, w: 4.35, h: 0.46, fontSize: 13.5, bold: true, color: C.white, valign: "middle", margin: 0 });
    ["Create, edit, delete reading lists", "Set visibility (public/private) and status", "Add books with per-item ordering", "Public feed for all authenticated users", "Admin moderation dashboard", "View any instructor's published lists"].forEach((item, i) => {
      sl.addText("• " + item, { x: 0.55, y: 2.08 + i * 0.44, w: 4.2, h: 0.36, fontSize: 11, fontFace: "Calibri", color: C.textMid, margin: 0 });
    });
    sl.addText("Follow System", { x: 0.55, y: 4.62, w: 4.2, h: 0.28, fontSize: 11, bold: true, color: "065F46", margin: 0 });
    sl.addText("Follow/unfollow instructors · follower counts · following feed", {
      x: 0.55, y: 4.92, w: 4.2, h: 0.26, fontSize: 10, fontFace: "Calibri", color: C.textMid, margin: 0,
    });

    // Right — materials
    card(sl, 5.1, 1.52, 4.55, 3.78);
    sl.addShape("rect", { x: 5.1, y: 1.52, w: 4.55, h: 0.46, fill: { color: "0369A1" }, line: { color: "0369A1" } });
    sl.addText("Research Materials", { x: 5.25, y: 1.52, w: 4.3, h: 0.46, fontSize: 13.5, bold: true, color: C.white, valign: "middle", margin: 0 });
    const matTypes = ["Research Papers", "Course Materials", "Theses", "Professor Publications"];
    matTypes.forEach((t, i) => {
      sl.addShape("rect", { x: 5.25 + (i % 2) * 2.12, y: 2.08 + Math.floor(i / 2) * 0.42, w: 1.98, h: 0.34, fill: { color: "EFF6FF" }, line: { color: "93C5FD" } });
      sl.addText(t, { x: 5.25 + (i % 2) * 2.12, y: 2.08 + Math.floor(i / 2) * 0.42, w: 1.98, h: 0.34, fontSize: 10, fontFace: "Calibri", color: "0369A1", align: "center", valign: "middle", margin: 0 });
    });

    sl.addText("Indexing Pipeline:", { x: 5.25, y: 3.05, w: 4.1, h: 0.3, fontSize: 11, bold: true, color: C.navy, margin: 0 });
    const pipeline = ["Upload", "Extract Text", "Chunk ~400w", "Index", "FT Search"];
    pipeline.forEach((p, i) => {
      const px = 5.25 + i * 0.86;
      sl.addShape("rect", { x: px, y: 3.42, w: 0.78, h: 0.34, fill: { color: C.navyMid }, line: { color: C.navyMid } });
      sl.addText(p, { x: px, y: 3.42, w: 0.78, h: 0.34, fontSize: 7.5, color: C.white, align: "center", valign: "middle", margin: 0 });
      if (i < pipeline.length - 1) {
        sl.addShape("rect", { x: px + 0.78, y: 3.54, w: 0.08, h: 0.1, fill: { color: C.teal }, line: { color: C.teal } });
      }
    });

    ["Approval & publishing workflow", "Access control: role, faculty, course, public", "Admin reindex & moderation dashboard", "AI tool: search_study_material"].forEach((item, i) => {
      sl.addText("• " + item, { x: 5.25, y: 3.9 + i * 0.35, w: 4.2, h: 0.3, fontSize: 10.5, fontFace: "Calibri", color: C.textMid, margin: 0 });
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 11 — Admin Dashboard
  // ══════════════════════════════════════════════════════════════════════════
  {
    const sl = pres.addSlide();
    lightSlide(sl);
    sectionHeader(sl, "ADMIN FEATURES");
    slideTitle(sl, "Admin Dashboard & Capabilities");

    const adminAreas = [
      { label: "Users",                 color: "0369A1", items: ["Activate / deactivate accounts", "View all roles and user stats", "User distribution dashboard"] },
      { label: "Books & Catalog",       color: "065F46", items: ["CRUD with copy management", "PDF indexing and reindex tools", "AI cover image scan endpoint"] },
      { label: "Borrows & Reservations",color: "B45309", items: ["Full lifecycle management", "Most-borrowed and trend reports", "Scheduler monitoring"] },
      { label: "Fines & Policies",      color: "7C2D12", items: ["Pay or waive fine records", "Per-role borrow policy limits", "Extension count and day rules"] },
      { label: "Materials",             color: "4C1D95", items: ["Approve/reject submissions", "Moderation dashboard", "Reindex pending file queue"] },
      { label: "Reports & Stats",       color: "064E3B", items: ["PDF and Excel report export", "Admin statistics dashboard", "AI usage metrics endpoint"] },
    ];

    adminAreas.forEach((a, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 0.35 + col * 3.22;
      const y = 1.52 + row * 1.88;
      card(sl, x, y, 3.02, 1.72);
      sl.addShape("rect", { x, y, w: 3.02, h: 0.42, fill: { color: a.color }, line: { color: a.color } });
      sl.addText(a.label, { x: x + 0.12, y, w: 2.85, h: 0.42, fontSize: 11.5, bold: true, color: C.white, valign: "middle", margin: 0 });
      a.items.forEach((item, ii) => {
        sl.addText("• " + item, { x: x + 0.18, y: y + 0.52 + ii * 0.36, w: 2.72, h: 0.3, fontSize: 10.5, fontFace: "Calibri", color: C.textMid, margin: 0 });
      });
    });

    // Footer with bottom margin
    sl.addShape("rect", { x: 0, y: 4.96, w: 10, h: 0.36, fill: { color: C.navyMid }, line: { color: C.navyMid } });
    sl.addText("Also: branch management  ·  reading list moderation  ·  external book imports (OpenLibrary, Gutendex)  ·  pgAdmin at port 5050", {
      x: 0.4, y: 4.97, w: 9.2, h: 0.32, fontSize: 10.5, fontFace: "Calibri", color: C.sky, valign: "middle", margin: 0,
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 12 — Functional Requirements  (4 items per panel, 0.28 spacing)
  // ══════════════════════════════════════════════════════════════════════════
  {
    const sl = pres.addSlide();
    lightSlide(sl);
    sectionHeader(sl, "REQUIREMENTS");
    slideTitle(sl, "Functional Requirements");

    const reqs = [
      { cat: "Auth & Access", color: "0369A1", items: [
        "Users authenticate before accessing /dashboard/*",
        "Dashboard routes are role-gated in frontend middleware",
        "New local users must verify email before login",
        "Admins can activate and deactivate users",
      ]},
      { cat: "Catalog & Copies", color: "065F46", items: [
        "Books may have multiple physical copies across branches",
        "Reservations scoped to user / book-copy / branch",
        "Partial unique index prevents duplicate active reservations",
        "Maximum 50 copies per branch enforced at API level",
      ]},
      { cat: "Borrow & Fines", color: "B45309", items: [
        "Borrow policies limit active borrows, days, and extensions per role",
        "Returning an overdue borrow creates a pending fine record",
        "Scheduler reconciles overdue borrows and expired reservations",
        "Password reset uses opaque tokens with generic outward messages",
      ]},
      { cat: "AI & Materials", color: "7C3AED", items: [
        "AI assistant must use tools for all live library data queries",
        "Assistant must not guess or invent catalog or statistical values",
        "Materials have publication, approval state, and access-level controls",
        "API validation strips and rejects non-whitelisted fields",
      ]},
    ];

    reqs.forEach((r, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 0.35 + col * 4.88;
      const y = 1.52 + row * 1.97;
      card(sl, x, y, 4.68, 1.82);
      sl.addShape("rect", { x, y, w: 4.68, h: 0.42, fill: { color: r.color }, line: { color: r.color } });
      sl.addText(r.cat, { x: x + 0.15, y, w: 4.4, h: 0.42, fontSize: 12, bold: true, color: C.white, valign: "middle", margin: 0 });
      r.items.forEach((item, ii) => {
        sl.addText("• " + item, { x: x + 0.2, y: y + 0.5 + ii * 0.28, w: 4.35, h: 0.25, fontSize: 9.5, fontFace: "Calibri", color: C.textMid, margin: 0 });
      });
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 13 — Non-Functional Requirements  (4 items per panel, no overflow)
  // ══════════════════════════════════════════════════════════════════════════
  {
    const sl = pres.addSlide();
    lightSlide(sl);
    sectionHeader(sl, "REQUIREMENTS");
    slideTitle(sl, "Non-Functional Requirements");

    const nfr = [
      { cat: "Security", color: "DC2626", items: [
        "bcrypt password hashing",
        "HttpOnly JWT cookies — secure + sameSite in production",
        "Helmet, CORS allowlist, global exception filter",
        "Rate limiting per endpoint · JWT secret ≥32 chars at startup",
      ]},
      { cat: "Reliability", color: "0369A1", items: [
        "Scheduler reconciles overdue borrows and reservations",
        "S3 config validated at startup — exits if invalid",
        "Global validation pipe: whitelist + forbidNonWhitelisted",
        "Health probes: /health/live and /health/ready",
      ]},
      { cat: "Observability", color: "065F46", items: [
        "Request-ID and request-logging on all routes",
        "Configurable log level and SQL logging",
        "AI metrics at /dashboard/admin/ai-metrics",
        "Swagger docs at /api/docs · pgAdmin at port 5050",
      ]},
      { cat: "Developer Ops", color: "7C3AED", items: [
        "TypeScript across frontend and backend",
        "Docker dev targets for both apps",
        "14 test suites (unit + e2e)",
        "ESLint · Prettier · stylelint · Next.js standalone build",
      ]},
    ];

    nfr.forEach((r, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 0.35 + col * 4.88;
      const y = 1.52 + row * 1.97;
      card(sl, x, y, 4.68, 1.82);
      sl.addShape("rect", { x, y, w: 4.68, h: 0.42, fill: { color: r.color }, line: { color: r.color } });
      sl.addText(r.cat, { x: x + 0.15, y, w: 4.4, h: 0.42, fontSize: 12, bold: true, color: C.white, valign: "middle", margin: 0 });
      r.items.forEach((item, ii) => {
        sl.addText("• " + item, { x: x + 0.2, y: y + 0.5 + ii * 0.28, w: 4.35, h: 0.25, fontSize: 9.5, fontFace: "Calibri", color: C.textMid, margin: 0 });
      });
    });

    // Note strip — with margin and readable contrast
    sl.addShape("rect", { x: 0.35, y: 4.84, w: 9.3, h: 0.3, fill: { color: "7F1D1D" }, line: { color: "7F1D1D" } });
    sl.addText("Not documented: formal uptime/latency targets · RPO/RTO · CI/CD pipeline · accessibility or browser support targets.", {
      x: 0.55, y: 4.85, w: 9.0, h: 0.28, fontSize: 9, fontFace: "Calibri", color: "FECACA", valign: "middle", margin: 0,
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 14 — Tech Stack
  // ══════════════════════════════════════════════════════════════════════════
  {
    const sl = pres.addSlide();
    lightSlide(sl);
    sectionHeader(sl, "TECHNICAL STACK");
    slideTitle(sl, "Technology Stack & Infrastructure");

    const stacks = [
      { label: "Frontend",       color: "0369A1", items: ["Next.js 14 App Router", "React 18 + TypeScript", "Tailwind CSS + Framer Motion", "SWR — data fetching", "Radix UI primitives", "Axios + SSE streaming"] },
      { label: "Backend",        color: "065F46", items: ["NestJS 10 + TypeScript", "Prisma ORM 5 + PostgreSQL 15", "JWT (HS256) + Passport.js", "Swagger / OpenAPI docs", "@nestjs/throttler rate limits", "bcryptjs · Helmet · CORS"] },
      { label: "AI & Storage",   color: "7C3AED", items: ["OpenRouter (active provider)", "Gemma · Gemini · Claude models", "SSE streaming responses", "PostgreSQL full-text search", "S3 or local file storage", "PDF + DOCX text extraction"] },
      { label: "Infrastructure", color: "B45309", items: ["Docker + Docker Compose", "PostgreSQL 15 + pgAdmin 4", "Node.js 20", "npm workspaces (monorepo)", "pdfkit + exceljs (reports)", "concurrently + wait-on"] },
    ];

    stacks.forEach((s, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 0.35 + col * 4.88;
      const y = 1.52 + row * 1.97;
      card(sl, x, y, 4.68, 1.82);
      sl.addShape("rect", { x, y, w: 4.68, h: 0.42, fill: { color: s.color }, line: { color: s.color } });
      sl.addText(s.label, { x: x + 0.15, y, w: 4.4, h: 0.42, fontSize: 12, bold: true, color: C.white, valign: "middle", margin: 0 });
      s.items.forEach((item, ii) => {
        const px = x + 0.2 + (ii % 2) * 2.26;
        const py = y + 0.52 + Math.floor(ii / 2) * 0.4;
        sl.addText("· " + item, { x: px, y: py, w: 2.18, h: 0.34, fontSize: 10, fontFace: "Calibri", color: C.textDark, margin: 0 });
      });
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 15 — Testing & Quality  (balanced 3+3 commands grid)
  // ══════════════════════════════════════════════════════════════════════════
  {
    const sl = pres.addSlide();
    lightSlide(sl);
    sectionHeader(sl, "TESTING & QUALITY");
    slideTitle(sl, "Testing, Linting & Type Safety");

    // E2E suites
    card(sl, 0.35, 1.52, 4.6, 2.05);
    sl.addShape("rect", { x: 0.35, y: 1.52, w: 4.6, h: 0.42, fill: { color: C.navy }, line: { color: C.navy } });
    sl.addText("E2E Test Suites", { x: 0.5, y: 1.52, w: 4.35, h: 0.42, fontSize: 12.5, bold: true, color: C.white, valign: "middle", margin: 0 });
    [
      { name: "security.e2e-spec.ts",      detail: "18 tests — auth guards, rate limits, query validation" },
      { name: "reservations.e2e-spec.ts",  detail: "20 tests — full reservation lifecycle" },
      { name: "borrows.e2e-spec.ts",        detail: "8 tests — extend, return, overdue fine" },
    ].forEach((t, i) => {
      sl.addText(t.name,   { x: 0.55, y: 2.04 + i * 0.48, w: 4.2, h: 0.23, fontSize: 10, bold: true, color: C.teal, margin: 0 });
      sl.addText(t.detail, { x: 0.55, y: 2.27 + i * 0.48, w: 4.2, h: 0.2,  fontSize: 9,  fontFace: "Calibri", color: C.textLight, margin: 0 });
    });

    // Unit suites
    card(sl, 5.1, 1.52, 4.55, 2.05);
    sl.addShape("rect", { x: 5.1, y: 1.52, w: 4.55, h: 0.42, fill: { color: C.navyMid }, line: { color: C.navyMid } });
    sl.addText("Unit Test Suites (11 files)", { x: 5.25, y: 1.52, w: 4.3, h: 0.42, fontSize: 12.5, bold: true, color: C.white, valign: "middle", margin: 0 });
    [
      "users.service.spec · users.controller.spec",
      "books.service.spec · book-document.service.spec",
      "reservations.service.spec",
      "borrow-scheduler.service.spec",
      "ai.service.spec · catalog-search.service.spec",
      "ai-modes.spec · material-access.util.spec · global-exception.filter.spec",
    ].forEach((t, i) => {
      sl.addText("• " + t, { x: 5.25, y: 2.04 + i * 0.28, w: 4.2, h: 0.24, fontSize: 9.5, fontFace: "Calibri", color: C.textMid, margin: 0 });
    });

    // Commands — balanced 3+3 grid
    card(sl, 0.35, 3.75, 9.3, 1.55);
    sl.addText("Verification Commands", { x: 0.55, y: 3.8, w: 8.8, h: 0.3, fontSize: 11.5, bold: true, color: C.navy, margin: 0 });
    const cmds = [
      { cmd: "npm run typecheck:api",       desc: "TS strict check (API)" },
      { cmd: "npm run typecheck:web",       desc: "TS strict check (web)" },
      { cmd: "npm run test:api:critical",   desc: "5 critical files, fast" },
      { cmd: "npm run test:api",            desc: "Full unit suite" },
      { cmd: "npm run test:api:e2e",        desc: "E2E (needs running DB)" },
      { cmd: "cd apps/api && npm run lint", desc: "ESLint + Prettier" },
    ];
    cmds.forEach((c, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 0.52 + col * 4.65;
      const y = 4.18 + row * 0.38;
      sl.addShape("rect", { x, y, w: 4.45, h: 0.32, fill: { color: "F1F5F9" }, line: { color: "CBD5E1", width: 1.2 } });
      sl.addText(c.cmd,  { x: x + 0.1, y: y + 0.02, w: 2.75, h: 0.28, fontSize: 8.5, fontFace: "Consolas", color: C.teal, valign: "middle", margin: 0 });
      sl.addText("— " + c.desc, { x: x + 2.88, y: y + 0.02, w: 1.5, h: 0.28, fontSize: 8.5, fontFace: "Calibri", color: C.textMid, valign: "middle", margin: 0 });
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 16 — Docker & Setup
  // ══════════════════════════════════════════════════════════════════════════
  {
    const sl = pres.addSlide();
    lightSlide(sl);
    sectionHeader(sl, "SETUP & DEPLOYMENT");
    slideTitle(sl, "Docker, Local Setup & Environment");

    // Docker services
    card(sl, 0.35, 1.52, 5.0, 2.42);
    sl.addShape("rect", { x: 0.35, y: 1.52, w: 5.0, h: 0.42, fill: { color: C.navy }, line: { color: C.navy } });
    sl.addText("Docker Compose Services", { x: 0.5, y: 1.52, w: 4.7, h: 0.42, fontSize: 12.5, bold: true, color: C.white, valign: "middle", margin: 0 });
    [
      { svc: "postgres", port: "5432", detail: "postgres:15-alpine · external volume" },
      { svc: "api",      port: "3001", detail: "NestJS · dev target · waits for postgres" },
      { svc: "web",      port: "3000", detail: "Next.js · dev target · waits for api" },
      { svc: "pgadmin",  port: "5050", detail: "dpage/pgadmin4 · admin@uskudar.edu.tr" },
    ].forEach((s, i) => {
      sl.addShape("rect", { x: 0.55, y: 2.03 + i * 0.46, w: 1.0, h: 0.36, fill: { color: C.teal }, line: { color: C.teal } });
      sl.addText(s.svc,  { x: 0.55, y: 2.03 + i * 0.46, w: 1.0, h: 0.36, fontSize: 10, color: C.white, align: "center", valign: "middle", margin: 0 });
      sl.addText(":" + s.port, { x: 1.65, y: 2.03 + i * 0.46, w: 0.68, h: 0.36, fontSize: 10.5, bold: true, color: C.teal, valign: "middle", margin: 0 });
      sl.addText(s.detail, { x: 2.42, y: 2.03 + i * 0.46, w: 2.8, h: 0.36, fontSize: 9.5, fontFace: "Calibri", color: C.textMid, valign: "middle", margin: 0 });
    });

    // Quick start
    card(sl, 0.35, 4.1, 5.0, 1.15);
    sl.addText("Quick Start", { x: 0.55, y: 4.14, w: 4.6, h: 0.3, fontSize: 11, bold: true, color: C.navy, margin: 0 });
    ["docker volume create library-system_edit_postgres_data", "npm install  &&  npm run db:start", "npm run db:migrate  &&  npm run db:seed", "npm run dev  →  http://localhost:3000"].forEach((cmd, i) => {
      sl.addText((i + 1) + ".  " + cmd, { x: 0.55, y: 4.49 + i * 0.19, w: 4.65, h: 0.18, fontSize: 9, fontFace: "Consolas", color: C.teal, margin: 0 });
    });

    // Env vars — 7 most critical (prevents overflow)
    card(sl, 5.55, 1.52, 4.1, 3.73);
    sl.addShape("rect", { x: 5.55, y: 1.52, w: 4.1, h: 0.42, fill: { color: C.navyLight }, line: { color: C.navyLight } });
    sl.addText("Critical Environment Variables", { x: 5.7, y: 1.52, w: 3.8, h: 0.42, fontSize: 11.5, bold: true, color: C.white, valign: "middle", margin: 0 });
    [
      { k: "JWT_SECRET",          v: "≥32 chars · same in API + web" },
      { k: "OPENROUTER_API_KEY",  v: "Required for all AI features" },
      { k: "FRONTEND_URL",        v: "e.g. http://localhost:3000" },
      { k: "DATABASE_URL",        v: "PostgreSQL connection string" },
      { k: "CORS_ORIGIN",         v: "Allowed frontend origins" },
      { k: "STORAGE_PROVIDER",    v: "local (default) or s3" },
      { k: "SMTP_HOST",           v: "Empty → tokens logged to console" },
    ].forEach((e, i) => {
      sl.addShape("rect", { x: 5.7, y: 2.03 + i * 0.48, w: 1.75, h: 0.36, fill: { color: "EFF6FF" }, line: { color: "BFDBFE" } });
      sl.addText(e.k, { x: 5.72, y: 2.03 + i * 0.48, w: 1.71, h: 0.36, fontSize: 8.5, bold: true, fontFace: "Consolas", color: C.navy, valign: "middle", margin: 2 });
      sl.addText(e.v, { x: 7.55, y: 2.03 + i * 0.48, w: 2.0,  h: 0.36, fontSize: 9,   fontFace: "Calibri", color: C.textMid, valign: "middle", margin: 0 });
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 17 — Thank You
  // ══════════════════════════════════════════════════════════════════════════
  {
    const sl = pres.addSlide();
    darkSlide(sl);

    sl.addShape("rect", { x: 0, y: 0, w: 0.28, h: 5.625, fill: { color: C.teal }, line: { color: C.teal } });
    sl.addShape("ellipse", { x: 6.5, y: -1.0, w: 5.2, h: 5.2, fill: { color: C.navyMid, transparency: 60 }, line: { color: C.navyMid, transparency: 60 } });
    sl.addShape("ellipse", { x: 8.0, y: 3.2,  w: 2.8, h: 2.8, fill: { color: C.navyLight, transparency: 70 }, line: { color: C.navyLight, transparency: 70 } });

    sl.addText("Thank You", {
      x: 0.65, y: 1.0, w: 7, h: 1.1,
      fontSize: 54, bold: true, fontFace: "Georgia", color: C.white, margin: 0,
    });
    sl.addShape("rect", { x: 0.65, y: 2.22, w: 2.3, h: 0.05, fill: { color: C.teal }, line: { color: C.teal } });
    sl.addText("Questions & Discussion", {
      x: 0.65, y: 2.42, w: 7, h: 0.52,
      fontSize: 21, fontFace: "Calibri", color: C.sky, margin: 0,
    });

    const facts = [
      "17 slides  ·  Full-stack Node.js monorepo",
      "NestJS API + Next.js 14 App Router frontend",
      "OpenRouter AI assistant with 15 callable tools",
      "4 user roles  ·  100+ API endpoints  ·  14 test suites",
    ];
    facts.forEach((s, i) => {
      sl.addText("· " + s, { x: 0.65, y: 3.2 + i * 0.38, w: 7.5, h: 0.32, fontSize: 13, fontFace: "Calibri", color: C.mutedDark, margin: 0 });
    });
  }

  // ─── Write ────────────────────────────────────────────────────────────────
  await pres.writeFile({ fileName: "C:/Projects/library-system-v2/presentation/LibrarySystem-Presentation.pptx" });
  console.log("Done → presentation/LibrarySystem-Presentation.pptx");
}

build().catch(err => { console.error(err); process.exit(1); });
