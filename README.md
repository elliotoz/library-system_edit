# Library System

AI-integrated university library system for catalog management, borrowing, reservations, instructor reading lists, study materials, notifications, fines, reports, and an OpenRouter-backed library assistant.

This README is based on the current repository code, configuration, Docker files, Prisma schema, frontend routes, backend controllers, AI services, tests, and operational docs. Items that are not present in the current repository are marked as not documented.

## Project Overview

This repository is a Node.js monorepo with two applications:

- `apps/api`: NestJS API, Prisma ORM, PostgreSQL, JWT cookie authentication, Swagger, document extraction, S3/local upload support, scheduled borrow/reservation reconciliation, and AI assistant services.
- `apps/web`: Next.js 14 App Router frontend with protected dashboard routes, role-aware navigation, API proxy rewrites, and AI chat route handlers.

Primary local ports:

| Service | Port | Source |
|---|---:|---|
| Web app | `3000` | `apps/web/package.json`, `apps/web/Dockerfile` |
| API | `3001` | `apps/api/.env.example`, `apps/api/Dockerfile` |
| PostgreSQL | `5432` | `docker-compose.yml` |
| pgAdmin | `5050` | `docker-compose.yml` |

## Current Feature Set

- Email/password authentication with email verification, password reset, and password change.
- Optional Google OAuth login when Google credentials are configured.
- HttpOnly `access_token` cookie sessions with JWT verification.
- Role model: `STUDENT`, `INSTRUCTOR`, `STAFF`, `ADMIN`.
- Role-protected frontend dashboard routes and backend guards.
- Book catalog with metadata, authors, ISBN, faculty/category/subject tags, cover images, e-book URLs, PDF URLs, copies, branches, and availability state.
- Book copy and branch management.
- Reservation lifecycle: `PENDING`, `APPROVED`, `READY_FOR_PICKUP`, `COLLECTED`, `CANCELLED`, `EXPIRED`.
- Borrow lifecycle: `ACTIVE`, `RETURNED`, `OVERDUE`, extensions, and return handling.
- Borrow policies by role.
- Fine payments with `PENDING`, `PAID`, and `WAIVED` states.
- Notifications with unread counts, read/delete operations, and reservation/borrow/list/system notification types.
- Instructor reading lists with visibility and publication status.
- Instructor following/follower features.
- Professor/course/research material upload, approval, publishing, access controls, indexing, and search.
- Reports export endpoints for PDF and Excel.
- External book search/import endpoints for OpenLibrary and Gutendex.
- Admin dashboards for users, books, branches, borrows, reservations, fines, materials, policies, reports, statistics, uploads, and imports.
- AI assistant with conversations, saved messages, streaming SSE chat, study sessions, model selection state, response modes, tool calling, catalog access, reading-list access, borrow/reservation/stat lookups, study-material search, e-book/PDF reading, webpage fetching, and admin book-cover scanning.
- Swagger API documentation at `/api/docs`.
- Health probes at `/health/live`, `/health/ready`, and `/auth/health`.

## User Experience and Main User Journeys

Public and auth journeys:

- A visitor can open `/`, sign up at `/signup`, verify email at `/verify-email`, log in at `/login`, request reset at `/forgot-password`, and reset a password at `/reset-password`.
- Login sets an HttpOnly `access_token` cookie and redirects users to the role dashboard.
- Google sign-in is shown only when configured by backend auth config.

Student and general authenticated journeys:

- Browse `/dashboard/catalog`, inspect `/dashboard/catalog/[id]`, reserve available copies, review active borrows at `/dashboard/borrowed`, review history at `/dashboard/history`, manage reservations at `/dashboard/reservations`, view fines at `/dashboard/fines`, and manage profile/settings/notifications.
- Use `/dashboard/ai-assistant` to ask catalog, borrowing, reading-list, study-material, and study-session questions.
- Browse published reading lists at `/dashboard/reading-lists` and details at `/dashboard/reading-lists/[id]`.
- View instructor profiles at `/dashboard/instructors/[id]`.

Instructor journeys:

- Use `/dashboard/instructor`.
- Submit materials at `/dashboard/instructor/submit-material`.
- Review own submissions at `/dashboard/instructor/my-submissions`.
- Create/manage reading lists at `/dashboard/instructor/reading-lists` and `/dashboard/instructor/reading-lists/[id]`.
- View followed instructors at `/dashboard/instructor/following`.

