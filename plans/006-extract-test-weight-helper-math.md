# Plan 006: Extract And Test Weight-Helper Math

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report; do not improvise. When done, update the status row for this plan in `plans/README.md` unless a reviewer told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 92dd3c7..HEAD -- src/components/workout-reference/weight_helper_dialog.tsx src/lib test`
> If an in-scope file changed since this plan was written, compare the "Current state" excerpts against live code before proceeding. On mismatch, stop and report.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/001-fix-weight-helper-typecheck.md
- **Category**: tests
- **Planned at**: commit `92dd3c7`, 2026-06-18

## Why This Matters

The new weight helper contains domain logic for plate loading and one-rep-max suggestions, but the logic is private inside a TSX component. It is hard to test without rendering UI, and easy to regress while polishing the dialog. Extracting pure calculations keeps the component focused on presentation and gives this workout-specific math cheap coverage.

## Current State

Relevant excerpts:

```ts
// src/components/workout-reference/weight_helper_dialog.tsx:753
function buildAddedWeightRepRows(
  currentWeight: number,
  currentOneRepMax: number,
  addedWeight: number,
  mode: PlateMode,
) {
```

```ts
// src/components/workout-reference/weight_helper_dialog.tsx:798
function calculatePlatePlan(
  targetWeight: number,
  startingWeight: number,
  mode: PlateMode,
) {
```

Existing tests do not cover these helpers directly.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| New helper tests | `npm test -- --run test/weightHelper.test.ts` | all pass |
| Existing workout tests | `npm test -- --run test/previousWorkoutExercise.test.tsx test/workout.integration.test.tsx` | all pass |
| Typecheck | `npm run typecheck` | exit 0 |

## Scope

**In scope**:
- `src/components/workout-reference/weight_helper_dialog.tsx`
- `src/lib/weight-helper.ts` (create)
- `test/weightHelper.test.ts` (create)

**Out of scope**:
- Changing the visible weight-helper UI.
- Changing set editor keyboard behavior.
- Changing the Brzycki formula in `src/lib/workoutLogic.ts`.

## Git Workflow

- Branch naming if needed: `codex/test-weight-helper-math`.
- Commit message style: short imperative, for example `Test weight helper math`.

## Steps

### Step 1: Create a pure helper module

Create `src/lib/weight-helper.ts`. Move pure values and functions needed for calculations:

- `PLATES`
- `BARS` only if calculation needs it, otherwise leave UI labels in the component
- `PlateMode`
- `PlateWeight`
- `buildAddedWeightRepRows`
- `calculatePlatePlan`
- `calculateLeastPlates`
- formatting helpers only if tests need stable formatted output

Keep UI-only colors and dimensions in the component.

**Verify**: `npm run typecheck` reports any missing export/import errors. Fix only in in-scope files.

### Step 2: Update component imports

In `weight_helper_dialog.tsx`, import the pure helpers from `@/lib/weight-helper`. Keep component state, buttons, colors, and markup local.

**Verify**: `npm run typecheck` exits 0.

### Step 3: Add focused unit tests

Create `test/weightHelper.test.ts` with cases:

- equal-sides mode for `100lb` target and `45lb` bar returns `27.5lb` per side with `25 + 2.5`.
- total-load mode for `100lb` target and `45lb` start returns `55lb total` with `45 + 10`.
- no starting weight still returns a plan with `startingWeight: 0`.
- equal-sides mode rejects a target that cannot be split with 2.5lb minimum plates.
- added-weight rows return one under/exact and one over suggestion around the current 1RM.

Use `test/workoutLogic.test.ts` as the style pattern: pure function inputs and direct `expect(...).toEqual(...)` assertions.

**Verify**: `npm test -- --run test/weightHelper.test.ts` exits 0.

### Step 4: Run affected UI tests

Run the existing component/integration tests that touch the workout UI.

**Verify**: `npm test -- --run test/previousWorkoutExercise.test.tsx test/workout.integration.test.tsx` exits 0.

## Test Plan

New pure unit tests in `test/weightHelper.test.ts`, plus affected component tests.

## Done Criteria

- [ ] Pure weight-helper math lives in `src/lib/weight-helper.ts`.
- [ ] `weight_helper_dialog.tsx` imports calculations and remains presentation-focused.
- [ ] New tests cover equal sides, total load, impossible equal-side states, and added-weight suggestions.
- [ ] `npm test -- --run test/weightHelper.test.ts` exits 0.
- [ ] `npm run typecheck` exits 0.
- [ ] `plans/README.md` status row updated.

## STOP Conditions

Stop and report if:

- Extracting helpers requires changing UI behavior or visible copy.
- Existing test expectations conflict with the user-approved equal-sides/total-load semantics.
- You find the current helper math is wrong in a way that needs product clarification.

## Maintenance Notes

Reviewer should scrutinize exported helper names and tests more than UI markup. Future SwiftUI work can reuse these tests as a behavior spec.
