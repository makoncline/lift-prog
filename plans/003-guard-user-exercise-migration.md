# Plan 003: Add Guardrails To The UserExercise Migration

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report; do not improvise. When done, update the status row for this plan in `plans/README.md` unless a reviewer told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 92dd3c7..HEAD -- prisma/migrations/20260618160000_user_exercises/migration.sql docs/DB.md`
> If an in-scope file changed since this plan was written, compare the "Current state" excerpts against live code before proceeding. On mismatch, stop and report.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/001-fix-weight-helper-typecheck.md
- **Category**: migration
- **Planned at**: commit `92dd3c7`, 2026-06-18

## Why This Matters

The production Turso migration is manual and touches historical workout data. The migration rebuilds `WorkoutExercise` with inner joins, then drops the old table. If any old row does not match the join, it is silently omitted before the drop, causing historical data loss.

## Current State

- `prisma/migrations/20260618160000_user_exercises/migration.sql` creates `UserExercise`, backfills it, rebuilds `WorkoutExercise`, then drops the original table.
- `docs/DB.md` documents the manual Turso migration process, but not count checks or fail-fast guardrails.

Relevant excerpts:

```sql
-- prisma/migrations/20260618160000_user_exercises/migration.sql:60
INSERT INTO "new_WorkoutExercise" (
...
FROM "WorkoutExercise"
INNER JOIN "Workout" ON "Workout"."id" = "WorkoutExercise"."workoutSessionId"
INNER JOIN "UserExercise" ON
    "UserExercise"."userId" = "Workout"."userId"
    AND "UserExercise"."exerciseId" = "WorkoutExercise"."exerciseId";

-- line 85
DROP TABLE "WorkoutExercise";
```

## Commands You Will Need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| SQL lint-ish smoke | `sqlite3 --version` | exit 0 and prints a version, if sqlite3 is installed |
| Typecheck | `npm run typecheck` | exit 0 |
| Focused router/initializer tests | `npm test -- --run test/workoutRouter.test.ts test/workoutInitializer.test.ts` | all pass |

## Scope

**In scope**:
- `prisma/migrations/20260618160000_user_exercises/migration.sql`
- `docs/DB.md`

**Out of scope**:
- Applying the migration to production.
- Creating Turso backup branches.
- Changing Prisma schema shape beyond what this migration already represents.

## Git Workflow

- Branch naming if needed: `codex/guard-user-exercise-migration`.
- Commit message style: short imperative, for example `Guard user exercise migration`.

## Steps

### Step 1: Add fail-fast count checks before dropping old tables

Add temp validation before `DROP TABLE "WorkoutExercise"` so SQLite aborts if the inserted row count differs from the original row count. One simple pattern:

```sql
CREATE TEMP TABLE "__migration_assert" (
    "ok" INTEGER NOT NULL CHECK ("ok" = 1)
);

INSERT INTO "__migration_assert" ("ok")
SELECT CASE
    WHEN (SELECT COUNT(*) FROM "WorkoutExercise") =
         (SELECT COUNT(*) FROM "new_WorkoutExercise")
    THEN 1
    ELSE 0
END;
```

Use a second check for `UserExercise` backfill count if helpful. Keep the check before any destructive drop.

**Verify**: inspect the SQL manually and confirm every destructive `DROP TABLE` is preceded by a relevant count check.

### Step 2: Add post-migration integrity checks to docs

Update `docs/DB.md` with the manual workflow:

1. create a Turso backup branch first;
2. export or copy production to a local SQLite rehearsal database;
3. apply the migration SQL locally;
4. verify counts for `Workout`, `WorkoutExercise`, and `WorkoutExerciseSet`;
5. run `PRAGMA foreign_key_check;`;
6. only then apply the same SQL to production.

Do not include secret tokens or production auth values.

**Verify**: `rg -n "foreign_key_check|backup|WorkoutExercise" docs/DB.md` shows the documented checks.

### Step 3: If sqlite3 is available, rehearse on a disposable database

Do not mutate `prisma/dev.db`. Use a temp copy or temp database only. If a realistic local prod copy exists, use that. Otherwise, skip this step and record that it was unavailable.

Example command shape:

```sh
sqlite3 /private/tmp/lift-migration-rehearsal.db < prisma/migrations/20260618160000_user_exercises/migration.sql
```

**Verify**: command exits 0 on a representative database. If it fails because the temp DB has no old schema, do not treat that as a source failure; report that no representative DB was available.

## Test Plan

No app tests directly exercise raw migration SQL. The verification is SQL inspection plus, when available, a disposable local rehearsal database.

## Done Criteria

- [ ] Migration SQL aborts before dropping `WorkoutExercise` if rebuilt row counts do not match.
- [ ] `docs/DB.md` documents backup-first and local rehearsal verification.
- [ ] No production DB command was run as part of this plan.
- [ ] `npm run typecheck` exits 0.
- [ ] `plans/README.md` status row updated.

## STOP Conditions

Stop and report if:

- The migration has already been applied to production and editing the old migration file would no longer represent reality.
- SQLite rejects the chosen fail-fast assertion pattern in a representative rehearsal.
- A count mismatch appears in rehearsal data.

## Maintenance Notes

The user prefers one big production migration after a backup branch, but the migration should still fail fast. Future manual Turso migrations should include row-count and `foreign_key_check` steps in the SQL or adjacent checklist.
