# TESTING.md

## Purpose

This project has backend and frontend test harnesses that developers and AI agents can
use.

It is designed to:

- verify critical business rules without touching production code
- catch regressions in security, reservation logic, and error handling
- be readable enough for a human to understand failures quickly

Current scope:

- backend unit/service tests
- backend type checking
- frontend Vitest component/helper tests
- web type checking
- no DB-backed integration suite yet

---

## What Exists

Backend tests use:

- `jest`
- `ts-jest`

Frontend tests use:

- `vitest`

Coverage currently focuses on:

- standardized error contract
- safe user selects
- reservation conflict/limit/state-guard behavior
- scheduler reconciliation behavior
- AI mode resolution, model registry, model selection, and fallback behavior
- AI graph parsing/render helpers, chart labels, and AI Markdown normalization

Reusable test helpers live in:

- [create-prisma-mock.ts](../../apps/api/src/test-utils/create-prisma-mock.ts)
- [create-response-mock.ts](../../apps/api/src/test-utils/create-response-mock.ts)

---

## Commands

From repo root:

```powershell
npm run typecheck:api
npm run typecheck:web
npm run test:web
npm run test:api
npm run test:api:critical
npm run build:api
npm run build:web
```

From `apps/api`:

```powershell
npm run typecheck
npm run test:unit
npm run test:critical
npm run test:watch
npm run test:cov
npx nest build
```

From `apps/web`:

```powershell
npm run typecheck
npm run test
npm run build
```

Targeted AI model-selection tests:

```powershell
cd apps/api
npx jest --runInBand src/ai/model-registry.spec.ts
npx jest --runInBand src/ai/prompts/system-prompt-builder.spec.ts
npx jest --runInBand src/ai/python/python-execution.service.spec.ts
```

---

## Recommended Verification Flow

For a normal backend change:

```powershell
cd apps/api
npm run typecheck
npm run test:critical
npx nest build
```

For broader backend work:

```powershell
cd apps/api
npm run typecheck
npm run test:unit
npx nest build
```

For AI assistant behavior changes:

```powershell
npm run typecheck:api
npm run typecheck:web
cd apps/api
npx jest --runInBand src/ai/model-registry.spec.ts
```

For frontend AI renderer changes, also run:

```powershell
npm run typecheck:web
npm run test:web
npm run build:web
```

For Python runner changes, also run:

```powershell
cd apps/python-runner
python -m pytest
```

---

## How To Read Failures

When a test fails:

1. Read the suite name
2. Read the test name
3. Read the assertion error
4. Compare expected behavior vs actual behavior
5. Open the referenced service or filter and inspect the relevant path

Good test names describe behavior directly.

Examples:
- `maps reservation unique-index collisions to ConflictException`
- `uses an explicit safe select for findById`
- `returns the standardized error envelope for HttpException`

---

## What These Tests Prove

They help confirm:

- security-sensitive fields are not loaded into API-facing user queries
- reservation uniqueness conflicts are surfaced correctly
- borrow-limit enforcement and reject-state guards behave correctly
- the global error contract keeps the expected shape
- scheduler reconciliation paths still perform the expected transitions
- AI model allowlisting, manual selection, capability fallback, and sequential
  state behavior remain stable
- frontend AI rendering helpers and graph/chart/Markdown normalization remain stable

They do **not** yet prove:

- full HTTP wiring
- real database behavior under concurrency
- full browser behavior
- visual correctness of Markdown, KaTeX, Plotly, or Mermaid rendering beyond the existing unit tests
- container-level Python sandboxing beyond the runner's application-level
  validation and subprocess timeout

Those would require integration and end-to-end tests later.

---

## Best Use For AI Agents

AI agents should use these commands after backend changes:

```powershell
cd apps/api
npm run typecheck
npm run test:critical
npx nest build
```

If the change is broad:

```powershell
cd apps/api
npm run test:unit
```

For AI assistant behavior changes, agents should also run the targeted model
registry suite and update README or operations docs when behavior, endpoints,
model configuration, or verification steps change.

Agents should treat green tests as evidence of preserved behavior, not as
proof that all production risks are gone.

---

## Best Use For Developers

Use:

- `test:critical` for fast confidence
- `test:unit` before merges or larger changes
- `test:watch` while iterating locally
- `test:cov` when you want to see what remains untested

---

## Next Logical Test Upgrades

If more time is available, add:

1. Nest API integration tests with Supertest
2. A dedicated test Postgres database with Prisma migrations
3. Critical flow integration tests for auth, reservations, borrows, and role
   enforcement
4. Later, Playwright smoke tests for core frontend flows
5. Playwright checks for AI assistant Markdown, math, graph, and Mermaid output