Staff journeys:

- Use `/dashboard/staff`.
- Access shared catalog, borrows, reservations, AI assistant, profile, notifications, reading-list, and settings surfaces allowed by frontend middleware.

Admin journeys:

- Use `/dashboard/admin`.
- Manage books, users, branches, borrows, reservations, fines, materials, reading lists, policies, reports, statistics, uploads, and external book imports.
- Scan book-cover images through the admin-only AI cover scan endpoint.

## Functional Requirements

Implemented requirements visible in code:

- Users must authenticate before accessing `/dashboard/*`.
- Dashboard access is role-gated in `apps/web/middleware.ts`.
- Backend endpoints are protected with JWT guards, role guards, and public decorators.
- New local users must verify email before login.
- Password reset uses opaque reset tokens and generic outward messages.
- Admins can activate/deactivate users.
- Books can have multiple physical copies across active library branches.
- Reservations are user/book-copy/book/branch scoped and include a server-derived `bookId`.
- Borrow policies limit active borrows, borrow days, extension count, and extension days by role.
- Returning overdue borrows creates pending fine records.
- Scheduler service reconciles overdue borrows and expired reservations.
- Materials have publication/approval state, access level, and indexing state.
- AI assistant must use tools for live library data questions and should not guess catalog/statistical values.
- API request validation strips non-whitelisted fields and rejects non-whitelisted input.

## Non-Functional Requirements

Implemented or configured requirements visible in code:

- TypeScript across frontend and backend.
- PostgreSQL persistence through Prisma.
- Global structured error contract with `success: false`, `message`, `requestId`, and `timestamp`.
- Request ID and request logging middleware.
- Configurable log level and SQL logging.
- Helmet middleware enabled with selected cross-origin policies disabled for app compatibility.
- CORS allowlist via `CORS_ORIGIN`.
- Cookie-based auth with `secure`/`sameSite` adjusted for production.
- Global and endpoint-level rate limiting via `@nestjs/throttler`.
- Startup validation for `JWT_SECRET` length and S3 configuration.
- Swagger-generated API docs.
- Docker development targets for API and web.
- Backend unit and e2e test coverage for selected critical paths.
- Frontend output configured as Next standalone build.

Not documented in the current repository:

- Formal uptime, latency, RPO/RTO, data retention, backup, observability, accessibility, or browser support targets.
- CI/CD pipeline definitions.

## Monorepo Structure

```text
.
├── apps
│   ├── api                  # NestJS backend
│   │   ├── prisma           # Prisma schema, migrations, seed scripts
│   │   ├── scripts          # Prisma helper scripts
│   │   ├── src              # API modules/controllers/services
│   │   ├── test             # E2E tests and helpers
│   │   └── uploads          # Local upload directory if using local storage
│   └── web                  # Next.js frontend
│       ├── app              # App Router pages and route handlers
│       ├── components       # UI and dashboard components
│       ├── hooks            # React hooks
│       ├── lib              # API clients, AI options, helpers
│       ├── public           # Static assets
│       └── types            # Shared frontend types
├── docs/operations          # Testing and migration recovery notes
├── docker-compose.yml
├── package.json             # Root workspace scripts
└── README.md
```

The root `package.json` declares workspaces for `apps/*` and `packages/*`; no `packages` directory is present in the current repository.

## Frontend Architecture

The frontend is a Next.js 14 App Router application.

Key implementation files:

- `apps/web/app`: pages, layouts, global error boundary, and API route handlers.
- `apps/web/middleware.ts`: JWT cookie verification and role-based dashboard route access.
- `apps/web/lib/api.ts`: browser Axios client using same-origin `/api` with credentials.
- `apps/web/lib/server-api.ts`: server route-handler backend URL resolution.
- `apps/web/next.config.js`: standalone output, `three` transpilation, `/api` and `/uploads` rewrites to the backend.
- `apps/web/tailwind.config.ts`: Tailwind theme, role colors, and UI tokens.
- `apps/web/components/ui`: local UI primitives and visual components.

Frontend environment:

