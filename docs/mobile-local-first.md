# Mobile local-first data

The iOS app treats its local Turso database as the source of truth for workout data. Opening workout history, starting a workout, editing a draft, and finishing a workout do not require the API.

## Local data ownership

- `workouts` stores each completed workout as one versioned JSON aggregate. A workout save is one atomic row write and is the future sync conflict boundary.
- `user_exercises` stores user-owned exercise preferences separately from workout history.
- `active_workout_draft` stores the single resumable in-progress workout.
- `quarantined_workout_draft` preserves an unreadable draft for recovery instead of silently discarding it.
- `app_metadata` stores idempotent bootstrap markers.
- IDs are generated on the device. Imported server integer IDs are retained only as `legacy_server_id` metadata.
- Deleted records use tombstones so a later cloud sync cannot resurrect them.
- An imported local database is bound to one authenticated account. A different signed-in account cannot open or import into that database; deleting the account clears the local database and its binding.

The shared exercise catalog must remain a separate, remotely replaceable database. It must not be mixed into the user's workout database or its sync stream.

## Production bootstrap

An authenticated installation with no local workout data downloads `workout.exportCurrentUserData` once and imports it as an idempotent write batch. Import completion is scoped to that account. Development can instead set `EXPO_PUBLIC_PRODUCTION_IMPORT_URL` to a private, read-only export file.

The import is idempotent by `legacy_server_id`. It never writes to the existing production `lift-prog` database. The current migration snapshot was verified with 116 workouts and 28 user exercises.

## Migrations

`apps/mobile/src/local-first/migrations.ts` contains append-only, monotonically numbered migrations. Never edit a migration after a released build has used it.

The React Native Turso SDK currently requires statements to be executed through `Database.run()`. Do not use `Database.exec()`, manual `BEGIN`/`COMMIT` statements, or the SDK's `Database.transaction()` helper in version 0.6.1. Manual transaction control either fails parsing or reports `no transaction is active` after writes have already autocommitted. Keep multi-write operations behind `withLocalTransaction()` as an idempotent operation boundary; every migration statement and import write must be safe to retry. Restore true atomic transactions there when the SDK supports them reliably.

Before releasing a migration:

1. Upgrade a database created by the previous released app.
2. Create a database from an empty install.
3. Verify stored aggregates still parse through their versioned Zod schemas.
4. Keep destructive data transforms in a new migration and preserve a recovery copy until the release is verified.

## Optional cloud sync

`openLocalDatabase` accepts a remote URL and token provider so the same local database can later use Turso push/pull. The remaining cloud work is intentionally outside this change:

1. Provision one new Turso database per app user. Do not sync against the legacy shared `lift-prog` database.
2. Add an authenticated API endpoint that returns only that user's database URL and a short-lived token.
3. Add explicit push/pull orchestration, retry state, and conflict handling at workout aggregate and user-exercise row boundaries.
4. Keep all workout UI reads and writes local regardless of sync status.
