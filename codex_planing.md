# Codex Planing Ledger

> Persistent planning and implementation record for `library-system-v2`.
> 
> Use this file to capture feature plans before implementation, track phase status during delivery, and record the final validation and commit once work is complete.

---

## Usage Rules

1. Create a new plan section before substantial feature work starts.
2. Keep each plan scoped to one feature or tightly related delivery set.
3. Break work into phases and tasks that can be validated independently.
4. Update status as work progresses; do not leave completed phases marked pending.
5. When a phase is finished and validated, mark it `GOOD`.
6. Record validation commands, behavior checks, and the final commit hash.
7. If scope changes mid-stream, add an amendment note instead of rewriting history.
8. Preserve completed plans so this file remains a durable planning archive.

---

## Status Legend

| Status | Meaning |
|---|---|
| `TODO` | Planned but not started |
| `IN_PROGRESS` | Actively being implemented |
| `GOOD` | Completed and validated |
| `BLOCKED` | Cannot proceed until dependency/decision is resolved |
| `CANCELLED` | Intentionally dropped or superseded |

Recommended task marker style:
- `[ ]` not started
- `[-]` in progress
- `[x]` completed and validated

---

## Plan Template

Copy this block for new work:

```md
## Plan: <Feature Name>

- Date Opened: YYYY-MM-DD
- Owner: Codex
- Status: GOOD | IN_PROGRESS | GOOD | BLOCKED | CANCELLED
- Related Files:
  - `path/to/file`
- Goal:
  - <what success looks like>
- Non-Goals:
  - <what must stay unchanged>
- Risks:
  - <main implementation risks>

### Current State
- <how it works now>
- <known gaps>

### Target Design
- <how it should work>

### Phase Breakdown
| Phase | Status | Scope | Validation |
|---|---|---|---|
| 1 | TODO | <phase summary> | <checks> |
| 2 | TODO | <phase summary> | <checks> |

### Task Checklist
- [ ] <task>
- [ ] <task>

### Implementation Notes
- <important decisions>
- <schema/API/UI notes>

### Completion Record
- Validation:
  - `<command>`
- Commit:
  - `<hash>` `<message>`
- Notes:
  - <follow-up or residual risk>
```

---

## Backfilled Completed Work

These entries were completed before this ledger was created and are recorded here for continuity.

| Date | Work | Status | Commit | Notes |
|---|---|---|---|---|
| 2026-05-05 | Production AI document indexing pipeline and book PDF backfill | `GOOD` | `f1d86c0` | Completed S3/local document extraction, material chunk search, book PDF indexing, admin backfill endpoint, tests, and operational note |
| 2026-05-05 | Startup logging, config validation, safe S3 logging, request logging cleanup | `GOOD` | `0e34db1` | Added JWT/S3 startup validation, structured startup logs, Prisma SQL toggle, consolidated request logs |
| 2026-05-05 | Windows-safe Prisma generate cleanup script | `GOOD` | `e4b4e7c` | Added `npm run prisma:generate:clean` for local Windows DLL lock recovery |
| 2026-05-05 | Staff dashboard metrics and role wording correction | `GOOD` | `3a04204` | Replaced fake staff dashboard values, fixed `University Staff` wording, updated README |

---

## Plan: AI Assistant Multi-Mode Orchestration

- Date Opened: 2026-05-05
- Owner: Codex
- Status: GOOD
- Related Files:
  - `apps/api/prisma/schema.prisma`
  - `apps/api/src/ai/agent.service.ts`
  - `apps/api/src/ai/ai.controller.ts`
  - `apps/api/src/ai/prompts/system-prompt-builder.ts`
  - `apps/web/app/dashboard/ai-assistant/page.tsx`
  - `apps/api/src/ai/ai-modes.ts`
  - `apps/api/src/ai/ai-modes.spec.ts`
  - `apps/web/lib/ai-modes.ts`
- Goal:
  - Replace the current single-mode chat setting with a production-grade multi-mode system that can auto-select and combine response modes per turn, while still allowing user-pinned manual modes.
  - Make study sessions start in the right teaching posture automatically.
  - Persist and surface active modes clearly in the UI so users always know how OZ is responding.
- Non-Goals:
  - Do not change model provider selection logic unless mode orchestration exposes a real defect.
  - Do not change tool permissions, access control, or role behavior.
  - Do not widen OZ data access beyond what current auth and material access rules already allow.
- Risks:
  - Mode combinations can become contradictory if prompt composition is weak.
  - UI and backend can drift if conversation mode state is not returned consistently.
  - Auto-mode inference can feel unstable if it changes too aggressively between turns.

### Current State
- The AI page exposes a single selected mode: `normal`, `learning`, `explanatory`, `planning`, `formal`, or `concise`.
- The frontend sends one `mode` string with each chat request.
- The backend applies that mode as a single prompt prefix.
- Conversations store a `mode`, but the UI does not reliably reload and reuse it when a conversation is reopened.
- The current system changes response style, but it does not support:
  - automatic mode detection
  - simultaneous multiple active modes
  - user-pinned mode stacking
  - study-session defaults such as `learning + explanatory`
  - visible distinction between auto-active and manually pinned modes

### Target Design

#### Core Principles
- `normal` becomes the baseline fallback state, not a combinable advanced mode.
- Modes are split into two classes:
  - Behavior modes: `learning`, `explanatory`, `planning`
  - Style modes: `formal`, `concise`