- `API_URL`: server-side backend URL for Next route handlers.
- `NEXT_PUBLIC_API_URL`: backend URL used by rewrites and browser-visible diagnostics.
- `NEXT_PUBLIC_APP_NAME`: app display name.
- `JWT_SECRET`: must match backend `JWT_SECRET` for middleware JWT signature verification.

Discovered frontend pages:

| Route | Purpose inferred from code path |
|---|---|
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
| `/dashboard/catalog` | Catalog search/list |
| `/dashboard/catalog/[id]` | Book detail |
| `/dashboard/borrowed` | Current borrowed books |
| `/dashboard/history` | Borrow history |
| `/dashboard/reservations` | User reservations |
| `/dashboard/fines` | User fines |
| `/dashboard/materials` | Materials |
| `/dashboard/reading-lists` | Reading-list feed |
| `/dashboard/reading-lists/[id]` | Reading-list detail |
| `/dashboard/instructors/[id]` | Instructor profile |
| `/dashboard/ai-assistant` | AI assistant chat |
| `/dashboard/notifications` | Notifications |
| `/dashboard/profile` | User profile |
| `/dashboard/settings` | User settings |
| `/dashboard/instructor/my-submissions` | Instructor material submissions |
| `/dashboard/instructor/submit-material` | Submit material |
| `/dashboard/instructor/following` | Followed instructors |
| `/dashboard/instructor/reading-lists` | Instructor reading lists |
| `/dashboard/instructor/reading-lists/[id]` | Instructor reading-list editor/detail |
| `/dashboard/admin/books` | Admin book management |
| `/dashboard/admin/books/new` | New book |
| `/dashboard/admin/books/[id]/edit` | Edit book |
| `/dashboard/admin/users` | Admin user management |
| `/dashboard/admin/branches` | Branch management |
| `/dashboard/admin/borrows` | Admin borrow management |
| `/dashboard/admin/reservations` | Admin reservation management |
| `/dashboard/admin/fines` | Admin fine management |
| `/dashboard/admin/materials` | Admin material moderation |
| `/dashboard/admin/reading-lists` | Admin reading-list moderation |
| `/dashboard/admin/policies` | Borrow policy management |
| `/dashboard/admin/reports` | Reports |
| `/dashboard/admin/statistics` | Statistics |
| `/dashboard/admin/import-books` | External book imports |
| `/dashboard/admin/upload` | Admin uploads |

Frontend API route handlers proxy selected AI calls to the backend:

- `GET /api/ai/conversations`
- `POST /api/ai/conversations`
- `DELETE /api/ai/conversations/[id]`
- `PATCH /api/ai/conversations/[id]/mode`
- `GET /api/ai/history`
- `POST /api/ai/study`
- `POST /api/ai/chat` with SSE passthrough

## Backend Architecture

The backend is a NestJS API using Prisma and PostgreSQL.

Key implementation files:

- `apps/api/src/main.ts`: startup validation, Helmet, body limits, cookie parser, CORS, static uploads, global filters/pipes, Swagger.
- `apps/api/src/app.module.ts`: module composition and global request middleware.
- `apps/api/src/prisma/prisma.service.ts`: database URL construction and Prisma logging.
- `apps/api/src/common`: global exception filter and request middleware.
- `apps/api/src/auth`: local auth, Google OAuth, JWT strategy, decorators, and guards.
- `apps/api/src/storage`: local/S3 upload and document buffer access.
- `apps/api/src/mail`: SMTP or dev-console email sending.
- `apps/api/src/ai`: assistant, providers, prompt builders, tools, modes, token tracking, search.

Registered backend modules:

- `AuthModule`
- `UsersModule`
- `BooksModule`
- `BorrowsModule`
- `ReservationsModule`
- `DashboardModule`
- `NotificationsModule`
- `MaterialsModule`
- `ReadingListsModule`
- `InstructorFollowersModule`
- `AiModule`
- `StorageModule`
- `HealthModule`
- `BranchesModule`
- `BorrowPoliciesModule`
- `FinePaymentsModule`
- `ReportsModule`
- `ExternalBooksModule`
- `PrismaModule`
- `MailModule`

## AI Assistant Integration

The active AI assistant path is OpenRouter-backed.

Required key for active AI features:

- `OPENROUTER_API_KEY`

