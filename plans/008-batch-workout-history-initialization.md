# Plan 008: Batch Workout History Initialization Queries

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report; do not improvise. When done, update the status row for this plan in `plans/README.md` unless a reviewer told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 92dd3c7..HEAD -- src/server/services/workout-initializer.ts test/workoutInitializer.test.ts`
> If an in-scope file changed since this plan was written, compare the "Current state" excerpts against live code before proceeding. On mismatch, stop and report.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/002-preserve-past-workout-edit-notes.md
- **Category**: perf
- **Planned at**: commit `92dd3c7`, 2026-06-18

## Why This Matters

Starting or editing a workout queries history once per exercise. That is acceptable for small personal workouts, but this path is now central to every workout start/edit and will get noisier with more exercises or users. Batching makes the initializer simpler to reason about and lowers latency without changing UI.

## Current State

Relevant excerpts:

```ts
// src/server/services/workout-initializer.ts:148
const results = await Promise.all(
  exerciseNames.map(async (exerciseName) => {
...
    const exerciseHistory = await prisma.workoutExercise.findMany({
```

```ts
// src/server/services/workout-initializer.ts:286
const exercises: PreviousExerciseData[] = await Promise.all(
  workout.workoutExercises.map(async (workoutExercise) => {
...
    const exerciseHistory = await prisma.workoutExercise.findMany({
```

Both paths use `HISTORY_LIMIT = 6`.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Initializer tests | `npm test -- --run test/workoutInitializer.test.ts` | all pass |
| Typecheck | `npm run typecheck` | exit 0 |

## Scope

**In scope**:
- `src/server/services/workout-initializer.ts`
- `test/workoutInitializer.test.ts`

**Out of scope**:
- Changing history UI display.
- Changing the history limit.
- Using raw SQL unless Prisma cannot express the needed grouping safely.

## Git Workflow

- Branch naming if needed: `codex/batch-workout-history`.
- Commit message style: short imperative, for example `Batch workout history initialization`.

## Steps

### Step 1: Add a helper to fetch histories for many user exercises

Create a helper in `workout-initializer.ts`, for example:

```ts
async function getHistoriesByUserExerciseId({
  prisma,
  userId,
  userExerciseIds,
}: ...): Promise<Map<number, WorkoutExerciseHistoryRecord[]>>
```

Use one `prisma.workoutExercise.findMany` with `userExerciseId: { in: userExerciseIds }`, the same `workout.userId` and `completedAt` filters, the same select shape, and order by completed date descending.

Group records in memory by `userExerciseId` and slice each group to `HISTORY_LIMIT`.

**Verify**: `npm run typecheck` reports any missing type fields. Add `userExerciseId` to the select if needed for grouping.

### Step 2: Use the helper in `buildInitialExercisesForNames`

After fetching user exercises, call the helper once for all IDs. Replace the per-exercise `findMany` call with a map lookup.

**Verify**: update mocks in `test/workoutInitializer.test.ts`; `npm test -- --run test/workoutInitializer.test.ts` should pass or fail only where expected call counts changed.

### Step 3: Use the helper in `buildInitialExercisesFromWorkout`

After loading the target workout and its `userExercise` ids, call the helper once and use map lookups inside the returned exercises.

Preserve the edit-vs-copy note behavior from plan 002.

**Verify**: `npm test -- --run test/workoutInitializer.test.ts` exits 0.

### Step 4: Add call-count assertions

Add or update tests to assert `mocks.workoutExercise.findMany` is called once for two exercises in each initializer path, not once per exercise.

**Verify**: targeted test exits 0.

## Test Plan

- Existing initializer tests should still cover ordering and history mapping.
- Add call-count assertions for batched history fetch.

## Done Criteria

- [ ] Both initializer paths fetch history with one query for all exercise IDs.
- [ ] Each exercise still receives at most `HISTORY_LIMIT` history entries.
- [ ] `npm test -- --run test/workoutInitializer.test.ts` exits 0.
- [ ] `npm run typecheck` exits 0.
- [ ] `plans/README.md` status row updated.

## STOP Conditions

Stop and report if:

- Prisma cannot select enough data to group histories without raw SQL.
- Batching changes the order of exercises in the initialized workout.
- The helper would need to fetch unbounded history for a large production user without a reasonable cap.

## Maintenance Notes

If per-exercise history grows large, revisit this with a SQL window function or cursor table. For now, a single grouped query is a pragmatic improvement.
