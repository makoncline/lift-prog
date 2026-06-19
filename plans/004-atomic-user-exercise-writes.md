# Plan 004: Make Workout Save User-Exercise Writes Atomic

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report; do not improvise. When done, update the status row for this plan in `plans/README.md` unless a reviewer told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 92dd3c7..HEAD -- src/server/api/routers/workout.ts test/workoutRouter.test.ts`
> If an in-scope file changed since this plan was written, compare the "Current state" excerpts against live code before proceeding. On mismatch, stop and report.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/001-fix-weight-helper-typecheck.md
- **Category**: bug
- **Planned at**: commit `92dd3c7`, 2026-06-18

## Why This Matters

`saveWorkout` and `updateWorkout` currently create/update `UserExercise` rows before the workout transaction begins. If the later workout write fails, durable exercise names or pinned notes can still be changed. The user is moving toward DB-backed editing, so save paths need clean transactional behavior.

## Current State

Relevant excerpts:

```ts
// src/server/api/routers/workout.ts:109
const userExerciseIdByName = await resolveUserExerciseIds({
  prisma,
  userId,
  exercises,
});

// line 116
return prisma.$transaction(async (tx) => {
```

```ts
// src/server/api/routers/workout.ts:219
const userExerciseIdByName = await resolveUserExerciseIds({
  prisma,
  userId,
  exercises,
});

// line 225
return prisma.$transaction(async (tx) => {
```

`resolveUserExerciseIds` writes via `prisma.userExercise.update` and `prisma.userExercise.upsert`.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Router tests | `npm test -- --run test/workoutRouter.test.ts` | all pass |
| Typecheck | `npm run typecheck` | exit 0 |

## Scope

**In scope**:
- `src/server/api/routers/workout.ts`
- `test/workoutRouter.test.ts`

**Out of scope**:
- Changing `CompletedWorkoutSchema`.
- Changing client workout UI behavior.
- Reworking all exercise APIs. Name fallback cleanup is plan 005.

## Git Workflow

- Branch naming if needed: `codex/atomic-user-exercise-writes`.
- Commit message style: short imperative, for example `Make workout save atomic`.

## Steps

### Step 1: Allow resolver to use a transaction client

Change the `resolveUserExerciseIds` `prisma` type so it can accept the transaction client used inside `prisma.$transaction`. A common pattern is:

```ts
type WorkoutPrisma = Pick<PrismaClient, "userExercise" | "exercise">;
```

or infer the transaction type locally if practical. Do not use `any` unless the existing tests force a temporary mock type; prefer a narrow Pick.

**Verify**: `npm run typecheck` should not report type errors in `workout.ts`.

### Step 2: Move resolution inside `saveWorkout` transaction

Inside the `saveWorkout` transaction callback, call `resolveUserExerciseIds({ prisma: tx, ... })` before creating the workout. Then create the workout and workout exercises as today.

**Verify**: `npm test -- --run test/workoutRouter.test.ts` still passes or fails only because mocks need Step 4 updates.

### Step 3: Move resolution inside `updateWorkout` transaction

Keep the ownership existence check before the transaction. Move `resolveUserExerciseIds` into the transaction callback before updating/deleting/recreating workout records.

**Verify**: `npm test -- --run test/workoutRouter.test.ts` still passes or fails only because mocks need Step 4 updates.

### Step 4: Update router tests to assert transaction boundaries

The current mock transaction passes a `tx` object with only workout-related delegates. Add `exercise` and `userExercise` delegates to the transaction mock and assert resolver calls use those transaction delegates, not the outer context delegates.

Add one regression test:

- make `workoutExerciseSet.createMany` throw inside the transaction;
- verify the promise rejects;
- verify durable `userExercise` writes were attempted only on `tx`, not on the outer `ctx.db`.

**Verify**: `npm test -- --run test/workoutRouter.test.ts` exits 0.

## Test Plan

- Update existing `saveWorkout` tests to account for transaction-local resolver calls.
- Add failure/rollback-boundary regression test in `test/workoutRouter.test.ts`.
- Run `npm run typecheck`.

## Done Criteria

- [ ] No `resolveUserExerciseIds` call occurs before `$transaction` in `saveWorkout` or `updateWorkout`.
- [ ] Router tests prove user-exercise delegates are called on the transaction client.
- [ ] `npm test -- --run test/workoutRouter.test.ts` exits 0.
- [ ] `npm run typecheck` exits 0.
- [ ] `plans/README.md` status row updated.

## STOP Conditions

Stop and report if:

- Moving resolver calls inside the transaction requires changing public API payloads.
- Prisma transaction client typing cannot be solved without broad `any` types.
- Tests reveal existing behavior depends on durable exercise writes committing even when workout save fails.

## Maintenance Notes

Future DB-backed draft saves should use this same transaction boundary: durable exercise metadata and workout rows should commit or roll back together.
