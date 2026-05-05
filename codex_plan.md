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
