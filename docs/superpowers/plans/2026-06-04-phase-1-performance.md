# Phase 1 Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved Phase 1 performance and reliability changes without changing UI design or broad dashboard architecture.

**Architecture:** Keep dashboard behavior intact while improving perceived loading, splitting AI renderer code from the initial AI page bundle, and adding bounded OpenRouter/backend fetch behavior. Backend changes stay env-driven and do not expose secrets.

**Tech Stack:** Next.js App Router, React client components, `next/dynamic`, NestJS, OpenRouter fetch calls, Tailwind CSS.

---

### Task 1: Dashboard Route Loading Feedback

**Files:**
- Create: `apps/web/app/dashboard/loading.tsx`

- [x] **Step 1: Add dashboard loading skeleton**

Create a route-level loading component with only Tailwind classes and no package imports.

- [x] **Step 2: Mark dashboard loading skeleton complete**

Confirm the file has no imports and exports a default component.

### Task 2: AI Assistant Initial Bundle Split

**Files:**
- Modify: `apps/web/app/dashboard/ai-assistant/page.tsx`
- Modify: `apps/web/components/ui/ai-message.tsx`

- [x] **Step 1: Dynamically import `AIMessage` in AI assistant page**

Use `next/dynamic` with a small inline loading placeholder. Do not change chat UI layout or message behavior.

- [x] **Step 2: Dynamically load `AIGraph` only for graph code blocks**

Use `next/dynamic` inside `ai-message.tsx` so normal messages do not synchronously import graph rendering.

- [x] **Step 3: Preserve normal markdown, math, mermaid, code block, and citation rendering**

Review the relevant branches in the `ReactMarkdown` code component after the dynamic import changes.

### Task 3: Backend OpenRouter Timeouts

**Files:**
- Modify: `apps/api/src/ai/agent.service.ts`
- Modify: `apps/api/src/ai/providers/openrouter.provider.ts`
- Modify: `apps/api/src/ai/semantic-search.service.ts`

- [x] **Step 1: Add OpenRouter timeout helpers**

Use `OPENROUTER_TIMEOUT_MS` with a `30000` ms fallback. Do not print or expose API keys.

- [x] **Step 2: Apply helper to AgentService OpenRouter fetches**

Keep provider/model selection logic unchanged. Only add timeout handling around existing OpenRouter HTTP calls.

- [x] **Step 3: Keep user-facing fallback behavior clean**

Ensure timeout errors flow into existing fallback messages without leaking internal provider details to users.

### Task 4: Backend Self-Call Configuration

**Files:**
- Modify: `apps/api/src/ai/agent.service.ts`

- [x] **Step 1: Replace hardcoded API base**

Replace `http://localhost:3001` with `process.env.INTERNAL_API_URL || process.env.API_URL || \`http://localhost:${process.env.PORT || 3001}\``.

- [x] **Step 2: Confirm local, Docker, and WSL fallback behavior**

Local default remains port `3001`; Docker/WSL can set `INTERNAL_API_URL`.

### Task 5: Environment Example Documentation

**Files:**
- Modify: `apps/api/.env.example`

- [x] **Step 1: Add `INTERNAL_API_URL` example**

Document it as the backend URL used by API self-calls.

- [x] **Step 2: Add `OPENROUTER_TIMEOUT_MS` example**

Document the default timeout as `30000`.

### Task 6: Verification Summary

**Files:**
- Read-only verification through git diff and optional type/build commands.

- [x] **Step 1: Review changed files**

Run `git diff -- apps/web/app/dashboard/loading.tsx apps/web/app/dashboard/ai-assistant/page.tsx apps/web/components/ui/ai-message.tsx apps/api/src/ai/agent.service.ts apps/api/.env.example docs/superpowers/plans/2026-06-04-phase-1-performance.md`.

- [x] **Step 2: Provide commands for user-run builds**

Report exact commands from repo root for web and API build verification.

---

## Phase 2: Frontend Bundle Reduction

### Task 7: Remove Heavy AI Syntax Highlighter From Initial Renderer

**Files:**
- Modify: `apps/web/components/ui/ai-message.tsx`

- [x] **Step 1: Replace `react-syntax-highlighter` imports**

Remove `react-syntax-highlighter` and Prism theme imports from `ai-message.tsx`.

- [x] **Step 2: Keep the existing code block shell**

Preserve the code block header, copy button, language label, scroll behavior, and dark/light styling with plain escaped text.

- [x] **Step 3: Confirm normal markdown branches still render**

Review inline code, tables, blockquotes, links, Mermaid, and graph branches after the code block change.

### Task 8: Remove Shared Dashboard Framer Motion Dependency

**Files:**
- Modify: `apps/web/app/dashboard/layout.tsx`
- Modify: `apps/web/components/ui/glass-nav-icon.tsx`

- [x] **Step 1: Remove `framer-motion` import from dashboard layout**

Replace `motion.div` active and hover wrappers with regular `div` elements using Tailwind/CSS transitions.

