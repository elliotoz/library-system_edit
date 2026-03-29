# CURRENT_STATE_POLICY.md

## Purpose

This file defines how `CURRENT_STATE.md` must be maintained after each implementation phase.

`CURRENT_STATE.md` is a living production-readiness audit.

It is not:

* a changelog
* a progress diary
* a task list
* a place for optimism

It must always describe the system as it actually exists now.

---

## Core Rule

Update `CURRENT_STATE.md` only from verified code reality.

Do not move an item to “completed” because:

* work started
* code was written
* a PR exists
* a fix was attempted
* the intended design says it should be fixed

Only update the file when the implementation actually closes the risk in the running system.

---

## Update Trigger

`CURRENT_STATE.md` should be reviewed and updated after any phase that changes:

* authentication
* authorization / role enforcement
* borrow logic
* reservation logic
* validation
* database write consistency
* error handling
* production safety or deployment readiness

If a phase does not materially affect production state, the file should not be changed.

---

## Mandatory Review Process

Before editing `CURRENT_STATE.md`, the reviewer must:

1. Re-read the affected source files.
2. Confirm the old risk still exists, is partially reduced, or is fully closed.
3. Check whether the fix is enforced in code, not just implied by frontend behavior.
4. Check for adjacent regressions or new risks introduced by the phase.
5. Update only the sections that changed.

---

## Section Rules

### Last Completed

Put an item here only if it is:

* implemented
* verified
* reliable enough for production in that area

An item belongs in `Last Completed` when the failure mode it previously had is no longer a meaningful production risk.

Do not place partial work here.

### In Progress

Put an item here if it is:

* partially implemented
* not fully hardened
* blocked by a remaining dependency
* improved but still not production-safe

If a fix reduces risk but does not fully close it, it stays here.

### Production Readiness Score

The score reflects remaining production risk, not effort spent.

Do not increase the score because:

* more code exists
* more endpoints were added
* UI looks more complete
* one issue was partially reduced

Increase the score only when real production failure risk is materially lower.

### Critical Issues

List only issues that represent one or more of the following:

* security exposure
* broken authorization
* race condition causing invalid state
* duplicate action causing corrupted state
* missing consistency protection in core flows
* production-breaking lifecycle gap

If the issue is fully fixed, remove it.

If the issue is only reduced, rewrite it to match the remaining actual risk.

### High Priority Issues

Use for issues that are serious but not immediately catastrophic, such as:

* missing policy enforcement
* incomplete validation in important flows
* inconsistent error contracts
* unsafe but non-critical endpoint exposure

### Medium Priority Issues

Use for:

* incomplete lifecycle handling
* inconsistent UX-level behavior
* non-fatal but real production weaknesses

### Low Priority Improvements

Use for:

* maintainability
* consistency cleanup
* polish
* low-risk structural weaknesses

Do not put real security or consistency issues here.

---

## System Health Status Rules

Use these labels consistently:

* `Broken`: core flow is unsafe or unreliable
* `Weak`: major production gaps remain
* `Fair`: workable but not fully production-safe
* `Good`: production-capable with minor known gaps
* `Strong`: no meaningful known gaps in that area

Do not upgrade an area status unless the main production risks for that area are actually reduced.

Example:

* If reservation approval works but duplicate reservation races still exist, `Reservation System` should not be rated `Good`.

---

## Evidence Standard

A claimed fix is considered complete only if at least one of these is true:

* automated tests cover the failure mode
* manual verification was performed and clearly confirms the behavior
* code-level enforcement unambiguously closes the issue and leaves no obvious gap

Best standard:

* code verification plus tests

If evidence is weak, keep the item in `In Progress` or leave the issue open.

---

## Partial Fix Rule

If a phase improves something but does not fully close the production risk:

* keep it out of `Last Completed`
* keep it in `In Progress`
* lower severity only if the worst-case risk genuinely decreased
* rewrite the issue so it describes the remaining problem precisely

Example:

If reservation expiration is added for new rows but old stranded reserved copies are still not reconciled:

* do not mark reservation expiration complete
* keep it in `In Progress`
* describe the remaining reconciliation gap explicitly

---

## Rewrite Rule

Do not append historical notes like:

* “previously this was broken”
* “phase 2 fixed most of this”
* “Claude implemented X”

`CURRENT_STATE.md` must read as a present-tense snapshot.

Always rewrite sections to reflect current reality cleanly.

---

## Score Rubric

Use this scale:

* `0-3`: unsafe, major broken production flows
* `4-5`: development-usable, not production-ready
* `6-7`: mostly functional, important production gaps remain
* `8-9`: production-capable, only minor or contained risks remain
* `10`: strong production readiness, no meaningful known gaps

The score must be justified by current unresolved risk, not by feature count.

---

## Per-Phase Update Checklist

For each completed phase, answer:

1. What exact risk was targeted?
2. Is it fully fixed, partially fixed, or unchanged?
3. What proof supports that conclusion?
4. Which `CURRENT_STATE.md` sections must change?
5. Does severity change?
6. Does area health change?
7. Does the overall score change?

If any answer is unclear, do not overstate progress.

---

## Example Update Decisions

### Example 1: Full Fix

If reservation create/collect is made transaction-safe, duplicate-safe, and tested:

* remove the related critical issue
* add a concise item to `Last Completed`
* improve `Reservation System` health if no equally severe reservation gap remains
* raise the score only if overall production risk is materially reduced

### Example 2: Partial Fix

If borrow limits are enforced during collection, but duplicate collect is still possible:

* remove or downgrade only the borrow-limit issue
* keep duplicate-collect risk open
* do not mark reservation flow fully complete
* adjust the score modestly, if at all

### Example 3: Cosmetic Work Only

If frontend messages are prettier but backend still returns inconsistent error shapes:

* do not mark error handling complete
* keep the issue open
* do not raise the readiness score

---

## Ownership Rule

The implementation agent may propose updates.

The reviewer is responsible for deciding whether:

* the claimed fix is real
* the severity actually changed
* the score should move
* the wording in `CURRENT_STATE.md` remains accurate

When in doubt, keep the harsher assessment until evidence is clear.

---

## Final Standard

`CURRENT_STATE.md` must always be:

* current
* evidence-based
* concise
* production-focused
* skeptical

If forced to choose between being generous and being accurate, choose accuracy.
