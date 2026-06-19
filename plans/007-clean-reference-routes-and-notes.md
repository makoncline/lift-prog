# Plan 007: Clean Up Reference Routes And Raw Workout-Note Docs

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report; do not improvise. When done, update the status row for this plan in `plans/README.md` unless a reviewer told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 92dd3c7..HEAD -- src/app/workout-reference/page.tsx src/app/weight-helper-reference/page.tsx src/app/page.tsx docs/workout-notes-to-enter.txt docs/workout-entry-checklist.md`
> If an in-scope file changed since this plan was written, compare the "Current state" excerpts against live code before proceeding. On mismatch, stop and report.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-fix-weight-helper-typecheck.md
- **Category**: dx
- **Planned at**: commit `92dd3c7`, 2026-06-18

## Why This Matters

The branch still contains temporary prototype routes and a raw personal workout-note dump. That may be intentional during active design work, but it should be explicit before PR/deploy. `git diff --check` is also red because the notes file has trailing whitespace.

## Current State

Relevant excerpts:

```ts
// src/app/workout-reference/page.tsx:1
import { PreviousWorkoutExerciseSandbox } from "@/components/workout-reference/workout_reference_sandbox";
```

```ts
// src/app/weight-helper-reference/page.tsx:18
export default function WeightHelperReferencePage() {
```

```txt
// docs/workout-notes-to-enter.txt:1
6/15
Legs
Hack squat
```

`src/app/page.tsx` also routes local sample workout rows to `/workout-reference` for negative sample IDs.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Diff whitespace | `git diff --check origin/main...HEAD` | exit 0 |
| Typecheck | `npm run typecheck` | exit 0 |
| Home/workout tests | `npm test -- --run test/workout.integration.test.tsx test/previousWorkoutExercise.test.tsx` | all pass |

## Scope

**In scope**:
- `src/app/workout-reference/page.tsx`
- `src/app/weight-helper-reference/page.tsx`
- `src/app/page.tsx`
- `docs/workout-notes-to-enter.txt`
- `docs/workout-entry-checklist.md`

**Out of scope**:
- Removing reusable components under `src/components/workout-reference`; the real workout UI still imports them.
- Deleting workout notes if the owner still needs them for manual entry.
- Changing production workout UI.

## Git Workflow

- Branch naming if needed: `codex/clean-reference-routes`.
- Commit message style: short imperative, for example `Clean up reference routes`.

## Steps

### Step 1: Decide route treatment

Preferred minimal treatment: make `/workout-reference` and `/weight-helper-reference` development-only. In each page, import `notFound` from `next/navigation` and return `notFound()` when `process.env.NODE_ENV !== "development"`.

Do not delete the route files unless the owner explicitly says the prototypes are no longer needed locally.

**Verify**: `rg -n "notFound|NODE_ENV" src/app/workout-reference/page.tsx src/app/weight-helper-reference/page.tsx` shows both routes gated.

### Step 2: Remove production links to prototype routes

In `src/app/page.tsx`, review the negative sample-workout handling. If it is only for auth-free local mode, leave it but make sure it cannot appear when `historyEnabled` is true. If route gating from Step 1 makes local samples unusable in production, no additional change is needed.

**Verify**: `rg -n "workout-reference" src/app/page.tsx` only appears in local/sample handling or not at all.

### Step 3: Clean or quarantine raw notes

Run a whitespace cleanup on `docs/workout-notes-to-enter.txt` without changing content. If the user has confirmed notes are no longer needed in the repo, delete both `docs/workout-notes-to-enter.txt` and `docs/workout-entry-checklist.md`; otherwise keep them and add a short first-line note to `docs/workout-entry-checklist.md` saying the notes are private source material and should be removed before a public repo/PR.

**Verify**: `git diff --check origin/main...HEAD` exits 0.

## Test Plan

No new tests required unless route gating changes behavior. Run the existing UI tests to catch import or route compile errors.

## Done Criteria

- [ ] Reference routes are either development-only or explicitly kept with owner-approved rationale.
- [ ] `git diff --check origin/main...HEAD` exits 0.
- [ ] Raw workout notes are either removed or clearly marked as private source material.
- [ ] `npm run typecheck` exits 0.
- [ ] `plans/README.md` status row updated.

## STOP Conditions

Stop and report if:

- The owner still needs the raw notes to complete data entry and no replacement exists.
- Hiding the reference routes breaks the real workout UI.
- The app intentionally exposes these prototype routes in production for testing.

## Maintenance Notes

Temporary design routes have been useful in this project. Keep the pattern, but make prototype/prod visibility explicit before deploy.