- [x] **Step 2: Remove `framer-motion` import from `GlassNavIcon`**

Replace `motion.div` wrappers with regular `div` elements while preserving active/inactive visual state.

- [x] **Step 3: Keep dashboard layout behavior intact**

Confirm nav links, active state, sidebar behavior, notifications, and dark mode code paths remain unchanged.

### Task 9: Phase 2 Verification Summary

**Files:**
- Read-only verification through typecheck and diff review.

- [x] **Step 1: Run web typecheck**

Run `npm run typecheck:web` from repo root.

- [x] **Step 2: Review Phase 2 diff**

Run `git diff -- apps/web/components/ui/ai-message.tsx apps/web/app/dashboard/layout.tsx apps/web/components/ui/glass-nav-icon.tsx docs/superpowers/plans/2026-06-04-phase-1-performance.md`.

- [x] **Step 3: Provide commands for user-run builds**

Report exact commands from repo root for comparing Next build output.

---

## Phase 3: Dependency Cleanup

### Task 10: Confirm Removable Dependencies

**Files:**
- Read-only usage scan across `apps/web`, `apps/api`, root `package.json`, and `package-lock.json`.

- [x] **Step 1: Check `framer-motion` usage**

Keep `framer-motion` if any source files still import it.

- [x] **Step 2: Check `react-syntax-highlighter` usage**

Remove `react-syntax-highlighter` and `@types/react-syntax-highlighter` only if no source files import them.

### Task 11: Remove Unused Syntax Highlighter Packages

**Files:**
- Modify: `apps/web/package.json`
- Modify: `package-lock.json`

- [x] **Step 1: Uninstall unused syntax highlighter packages**

Run `npm uninstall react-syntax-highlighter @types/react-syntax-highlighter --workspace=web` from repo root.

- [x] **Step 2: Keep `framer-motion` installed**

Do not remove `framer-motion` because it is still used by other frontend files.

### Task 12: Phase 3 Verification Summary

**Files:**
- Read-only verification through usage scan, typecheck, and diff review.

- [x] **Step 1: Confirm syntax highlighter imports are gone**

Run `rg -n "react-syntax-highlighter" apps/web apps/api package.json package-lock.json`.

- [x] **Step 2: Run web typecheck**

Run `npm run typecheck:web` from repo root.

- [x] **Step 3: Provide commands for user-run builds**

Report exact commands from repo root for comparing Next build output.

---

## Phase 4: AI Assistant Dev-Compile Audit

**Goal:** Reduce first-visit Next.js dev compile cost for `/dashboard/ai-assistant` without changing UI design, AI provider behavior, or graph/markdown/math support.

**Current dev signal:** `/dashboard/ai-assistant` compiled in about `11.5s` with `7988 modules`.

### Task 13: Audit AI Assistant Dev Imports

**Files:**
- Read: `apps/web/app/dashboard/ai-assistant/page.tsx`
- Read: `apps/web/components/ui/ai-message.tsx`
- Read: `apps/web/components/ui/ai-mermaid.tsx`
- Read: `apps/web/components/ui/ai-graph.tsx`
- Read: `apps/web/app/api/ai/*/route.ts`

- [x] **Step 1: Identify heavy top-level AI renderer imports**

Check whether markdown, math, KaTeX, Mermaid, graph, Plotly, Zod, or similar libraries are pulled into the AI assistant route at top level.

- [x] **Step 2: Check Next API route handlers**

Confirm `apps/web/app/api/ai/*` route handlers stay thin and do not import provider/model logic directly.

### Task 14: Split Heavy AI Markdown Renderer

**Files:**
- Modify: `apps/web/components/ui/ai-message.tsx`
- Create: `apps/web/components/ui/ai-rich-message.tsx`

- [x] **Step 1: Keep `AIMessage` lightweight**

Remove top-level imports of `react-markdown`, `remark-*`, `rehype-katex`, Mermaid, graph normalizers, and graph parser dependencies from `ai-message.tsx`.

- [x] **Step 2: Move current rich markdown rendering into a dynamic component**

Create `ai-rich-message.tsx` with the existing markdown, math, Mermaid, graph, table, link, code block, and citation-compatible message rendering behavior.

- [x] **Step 3: Preserve loading and empty streaming behavior**

Use a small Tailwind-only placeholder while the rich renderer loads, and render empty assistant streaming messages without forcing rich renderer compilation.

### Task 15: Phase 4 Verification Summary

**Files:**
- Read-only verification through import scans, typecheck, and optional build/dev compile comparison.

- [x] **Step 1: Confirm `ai-message.tsx` no longer imports heavy renderer libraries**

Run an import scan for markdown, KaTeX, Mermaid, graph parser, and Plotly-related imports in `ai-message.tsx`.

- [x] **Step 2: Run web typecheck**

Run `npm run typecheck:web` from repo root.

- [x] **Step 3: Provide commands for dev compile comparison**

Report exact commands from repo root for rechecking `/dashboard/ai-assistant` dev compile time and module count.
