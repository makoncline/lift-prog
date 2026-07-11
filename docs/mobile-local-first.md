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

`packages/workout-sdk/src/local-first-schema.ts` contains the shared append-only, monotonically numbered migrations. The mobile database runner and server-side per-user database provisioner both consume that list. Never edit a migration after a released build has used it.

Turso Sync does not copy client-created DDL to an empty remote database. Before the API returns sync credentials, it applies every pending shared migration to the per-user remote database. The mobile client then runs the same migrations locally before it pushes or pulls. This ordering is required for both first-device imports and empty-device restores.

The React Native Turso SDK currently requires statements to be executed through `Database.run()`. Do not use `Database.exec()`, manual `BEGIN`/`COMMIT` statements, or the SDK's `Database.transaction()` helper in version 0.6.1. Manual transaction control either fails parsing or reports `no transaction is active` after writes have already autocommitted. Keep multi-write operations behind `withLocalTransaction()` as an idempotent operation boundary; every migration statement and import write must be safe to retry. Restore true atomic transactions there when the SDK supports them reliably.

Before releasing a migration:

1. Upgrade a database created by the previous released app.
2. Create a database from an empty install.
3. Verify stored aggregates still parse through their versioned Zod schemas.
4. Keep destructive data transforms in a new migration and preserve a recovery copy until the release is verified.

## Optional cloud sync

When `TURSO_PLATFORM_ORG` and `TURSO_PLATFORM_TOKEN` are configured, the authenticated API provisions one opaque database per stable app user, migrates it to the current shared schema, and returns a one-hour database-scoped token. Set `TURSO_USER_DB_GROUP=lift-users` so newly provisioned databases stay isolated from unrelated Turso projects. The central `UserSyncDatabase` registry records the opaque database name, group, status, and schema version for support and deletion workflows without exposing email addresses in Turso resource names. Existing databases can remain in their original group and are registered explicitly because Turso does not support moving an individual database between groups in place.

Mobile reopens the same local file in sync mode, refreshes that token through the authenticated API, then pushes and pulls while all UI reads and writes remain local. Without the platform variables, the API reports sync disabled and the app remains fully local-only.

Deleting an account also deletes its deterministic per-user sync database before removing the app and authentication records. A missing sync database is treated as already deleted. This operation never targets the legacy shared database.

Mobile coalesces local writes into background pushes, retries when connectivity returns or the app enters the foreground, and shows the backup state in Settings. Local reads and writes never wait for that process.

Turso resolves concurrent statements with last-push-wins semantics. The app uses that rule at the workout aggregate and user-exercise row boundaries. Stable IDs let independently created workouts coexist; concurrent edits to the same workout intentionally resolve to the last pushed aggregate. Workout deletion also writes an independent tombstone, so a stale edit from another device cannot make a deleted workout visible again.

On July 10, 2026, the matching official Turso Sync `0.6.1` engine was exercised against an isolated temporary cloud database with two writers and an empty restore client. Independent workout inserts merged, the later push won a same-workout edit, the tombstone prevented stale resurrection, and the empty client restored the surviving rows. The temporary database was deleted after the test.

The remaining cloud work is:

1. Verify the complete authenticated React Native app restore from an empty second Simulator installation before enabling platform credentials in production.

Never point this path at the legacy shared `lift-prog` database.