The `.env.example` does not currently list `OPENROUTER_API_KEY`, but the active `OpenRouterProvider`, `AgentService`, health readiness check, and auth config all check for it. Add it to `apps/api/.env` when enabling AI.

Provider code present:

- `OpenRouterProvider`: active provider used by `ProviderFactory` and `AgentService`.
- `GroqProvider`: provider class present and uses `GROQ_API_KEY`, but not wired into `AiModule` providers or `ProviderFactory`.
- `GeminiProvider`: provider class present and uses `GEMINI_API_KEY`, but not wired into `AiModule` providers or `ProviderFactory`.

Model options discovered in code:

| Tier / UI option | Model id |
|---|---|
| Free/simple | `google/gemma-4-31b-it:free` |
| Cheap/tool/vision | `google/gemini-3.1-flash-lite-preview` |
| Smart/deep/study | `anthropic/claude-3-haiku` |
| Cover scan vision | `google/gemini-2.0-flash-lite` |

AI conversation features:

- Conversation list/create/delete.
- Message history.
- Dedicated study sessions tied to a `Book`.
- Saved conversation mode state: manual modes, auto modes, study-session state.
- Saved conversation model state: manual model, resolved model, selection source.
- Token usage metrics per user/conversation in memory through `TokenTrackerService`.
- SSE streaming response endpoint at `POST /ai/chat`.

Response modes:

- `learning`
- `explanatory`
- `planning`
- `formal`
- `concise`

AI tools:

- `search_catalog`
- `get_book_details`
- `read_ebook`
- `fetch_webpage`
- `get_my_borrows`
- `get_catalog_stats`
- `get_active_borrows`
- `get_active_reservations`
- `get_user_stats`
- `get_reading_lists`
- `get_my_reading_lists`
- `search_study_material`
- `list_study_materials`
- `get_chunk_context`
- `get_material_outline`

RAG and retrieval behavior:

- Catalog search is keyword-first. `AI_SEMANTIC_MODE` accepts `keyword`, `hybrid`, or `embedding`; `hybrid` and `embedding` currently fall back to keyword search because vector infrastructure is not implemented.
- Material indexing extracts `.pdf`, `.docx`, `.doc`, and `.txt`, chunks content into about 400-word chunks with 40-word overlap, stores chunks in `MaterialChunk`, and searches them with PostgreSQL full-text search.
- Material search enforces access controls by role, uploader, public access, faculty, and course code.
- Book PDF indexing extracts text into `Book.pdfExtractedText`, tracks page count and index status, and is used by `read_ebook`.
- Embedding generation is a stub returning `null`; pgvector/vector columns are not present in the current Prisma schema.

Prompt behavior:

- The system prompt is built from role-specific base instructions and few-shot examples.
- It injects current user context, active borrows, borrow policy, catalog totals, available copies, published reading-list count, indexed material count, and current date.
- It explicitly instructs the assistant to use tools for live library data, catalog searches, reading lists, borrows, reservations, stats, and study material retrieval.

## Docker Setup

`docker-compose.yml` defines:

| Service | Image/build | Container | Exposed port | Notes |
|---|---|---|---:|---|
| `postgres` | `postgres:15-alpine` | `library_db` | `5432` | Uses external volume `library-system_edit_postgres_data` |
| `api` | `./apps/api` target `development` | `library_api` | `3001` | Depends on healthy Postgres |
| `web` | `./apps/web` target `development` | `library_web` | `3000` | Depends on API |
| `pgadmin` | `dpage/pgadmin4:latest` | `library_pgadmin` | `5050` | Default login from Compose |

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

Important: the Compose file uses an external volume:

```yaml
volumes:
  postgres_data:
    name: library-system_edit_postgres_data
    external: true
```

Create it before first `docker-compose up` if it does not exist:

```bash
docker volume create library-system_edit_postgres_data
```

The API Dockerfile installs dependencies and runs `npx prisma generate`; the development command is `npm run start:dev`. The web Dockerfile runs `npm run dev`.

## Database Setup

Database stack:

- PostgreSQL
- Prisma ORM
- Prisma Client generator with binary targets: `native`, `debian-openssl-3.0.x`, `windows`

Schema source:

- `apps/api/prisma/schema.prisma`

Main Prisma models:

