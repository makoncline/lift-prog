# Plan 001: Fix Weight Helper Typecheck Errors

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report; do not improvise. When done, update the status row for this plan in `plans/README.md` unless a reviewer told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 92dd3c7..HEAD -- src/components/workout-reference/weight_helper_dialog.tsx`
> If the in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding. On a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `92dd3c7`, 2026-06-18

## Why This Matters

The branch currently fails `npm run typecheck`. This blocks a clean PR/deploy and hides later defects behind a simple TypeScript issue. The error is confined to the new weight-helper component and should be resolved without changing UI behavior.

## Current State

- `src/components/workout-reference/weight_helper_dialog.tsx` contains the new weight-helper UI and plate display.
- `npm run typecheck` currently reports six `TS18048: 'color' is possibly 'undefined'` errors at plate rendering sites.

Relevant excerpts:

```tsx
// src/components/workout-reference/weight_helper_dialog.tsx:24
const PLATES = [45, 35, 25, 10, 5, 2.5] as const;

// src/components/workout-reference/weight_helper_dialog.tsx:556
function PlateBlock({ weight }: { weight: number }) {
  const height = PLATE_HEIGHTS[weight] ?? 30;
  const width = 12;
  const color = PLATE_COLORS[weight] ?? PLATE_COLORS[2.5];

// src/components/workout-reference/weight_helper_dialog.tsx:609
function PlateChip({ weight, active }: { weight: number; active: boolean }) {
  const color = PLATE_COLORS[weight] ?? PLATE_COLORS[2.5];
```

The repo has `noUncheckedIndexedAccess` enabled, so indexed object lookups remain possibly undefined even when a fallback key is used.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `npm run typecheck` | exit 0, no TypeScript errors |
| Focused tests | `npm test -- --run test/workoutInitializer.test.ts` | currently fails until plan 002; do not require success for this plan |

## Scope

**In scope**:
- `src/components/workout-reference/weight_helper_dialog.tsx`

**Out of scope**:
- Changing weight-helper UI layout.
- Extracting weight-helper logic to a library. That is plan 006.
- Changing plate math behavior.

## Git Workflow

- Branch naming if a branch is needed: `codex/fix-weight-helper-typecheck`.
- Commit message style in this repo is short imperative, for example `Polish workout editor flow`.
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Make plate weight types explicit

In `weight_helper_dialog.tsx`, introduce a `PlateWeight` type from `PLATES`:

```ts
type PlateWeight = (typeof PLATES)[number];
type PlateColor = { background: string; border: string; text: string };
```

Change `PLATE_COLORS` and `PLATE_HEIGHTS` to `Record<PlateWeight, ...>` instead of `Record<number, ...>`. Make `calculateLeastPlates` return `Array<{ weight: PlateWeight; count: number }>` and make `PlateBlock`, `PlateChip`, and `PlateCountLegend` accept `PlateWeight` where possible.

**Verify**: `npm run typecheck` should have no `TS18048` errors from `weight_helper_dialog.tsx`. If other unrelated type errors remain, record them and stop.

### Step 2: Add a small helper if needed

If TypeScript still cannot prove fallback safety, add a local helper:

```ts
function getPlateColor(weight: PlateWeight): PlateColor {
  return PLATE_COLORS[weight];
}
```

Do not use non-null assertions unless the typed helper still cannot satisfy TypeScript. Prefer typed inputs over `!`.

**Verify**: `npm run typecheck` exits 0, unless plan 002's existing test failure is the only remaining verification problem outside typecheck.

## Test Plan

No new runtime tests are required for this plan. This is a static type fix. Plan 006 adds focused tests for the calculation behavior.

## Done Criteria

- [ ] `npm run typecheck` exits 0.
- [ ] `src/components/workout-reference/weight_helper_dialog.tsx` behavior is unchanged except for type-safe plate lookup.
- [ ] No files outside the in-scope list are modified.
- [ ] `plans/README.md` status row updated.

## STOP Conditions

Stop and report if:

- The current file no longer contains `PLATES`, `PLATE_COLORS`, `PlateBlock`, or `PlateChip`.
- Fixing typecheck requires changing weight-helper calculation results.
- New TypeScript errors appear outside `weight_helper_dialog.tsx`.

## Maintenance Notes

Plan 006 will likely move these helpers into `src/lib/weight-helper.ts`. When that happens, preserve the `PlateWeight` union so future changes do not reintroduce unchecked indexed access.
