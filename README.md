# 📚 AI-Integrated University Library Management System

![Library System Banner](https://img.shields.io/badge/University-Library%20System-0D9488?style=for-the-badge&logo=book&logoColor=white)

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?style=flat-square&logo=nestjs)](https://nestjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

A modern, full-stack university library management system with role-based access control, real-time notifications, and AI-powered study assistance.

[Features](#-features) • [Tech Stack](#-tech-stack) • [Installation](#-installation) • [API Documentation](#-api-documentation) • [Screenshots](#-screenshots)

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Installation](#-installation)
- [Environment Variables](#-environment-variables)
- [Running the Application](#-running-the-application)
- [API Documentation](#-api-documentation)
- [User Roles & Permissions](#-user-roles--permissions)
- [Database Schema](#-database-schema)
- [AI Assistant](#-ai-assistant)
- [Screenshots](#-screenshots)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 Overview

The **AI-Integrated University Library Management System** is a comprehensive web-based platform designed to manage all aspects of university library operations. Built for Üsküdar University, the system supports physical book management, digital resources, borrowing workflows, research material sharing, and administrative oversight.

### Key Highlights

- 🔐 **Role-Based Access Control** — Four distinct user roles with tailored experiences
- 📖 **Complete Borrowing Lifecycle** — From reservation to return with automated fine calculation
- 📚 **Research Materials Hub** — Instructors can share publications and course materials
- 📋 **Reading Lists** — Instructor-curated collections with visibility control and student discovery
- 📊 **Analytics Dashboard** — Real-time statistics and borrowing trends
- 🌙 **Dark Mode Support** — Eye-friendly interface for extended use
- 🎨 **Liquid Glass Design System** — WebGL aurora background, Framer Motion spring animations, glass chrome layer with content-aware opacity
- 🤖 **OZ AI Agentic Assistant** — SSE streaming, tool-calling agent loop with real-time library data access, per-conversation history, image understanding, and book cover scanning powered by OpenRouter

---

## ✨ Features

### For Students

- Browse and search book catalog with advanced filters
- Create and track book reservations
- View borrowed books and due dates
- Track a **reading streak**: counts consecutive calendar days (up to today) with at least one active borrow (borrowedAt ≤ day ≤ returnedAt or today) in ACTIVE/OVERDUE status; not based on reading time or page views
- Access research materials and e-books
- Receive notifications for due dates and reservation updates
- Follow instructors and discover their reading lists
- View and track fines (outstanding balance, paid/waived history)
- AI assistant (OZ AI) with personalized study guidance, catalog search, and real-time library data

### For Instructors

- All student features plus:
- Submit research materials for library approval
- Create and manage course reading lists (with visibility and status controls)
- Track material submission status
- Extended borrowing periods (30 days)

### For Staff

- All student features plus:
- Interest-based AI recommendations (with onboarding prompt if interests are missing)
- Extended borrowing limits

### For Administrators

- **Book Management**: Add, edit, delete books and manage copies across branches
- **User Management**: View, activate/deactivate user accounts
- **Reservation Processing**: Approve, reject, and manage pickup workflows
- **Borrow Management**: Process returns, calculate fines, track overdue items
- **Materials Approval**: Review and approve instructor submissions
- **Reading List Moderation**: View and manage all reading lists
- **Statistics Dashboard**: View borrowing trends, popular books, and system metrics
- **System Configuration**: Manage branches, policies, and settings
- **Automated Notifications**: Scheduler sends overdue and due-soon alerts hourly (22-hour dedup window)

---

## 🛠 Tech Stack

### Frontend

| Technology          | Purpose                                  |
| ------------------- | ---------------------------------------- |
| **Next.js 14**      | React framework with App Router, SSR/SSG |
| **TypeScript**      | Type-safe JavaScript                     |
| **Tailwind CSS**    | Utility-first styling                    |
| **Lucide React**    | Icon library                             |
| **Framer Motion**   | Spring physics animations                |
| **Three.js**        | WebGL aurora mesh background             |
| **@splinetool/react-spline** | Interactive 3D scene (login/signup) |
| **Axios**           | HTTP client                              |

### Backend

| Technology          | Purpose                                  |
| ------------------- | ---------------------------------------- |
| **NestJS 10**       | Node.js framework with decorators and DI |
| **TypeScript**      | Type-safe backend code                   |
| **Prisma ORM**      | Database access and migrations           |
| **Passport.js**     | Authentication strategies (JWT + Google) |
| **JWT**             | Stateless authentication via HttpOnly cookies |
| **class-validator** | Request validation                       |
| **OpenRouter**      | Cloud LLM routing for AI assistant (tiered models) |

### Database & Infrastructure

| Technology         | Purpose                       |
| ------------------ | ----------------------------- |
| **PostgreSQL 15**  | Primary relational database   |
| **Docker**         | Containerized development     |
| **Docker Compose** | Multi-container orchestration |

---

## 📁 Project Structure

```
library-system/
├── apps/
│   ├── api/                    # NestJS Backend
│   │   ├── src/
│   │   │   ├── ai/             # AI assistant module
│   │   │   │   ├── ai.controller.ts            # REST + SSE endpoints
│   │   │   │   ├── agent.service.ts            # Agentic loop (tool-calling, SSE)
│   │   │   │   ├── ai.service.ts               # Legacy orchestrator
│   │   │   │   ├── groq.service.ts             # Cover scan + OpenRouter fallback
│   │   │   │   ├── providers/                  # OpenRouter / Gemini / Groq providers
│   │   │   │   └── dto/                        # Request/response DTOs
│   │   │   ├── auth/           # Authentication (JWT + Google OAuth)
│   │   │   ├── users/          # User management
│   │   │   ├── books/          # Book catalog & copies
│   │   │   ├── reservations/   # Reservation workflows
│   │   │   ├── borrows/        # Borrow management & fines
│   │   │   ├── materials/      # Research materials
│   │   │   ├── reading-lists/  # Instructor reading lists
│   │   │   ├── instructor-followers/ # Instructor follow system
│   │   │   ├── dashboard/      # Statistics & analytics
│   │   │   ├── notifications/  # Notification system
│   │   │   ├── prisma/         # Database client
│   │   │   └── main.ts         # Application entry
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # Database schema
│   │   │   └── seed.ts         # Seed data
│   │   └── package.json
│   │
│   └── web/                    # Next.js Frontend
│       ├── app/
│       │   ├── (auth)/         # Auth pages (login, register)
│       │   ├── dashboard/      # Protected dashboard routes
│       │   │   ├── admin/      # Admin-only pages
│       │   │   ├── instructor/ # Instructor pages
│       │   │   ├── ai-assistant/ # AI chat interface
│       │   │   ├── catalog/    # Book catalog
│       │   │   ├── borrowed/   # Active borrows
│       │   │   ├── reservations/ # Reservations
│       │   │   ├── reading-lists/ # Reading list discovery
│       │   │   ├── instructors/  # Instructor discovery
│       │   │   ├── materials/  # Research materials
│       │   │   ├── history/    # Borrow history
│       │   │   ├── profile/    # User profile
│       │   │   ├── settings/   # User settings
│       │   │   └── notifications/ # Notifications
│       │   ├── layout.tsx      # Root layout
│       │   └── page.tsx        # Landing page
│       ├── components/         # Reusable components
│       ├── lib/                # Utilities & API client
│       └── package.json
│
├── docker-compose.yml          # Docker configuration
├── package.json                # Root package.json
└── README.md
```

---

## 🚀 Installation

### Prerequisites

- **Node.js** >= 20.x
- **npm** >= 9.x
- **Docker** & **Docker Compose**
- **Git**
- **OpenRouter API key** (free tier available at openrouter.ai)

### Step 1: Clone the Repository

```bash
git clone https://github.com/yourusername/library-system.git
cd library-system
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Set Up Environment Variables

```bash
# Copy environment templates
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

### Step 4: Start the Database

```bash
npm run db:start
```

### Step 5: Run Database Migrations

```bash
npm run db:migrate
npm run db:seed
```

### Step 6: Start the Development Servers

```bash
npm run dev
```

The application will be available at:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **API Documentation**: http://localhost:3001/api/docs

---

## 🔐 Environment Variables

### Backend (`apps/api/.env`)

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/library_db?schema=public"

# JWT Configuration
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRATION="7d"

# Server
PORT=3001
NODE_ENV=development

# File Upload
MAX_FILE_SIZE=52428800  # 50MB in bytes
UPLOAD_DIR="./uploads"

# Google OAuth (optional)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:3001/auth/google/callback"

# OpenRouter (required for AI chat)
OPENROUTER_API_KEY="sk-or-v1-..."

# Gemini (required for book cover scanning)
GEMINI_API_KEY="AIza..."

# SMTP Email (optional — falls back to console logging if not configured)
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_USER="your-smtp-user"
SMTP_PASS="your-smtp-password"
SMTP_FROM="noreply@library.uskudar.edu.tr"
```

> **SMTP Note:** When `SMTP_HOST` is not set, verification codes and password reset links are logged to the server console instead of emailed. This is the default for local development — no SMTP server required.

### Frontend (`apps/web/.env`)

```env
# API URL
NEXT_PUBLIC_API_URL=http://localhost:3001

# App Configuration
NEXT_PUBLIC_APP_NAME="Library System"

# JWT secret — must match apps/api JWT_SECRET for middleware signature verification
JWT_SECRET="change-me-must-match-api"
```

> **JWT_SECRET Note:** The web middleware verifies JWT signatures to enforce role-based route protection at the UI layer. This secret **must match** the API's `JWT_SECRET`. If missing or mismatched, all dashboard requests redirect to the login page (fail-closed).

### Optional Feature Configuration

| Feature | Required Env Vars | Fallback |
|---------|-------------------|----------|
| **SMTP Email** | `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` | Emails logged to console |
| **OZ AI Chat** | `OPENROUTER_API_KEY` | AI offline indicator shown |
| **Book Cover Scan** | `GEMINI_API_KEY` | Scan endpoint unavailable |
| **Google OAuth** | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Button hidden on login/signup |

The `/auth/config` endpoint returns the current status of each feature:
```json
{ "googleOAuthEnabled": false, "smtpEnabled": false }
```

---

## 🏃 Running the Application

### Development Mode

```bash
npm run db:start              # Database on :5432
npm run dev                   # Backend on :3001, Frontend on :3000
```

### Production Build

```bash
npm run build

# Start production servers
cd apps/api && npm run start:prod
cd apps/web && npm start
```

### Build Commands (Monorepo)

```bash
npm run build                          # both apps
cd apps/api && npx nest build          # API only
cd apps/web && npx next build          # web only
```

### Test from Another Device on the Same Network (LAN)

The dev server binds to `0.0.0.0` so any device on your local network can connect.

**npm dev mode:**

```bash
# 1. Find your host machine IP
#    macOS / Linux:
ip -4 addr show | grep inet
#    or on macOS:
ipconfig getifaddr en0

# 2. Start normally
npm run db:start
npm run dev

# 3. On the other device, open:
#    http://<HOST_IP>:3000
```

**Docker dev mode:**

```bash
npm run docker:up
# Open http://<HOST_IP>:3000 on the other device
```

Docker already binds all services to `0.0.0.0` via port mappings, so no extra steps are needed.

> **Note:** All browser API requests use the `/api` same-origin path and are proxied server-side by Next.js, so LAN devices work without direct backend access.

> **CORS:** If you still see CORS errors (e.g., when the backend sets cookie domains), add your host IP to the API's allowed origins in `apps/api/.env`:
> ```
> CORS_ORIGIN="http://localhost:3000,http://<HOST_IP>:3000"
> ```

#### Off-network testing (optional)

For quick testing outside your LAN (e.g., on a mobile over cellular), you can use a temporary tunnel:

```bash
# Using SSH (if you have a public server):
ssh -R 80:localhost:3000 serveo.net

# Or using npx:
npx localtunnel --port 3000
```

> **Caution:** Tunnels expose your dev server to the internet. Use only for temporary testing and shut down when done.

### Seeded Development Accounts

Run the seed script to create test accounts for local development:

```bash
npm run db:seed
```

Credentials for all seeded roles (Student, Instructor, Staff, Admin) are printed to the terminal during seeding. To keep a local copy, save them to `SEED_ACCOUNTS_LOCAL.md` (already gitignored).

---

## 📡 API Documentation

### Base URL

```
http://localhost:3001
```

### Authentication

All protected endpoints require a JWT token sent via HttpOnly cookie.

### Endpoints Overview

| Module                   | Endpoints | Description                                    |
| ------------------------ | --------- | ---------------------------------------------- |
| **Auth**                 | 10        | Login, register, Google OAuth, password reset, email verification, logout |
| **Users**                | 6         | CRUD, activate/deactivate, interests           |
| **Books**                | 8         | Catalog, search, copies management             |
| **Reservations**         | 7         | Create, approve, reject, collect               |
| **Borrows**              | 10        | Checkout, return, history, statistics           |
| **Materials**            | 6         | Upload, approve, list                          |
| **Reading Lists**        | 10        | CRUD, items, feed, instructor lists, admin moderation |
| **Instructor Followers** | 3         | Follow, unfollow, list followed                |
| **Dashboard**            | 3         | Statistics, analytics                          |
| **AI**                   | 9         | SSE chat, conversations CRUD, history, status, scan cover, update interests, get context |
| **External Books**       | 5         | Search (Open Library + Gutendex), single import, bulk import, check existing |
| **Notifications**        | 4         | List, mark read                                |
| **Branches**             | 5         | CRUD, activate/deactivate (admin)              |
| **Borrow Policies**      | 2         | List, update per role (admin)                  |
| **Fine Payments**        | 5         | List, totals, detail, mark paid, waive (admin) |
| **Reports**              | 2         | Summary metrics, PDF/Excel export (admin)      |

### Example Requests

#### Login

```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "student@uskudar.edu.tr",
  "password": "yourPassword"
}
```

#### Get Book Catalog

```bash
GET /api/books?page=1&pageSize=12&faculty=FENS&category=Textbook
Authorization: Cookie (access_token)
```

#### Create Reservation

```bash
POST /api/reservations
Content-Type: application/json
Authorization: Cookie (access_token)

{
  "bookId": "book-uuid",
  "branchId": "branch-uuid"
}
```

#### AI Chat

```bash
POST /api/ai/chat
Content-Type: application/json
Authorization: Cookie (access_token)

{
  "message": "Create a learning path for machine learning"
}
```

---

## 👥 User Roles & Permissions

| Permission              | Student | Instructor | Staff | Admin |
| ------------------------ | ------- | ---------- | ----- | ----- |
| Browse Catalog           | ✅      | ✅         | ✅    | ✅    |
| Create Reservations      | ✅      | ✅         | ✅    | ✅    |
| View Own Borrows         | ✅      | ✅         | ✅    | ✅    |
| AI Chat Assistant        | ✅      | ✅         | ✅    | ✅    |
| Follow Instructors       | ✅      | ✅         | ✅    | ❌    |
| Discover Reading Lists   | ✅      | ✅         | ✅    | ✅    |
| Submit Materials         | ❌      | ✅         | ❌    | ✅    |
| Create Reading Lists     | ❌      | ✅         | ❌    | ❌    |
| Approve Reservations     | ❌      | ❌         | ❌    | ✅    |
| Process Returns          | ❌      | ❌         | ❌    | ✅    |
| Manage Books             | ❌      | ❌         | ❌    | ✅    |
| Manage Users             | ❌      | ❌         | ❌    | ✅    |
| Moderate Reading Lists   | ❌      | ❌         | ❌    | ✅    |
| View Statistics          | ❌      | ❌         | ❌    | ✅    |

### Borrow Limits by Role

| Role       | Max Active Borrows | Borrow Period | Max Extensions |
| ---------- | ------------------ | ------------- | -------------- |
| Student    | 5                  | 14 days       | 2              |
| Instructor | 10                 | 30 days       | 3              |
| Staff      | 7                  | 14 days       | 2              |
| Admin      | Unlimited          | 60 days       | Unlimited      |

---

## 🗄 Database Schema

### Core Entities

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│     User     │     │     Book     │     │    Branch    │
├──────────────┤     ├──────────────┤     ├──────────────┤
│ id           │     │ id           │     │ id           │
│ email        │     │ title        │     │ name         │
│ password     │     │ authors      │     │ address      │
│ name         │     │ isbn         │     │ isActive     │
│ role         │     │ category     │     └──────────────┘
│ studentId    │     │ faculty      │            │
│ faculty      │     │ ebookUrl     │            │
│ interests    │     │ subjectTags  │            │
└──────────────┘     └──────────────┘            │
       │                    │                    │
       │              ┌─────┴───────────┐        │
       │              │                 │        │
       ▼              ▼                 ▼        ▼
┌────────────────┐  ┌──────────────┐  ┌──────────────┐
│ Reservation    │  │   BookCopy   │──│   Borrow     │
├────────────────┤  ├──────────────┤  ├──────────────┤
│ id             │  │ id           │  │ id           │
│ userId         │  │ bookId       │  │ userId       │
│ bookId         │  │ branchId     │  │ bookCopyId   │
│ branchId       │  │ barcode      │  │ borrowDate   │
│ status         │  │ status       │  │ dueDate      │
│ pickupDeadline │  └──────────────┘  │ returnDate   │
└────────────────┘                    │ fine         │
                                      └──────────────┘
```

### Additional Entities

- **Material**: Research papers, publications, course materials
- **Notification**: User notifications for system events
- **ReadingList**: Instructor-curated book collections with visibility and status controls
- **ReadingListItem**: Books within a reading list
- **InstructorFollower**: Student-to-instructor follow relationships
- **BorrowPolicy**: Role-specific borrowing limits and rules

---

## 🤖 OZ AI — Agentic Assistant

OZ AI is the library's built-in AI assistant. It runs as a **tool-calling agent loop** with **Server-Sent Events (SSE) streaming**, giving it real-time access to library data rather than relying on static context injection.

### Architecture

```
User Message (text or image)
     │
     ▼
┌──────────────────────────────────────────┐
│  POST /ai/chat  →  SSE stream            │
│  agent.service.ts — AgentService         │
└───────────────┬──────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────┐
│  OpenRouter /chat/completions            │
│  Tiered model selection (FREE/CHEAP/SMART)
│  System prompt + conversation history   │
│  Tool definitions injected              │
└───────────────┬──────────────────────────┘
                │ tool_call?
       ┌────────┴─────────┐
       │ yes              │ no
       ▼                  ▼
┌─────────────┐   ┌───────────────────┐
│ executeTool │   │ stream text chunk │
│ (Prisma /   │   │ to client via SSE │
│  fetch)     │   └───────────────────┘
└──────┬──────┘
       │ result injected as tool message
       └──────────► back to OpenRouter (loop, max 5 rounds)
```

### Model Tiers

| Tier | Model | Used For |
|------|-------|----------|
| FREE | `google/gemma-4-31b-it:free` | Simple greetings, short responses |
| CHEAP | `google/gemini-3.1-flash-lite-preview` | Tool-calling, image analysis |
| SMART | `anthropic/claude-3-haiku` | Deep analytical queries, research |

If the FREE tier is rate-limited (429), the agent automatically falls back to CHEAP.

### Tools

| Tool | Description |
|------|-------------|
| `search_catalog` | Search books by keyword; returns title, authors, availability |
| `get_book_details` | Full detail for a specific book ID |
| `read_ebook` | Fetch and return e-book text content from URL |
| `fetch_webpage` | General web fetch for research or external context |
| `get_my_borrows` | Caller's currently active borrows with due dates |
| `get_catalog_stats` | System-wide counts: books, copies, available, borrowed, e-books |
| `get_active_borrows` | Staff/Admin: all active borrows + top 5 most-borrowed titles |
| `get_active_reservations` | Staff/Admin: pending and ready-for-pickup reservations |
| `get_user_stats` | Admin: total user counts by role |

### Image Understanding

Users can attach an image to any message (max 1024px, JPEG compressed). The image is sent as a base64 multipart content block via the OpenRouter vision API. Useful for asking about a book cover, a reading list photo, etc.

### Conversation History

Each conversation is persisted in the `AiConversation` database model. Users can:
- Start new conversations
- Switch between past conversations from the sidebar
- Each conversation maintains its own full message history for multi-turn context

### Book Cover Scanning

Administrators can scan a physical book cover image to auto-fill the add-book form:

```bash
POST /ai/scan-cover
Content-Type: application/json
{ "image": "<base64 JPEG>" }
```

Uses Google Gemini Flash. Extracts title, authors, ISBN, publisher, and publication year.

### Permission Safety

- Tool results are scoped: `get_my_borrows` returns only the requesting user's data
- Staff/Admin-only tools (`get_active_borrows`, `get_active_reservations`) enforce role check inside tool handler
- Admin-only tool (`get_user_stats`) enforces ADMIN role
- The AI informs but never executes write actions
- SSRF protection: `fetch_webpage` and `read_ebook` block localhost, RFC-1918, and link-local addresses

### LLM Configuration (OpenRouter)

Requires an OpenRouter API key (free tier available):

```env
OPENROUTER_API_KEY="sk-or-v1-..."
GEMINI_API_KEY="AIza..."   # for book cover scan only
```

When `OPENROUTER_API_KEY` is not set, `/ai/status` returns `{ "available": false }` and the frontend shows an "Offline" indicator.

---

## 📸 Screenshots

*Screenshots coming soon*

---

## 🗺 Roadmap

### ✅ Phase 1: Core System (Completed)

- [x] Authentication & Authorization (JWT + Google OAuth)
- [x] Email Verification & Password Reset
- [x] Book Catalog with Search & Filters
- [x] Reservation System
- [x] Borrow Management with Fine Calculation
- [x] Materials Upload & Approval
- [x] Notification System
- [x] Admin Statistics Dashboard
- [x] Dark Mode

### ✅ Phase 2: User Features (Completed)

- [x] Secure User Onboarding (Google Sign-In + Verified Email/Password Signup)
- [x] Edit User Profile
- [x] Instructor Follower System
- [x] Reading Lists CRUD (visibility/status/discovery/moderation)

### ✅ Phase 3: AI Integration (Completed)

- [x] AI Chatbot for Study Assistance
- [x] Role-Aware Context-Driven Recommendations
- [x] Natural Language Catalog Search with Semantic Scoring
- [x] Personalized Learning Path Generation
- [x] Research Assistant with Literature Guidance
- [x] OpenRouter LLM Integration with tiered model routing (FREE/CHEAP/SMART)
- [x] Embeddings-Ready Semantic Search Abstraction (keyword/hybrid/embedding strategy with shared types)

### 🔄 Phase 4: Production Readiness (In Progress)

- [x] Email Service (SMTP with nodemailer, feature-flagged fallback)
- [x] Cloud File Storage (AWS S3 with local fallback)
- [x] Error Logging & Monitoring (structured logging, correlation IDs, health endpoints)
- [x] Security Hardening (Helmet, CORS allowlist, rate limiting)
- [x] Performance Optimization (query shaping, pagination, compound indexes)

### ✅ Phase 5: Admin Enhancements (Completed)

- [x] Branch Management (CRUD + activate/deactivate)
- [x] Configurable Borrow Policies (admin UI for role-based limits)
- [x] Fine Payment Tracking (auto-create on overdue return, admin pay/waive)
- [x] Report Generation (PDF/Excel export with date range, summary metrics, top books)
- [x] External E-Book Import (Open Library + Gutendex, single + bulk, duplicate prevention)

### ✅ Phase 6: UI/UX & AI Overhaul (Completed)

- [x] Liquid Glass Design System (WebGL aurora background, glass chrome layer, Framer Motion spring animations)
- [x] 3D Login/Signup redesign (Spline interactive robot, glassmorphism form card, traveling border beams)
- [x] OZ AI — full agentic rewrite (SSE streaming, tool-calling loop, replaces intent-router)
- [x] AI conversation history persistence (AiConversation model, conversation sidebar)
- [x] Book cover scanning via gemma3:4b multimodal model
- [x] Student UX audit — fines page, department-based recommendations, borrow history fine cross-reference, a11y toggle roles
- [x] Instructor dashboard — new-list flow, share-research widget, followers widget
- [x] Automated overdue/due-soon notification scheduler (hourly, 22h dedup)

---

## ⚡ Performance Optimization

### Query Shaping
- Expensive Prisma reads use `select` to fetch only required fields instead of full model includes
- `findActiveBorrows()`, `findAllBorrows()` now return only the columns the frontend needs

### Pagination & Safety Caps
- `GET /borrows` (admin) now supports `?page=&pageSize=` with a 100-row max
- User-scoped list endpoints (`findMyBorrows`, `findMyReservations`, `findMyLists`) have `take: 50` safety caps
- Admin list endpoints (`findPendingReservations`, `findReadyForPickup`, `findAllForModeration`) have `take: 100` caps

### Database Indexes
Compound indexes added for common query patterns:
- `Notification(userId, read)` — unread count queries
- `Notification(userId, createdAt)` — notification feed sorting
- `Borrow(userId, status)` — user active borrows lookup
- `Borrow(status, dueAt)` — admin overdue queries
- `Reservation(userId, status)` — user active reservation checks
- `ReadingList(status, visibility)` — global feed discovery

Run `npx prisma migrate dev` after pulling to apply the new indexes.

---

## 🔒 Security Hardening

### Helmet

All responses include secure HTTP headers (X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security, etc.) via [Helmet](https://helmetjs.github.io/). CSP is disabled (managed by Next.js frontend).

### CORS

Origins are controlled via the `CORS_ORIGIN` env var (comma-separated). Only listed origins can make credentialed requests:

```env
CORS_ORIGIN="http://localhost:3000,https://library.uskudar.edu.tr"
```

### Rate Limiting

Powered by `@nestjs/throttler`. Global default: 20 requests per 60-second window.

Stricter limits on sensitive endpoints:
- **Auth** (`/auth/login`, `/auth/register`, `/auth/forgot-password`): 5 req/min
- **AI chat** (`/ai/chat`): 15 req/min

Exceeding the limit returns `429 Too Many Requests`. Tune via env vars:

| Variable | Default | Description |
|----------|---------|-------------|
| `THROTTLE_TTL` | `60` | Window in seconds |
| `THROTTLE_LIMIT` | `20` | Global max requests per window |
| `THROTTLE_AUTH_LIMIT` | `5` | Auth endpoint limit |
| `THROTTLE_AI_LIMIT` | `15` | AI chat limit |

---

## 📧 Production Auth & Mail Setup

Configure authentication and email services for production deployments.

### Google OAuth

The "Continue with Google" button is **automatically hidden** if OAuth is not configured. To enable:

1. Create credentials at [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Set authorized redirect URI: `https://your-api-domain/auth/google/callback`
3. Add to `.env`:
   ```env
   GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
   GOOGLE_CLIENT_SECRET="your-client-secret"
   GOOGLE_CALLBACK_URL="https://your-api-domain/auth/google/callback"
   ```

**Startup log:**
```
[Bootstrap] Google OAuth: ENABLED
```

If credentials are missing:
```
[Bootstrap] Google OAuth: DISABLED (set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable)
```

### SMTP Email

Email verification codes and password reset links require SMTP in production. Without it, emails are logged to the console (dev mode only).

```env
SMTP_HOST="smtp.sendgrid.net"
SMTP_PORT="587"
SMTP_USER="apikey"
SMTP_PASS="SG.your-api-key"
SMTP_FROM="noreply@library.uskudar.edu.tr"
```

**Gmail users:** You must use an [App Password](https://support.google.com/accounts/answer/185833), not your account password. Enable 2-Step Verification first, then generate an App Password for "Mail".

```env
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-16-char-app-password"
```

**Startup log:**
```
[MailService] SMTP connected: smtp.sendgrid.net
```

If SMTP is not configured:
```
[MailService] SMTP_HOST not configured — emails will be logged to console instead of sent
```

### FRONTEND_URL vs CORS_ORIGIN

| Variable | Purpose |
|----------|---------|
| `CORS_ORIGIN` | Comma-separated list of allowed origins for CORS (e.g., `http://localhost:3000,https://app.example.com`) |
| `FRONTEND_URL` | Canonical URL for password reset links and OAuth redirects. Falls back to first CORS origin if not set. |

In production, set both:
```env
CORS_ORIGIN="https://app.example.com,https://staging.example.com"
FRONTEND_URL="https://app.example.com"
```

---

## ☁️ Cloud File Storage

File uploads (avatars, materials) support both local disk and AWS S3.

### Configuration

Set `STORAGE_PROVIDER=s3` in `.env` along with the required AWS credentials:

```env
STORAGE_PROVIDER="s3"
AWS_REGION="eu-central-1"
AWS_S3_BUCKET="my-library-uploads"
AWS_ACCESS_KEY_ID="AKIA..."
AWS_SECRET_ACCESS_KEY="..."
AWS_S3_PUBLIC_BASE_URL=""   # optional override
```

### Local Fallback

When `STORAGE_PROVIDER` is `local` (the default) or S3 credentials are missing, uploads are written to `apps/api/uploads/` and served as static assets — no AWS account needed for development.

---

## 🩺 Health Endpoints

No authentication required. Designed for load balancers and container orchestrators.

| Endpoint | Purpose | Success | Failure |
|----------|---------|---------|---------|
| `GET /health/live` | Liveness probe — process is running | `200` | — |
| `GET /health/ready` | Readiness probe — dependencies healthy | `200` | `503` |

**Readiness checks:**
- **db**: Runs `SELECT 1` against PostgreSQL

Example response:
```json
{
  "status": "ready",
  "checks": { "db": "up" },
  "timestamp": "2026-03-12T10:00:00.000Z"
}
```

---

## 🔍 Logging & Troubleshooting

The API includes structured logging and error handling out of the box.

### Request Correlation

Every response includes an `x-request-id` header. If a client sends `x-request-id`, that value is preserved; otherwise a UUID is generated. Include this ID when reporting issues.

### Request Logging

All requests (except `/uploads/` static files) are logged with method, path, status, duration, and request ID:

```
[RequestLogger] GET /api/books 200 12ms [req=abc-123]
```

Disable per-request logging by setting `ENABLE_REQUEST_LOGGING=false` in `.env`.

### Error Responses

All errors return a consistent JSON shape with `requestId` and `timestamp`:

```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Internal Server Error",
  "requestId": "abc-123",
  "timestamp": "2026-03-10T12:00:00.000Z"
}
```

Stack traces are logged server-side only and never exposed to clients.

### Log Levels

Set `LOG_LEVEL` in `.env` to control verbosity: `error`, `warn`, `log` (default), `debug`, or `verbose`.

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed
- Follow the existing code style

---

## 📄 License

This project is developed as a graduation project for Üsküdar University, Faculty of Engineering and Natural Sciences, Software Engineering Department.

**© 2025-2026 Üsküdar University**

---

## 🙏 Acknowledgments

- **Thesis Advisor**: Dr. Kristin Surpuhi BENLİ
- **Department**: Software Engineering, Üsküdar University
- **Icons**: [Lucide Icons](https://lucide.dev/)
- **UI Inspiration**: Modern library management systems

---

**Built with ❤️ for Üsküdar University**

[⬆ Back to Top](#-ai-integrated-university-library-management-system)