- `User`
- `Faculty`
- `LibraryBranch`
- `Course`
- `Book`
- `BookCopy`
- `BorrowPolicy`
- `Reservation`
- `Borrow`
- `Material`
- `MaterialChunk`
- `Notification`
- `ReadingList`
- `ReadingListItem`
- `InstructorFollower`
- `FinePayment`
- `AiConversation`
- `AiMessage`

Enums:

- `Role`
- `BookCopyStatus`
- `ReservationStatus`
- `BorrowStatus`
- `MaterialType`
- `AccessLevel`
- `IndexStatus`
- `AuthProvider`
- `ReadingListVisibility`
- `ReadingListStatus`
- `FineStatus`
- `NotificationType`

Migration files are present under `apps/api/prisma/migrations`, from `20251209213528_init` through `20260505170000_add_ai_conversation_model_state`.

Database commands from root:

```bash
npm run db:start
npm run db:stop
npm run db:studio
npm run db:migrate
npm run db:seed
npm run db:reset
```

API-level Prisma commands:

```bash
cd apps/api
npm run prisma:generate
npm run prisma:migrate
npm run prisma:studio
npm run prisma:seed
npm run prisma:generate:clean
```

Seed data:

- `apps/api/prisma/seed.ts` clears core tables and seeds branches, faculties, borrow policies, users, books, book copies, and sample borrows.
- Default seeded password is `password123`.
- Seeded dev accounts include:
  - Student: `efe.demir@std.uskudar.edu.tr`
  - Instructor: `kemal.sahin@uskudar.edu.tr`
  - Staff: `ayse.yildiz@uskudar.edu.tr`
  - Admin: `admin@uskudar.edu.tr`

Additional script:

- `apps/api/prisma/add-books.ts`: standalone `npx ts-node prisma/add-books.ts` script to add or update 8 test books. It is not wired into `package.json`.

## Environment Variables

Backend variables from `apps/api/.env.example` and code:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Prisma/PostgreSQL connection string |
| `POSTGRES_HOST` | Optional DB host used by `PrismaService` when `DATABASE_URL` is absent |
| `POSTGRES_USER` | Optional DB user fallback |
| `POSTGRES_PASSWORD` | Optional DB password fallback |
| `POSTGRES_DB` | Optional DB name fallback |
| `POSTGRES_PORT` | Optional DB port fallback |
| `DOCKER_ENV` | Uses `postgres` as fallback DB host when `true` |
| `JWT_SECRET` | JWT signing secret; startup requires at least 32 characters |
| `JWT_EXPIRATION` | JWT expiration config |
| `PORT` | API port, default `3001` |
| `NODE_ENV` | Runtime environment |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | Google OAuth callback URL |
| `CORS_ORIGIN` | Comma-separated allowed frontend origins |
| `FRONTEND_URL` | Canonical frontend URL for OAuth and email links |
| `UPLOAD_DIR` | Listed in example; static serving uses `./uploads` from API process cwd |
| `OLLAMA_BASE_URL` | Listed in example; active embedding implementation is not wired |
| `ANTHROPIC_API_KEY` | Listed in example; active AI path uses OpenRouter |
| `LLM_PROVIDER_PREFERENCE` | Listed in example; no active provider switching found |
| `OPENROUTER_API_KEY` | Required by active AI provider; checked in code but missing from `.env.example` |
| `GROQ_API_KEY` | Used only by unused `GroqProvider` class |
| `GEMINI_API_KEY` | Used only by unused `GeminiProvider` class |
| `AI_SEMANTIC_MODE` | `keyword`, `hybrid`, or `embedding`; default `hybrid` |
| `AI_EMBEDDINGS_ENABLED` | Listed in example; no active code path found |
| `STORAGE_PROVIDER` | `local` or `s3` |
| `AWS_REGION` | S3 region |
| `AWS_S3_BUCKET` | S3 bucket |
| `AWS_ACCESS_KEY_ID` | AWS SDK credential chain input |
| `AWS_SECRET_ACCESS_KEY` | AWS SDK credential chain input |
| `AWS_S3_PUBLIC_BASE_URL` | Optional public S3 base URL override |
| `THROTTLE_TTL` | Global rate-limit window in seconds |
| `THROTTLE_LIMIT` | Global rate-limit max requests |
| `THROTTLE_AUTH_LIMIT` | Listed in example; auth controllers use inline throttles |
| `THROTTLE_AI_LIMIT` | Listed in example; AI controller uses inline throttle |
| `MONITOR_OLLAMA` | Listed in example; readiness currently checks DB and OpenRouter key only |
| `LOG_LEVEL` | Nest logger level |
| `ENABLE_REQUEST_LOGGING` | Disable request logs when `false` |
| `LOG_SQL` | Enable Prisma query logs when `true` |
| `SMTP_HOST` | SMTP host; empty means dev/console behavior |
| `SMTP_PORT` | SMTP port |
| `SMTP_USER` | SMTP user |
| `SMTP_PASS` | SMTP password |
| `SMTP_FROM` | Sender address |

