# Plan 002: Preserve Notes When Editing Past Workouts

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report; do not improvise. When done, update the status row for this plan in `plans/README.md` unless a reviewer told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 92dd3c7..HEAD -- src/server/services/workout-initializer.ts src/server/api/routers/workout.ts 'src/app/workout/[workoutId]/edit/page.tsx' test/workoutInitializer.test.ts test/workoutRouter.test.ts`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against live code before proceeding. On mismatch, stop and report.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/001-fix-weight-helper-typecheck.md
- **Category**: bug
- **Planned at**: commit `92dd3c7`, 2026-06-18

## Why This Matters

The same initializer currently powers both "copy from a previous workout" and "edit this completed workout." Copying should strip set notes and today-only workout-exercise notes; editing must preserve them. Today, the edit path drops those notes before `updateWorkout` deletes and recreates workout exercises, so saving a past workout can erase historical notes.

## Current State

- `src/app/workout/[workoutId]/edit/page.tsx` calls `api.workout.getWorkoutDetails` and passes `workout.exercises` into `WorkoutComponent`.
- `src/server/api/routers/workout.ts` implements both `getWorkoutDetails` and `prepareInitialWorkout` using `buildInitialExercisesFromWorkout`.
- `src/server/services/workout-initializer.ts` strips notes in `buildInitialExercisesFromWorkout`.
- `test/workoutInitializer.test.ts` already fails because it expects notes to be preserved.

Relevant excerpts:

```tsx
// src/app/workout/[workoutId]/edit/page.tsx:47
return (
  <WorkoutComponent
    workoutId={workoutId}
    workoutName={workout.workoutName}
    exercises={workout.exercises}
```

```ts
// src/server/services/workout-initializer.ts:289
const sets = workoutExercise.sets.map((set) =>
  mapSet(set, { includeNotes: false }),
);

// src/server/services/workout-initializer.ts:339
notes: null,
```

```ts
// src/server/api/routers/workout.ts:236
await tx.workoutExercise.deleteMany({
  where: { workoutSessionId: input.workoutId },
});
```

## Commands You Will Need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Focused initializer tests | `npm test -- --run test/workoutInitializer.test.ts` | all tests pass |
| Router tests | `npm test -- --run test/workoutRouter.test.ts` | all tests pass |
| Typecheck | `npm run typecheck` | exit 0 |

## Scope

**In scope**:
- `src/server/services/workout-initializer.ts`
- `src/server/api/routers/workout.ts`
- `test/workoutInitializer.test.ts`
- `test/workoutRouter.test.ts`
- `src/app/workout/[workoutId]/edit/page.tsx` only if a route-level option is needed

**Out of scope**:
- Changing visual note UI.
- Copying set notes into new workouts. The user explicitly wanted copied workouts to avoid copying set notes.
- Changing `updateWorkout` delete-and-recreate behavior except as needed to preserve payload fields.

## Git Workflow

- Branch naming if needed: `codex/preserve-workout-edit-notes`.
- Commit message style: short imperative, for example `Preserve notes in workout edits`.

## Steps

### Step 1: Split copy and edit semantics

Add an options argument to `buildInitialExercisesFromWorkout`, for example:

```ts
type WorkoutInitializerMode = "copy" | "edit";
```

or:

```ts
options?: { preserveInstanceNotes?: boolean }
```

Use `preserveInstanceNotes: true` only for `workout.getWorkoutDetails`. Keep `prepareInitialWorkout` with `mode: "workoutReference"` using `false`.

**Verify**: `rg -n "buildInitialExercisesFromWorkout" src/server` shows every call site passing or intentionally relying on the default.

### Step 2: Preserve current workout notes in edit mode

When `preserveInstanceNotes` is true:

- call `mapSet(set)` without `includeNotes: false`;
- set returned exercise `notes` to `workoutExercise.notes` instead of `null`;
- keep existing `exerciseNotesSnapshot`;
- keep `userExercise.notes` as the durable exercise note.

When `preserveInstanceNotes` is false:

- keep set notes stripped;
- keep workout-exercise note stripped;
- still expose those notes in `history` for reference.

**Verify**: `npm test -- --run test/workoutInitializer.test.ts` passes or only fails for assertions that must be updated in Step 3.

### Step 3: Add explicit tests for both modes

In `test/workoutInitializer.test.ts`, update or add tests:

- `buildInitialExercisesFromWorkout` in edit mode preserves `workoutExercise.notes` and set `notes`.
- `buildInitialExercisesFromWorkout` in copy mode strips current set notes and workout-exercise notes but still includes them in `history`.

Use the existing `buildInitialExercisesFromWorkout > returns exercises in workout order...` test as the pattern.

**Verify**: `npm test -- --run test/workoutInitializer.test.ts` exits 0.

### Step 4: Cover update persistence

If not already covered, add a router-level test in `test/workoutRouter.test.ts` proving `updateWorkout` persists `notes` and set `notes` when present. Reuse the existing `saveWorkout` test that verifies notes/rest/RIR persistence.

**Verify**: `npm test -- --run test/workoutRouter.test.ts` exits 0.

## Test Plan

- `test/workoutInitializer.test.ts`: copy vs edit semantics.
- `test/workoutRouter.test.ts`: update payload persists note fields.
- `npm run typecheck`: no type regressions.

## Done Criteria

- [ ] Editing a past workout initializes current workout-exercise notes and set notes.
- [ ] Copying from a past workout still does not copy set notes or workout-exercise notes into the new workout draft.
- [ ] `npm test -- --run test/workoutInitializer.test.ts` exits 0.
- [ ] `npm test -- --run test/workoutRouter.test.ts` exits 0.
- [ ] `npm run typecheck` exits 0.
- [ ] `plans/README.md` status row updated.

## STOP Conditions

Stop and report if:

- You cannot distinguish copy vs edit at the server route layer without changing client URL semantics.
- Preserving notes requires changing the shape of `CompletedWorkoutSchema`.
- The user-facing copy workflow starts copying set notes after your change.

## Maintenance Notes

Future "DB-backed draft" work should keep separate concepts for "reference history" and "the record currently being edited." Do not reuse a copy initializer for edit mode unless the mode is explicit and tested.
