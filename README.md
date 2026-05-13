# Library System

AI-integrated university library system for Üsküdar University. Covers catalog management,
borrowing, reservations, instructor reading lists, study materials, notifications, fines,
reports, and an OpenRouter-backed AI library assistant.

This README is based directly on the current repository code, configuration, Docker files,
Prisma schema, frontend routes, backend controllers, AI services, tests, and operational docs.
Items absent from the current repository are marked as **not documented in the current repository**.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Current Feature Set](#current-feature-set)
- [User Experience and Main User Journeys](#user-experience-and-main-user-journeys)
- [Functional Requirements](#functional-requirements)
- [Non-Functional Requirements](#non-functional-requirements)
- [Monorepo Structure](#monorepo-structure)
- [Frontend Architecture](#frontend-architecture)
- [Backend Architecture](#backend-architecture)
- [AI Assistant Integration](#ai-assistant-integration)
- [Docker Setup](#docker-setup)
- [Database Setup](#database-setup)
- [Environment Variables](#environment-variables)
- [Local Development Setup](#local-development-setup)
- [Available Scripts](#available-scripts)
- [Testing, Linting, Formatting, and Type Checking](#testing-linting-formatting-and-type-checking)
- [API Documentation and Discovered Endpoints](#api-documentation-and-discovered-endpoints)
- [Security Considerations](#security-considerations)
- [Deployment and Production Notes](#deployment-and-production-notes)
- [Troubleshooting](#troubleshooting)
- [Contributing Notes](#contributing-notes)

---

## Project Overview

This repository is a Node.js monorepo containing two applications:

- `apps/api`: NestJS API with Prisma ORM, PostgreSQL, JWT cookie authentication, Swagger,
  document extraction, S3/local upload support, scheduled borrow and reservation reconciliation,
  and AI assistant services.
- `apps/web`: Next.js 15 App Router frontend with protected dashboard routes, role-aware
  navigation, API proxy rewrites, and AI chat route handlers.

Primary local ports:

| Service    | Port   | Source                                           |
| ---------- | -----: | ------------------------------------------------ |
| Web app    | `3000` | `apps/web/package.json`, `apps/web/Dockerfile`   |
| API        | `3001` | `apps/api/.env.example`, `apps/api/Dockerfile`   |
| PostgreSQL | `5432` | `docker-compose.yml`                             |
| Python runner | internal | `apps/python-runner`, `docker-compose.yml`       |
| pgAdmin    | `5050` | `docker-compose.yml`                             |

---

## Current Feature Set

- Email/password authentication with email verification, password reset, and password change.
- Optional Google OAuth login when Google credentials are configured.
- HttpOnly `access_token` cookie sessions with JWT verification.
- Role model: `STUDENT`, `INSTRUCTOR`, `STAFF`, `ADMIN`.
- Role-protected frontend dashboard routes and backend guards.
- Book catalog with metadata, authors, ISBN, faculty/category/subject tags, cover images,
  e-book URLs, PDF URLs, copies, branches, and availability state.
- Book copy and branch management.
- Reservation lifecycle: `PENDING`, `APPROVED`, `READY_FOR_PICKUP`, `COLLECTED`, `CANCELLED`, `EXPIRED`.
- Borrow lifecycle: `ACTIVE`, `RETURNED`, `OVERDUE`; extensions and return handling.
- Borrow policies configurable per role.
- Fine payments with `PENDING`, `PAID`, and `WAIVED` states.
- Notifications with unread counts, read/delete operations, and multiple notification types.
- Instructor reading lists with visibility, publication status, and per-item ordering.
- Instructor following/follower relationships.
- Research material upload (professor publications, research papers, course materials, theses)
  with approval, publishing, access controls, indexing, and search.
- Reports export endpoints for PDF and Excel.
- External book search and import from OpenLibrary and Gutendex.
- Admin dashboards for users, books, branches, borrows, reservations, fines, materials,
  policies, reports, statistics, uploads, and external book imports.
- AI assistant with conversations, saved messages, streaming SSE chat, study sessions,
  live model auto-selection, manual model override, response modes, tool calling, catalog
  access, reading-list access, borrow/reservation/stat lookups, study-material search,
  e-book/PDF reading, webpage fetching, scientific response rendering, and admin
  book-cover scanning.
- Swagger API documentation at `/api/docs`.
- Health probes at `/health/live`, `/health/ready`, and `/auth/health`.

---

## User Experience and Main User Journeys

### Public and Auth Journeys

- A visitor opens `/`, signs up at `/signup`, verifies email at `/verify-email`, logs in at
  `/login`, requests a reset at `/forgot-password`, and resets a password at `/reset-password`.
- Login sets an HttpOnly `access_token` cookie and redirects users to their role dashboard.
- The Google sign-in button is shown only when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
  are configured in the backend.

### Student and General Authenticated Journeys

- Browse `/dashboard/catalog`, inspect `/dashboard/catalog/[id]`, reserve available copies,
  review active borrows at `/dashboard/borrowed`, review history at `/dashboard/history`,
  manage reservations at `/dashboard/reservations`, view fines at `/dashboard/fines`, and
  manage profile/settings/notifications.
- Use `/dashboard/ai-assistant` to ask catalog, borrowing, reading-list, study-material, and
  study-session questions with a streaming AI assistant.
- Browse published reading lists at `/dashboard/reading-lists` and details at
  `/dashboard/reading-lists/[id]`.
- View instructor profiles at `/dashboard/instructors/[id]`.

### Instructor Journeys

- Access the instructor dashboard at `/dashboard/instructor`.
- Submit materials at `/dashboard/instructor/submit-material`.
- Review own submissions at `/dashboard/instructor/my-submissions`.
- Create and manage reading lists at `/dashboard/instructor/reading-lists` and
  `/dashboard/instructor/reading-lists/[id]`.
- View followed instructors at `/dashboard/instructor/following`.

### Staff Journeys

- Access `/dashboard/staff`.
- Access shared catalog, borrows, reservations, AI assistant, profile, notifications,
  reading lists, and settings surfaces permitted by frontend middleware.

### Admin Journeys

- Access `/dashboard/admin`.
- Manage books, users, branches, borrows, reservations, fines, materials, reading lists,
  policies, reports, statistics, uploads, and external book imports.
- Scan book-cover images through the admin-only `POST /ai/scan-cover` endpoint.

---

## Functional Requirements

Implemented requirements visible in the current code:

- Users must authenticate before accessing `/dashboard/*`.
- Dashboard access is role-gated in `apps/web/middleware.ts`.
- Backend endpoints are protected with JWT guards, role guards, and public decorators.
- New local users must verify email before login.
- Password reset uses opaque reset tokens and returns generic outward messages.
- Admins can activate and deactivate users.
- Books can have multiple physical copies across active library branches.
- Reservations are user/book-copy/book/branch scoped; `bookId` is server-derived, never
  accepted from client input.
- A unique partial index prevents duplicate active reservations for the same user and book.
- Borrow policies limit active borrows, borrow days, extension count, and extension days per role.
- Returning an overdue borrow creates a pending fine record.
- A scheduler service reconciles overdue borrows and expired reservations.
- Materials have publication/approval state, access level, and indexing state.
- The AI assistant must use tools for live library data and must not guess catalog or
  statistical values.
- API request validation strips non-whitelisted fields and rejects non-whitelisted input.

---

## Non-Functional Requirements

Implemented or configured requirements visible in the current code:

- TypeScript across frontend and backend.
- PostgreSQL persistence through Prisma ORM.
- Global structured error contract: `success: false`, `message`, `requestId`, `timestamp`.
- Request-ID and request-logging middleware applied to all routes.
- Configurable log level and SQL logging.
- Helmet middleware enabled with `contentSecurityPolicy`, `crossOriginEmbedderPolicy`, and
  `crossOriginResourcePolicy` disabled for app compatibility.
- CORS allowlist via `CORS_ORIGIN`.
- Cookie-based auth with `secure`/`sameSite` adjusted for production.
- Global and endpoint-level rate limiting via `@nestjs/throttler`.
- Startup validation for `JWT_SECRET` length and S3 configuration; the API exits if invalid.
- Swagger-generated API docs served at `/api/docs`.
- Docker development targets for the API and web app.
- Backend unit and e2e test coverage for selected critical paths.
- Frontend output configured as Next.js standalone build.
- JSON body limit raised to `10mb` to accommodate AI chat with embedded file content.

Not documented in the current repository:

- Formal uptime, latency, RPO/RTO, data retention, backup, observability, accessibility, or
  browser support targets.
- CI/CD pipeline definitions.

---

## Monorepo Structure

```text
.
├── apps
│   ├── api                  # NestJS backend
│   │   ├── prisma           # Prisma schema, migrations, seed scripts
│   │   ├── scripts          # Prisma helper scripts (Windows PowerShell)
│   │   ├── src              # API modules, controllers, services
│   │   ├── test             # E2E tests and helpers
│   │   └── uploads          # Local upload directory when using local storage
│   └── web                  # Next.js frontend
│       ├── app              # App Router pages and API route handlers
│       ├── components       # UI and dashboard components
│       ├── hooks            # React hooks
│       ├── lib              # API clients, AI model/mode definitions, helpers
│       ├── public           # Static assets
│       └── types            # Shared frontend TypeScript types
├── docs
│   └── operations           # Testing checklist and migration recovery notes
├── docker-compose.yml
├── package.json             # Root workspace scripts and dev dependencies
└── README.md
```

The root `package.json` declares workspaces for `apps/*` and `packages/*`. No `packages`
directory is present in the current repository.

---

## Frontend Architecture

The frontend is a Next.js 15 App Router application built with React 18, TypeScript, Tailwind
CSS, Framer Motion, SWR, Axios, and Radix UI primitives.

Key implementation files:

| File | Purpose |
| ---- | ------- |
| `apps/web/app` | Pages, layouts, global error boundary, API route handlers |
| `apps/web/middleware.ts` | JWT cookie verification and role-based dashboard route access |
| `apps/web/lib/api.ts` | Browser Axios client using same-origin `/api` with credentials |
| `apps/web/lib/server-api.ts` | Server route-handler backend URL resolution |
| `apps/web/lib/ai-models.ts` | AI model options exposed to the frontend model selector |
| `apps/web/lib/ai-modes.ts` | AI mode definitions for the frontend mode UI |
| `apps/web/next.config.js` | Standalone output, `three` transpilation, `/api` and `/uploads` rewrites |
| `apps/web/tailwind.config.ts` | Tailwind theme, role colors, and UI tokens |
| `apps/web/components/ui` | Local UI primitives and visual components |

Frontend environment variables (from `apps/web/.env.example`):

| Variable               | Purpose                                                               |
| ---------------------- | --------------------------------------------------------------------- |
| `API_URL`              | Server-side backend URL for Next.js route handlers                    |
| `NEXT_PUBLIC_API_URL`  | Backend URL used by rewrites and browser-visible diagnostics          |
| `NEXT_PUBLIC_APP_NAME` | Application display name                                              |
| `JWT_SECRET`           | Must match the API `JWT_SECRET` for middleware JWT signature verification |

Discovered frontend pages:

| Route | Purpose |
| ----- | ------- |
| `/` | Public landing/home page |
| `/login` | Login |
| `/signup` | Registration |
| `/verify-email` | Email verification |
| `/forgot-password` | Password reset request |
| `/reset-password` | Password reset |
| `/dashboard/student` | Student dashboard |
| `/dashboard/instructor` | Instructor dashboard |
| `/dashboard/staff` | Staff dashboard |
| `/dashboard/admin` | Admin dashboard |
| `/dashboard/catalog` | Catalog search and list |
| `/dashboard/catalog/[id]` | Book detail |
| `/dashboard/borrowed` | Current borrowed books |
| `/dashboard/history` | Borrow history |
| `/dashboard/reservations` | User reservations |
| `/dashboard/fines` | User fines |
| `/dashboard/materials` | Materials browse |
| `/dashboard/reading-lists` | Reading list feed |
| `/dashboard/reading-lists/[id]` | Reading list detail |
| `/dashboard/instructors/[id]` | Instructor profile |
| `/dashboard/ai-assistant` | AI assistant chat |
| `/dashboard/notifications` | Notifications |
| `/dashboard/profile` | User profile |
| `/dashboard/settings` | User settings |
| `/dashboard/instructor/my-submissions` | Instructor material submissions |
| `/dashboard/instructor/submit-material` | Submit material |
| `/dashboard/instructor/following` | Followed instructors |
| `/dashboard/instructor/reading-lists` | Instructor reading lists |
| `/dashboard/instructor/reading-lists/[id]` | Instructor reading list editor |
| `/dashboard/admin/books` | Admin book management |
| `/dashboard/admin/books/new` | New book |
| `/dashboard/admin/books/[id]/edit` | Edit book |
| `/dashboard/admin/users` | Admin user management |
| `/dashboard/admin/branches` | Branch management |
| `/dashboard/admin/borrows` | Admin borrow management |
| `/dashboard/admin/reservations` | Admin reservation management |
| `/dashboard/admin/fines` | Admin fine management |
| `/dashboard/admin/materials` | Admin material moderation |
| `/dashboard/admin/reading-lists` | Admin reading list moderation |
| `/dashboard/admin/policies` | Borrow policy management |
| `/dashboard/admin/reports` | Reports |
| `/dashboard/admin/statistics` | Statistics |
| `/dashboard/admin/import-books` | External book imports |
| `/dashboard/admin/upload` | Admin uploads |

Frontend API route handlers that proxy selected AI calls to the backend:

- `GET /api/ai/conversations`
- `POST /api/ai/conversations`
- `DELETE /api/ai/conversations/[id]`
- `PATCH /api/ai/conversations/[id]/mode`
- `GET /api/ai/history`
- `POST /api/ai/study`
- `POST /api/ai/chat` with SSE passthrough

Middleware route permissions (from `apps/web/middleware.ts`):

- `/dashboard/admin` and all sub-routes: `ADMIN` only.
- `/dashboard/student`: `STUDENT`, `ADMIN`.
- `/dashboard/instructor`: `INSTRUCTOR`, `ADMIN`.
- `/dashboard/staff`: `STAFF`, `ADMIN`.
- Catalog, borrowed, reservations, AI assistant, profile, settings, notifications,
  reading lists, instructors: all four roles.
- `/dashboard/fines`, `/dashboard/history`, `/dashboard/materials` are not in the
  middleware permission map — any authenticated user may navigate to them; backend
  data scoping prevents cross-user data exposure.

---

## Backend Architecture

The backend is a NestJS 11 API using Prisma 5 and PostgreSQL 15.

Key implementation files:

| File | Purpose |
| ---- | ------- |
| `apps/api/src/main.ts` | Startup validation, Helmet, body limits, cookie parser, CORS, static uploads, global filters/pipes, Swagger |
| `apps/api/src/app.module.ts` | Module composition and global request middleware |
| `apps/api/src/prisma/prisma.service.ts` | Database URL construction and Prisma logging |
| `apps/api/src/common` | Global exception filter, request-ID middleware, request-logger middleware |
| `apps/api/src/auth` | Local auth, Google OAuth, JWT strategy, decorators, and guards |
| `apps/api/src/storage` | Local/S3 upload and document buffer access |
| `apps/api/src/mail` | SMTP or dev-console email sending |
| `apps/api/src/ai` | Assistant, providers, prompt builder, tools, modes, token tracking, search |

Registered backend modules:

| Module | Purpose |
| ------ | ------- |
| `AuthModule` | Login, registration, email verification, password reset, Google OAuth, JWT strategy |
| `UsersModule` | User profile, preferences, interests, activation/deactivation, user stats |
| `BooksModule` | Catalog CRUD, book copies, PDF indexing, cover images, branch availability |
| `BorrowsModule` | Borrow lifecycle, extensions, returns, overdue detection, scheduler |
| `ReservationsModule` | Reservation lifecycle from pending through collection or expiry |
| `DashboardModule` | Role-specific dashboard aggregates, activity feed, admin AI metrics |
| `NotificationsModule` | User notifications, unread counts, read/delete operations |
| `MaterialsModule` | Research material upload, approval, indexing, chunking, and search |
| `ReadingListsModule` | Instructor reading list creation, management, and feed |
| `InstructorFollowersModule` | Follow/unfollow relationships between users and instructors |
| `AiModule` | AI assistant conversations, study sessions, SSE chat, tools, cover scan |
| `StorageModule` | Local and S3 file storage, upload handling, document buffer access |
| `HealthModule` | Liveness and readiness probes |
| `BranchesModule` | Library branch creation, activation, and deactivation |
| `BorrowPoliciesModule` | Per-role borrow limits, days, and extension rules |
| `FinePaymentsModule` | Fine records, payment, and waiver |
| `ReportsModule` | PDF and Excel report export |
| `ExternalBooksModule` | OpenLibrary and Gutendex search and import |
| `PrismaModule` | Shared Prisma client, exported globally |
| `MailModule` | SMTP or console email sending for auth flows |

---

## AI Assistant Integration

### Provider

The active AI provider is OpenRouter. All model calls go through `OpenRouterProvider` and
`AgentService`, which make direct HTTP requests to `https://openrouter.ai/api/v1`.

Required environment variable:

- `OPENROUTER_API_KEY` — required by the active provider. The `/health/ready` endpoint
  reports `"ai": "configured"` when this key is present, `"ai": "not configured"` otherwise.

Add `OPENROUTER_API_KEY` to `apps/api/.env` when enabling AI features.

### Provider Class

| Class | Status | Key Variable |
| ----- | ------ | ------------ |
| `OpenRouterProvider` | Active and wired into `AiModule` | `OPENROUTER_API_KEY` |

### Model Tiers

All model requests go through OpenRouter regardless of the underlying model provider.

- `free`: `google/gemma-4-31b-it:free` for simple greetings and
  short messages.
- `tool`: `google/gemini-3.1-flash-lite-preview` for tool use, catalog
  queries, and image fallback.
- `smart`: `anthropic/claude-3-haiku` for deep analytical queries and
  study-session guides.
- `technical`: `openai/gpt-5.1-codex-mini` for Auto or manual technical,
  coding, scientific, graphing, and structured reasoning.

`OPENROUTER_MODELS` exposes `FREE`, `CHEAP`, `SMART`, `TECHNICAL`, and
`STUDY` constants. The IDs come from `apps/api/src/ai/model-registry.ts`.

Auto model selection logic in `AgentService.resolveModelSelection()`:

- image attached: use the tool/vision-capable standby model
- technical image: use Codex Mini
- coding, math, graphing, engineering, or numerical method request: use
  Codex Mini
- study session or deep query: use the smart model
- simple greeting or short message: use the free model
- other tool/catalog requests: use the tool-capable standby model

Manual model override: users can select a specific model from the frontend
model selector, which sends it in the `model` field of the chat request.
The conversation stores `manualModel`, `lastResolvedModel`, and
`lastModelSelectionSource`.

Model selection source values are:

| Source | Meaning |
| ------ | ------- |
| `auto` | Auto mode selected the active model |
| `manual` | The saved manual model handled the request directly |
| `capability_fallback` | The saved model lacked image or tool support |
| `rate_limit_fallback` | The selected free model was rate-limited |

Capability fallback is temporary. It does not overwrite the saved manual
model, so the next request starts from the user's selected model again.

Book-cover scan uses `google/gemini-2.0-flash-lite` directly (vision model, not tiered).

### Scientific Response Rendering

Assistant messages render through `AIMessage` with:

- Markdown and GitHub-flavored Markdown tables
- KaTeX math via `$...$` and `$$...$$`
- safe normalization of `\(...\)` and `\[...\]` outside fenced code blocks
- syntax-highlighted code blocks with a copy button
- interactive Plotly graph blocks from fenced `graph` JSON
- automatic wrapping of standalone valid graph JSON into fenced `graph` blocks
- Mermaid diagrams from fenced `mermaid` blocks
- source-code fallback when graph or Mermaid rendering fails

Scientific output guidance is added to the system prompt when the user's
message asks for math, science, engineering, graphing, code, or diagrams.

Graph blocks are validated before rendering. Supported graph types are
`function`, `multi-function`, `scatter`, `line`, `bar`, `pie`, and
`histogram`. Versioned graph JSON may use `schemaVersion: 1`, `points`,
`functions`, `values`, `connectPoints`, axis labels, and axis ranges. Legacy
`xValues`, `yValues`, `labels`, tuple points, and model-style function series
remain supported.

Graph validation limits are intentionally bounded: 500 points, 5 functions,
120 characters per expression, 80 characters per label, and a maximum x/y
range width of 1000. Admin analytics graphs must be based on returned
tool/API/database data; OZ should not invent library statistics to fill a
chart.

### Python Scientific Runner

The optional Python runner is a separate FastAPI service under
`apps/python-runner`. The API exposes it to OZ as a bounded `run_python` tool
only when `PYTHON_RUNNER_URL` is configured.

The runner is intended for scientific computation, symbolic math, numerical
methods, matrices, statistics, dataframe work, and graph data generation. It is
not used for live library catalog data; library questions still use the
existing catalog, borrow, reading-list, and study-material tools.

Initial runner safeguards:

- separate process and Docker service
- non-root container user
- `python -I`
- temporary working directory per request
- blocked common unsafe imports and runtime calls
- execution timeout
- truncated stdout and stderr

### Conversation Features

- Conversation list, create, delete.
- Message history per conversation.
- Dedicated study sessions: initiated via `POST /ai/study` with a `bookId`. This creates an
  `AiConversation` with `studyBookId` set and locks the conversation to `learning` and
  `explanatory` modes. The `STUDY` model tier is used for the opening guide generation.
  Subsequent messages in the same conversation use the normal model selection logic.
- Saved mode state: `manualModes`, `lastAutoModes` persisted per conversation.
- Saved model state: `manualModel`, `lastResolvedModel`, `lastModelSelectionSource`.
- Token usage metrics per user and conversation, tracked in memory by `TokenTrackerService`.
- SSE streaming response at `POST /ai/chat`.
- Chat rate limit: 15 requests per 60 seconds.

### Response Modes

Modes are stored per conversation and influence system prompt instructions.

| Mode | Behaviour |
| ---- | --------- |
| `learning` | Socratic coaching with retrieval questions and comprehension checks |
| `explanatory` | Step-by-step explanations with concrete examples |
| `planning` | Phases, milestones, priorities, timelines, and next-step plans |
| `formal` | Academic, polished tone with clear headings |
| `concise` | Tight responses, short bullets, minimal padding |

Study sessions default to `learning` + `explanatory`. Modes are inferred automatically from
message content and can also be set manually.

### AI Tools

Tools registered in `AgentService.getTools()` and executed via `AgentService.executeTool()`:

| Tool | Description |
| ---- | ----------- |
| `search_catalog` | Keyword search across the library catalog |
| `get_book_details` | Full details for a specific book including availability |
| `read_ebook` | Read an e-book or uploaded book PDF for summaries and quotes |
| `fetch_webpage` | Fetch any public URL |
| `get_my_borrows` | Current user's active borrows and due dates |
| `get_catalog_stats` | Total book, copy, and e-book counts from the database |
| `get_active_borrows` | All currently active borrows and top 5 most-borrowed books |
| `get_active_reservations` | All active reservations (pending or ready for pickup) |
| `get_user_stats` | Total registered user counts by role |
| `get_reading_lists` | Published reading lists curated by instructors |
| `get_my_reading_lists` | Current instructor's own reading lists including drafts |
| `search_study_material` | Full-text search across indexed study material chunks |
| `list_study_materials` | List all indexed study materials available to the user |
| `get_chunk_context` | Neighbouring chunks around a specific material chunk |
| `get_material_outline` | Opening chunks of a study material to understand its structure |

### RAG and Retrieval Behavior

- **Catalog search**: keyword-first. `AI_SEMANTIC_MODE` accepts `keyword`, `hybrid`, or
  `embedding`; the `hybrid` and `embedding` modes currently fall back to keyword search
  because vector infrastructure is not implemented. Embedding generation returns `null`;
  no pgvector columns are present in the current Prisma schema.
- **Material indexing**: extracts text from `.pdf`, `.docx`, `.doc`, and `.txt` files, chunks
  content into approximately 400-word chunks with 40-word overlap, stores chunks in
  `MaterialChunk`, and searches with PostgreSQL full-text search.
- **Material access control**: enforced by role, uploader identity, public access, faculty
  code, and course code.
- **Book PDF indexing**: extracts text into `Book.pdfExtractedText`, tracks page count and
  index status (`pdfIndexStatus`), used by the `read_ebook` tool.

### System Prompt Behavior

The system prompt is built by `buildSystemPrompt()` in
`apps/api/src/ai/prompts/system-prompt-builder.ts`. It:

- Injects role-specific base instructions and few-shot behavioral examples.
- Injects current user context: name, role, faculty, interests, active borrows, borrow policy
  limits, catalog totals, available copies, published reading list count, indexed material
  count, and current date.
- Explicitly instructs the assistant to use tools for all live library data questions and
  never to guess or invent catalog or statistical values.
- Instructs the assistant to respond in English by default and switch to Turkish only when the
  user's message is written in Turkish.
- Instructs the assistant to read attached file content when present in the message.

---

## Docker Setup

`docker-compose.yml` defines:

| Service | Image / Build | Container | Port | Notes |
| ------- | ------------- | --------- | ----: | ----- |
| `postgres` | `postgres:15-alpine` | `library_db` | `5432` | External named volume |
| `python-runner` | `./apps/python-runner` | `library_python_runner` | internal | Scientific Python execution |
| `api` | `./apps/api` target `development` | `library_api` | `3001` | Depends on Postgres and Python runner |
| `web` | `./apps/web` target `development` | `library_web` | `3000` | Depends on API |
| `pgadmin` | `dpage/pgadmin4:latest` | `library_pgadmin` | `5050` | Default email `admin@uskudar.edu.tr` |

All services share a bridge network named `library_network`.

The Compose file uses an **external** named volume:

```yaml
volumes:
  postgres_data:
    name: library-system_edit_postgres_data
    external: true
```

Create this volume before the first `docker-compose up` if it does not exist:

```bash
docker volume create library-system_edit_postgres_data
```

Start all services:

```bash
npm run docker:up
```

Stop services:

```bash
npm run docker:down
```

View logs:

```bash
npm run docker:logs
```

The API Dockerfile (`apps/api/Dockerfile`):

- Base image: `node:20-slim` with `openssl` installed.
- Installs dependencies and runs `npx prisma generate` in a `deps` stage.
- The `development` stage copies the node\_modules and source, exposes port `3001`,
  and runs `npm run start:dev`.

The web Dockerfile (`apps/web/Dockerfile`):

- Base image: `node:20-alpine`.
- The `development` stage copies node\_modules and source, exposes port `3000`,
  and runs `npm run dev`.

---

## Database Setup

Database stack:

- PostgreSQL 15
- Prisma ORM 5
- Prisma Client generator with binary targets: `native`, `debian-openssl-3.0.x`, `windows`

Schema source: `apps/api/prisma/schema.prisma`

### Prisma Models

| Model | Description |
| ----- | ----------- |
| `User` | Authenticated users with role, auth provider, email verification, profile, and preferences |
| `Faculty` | University faculties with optional default branch |
| `LibraryBranch` | Physical library branches/campuses |
| `Course` | Courses linked to faculties |
| `Book` | Catalog books with metadata, copies, PDF indexing, and e-book fields |
| `BookCopy` | Individual physical copies with barcode, branch, status, and condition |
| `BorrowPolicy` | Per-role borrow limits, days, extensions |
| `Reservation` | Reservation lifecycle per user/book copy/branch |
| `Borrow` | Borrow records with extension tracking and optional fine |
| `Material` | Uploaded instructor materials with indexing and access control |
| `MaterialChunk` | Full-text-searchable chunks of indexed material content |
| `Notification` | User notifications with type, read state, and related entity references |
| `ReadingList` | Instructor-curated book lists with visibility and status |
| `ReadingListItem` | Ordered book entries within a reading list |
| `InstructorFollower` | Follow relationships between users and instructors |
| `FinePayment` | Fines linked to overdue borrows with status and payment tracking |
| `AiConversation` | AI chat conversations with mode state and model state |
| `AiMessage` | Individual messages in an AI conversation |

### Enums

`Role`, `BookCopyStatus`, `ReservationStatus`, `BorrowStatus`, `MaterialType`, `AccessLevel`,
`IndexStatus`, `AuthProvider`, `ReadingListVisibility`, `ReadingListStatus`, `FineStatus`,
`NotificationType`

### Migrations

Migration files are present under `apps/api/prisma/migrations`, from
`20251209213528_init` through `20260505170000_add_ai_conversation_model_state`.

### Database Commands

From the repository root:

```bash
npm run db:start      # Start only PostgreSQL via Docker Compose
npm run db:stop       # Stop Docker Compose services
npm run db:studio     # Open Prisma Studio
npm run db:migrate    # Run Prisma migrate dev
npm run db:seed       # Seed the database
npm run db:reset      # Reset and re-migrate the database
```

From `apps/api`:

```bash
npm run prisma:generate        # Generate Prisma Client
npm run prisma:migrate         # prisma migrate dev
npm run prisma:studio          # prisma studio
npm run prisma:seed            # prisma db seed
npm run prisma:generate:clean  # Windows PowerShell clean generate helper
```

### Seed Data

`apps/api/prisma/seed.ts` clears core tables and seeds branches, faculties, borrow policies,
users, books, book copies, and sample borrows.

Default password for all seeded accounts: `password123`

| Role | Email |
| ---- | ----- |
| Student | `efe.demir@std.uskudar.edu.tr` |
| Instructor | `kemal.sahin@uskudar.edu.tr` |
| Staff | `ayse.yildiz@uskudar.edu.tr` |
| Admin | `admin@uskudar.edu.tr` |

Additional script `apps/api/prisma/add-books.ts` adds or updates 8 test books when run with
`npx ts-node prisma/add-books.ts`. It is not wired into `package.json`.

---

## Environment Variables

### Backend (`apps/api/.env.example` and code)

| Variable | Purpose |
| -------- | ------- |
| `DATABASE_URL` | Prisma/PostgreSQL connection string |
| `POSTGRES_HOST` | Optional DB host used by `PrismaService` when `DATABASE_URL` is absent |
| `POSTGRES_USER` | Optional DB user fallback |
| `POSTGRES_PASSWORD` | Optional DB password fallback |
| `POSTGRES_DB` | Optional DB name fallback |
| `POSTGRES_PORT` | Optional DB port fallback |
| `DOCKER_ENV` | Uses `postgres` as fallback DB host when `"true"` |
| `JWT_SECRET` | JWT signing secret; startup requires at least 32 characters |
| `JWT_EXPIRATION` | JWT expiration (e.g. `7d`) |
| `PORT` | API listen port; default `3001` |
| `NODE_ENV` | Runtime environment (`development` / `production`) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID; leave empty to disable Google sign-in |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | Google OAuth callback URL |
| `CORS_ORIGIN` | Comma-separated list of allowed frontend origins |
| `FRONTEND_URL` | Canonical frontend URL for OAuth redirects and email links |
| `UPLOAD_DIR` | Upload directory path (static serving uses `./uploads` relative to API cwd) |
| `OPENROUTER_API_KEY` | Required by the active OpenRouter AI provider |
| `PYTHON_RUNNER_URL` | Optional internal URL for the scientific Python runner |
| `PYTHON_RUNNER_TIMEOUT_MS` | Python runner execution timeout; default `3000` |
| `AI_SEMANTIC_MODE` | `keyword`, `hybrid`, or `embedding`; default `hybrid`; hybrid falls back to keyword |
| `STORAGE_PROVIDER` | `local` or `s3` |
| `AWS_REGION` | S3 region; required when `STORAGE_PROVIDER=s3` |
| `AWS_S3_BUCKET` | S3 bucket; required when `STORAGE_PROVIDER=s3` |
| `AWS_ACCESS_KEY_ID` | AWS SDK credential chain input |
| `AWS_SECRET_ACCESS_KEY` | AWS SDK credential chain input |
| `AWS_S3_PUBLIC_BASE_URL` | Optional public S3 base URL override |
| `THROTTLE_TTL` | Global rate-limit window in seconds |
| `THROTTLE_LIMIT` | Global rate-limit max requests per window |
| `THROTTLE_AUTH_LIMIT` | Auth endpoint throttle limit (auth controllers use inline throttles) |
| `THROTTLE_AI_LIMIT` | AI chat throttle limit (AI controller uses inline throttle of 15/60s) |
| `LOG_LEVEL` | Nest logger level: `error`, `warn`, `log`, `debug`, `verbose` |
| `ENABLE_REQUEST_LOGGING` | Set to `"false"` to silence per-request logs |
| `LOG_SQL` | Set to `"true"` to enable Prisma SQL query logs |
| `SMTP_HOST` | SMTP host; empty means dev/console email behavior |
| `SMTP_PORT` | SMTP port |
| `SMTP_USER` | SMTP user |
| `SMTP_PASS` | SMTP password |
| `SMTP_FROM` | Sender address |

### Frontend (`apps/web/.env.example`)

| Variable | Purpose |
| -------- | ------- |
| `API_URL` | Server-side backend URL for Next.js route handlers |
| `NEXT_PUBLIC_API_URL` | Backend URL used by rewrites and browser-visible config |
| `NEXT_PUBLIC_APP_NAME` | Application display name |
| `JWT_SECRET` | Must match API `JWT_SECRET` for middleware JWT signature verification |

---

## Local Development Setup

### Prerequisites

- Node.js 20 (expected by Dockerfiles)
- npm
- Docker and Docker Compose (for PostgreSQL or full container development)

### Steps

Install all workspace dependencies from the repository root:

```bash
npm install
```

Create environment files:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Set a matching `JWT_SECRET` of at least 32 characters in both `apps/api/.env` and
`apps/web/.env.local`. Set `OPENROUTER_API_KEY` in `apps/api/.env` to enable AI features.

Set `FRONTEND_URL` in `apps/api/.env` to `http://localhost:3000`. This value is embedded in
email verification and password reset links. Without it those links will be broken or missing
a host.

In development, leaving `SMTP_HOST` empty causes `MailService` to print emails to the API
console instead of sending them. Verification and reset tokens appear in the terminal output.

Start only PostgreSQL:

```bash
npm run db:start
```

Run migrations and seed:

```bash
npm run db:migrate
npm run db:seed
```

Start both apps in development mode:

```bash
npm run dev
```

The root `dev` script starts the API first, waits for `http://localhost:3001/health/live`
to respond, then starts the web app.

Or start apps individually:

```bash
npm run dev:api
npm run dev:web
```

Open in your browser:

| URL | Description |
| --- | ----------- |
| `http://localhost:3000` | Web application |
| `http://localhost:3001` | API |
| `http://localhost:3001/api/docs` | Swagger documentation |
| `http://localhost:5050` | pgAdmin (when started via Docker Compose) |

---

## Available Scripts

### Root Scripts (`package.json`)

| Script | Command |
| ------ | ------- |
| `dev` | `concurrently "npm run dev:api" "wait-on http://localhost:3001/health/live && npm run dev:web"` |
| `dev:api` | `cd apps/api && npm run start:dev` |
| `dev:web` | `cd apps/web && npm run dev` |
| `dev:lan` | Same as `dev` (alias for LAN access) |
| `build` | `npm run build:api && npm run build:web` |
| `build:api` | `cd apps/api && npm run build` |
| `build:web` | `cd apps/web && npm run build` |
| `typecheck:api` | `cd apps/api && npm run typecheck` |
| `typecheck:web` | `cd apps/web && npm run typecheck` |
| `test:api` | `cd apps/api && npm run test:unit` |
| `test:api:critical` | `cd apps/api && npm run test:critical` |
| `test:api:e2e` | `cd apps/api && npm run test:e2e` |
| `test:web` | `cd apps/web && npm run test` |
| `db:start` | `docker-compose up -d postgres` |
| `db:stop` | `docker-compose down` |
| `db:studio` | `cd apps/api && npx prisma studio` |
| `db:migrate` | `cd apps/api && npx prisma migrate dev` |
| `db:seed` | `cd apps/api && npx prisma db seed` |
| `db:reset` | `cd apps/api && npx prisma migrate reset` |
| `docker:up` | `docker-compose up -d` |
| `docker:down` | `docker-compose down` |
| `docker:logs` | `docker-compose logs -f` |
| `clean` | `rimraf node_modules apps/*/node_modules packages/*/node_modules` |

### API Scripts (`apps/api/package.json`)

| Script | Command |
| ------ | ------- |
| `build` | `nest build` |
| `typecheck` | `npx tsc --noEmit` |
| `format` | `prettier --write "src/**/*.ts" "test/**/*.ts"` |
| `start` | `nest start` |
| `start:dev` | `nest start --watch` |
| `start:debug` | `nest start --debug --watch` |
| `start:prod` | `node dist/src/main` |
| `lint` | `eslint "{src,apps,libs,test}/**/*.ts" --fix` |
| `test` | `jest` |
| `test:unit` | `jest --runInBand` |
| `test:critical` | `jest --runInBand` with 5 specific critical test files |
| `test:watch` | `jest --watch` |
| `test:cov` | `jest --coverage` |
| `test:e2e` | `jest --config test/jest-e2e.config.ts --runInBand --no-coverage` |
| `prisma:generate` | `prisma generate` |
| `prisma:migrate` | `prisma migrate dev` |
| `prisma:studio` | `prisma studio` |
| `prisma:seed` | `prisma db seed` |
| `covers:backfill` | `ts-node src/scripts/backfill-book-covers.ts` |
| `prisma:generate:clean` | Windows PowerShell clean Prisma generate helper |

The `test:critical` command runs these five files:

- `src/common/filters/global-exception.filter.spec.ts`
- `src/users/users.service.spec.ts`
- `src/users/users.controller.spec.ts`
- `src/reservations/reservations.service.spec.ts`
- `src/borrows/borrow-scheduler.service.spec.ts`

### Web Scripts (`apps/web/package.json`)

| Script | Command |
| ------ | ------- |
| `dev` | `next dev -H 0.0.0.0` |
| `build` | `next build` |
| `start` | `next start` |
| `lint` | `next lint` |
| `lint:css` | `stylelint "**/*.css"` |
| `typecheck` | `npx tsc --noEmit` |
| `format` | `prettier --write "**/*.{js,jsx,ts,tsx,css,json}"` |

---

## Testing, Linting, Formatting, and Type Checking

### Backend Tests

- Unit and service/controller tests use Jest and `ts-jest`.
- E2E tests use Jest with `apps/api/test/jest-e2e.config.ts`.
- Test helpers live under `apps/api/test/helpers/` and `apps/api/src/test-utils/`.
- No frontend test runner is configured in `apps/web/package.json`.

Discovered test suites:

| Suite | Type | Coverage |
| ----- | ---- | -------- |
| `test/security.e2e-spec.ts` | E2E | Auth guards, password policy, rate limits, query validation (18 tests) |
| `test/reservations.e2e-spec.ts` | E2E | Full reservation lifecycle (20 tests) |
| `test/borrows.e2e-spec.ts` | E2E | Extend, return, overdue fine (8 tests) |
| `src/users/users.service.spec.ts` | Unit | Safe select, interests |
| `src/users/users.controller.spec.ts` | Unit | GET /users/:id access control |
| `src/books/book-document.service.spec.ts` | Unit | Document extraction |
| `src/books/books.service.spec.ts` | Unit | Books service |
| `src/reservations/reservations.service.spec.ts` | Unit | Service-layer concurrency |
| `src/borrows/borrow-scheduler.service.spec.ts` | Unit | Overdue and expiry scheduler |
| `src/ai/catalog-search.service.spec.ts` | Unit | Catalog search |
| `src/ai/ai-modes.spec.ts` | Unit | AI mode resolution logic |
| `src/ai/model-registry.spec.ts` | Unit | AI model registry and fallback behavior |
| `src/ai/agent.service.spec.ts` | Unit | Agent service |
| `src/materials/material-access.util.spec.ts` | Unit | Material access control |
| `src/common/filters/global-exception.filter.spec.ts` | Unit | Error contract shape |

### Common Verification Commands

```bash
# Type checking
npm run typecheck:api
npm run typecheck:web

# Critical backend tests (fast)
npm run test:api:critical

# Full backend unit suite
npm run test:api

# E2E backend tests (requires a running database)
npm run test:api:e2e
```

### Linting and Formatting

```bash
# Backend
cd apps/api
npm run lint
npm run format

# Frontend
cd apps/web
npm run lint
npm run lint:css
npm run format
```

---

## API Documentation and Discovered Endpoints

Swagger UI is available at:

```text
http://localhost:3001/api/docs
```

### Health

- `GET /health/live` — liveness probe
- `GET /health/ready` — readiness probe; checks DB and OpenRouter key presence

### Auth

- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/profile`
- `GET /auth/me`
- `POST /auth/register`
- `POST /auth/verify-email`
- `POST /auth/resend-verification`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `PATCH /auth/change-password`
- `GET /auth/google`
- `GET /auth/google/callback`
- `GET /auth/config`
- `GET /auth/health`

### Users

- `GET /users`
- `GET /users/stats`
- `PATCH /users/profile`
- `GET /users/:id`
- `PATCH /users/interests`
- `GET /users/preferences`
- `PATCH /users/preferences`
- `GET /users/export`
- `PATCH /users/:id/deactivate`
- `PATCH /users/:id/activate`

### Books

- `GET /books`
- `GET /books/categories`
- `GET /books/faculties`
- `GET /books/branches`
- `GET /books/:id`
- `POST /books`
- `PATCH /books/:id`
- `DELETE /books/:id`
- `POST /books/:id/copies`
- `POST /books/admin/reindex-pending-pdfs`
- `POST /books/:id/pdf`

### Reservations

- `GET /reservations/my`
- `GET /reservations/my/info`
- `GET /reservations/pending`
- `GET /reservations/stats`
- `GET /reservations`
- `POST /reservations`
- `PATCH /reservations/:id/cancel`
- `PATCH /reservations/:id/approve`
- `PATCH /reservations/:id/mark-ready`
- `PATCH /reservations/:id/reject`
- `GET /reservations/approved`
- `GET /reservations/ready`
- `PATCH /reservations/:id/collect`

### Borrows

- `GET /borrows/my`
- `GET /borrows/active`
- `GET /borrows/history`
- `GET /borrows/admin/active`
- `GET /borrows/admin/history`
- `GET /borrows/admin/most-borrowed`
- `GET /borrows/admin/trends`
- `GET /borrows/admin/statistics`
- `GET /borrows/stats`
- `GET /borrows`
- `PATCH /borrows/:id/extend`
- `PATCH /borrows/:id/return`

### Borrow Policies

- `GET /borrow-policies/me`
- `GET /borrow-policies`
- `PATCH /borrow-policies/:role`

### Branches

- `GET /branches`
- `POST /branches`
- `PATCH /branches/:id`
- `PATCH /branches/:id/activate`
- `PATCH /branches/:id/deactivate`

### Materials

- `GET /materials`
- `GET /materials/types`
- `GET /materials/my`
- `GET /materials/admin`
- `GET /materials/admin/stats`
- `GET /materials/:id`
- `POST /materials`
- `POST /materials/upload`
- `PATCH /materials/:id`
- `PATCH /materials/:id/approve`
- `POST /materials/:id/reindex`
- `POST /materials/admin/reindex-pending`
- `DELETE /materials/:id`

### Reading Lists

- `GET /reading-lists/my`
- `POST /reading-lists`
- `PATCH /reading-lists/:id`
- `DELETE /reading-lists/:id`
- `POST /reading-lists/:id/items`
- `DELETE /reading-lists/:id/items/:itemId`
- `GET /reading-lists/admin/all`
- `GET /reading-lists/feed`
- `GET /reading-lists/instructor/:instructorId`
- `GET /reading-lists/:id`

### Instructor Followers

- `GET /instructor-followers/my-following`
- `GET /instructor-followers/my-followers`
- `POST /instructor-followers/:instructorId/follow`
- `DELETE /instructor-followers/:instructorId/unfollow`
- `GET /instructor-followers/:instructorId/followers-count`
- `GET /instructor-followers/:instructorId/is-following`

### Notifications

- `GET /notifications`
- `GET /notifications/unread-count`
- `PATCH /notifications/:id/read`
- `PATCH /notifications/read-all`
- `DELETE /notifications/:id`
- `DELETE /notifications/clear-read`

### Fine Payments

- `GET /fine-payments/my`
- `GET /fine-payments`
- `GET /fine-payments/totals`
- `GET /fine-payments/:id`
- `PATCH /fine-payments/:id/pay`
- `PATCH /fine-payments/:id/waive`

### Dashboard

- `GET /dashboard/admin`
- `GET /dashboard/student`
- `GET /dashboard/instructor`
- `GET /dashboard/staff`
- `GET /dashboard/activity`
- `GET /dashboard/admin/user-distribution`
- `GET /dashboard/admin/ai-metrics`

### Reports

- `GET /reports/summary`
- `GET /reports/export`

### External Books

- `GET /external-books/search`
- `POST /external-books/import`
- `POST /external-books/check-existing`
- `POST /external-books/import/openlibrary`
- `POST /external-books/import/gutendex`

### AI

- `GET /ai/status`
- `GET /ai/conversations`
- `POST /ai/conversations`
- `DELETE /ai/conversations/:id`
- `GET /ai/history`
- `GET /ai/metrics`
- `GET /ai/models`
- `POST /ai/study`
- `PATCH /ai/conversations/:id/mode`
- `PATCH /ai/conversations/:id/model`
- `POST /ai/chat` (SSE streaming; rate-limited 15 requests/60s)
- `PATCH /ai/interests`
- `GET /ai/context`
- `POST /ai/scan-cover` (admin only)

---

## Security Considerations

Implemented security controls:

- Passwords are hashed with bcrypt/bcryptjs.
- Auth tokens are stored in HttpOnly cookies; `secure` and `sameSite` are set to production
  values when `NODE_ENV=production`.
- Frontend middleware verifies JWT signatures with HS256 before serving any `/dashboard/*`
  route; missing or invalid tokens redirect to `/login`.
- Backend JWT guard protects all authenticated endpoints.
- Backend roles guard enforces admin-only and instructor-only actions where declared.
- Login, registration, verification, password reset, and AI chat have explicit per-endpoint
  throttling in addition to the global throttler.
- Global validation pipe uses `whitelist`, `forbidNonWhitelisted`, and `transform`.
- Global exception filter returns a structured error envelope and avoids leaking internals
  for unknown errors.
- CORS is restricted by `CORS_ORIGIN`.
- Helmet is enabled (`contentSecurityPolicy`, `crossOriginEmbedderPolicy`, and
  `crossOriginResourcePolicy` are disabled for app compatibility).
- S3 startup configuration is validated when `STORAGE_PROVIDER=s3`; the API exits on failure.
- Local upload file reads are constrained to the `uploads` directory.
- Dev-mode Axios logging in the frontend redacts sensitive header keys.
- `POST /books` enforces a maximum of 50 copies per branch.

Operational security notes:

- Replace all demo secrets and Compose passwords before production.
- Use a long, random `JWT_SECRET` and keep the same value in API and web environments.
- Set `NODE_ENV=production` so auth cookies use production `secure`/`sameSite` behavior.
- Configure real SMTP for verification and reset emails in production.
- Configure production CORS origins explicitly in `CORS_ORIGIN`.
- Do not expose pgAdmin or the Python runner publicly without additional
  access controls.
- Review S3 bucket permissions and public URL behavior before enabling `STORAGE_PROVIDER=s3`.
- `OPENROUTER_API_KEY`, AWS credentials, SMTP credentials, Google OAuth secrets, and
  `JWT_SECRET` must never be committed to version control.

---

## Deployment and Production Notes

Documented in current code and configuration:

- API production start command: `node dist/src/main`
- Web build output is configured as Next.js `standalone`.
- Dockerfiles currently define development targets only; no production targets are present.
- Health checks are available at `/health/live` (liveness) and `/health/ready` (readiness).
- The API validates required JWT and S3 configuration at startup and exits if invalid.
- Swagger is available at `/api/docs` unless disabled by deployment infrastructure.
- Reports export PDF and Excel dependencies: `pdfkit` (root workspace) and `exceljs`
  (root workspace).

Not documented in the current repository:

- CI/CD pipeline definitions.
- Cloud hosting target or Kubernetes manifests.
- Production Docker Compose files.
- Reverse proxy or TLS termination configuration.
- Backup and restore procedures.
- Migration rollout procedure beyond local recovery notes.

Production checklist:

1. Set production environment variables for both apps.
2. Run `cd apps/api && npx prisma migrate deploy` to apply migrations.
3. Run `cd apps/api && npx prisma generate` if not using the build-stage client.
4. Only seed if intentionally deploying sample data.
5. Configure `FRONTEND_URL`, `CORS_ORIGIN`, SMTP, storage provider, and `OPENROUTER_API_KEY`.
6. Confirm `GET /health/ready` returns `"status": "ready"`.
7. Restrict database, pgAdmin, and Python runner network access.

---

## Troubleshooting

**API fails at startup with `JWT_SECRET must be configured`**

Set `JWT_SECRET` in `apps/api/.env`. Use at least 32 characters. Set the same value in
`apps/web/.env.local` for frontend middleware.

**Dashboard routes redirect to login even with a valid cookie**

Confirm `apps/web/.env.local` contains `JWT_SECRET` and that it matches the backend value.
The middleware verifies the JWT signature with HS256 and requires a `role` claim in the payload.

**Docker Compose fails because the Postgres volume is missing**

```bash
docker volume create library-system_edit_postgres_data
npm run docker:up
```

**API cannot connect to the database**

- Check the `DATABASE_URL` value.
- When running the API locally outside Docker with a Compose Postgres, use host `localhost`.
- Inside Docker the Compose service hostname is `postgres`.
- Run `npm run db:start` before starting the API locally.

**S3 startup validation fails**

If S3 is not needed locally, set `STORAGE_PROVIDER=local`. If S3 is needed, provide
`AWS_REGION`, `AWS_S3_BUCKET`, and AWS credentials discoverable by the AWS SDK credential
chain.

**AI status reports unavailable**

Set `OPENROUTER_API_KEY` in `apps/api/.env`. Check `GET /health/ready` — it reports
`"ai": "configured"` when the key is present.

**Semantic search does not behave like vector search**

The `hybrid` and `embedding` modes currently fall back to keyword search. Vector storage and
embedding generation are not implemented in the current schema or code.

**Email is not delivered locally**

An empty `SMTP_HOST` causes `MailService` to log emails to the console instead of sending
them. Configure the SMTP variables for real delivery.

**Prisma migration history is blocked**

See `docs/operations/prisma-migration-recovery.md`. Use `prisma migrate resolve` only when
the schema change is already present in the target database.

**Frontend API calls go to the wrong host**

The browser Axios client uses same-origin `/api`. Next.js rewrites `/api/:path*` and
`/uploads/:path*` to `NEXT_PUBLIC_API_URL`. Next.js route handlers use `API_URL` first,
then `NEXT_PUBLIC_API_URL`, then `http://localhost:3001`.

---

## Contributing Notes

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full workflow guide including branch naming,
commit message conventions, code style, PR checklist, and how to report bugs or request features.

Summary of conventions verified in `CONTRIBUTING.md`:

- Use TypeScript for all code.
- Follow the existing ESLint and Prettier configurations.
- Use descriptive branch names: `feature/...`, `fix/...`, `docs/...`, `refactor/...`.
- Use conventional commit messages: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`.

Recommended pre-PR verification:

```bash
npm run typecheck:api
npm run test:api:critical
npm run typecheck:web
cd apps/api && npm run lint
cd ../web && npm run lint
```

Architecture conventions:

- Backend features belong under `apps/api/src/<module>`.
- Add DTOs and `class-validator` decorators for new API inputs.
- Add Swagger decorators for new API endpoints.
- Register new backend modules in `AppModule`.
- Frontend pages belong under `apps/web/app`.
- Shared frontend API calls should use `apps/web/lib/api.ts`.
- Keep role checks aligned between backend guards and `apps/web/middleware.ts`.
- Add focused tests for business rules, security-sensitive paths, and regressions.
- Update this README when scripts, routes, environment variables, Docker services, or
  system behavior changes.