Frontend variables from `apps/web/.env.example` and code:

| Variable | Purpose |
|---|---|
| `API_URL` | Server-side backend URL for route handlers |
| `NEXT_PUBLIC_API_URL` | Backend URL used by rewrites/browser-visible config |
| `NEXT_PUBLIC_APP_NAME` | Display name |
| `JWT_SECRET` | Must match API `JWT_SECRET` for middleware verification |

## Local Development Setup

Prerequisites:

- Node.js 20 is expected by Dockerfiles.
- npm.
- Docker and Docker Compose for PostgreSQL or full container development.

Install dependencies from the repository root:

```bash
npm install
```

Create env files:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Set matching `JWT_SECRET` values in both API and web env files. The API requires at least 32 characters.

Start only PostgreSQL:

```bash
npm run db:start
```

Run migrations and seed:

```bash
npm run db:migrate
npm run db:seed
```

Start both apps in development:

```bash
npm run dev
```

The root `dev` command starts the API first, waits for `http://localhost:3001/health/live`, then starts the web app.

Manual app startup:

```bash
npm run dev:api
npm run dev:web
```

Open:

- Web: `http://localhost:3000`
- API: `http://localhost:3001`
- Swagger: `http://localhost:3001/api/docs`
- pgAdmin with Compose: `http://localhost:5050`

## Available Scripts

Root scripts from `package.json`:

| Script | Command |
|---|---|
| `dev` | `concurrently "npm run dev:api" "wait-on http://localhost:3001/health/live && npm run dev:web"` |
| `dev:api` | `cd apps/api && npm run start:dev` |
| `dev:web` | `cd apps/web && npm run dev` |
| `build` | `npm run build:api && npm run build:web` |
| `build:api` | `cd apps/api && npm run build` |
| `build:web` | `cd apps/web && npm run build` |
| `typecheck:api` | `cd apps/api && npm run typecheck` |
| `typecheck:web` | `cd apps/web && npm run typecheck` |
| `test:api` | `cd apps/api && npm run test:unit` |
| `test:api:critical` | `cd apps/api && npm run test:critical` |
| `test:api:e2e` | `cd apps/api && npm run test:e2e` |
| `db:start` | `docker-compose up -d postgres` |
| `db:stop` | `docker-compose down` |
| `db:studio` | `cd apps/api && npx prisma studio` |
| `db:migrate` | `cd apps/api && npx prisma migrate dev` |
| `db:seed` | `cd apps/api && npx prisma db seed` |
| `db:reset` | `cd apps/api && npx prisma migrate reset` |
| `docker:up` | `docker-compose up -d` |
| `docker:down` | `docker-compose down` |
| `docker:logs` | `docker-compose logs -f` |
| `dev:lan` | `concurrently "npm run dev:api" "wait-on http://localhost:3001/health/live && npm run dev:web"` |
| `clean` | `rimraf node_modules apps/*/node_modules packages/*/node_modules` |

API scripts from `apps/api/package.json`:

| Script | Command |
|---|---|
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
| `test:critical` | `jest --runInBand src/common/filters/global-exception.filter.spec.ts src/users/users.service.spec.ts src/users/users.controller.spec.ts src/reservations/reservations.service.spec.ts src/borrows/borrow-scheduler.service.spec.ts` |
| `test:watch` | `jest --watch` |
| `test:cov` | `jest --coverage` |
| `test:e2e` | `jest --config test/jest-e2e.config.ts --runInBand --no-coverage` |
| `prisma:generate` | `prisma generate` |
| `prisma:migrate` | `prisma migrate dev` |
| `prisma:studio` | `prisma studio` |
| `prisma:seed` | `prisma db seed` |
| `covers:backfill` | `ts-node src/scripts/backfill-book-covers.ts` |
| `prisma:generate:clean` | `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prisma-generate-clean.ps1` |

