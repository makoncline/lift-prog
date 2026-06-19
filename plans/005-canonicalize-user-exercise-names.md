# Plan 005: Canonicalize Name-Based User-Exercise Flows

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report; do not improvise. When done, update the status row for this plan in `plans/README.md` unless a reviewer told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 92dd3c7..HEAD -- src/components/workout/workout.tsx src/server/api/routers/exercise.ts src/server/api/routers/workout.ts src/server/services/workout-initializer.ts test/workoutRouter.test.ts test/workoutInitializer.test.ts`
> If an in-scope file changed since this plan was written, compare the "Current state" excerpts against live code before proceeding. On mismatch, stop and report.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/004-atomic-user-exercise-writes.md
- **Category**: bug
- **Planned at**: commit `92dd3c7`, 2026-06-18

## Why This Matters

The UI sometimes compares exercise names case-insensitively, but the database unique key is exact-case. A typed name like `pull-ups` can miss an existing `Pull-ups` during initialization, suppress creation because the client found a lowercase match, and later save as a new exact-case `UserExercise`. Name-based pinned-note fallback can also return `count: 0` while the local UI shows the note.

## Current State

Relevant excerpts:

```ts
// src/components/workout/workout.tsx:510
if (state.exercises.some((exercise) => exercise.name === trimmedName)) {

// src/components/workout/workout.tsx:529
const exact = exercisesQuery.data?.some(
  (existingExercise) =>
    existingExercise.name.toLowerCase() === trimmedName.toLowerCase(),
);
if (!exact) {
  addExerciseMutation.mutate({ name: trimmedName });
}
```

```ts
// src/server/services/workout-initializer.ts:136
const userExercises = await prisma.userExercise.findMany({
  where: {
    userId,
    name: { in: exerciseNames },
  },
```

```ts
// src/server/api/routers/exercise.ts:72
return ctx.db.userExercise.updateMany({
  where: {
    userId,
    ...(input.id !== undefined
      ? { id: input.id }
      : { name: input.name?.trim() }),
```

## Commands You Will Need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Router tests | `npm test -- --run test/workoutRouter.test.ts` | all pass |
| Initializer tests | `npm test -- --run test/workoutInitializer.test.ts` | all pass |
| Integration test | `npm test -- --run test/workout.integration.test.tsx` | all pass |
| Typecheck | `npm run typecheck` | exit 0 |

## Scope

**In scope**:
- `src/components/workout/workout.tsx`
- `src/server/api/routers/exercise.ts`
- `src/server/api/routers/workout.ts`
- `src/server/services/workout-initializer.ts`
- `test/workoutRouter.test.ts`
- `test/workoutInitializer.test.ts`
- `test/workout.integration.test.tsx`

**Out of scope**:
- Adding a new database column for normalized names unless the minimal app-layer fix cannot be made safe.
- Renaming all historical exercises.
- Changing the user-visible capitalization of an existing exercise without an explicit user action.

## Git Workflow

- Branch naming if needed: `codex/canonicalize-user-exercise-names`.
- Commit message style: short imperative, for example `Canonicalize exercise names`.

## Steps

### Step 1: Add a shared name comparison helper

Create a small helper in an appropriate existing module, or locally in the files if avoiding a new utility is cleaner:

```ts
const normalizeExerciseNameForCompare = (name: string) =>
  name.trim().toLocaleLowerCase();
```

Use it consistently for client duplicate checks and server fallback matching. Do not change display names with this helper.

**Verify**: `rg -n "toLowerCase\\(\\).*exercise|name === trimmedName" src/components/workout src/server` shows no remaining divergent duplicate check in the changed flow.

### Step 2: Canonicalize add-exercise in the workout screen

In `WorkoutComponent` `handleAddExercise`, when `exercisesQuery.data` has a case-insensitive match, use the existing exercise's exact `name` for:

- duplicate check;
- `prepareInitialWorkout.fetch`;
- draft display;
- later save payload.

This should mirror the home page builder behavior in `src/app/page.tsx`, where `const exerciseName = exact?.name ?? trimmedSearch`.

**Verify**: add or update a component test so adding `pull-ups` when suggestions include `Pull-ups` displays only `Pull-ups` once.

### Step 3: Make server name fallback deterministic

In `exercise.updateNote`, if `id` is provided, update by `{ id, userId }` and throw `NOT_FOUND` if `count === 0`.

For name fallback:

- first find the user's existing exercise by normalized comparison among likely candidates;
- if found, update by id;
- if not found, either create/upsert a user exercise by exact trimmed name or throw a clear error. Prefer upsert only if this path is still required for old drafts.

Do not silently return `{ count: 0 }`.

**Verify**: add tests for name fallback updating an existing differently-cased exercise and for the count-0 path no longer looking successful.

### Step 4: Align workout save resolver

In `resolveUserExerciseIds`, when no valid `userExerciseId` exists, canonicalize by existing user exercise name before exact-name upsert. This should happen inside the transaction after plan 004.

**Verify**: add a router test where payload exercise name differs only by case from an existing `UserExercise`; the resolver should use the existing id and not create a duplicate.

## Test Plan

- `test/workoutRouter.test.ts`: case-insensitive existing user exercise does not create a duplicate; note fallback does not silently no-op.
- `test/workoutInitializer.test.ts`: initialization uses canonical existing names when possible.
- `test/workout.integration.test.tsx`: user-facing add flow uses existing capitalization.

## Done Criteria

- [ ] Case-variant exercise names do not create duplicate `UserExercise` rows through the workout add/save flow.
- [ ] `exercise.updateNote` never reports success for zero updated rows.
- [ ] `npm test -- --run test/workoutRouter.test.ts test/workoutInitializer.test.ts test/workout.integration.test.tsx` exits 0.
- [ ] `npm run typecheck` exits 0.
- [ ] `plans/README.md` status row updated.

## STOP Conditions

Stop and report if:

- Preventing duplicates requires a schema migration for a normalized unique key.
- Old localStorage drafts cannot be supported without creating ambiguous duplicates.
- There are two existing user exercises that differ only by case; ask for a merge strategy before proceeding.

## Maintenance Notes

This is an app-layer guard. A future multi-user release should consider a database-backed normalized name key to enforce this invariant permanently.