- Final response behavior for each turn is built from:
  - auto-inferred modes
  - user-manual modes
  - deterministic conflict resolution
- The UI must show which modes are active now, not just which mode was last clicked.

#### Desired Runtime Behavior
- Regular chat starts in `normal`.
- Study sessions start with auto modes:
  - `learning`
  - `explanatory`
- Mid-conversation, OZ can auto-activate modes based on user intent.
- Users can manually add one or more modes on top of auto-selected ones.
- Auto-active mode chips appear highlighted in purple.
- Manual modes remain active until the user removes them.
- If no special mode is active, show `normal` as the effective state.

#### Example Outcomes
- Generic chat -> `normal`
- “Teach me recursion” -> `learning + explanatory`
- “Make me a weekly exam plan” -> `planning`
- “Explain this like I’m new, but briefly” -> `explanatory + concise`
- “Rewrite this in academic tone” -> `formal`
- Study session asking for a roadmap -> `learning + explanatory + planning`

### Mode Resolution Rules
- `normal` is only active when no other mode is active.
- `learning` and `explanatory` can coexist.
- `planning` can coexist with `learning` and/or `explanatory`.
- `formal` modifies tone and structure, not task behavior.
- `concise` limits verbosity but must not suppress factual grounding or remove structure.
- If `concise` and `explanatory` coexist, OZ should explain briefly and directly.
- If `planning` is active, OZ should favor phased steps, sequencing, milestones, and prioritization.

### Proposed Data Model
- Replace the single conversation mode field with structured mode state.
- Preferred shape:
  - `manualModes: AiMode[]`
  - `lastAutoModes: AiMode[]`
- If Prisma array handling becomes awkward for the current database setup, use a JSON field with clear validation at the API layer.
- Continue storing enough state on the conversation so reopening it restores the correct mode presentation.

### API / Backend Design
- Add mode inference before each assistant response:
  - inspect latest user message
  - inspect whether the conversation is a study session
  - inspect recent conversation context
- Compute:
  - `autoModes`
  - `finalActiveModes = resolveModes(manualModes, autoModes)`
- Return mode state in conversation detail/list responses where the UI needs it.
- Replace single-prefix prompt logic with composable prompt fragments:
  - base system prompt
  - session prompt
  - behavior mode fragments
  - style mode fragments
- Persist the latest auto modes after each turn so the UI can reflect what OZ actually used.

### UI / Frontend Design
- Replace single-select mode buttons with multi-select chips.
- Visual states:
  - auto-active -> purple filled
  - manual-active -> purple filled with a pinned/manual indicator
  - inactive -> neutral
- Show `normal` only when no other mode is active.
- Rehydrate mode state when reopening a conversation.
- Update visible active modes after each assistant turn.
- Let users manually add modes without clearing auto-selected modes.

### Phase Breakdown

| Phase | Status | Scope | Validation |
|---|---|---|---|
| 1 | GOOD | Finalize mode model, prompt-composition rules, and DB/API contract | Schema/API/UI contract updated and typechecked |
| 2 | GOOD | Implement backend structured mode state, inference, persistence, and prompt composition | `npm run typecheck:api` and `npx jest --runInBand src/ai/ai-modes.spec.ts src/ai/agent.service.spec.ts` |
| 3 | GOOD | Upgrade AI chat UI to multi-mode chips with auto/manual state and conversation rehydration | `npm run typecheck:web` |
| 4 | GOOD | Integrate study-session defaults and mid-conversation auto-mode transitions | Backend inference + study-session defaults typechecked and covered by helper tests |
| 5 | GOOD | Document final behavior in README and close the plan with validation + commit log | README updated; commit recorded in implementation summary |

### Task Checklist
- [x] Confirm whether `AiConversation.mode` should be migrated to arrays or JSON.
- [x] Define `AiMode` enum or equivalent validated type for shared API use.
- [x] Implement `inferAutoModes(...)` in the backend.
- [x] Implement `resolveModes(...)` with deterministic conflict rules.
- [x] Replace single prompt prefix logic with composable mode fragments.
- [x] Return mode state from conversation fetch APIs.
- [x] Update chat send flow to support multiple manual modes.
- [x] Rehydrate mode state when a conversation is reopened.
- [x] Add auto/manual visual distinction to the mode chips.
- [x] Add study-session default mode behavior.
- [x] Add backend and frontend regression coverage.
- [x] Update README after delivery.

### Implementation Notes
- Keep automatic mode inference conservative; avoid rapid oscillation between modes from one turn to the next without a clear user signal.
- The first production version should prefer clear heuristics over opaque scoring logic.
- Auto modes should be derived per turn, but manual modes should persist on the conversation until removed.
- If the backend computes active modes, the frontend should render that source of truth rather than duplicating mode logic.
- The final system should explain active-mode behavior to the user through the UI instead of hiding it.

### Completion Record
- Validation:
  - `cd apps/api && npm run prisma:generate:clean`
  - `npm run typecheck:api`
  - `npm run typecheck:web`
  - `cd apps/api && npx jest --runInBand src/ai/ai-modes.spec.ts src/ai/agent.service.spec.ts`
- Commit:
  - Pending — recorded by the implementation commit for this delivery.
- Notes:
  - Delivered with `String[]` mode-state fields (`manualModes`, `lastAutoModes`) plus validated `AiMode` helpers instead of a Prisma enum or JSON field.
  - Study sessions now auto-start in `learning + explanatory`; regular chat remains `normal` until OZ infers stronger modes or the user pins them.