Web scripts from `apps/web/package.json`:

| Script | Command |
|---|---|
| `dev` | `next dev -H 0.0.0.0` |
| `build` | `next build` |
| `start` | `next start` |
| `lint` | `next lint` |
| `lint:css` | `stylelint "**/*.css"` |
| `typecheck` | `npx tsc --noEmit` |
| `format` | `prettier --write "**/*.{js,jsx,ts,tsx,css,json}"` |

## Testing, Linting, Formatting, and Type Checking

Backend tests:

- Unit/service/controller tests use Jest and `ts-jest`.
- E2E tests use Jest with `apps/api/test/jest-e2e.config.ts`.
- Test helpers live under `apps/api/test/helpers` and `apps/api/src/test-utils`.

Discovered test suites:

- `apps/api/test/security.e2e-spec.ts`
- `apps/api/test/reservations.e2e-spec.ts`
- `apps/api/test/borrows.e2e-spec.ts`
- `apps/api/src/users/users.service.spec.ts`
- `apps/api/src/users/users.controller.spec.ts`
- `apps/api/src/books/book-document.service.spec.ts`
- `apps/api/src/books/books.service.spec.ts`
- `apps/api/src/reservations/reservations.service.spec.ts`
- `apps/api/src/borrows/borrow-scheduler.service.spec.ts`
- `apps/api/src/ai/catalog-search.service.spec.ts`
- `apps/api/src/ai/ai-modes.spec.ts`
- `apps/api/src/ai/agent.service.spec.ts`
- `apps/api/src/materials/material-access.util.spec.ts`
- `apps/api/src/common/filters/global-exception.filter.spec.ts`

Common verification commands:

```bash
npm run typecheck:api
npm run test:api:critical
npm run test:api:e2e
npm run typecheck:web
```

Formatting and linting:

```bash
cd apps/api
npm run lint
npm run format

cd ../web
npm run lint
npm run lint:css
npm run format
```

No frontend test runner is configured in `apps/web/package.json`.

## API Documentation and Discovered Endpoints

Swagger is generated at:

```text
GET /api/docs
```

Health:

- `GET /health/live`
- `GET /health/ready`
- `GET /auth/health`

Discovered backend endpoints:

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
- `POST /ai/study`
- `PATCH /ai/conversations/:id/mode`
- `POST /ai/chat`
- `PATCH /ai/interests`
- `GET /ai/context`
- `POST /ai/scan-cover`

## Security Considerations

Implemented security controls:

- Passwords are hashed with bcrypt/bcryptjs.
- Auth tokens are stored in HttpOnly cookies.
- Frontend middleware verifies JWT signatures with HS256 before serving dashboard routes.
- Backend JWT guard protects authenticated endpoints.
- Backend roles guard enforces admin/instructor-only actions where declared.
- Login, registration, verification, password reset, and AI chat have explicit throttling.
- Global validation pipe uses `whitelist`, `forbidNonWhitelisted`, and `transform`.
- Global exception filter avoids leaking internals for unknown errors.
- CORS is restricted by `CORS_ORIGIN`.
- Helmet is enabled.
- S3 startup config is validated when `STORAGE_PROVIDER=s3`.
- Local upload file reads are constrained to the `uploads` directory.
- Dev request logs redact sensitive keys in frontend Axios logging.

Operational security notes:

- Replace all demo secrets and Compose passwords before production.
- Use a long, random `JWT_SECRET` and keep the same value in API and web environments.
- Set `NODE_ENV=production` so auth cookies use production `secure`/`sameSite` behavior.
- Configure real SMTP for verification and reset emails in production.
- Configure production CORS origins explicitly.
- Do not expose pgAdmin publicly without additional access controls.
- Review S3 bucket permissions and public URL behavior before enabling `STORAGE_PROVIDER=s3`.
- `OPENROUTER_API_KEY`, AWS credentials, SMTP credentials, Google secrets, and JWT secrets must not be committed.

## Deployment or Production Notes

Documented in code/config:

