# Codex Plan

## Plan: Light Mode Visibility Audit and Repair

- Date Opened: 2026-05-05
- Owner: Codex
- Status: GOOD
- Related Files:
  - `apps/web/components/BookCitationCards.tsx`
  - `apps/web/app/dashboard/ai-assistant/page.tsx`
  - `apps/web/app/globals.css`
  - `apps/web/lib/renderMessage.tsx`
  - `apps/web/components/ui/assistant-chat-input.tsx`
- Goal:
  - Fix real light-mode readability failures in the dashboard/shared UI without breaking dark mode or the repo's token-based theme system.
- Non-Goals:
  - Do not rewrite auth pages that are intentionally dark-first.
  - Do not replace the existing CSS-token body theme model with generic Tailwind `@apply` rules.
  - Do not do blind global `text-white` replacement.
- Risks:
  - Over-fixing dark-surface components that are intentionally dark in both themes.
  - Regressing AI Assistant styling while trying to normalize colors.

### Current State
- The repo already has a light/dark token system in `apps/web/app/globals.css`.
- Most dashboard pages already use correct dual-mode text utilities.
- The actual breakage is in some shared dark-first UI patterns reused inside light mode.
- Confirmed offenders:
  - `BookCitationCards` uses `text-white/90` on a pale/translucent light surface.
  - AI Assistant conversation history drawer uses hardcoded dark-first sidebar colors and white-muted text instead of theme-aware dashboard colors.

### Target Design
- Shared dashboard/citation UI should always specify readable light text plus dark-mode overrides.
- Dark-intent components that genuinely render on dark surfaces may remain dark.
- AI Assistant shell should feel consistent with the rest of the dashboard in light mode.

### Phase Breakdown
| Phase | Status | Scope | Validation |
|---|---|---|---|
| 1 | GOOD | Audit actual light-mode offenders in dashboard/shared UI | Code search + file inspection |
| 2 | GOOD | Fix shared citation card contrast and surfaces | Visual class audit + typecheck |
| 3 | GOOD | Fix AI Assistant history drawer theme awareness | Visual class audit + typecheck |

### Task Checklist
- [x] Audit dashboard/shared UI for real light-mode text failures
- [x] Fix `BookCitationCards` light-mode text and surface styles
- [x] Fix AI Assistant history drawer to be theme-aware in light mode
- [x] Leave intentionally dark auth pages unchanged
- [x] Validate frontend typecheck

### Implementation Notes
- `globals.css` already provides the correct body background and foreground via CSS variables, so no global body rewrite was applied.
- `renderMessage` code blocks were intentionally left unchanged because they use a deliberate hardcoded dark code surface in both themes.
- `assistant-chat-input` already uses tokenized `text-*` / `bg-*` utilities and did not need a visibility fix.

### Completion Record
- Validation:
  - `npm run typecheck:web`
- Commit:
  - `<pending>`
- Notes:
  - Scope was intentionally limited to confirmed dashboard/shared UI regressions instead of broad color churn.

## Plan: OZ AI Model Auto-Selection and Live Active Model UI

- Date Opened: 2026-05-05
- Owner: Codex
- Status: GOOD
- Related Files:
  - `apps/api/prisma/schema.prisma`
  - `apps/api/src/ai/agent.service.ts`
  - `apps/api/src/ai/ai.controller.ts`
  - `apps/web/app/dashboard/ai-assistant/page.tsx`
  - `apps/web/components/ui/assistant-chat-input.tsx`
  - `apps/web/lib/ai-models.ts`
- Goal:
  - Make `Auto` the real default OZ model behavior.
  - Show the actual model currently in use in the UI in purple.
  - Update the active model in real time when OZ resolves or falls back to a different model.
  - Keep manual model override available.
- Non-Goals:
  - Do not add new external models in this pass.
  - Do not change AI business logic beyond model resolution and UI state.
- Risks:
  - Frontend can drift from backend if resolved model is not streamed explicitly.
  - Model fallback events must update both the running UI and persisted conversation state.

### Current State
- The frontend dropdown defaults to Gemini Flash Lite.
- The backend has auto-selection logic, but normal chat sends a model override from the UI, which mostly bypasses auto mode.
- The UI does not show the actual resolved model currently used by OZ.

### Target Design
- Model selector defaults to `Auto`.
- Backend resolves the model per turn and streams model state like mode state.
- Purple active-model UI always reflects the resolved model actually used.
- Manual selection remains possible and persists per conversation when applicable.

### Phase Breakdown
| Phase | Status | Scope | Validation |
|---|---|---|---|
| 1 | GOOD | Add persisted conversation model state and backend resolution helpers | Typecheck API + migrate deploy |
| 2 | GOOD | Stream real-time model state, including fallback changes | Typecheck API |
| 3 | GOOD | Make frontend model selector Auto-default and show active purple model state | Typecheck web |

### Task Checklist
- [x] Add conversation model state fields
- [x] Make backend resolve and persist manual/resolved model state
- [x] Stream model state in SSE responses
- [x] Make frontend selector controlled and Auto-default
- [x] Show real active model in purple and update it in real time
- [x] Validate API and web typecheck

### Completion Record
- Validation:
  - `cd apps/api && npm run prisma:generate:clean`
  - `cd apps/api && npx prisma migrate deploy`
  - `npm run typecheck:api`
  - `npm run typecheck:web`
- Commit:
  - `<pending>`
- Notes:
  - `gpt-oss-120b` was intentionally not added in this pass.