- API production start command: `node dist/src/main`.
- Web build output is configured as Next `standalone`.
- Dockerfiles currently define development targets only.
- Health checks available at `/health/live` and `/health/ready`.
- The API validates required JWT/S3 configuration on startup.
- Swagger is available at `/api/docs` unless disabled by deployment infrastructure.
- Reports export PDF/Excel dependencies include `pdfkit` and `exceljs`.

Not documented in the current repository:

- CI/CD pipeline.
- Cloud hosting target.
- Production Docker Compose or Kubernetes manifests.
- Reverse proxy configuration.
- TLS termination.
- Backup/restore process.
- Migration rollout procedure beyond local Prisma recovery notes in `docs/operations/prisma-migration-recovery.md`.

Production checklist:

- Set production env vars for both apps.
- Run `cd apps/api && npx prisma migrate deploy`.
- Run `cd apps/api && npx prisma generate` or use the generated client from build.
- Seed only if intentionally deploying sample data.
- Configure `FRONTEND_URL`, `CORS_ORIGIN`, SMTP, storage, and OpenRouter.
- Confirm `/health/ready` returns ready.
- Restrict database and pgAdmin network access.

## Troubleshooting

API fails at startup with `JWT_SECRET must be configured`:

- Set `JWT_SECRET` in `apps/api/.env`.
- Use at least 32 characters.
- Set the same value in `apps/web/.env.local` for middleware.

Dashboard routes redirect to login even with a cookie:

- Confirm `apps/web/.env.local` has `JWT_SECRET`.
- Confirm it matches the backend.
- Confirm the token was signed with HS256 and has a `role` claim.

Docker Compose fails because the Postgres volume is missing:

```bash
docker volume create library-system_edit_postgres_data
npm run docker:up
```

API cannot connect to the database:

- Check `DATABASE_URL`.
- If running API outside Docker with Compose Postgres, use host `localhost`.
- If running inside Docker, the Compose environment uses host `postgres`.
- Run `npm run db:start` before local API startup.

S3 startup validation fails:

- If S3 is not needed locally, set `STORAGE_PROVIDER=local`.
- If S3 is needed, set `AWS_REGION`, `AWS_S3_BUCKET`, and AWS credentials discoverable by the AWS SDK.

AI status is unavailable:

- Set `OPENROUTER_API_KEY` in `apps/api/.env`.
- Check `/health/ready`; it reports AI as `configured` or `not configured`.

AI semantic search does not behave like vector search:

- Current `hybrid` and `embedding` modes fall back to keyword search. Vector storage and embedding generation are not implemented in the current schema/code.

Email is not sent locally:

- Empty `SMTP_HOST` means development behavior. Configure SMTP variables for real delivery.

Prisma migration history is blocked:

- See `docs/operations/prisma-migration-recovery.md`.
- Only use `prisma migrate resolve` when the schema change is already present in the target database.

Frontend API calls go to the wrong host:

- The browser client uses same-origin `/api`.
- Next rewrites `/api/:path*` and `/uploads/:path*` to `NEXT_PUBLIC_API_URL`.
- Next route handlers use `API_URL` first, then `NEXT_PUBLIC_API_URL`, then `http://localhost:3001`.

## Contributing Notes

Use the existing architecture and module boundaries:

- Backend features belong under `apps/api/src/<module>`.
- Add DTOs and validation for new API inputs.
- Add or update Swagger decorators for API endpoints.
- Add modules to `AppModule` when creating new backend modules.
- Frontend pages belong under `apps/web/app`.
- Shared frontend API calls should use `apps/web/lib/api.ts`.
- Keep role checks aligned between backend guards and `apps/web/middleware.ts`.
- Add focused tests for business rules, security-sensitive paths, and regressions.
- Update this README when scripts, routes, env vars, Docker services, or behavior changes.

Conventions from `CONTRIBUTING.md`:

- Use TypeScript.
- Follow ESLint and Prettier configuration.
- Use descriptive branch names such as `feature/...`, `fix/...`, `docs/...`, and `refactor/...`.
- Use conventional commit-style messages such as `feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`, and `test: ...`.

Recommended pre-PR checks:

```bash
npm run typecheck:api
npm run test:api:critical
npm run typecheck:web
cd apps/api && npm run lint
cd ../web && npm run lint
```
