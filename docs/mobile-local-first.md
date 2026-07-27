# Mobile local-first data

The iOS app treats its local Turso database as the source of truth for workout data. Opening workout history, starting a workout, editing a draft, and finishing a workout do not require the API.

## Local data ownership

- `workouts` stores each completed workout as one versioned JSON aggregate. A workout save is one atomic row write and is the future sync conflict boundary.
- `user_exercises` stores user-owned exercise preferences separately from workout history.
- `active_workout_draft` stores the single resumable in-progress workout.
- `quarantined_workout_draft` preserves an unreadable draft for recovery instead of silently discarding it.
- `app_metadata` stores local account ownership and recovery state.
- IDs are generated on the device. Imported server integer IDs are retained only as `legacy_server_id` metadata.
- Deleted records use tombstones so a later cloud sync cannot resurrect them.
- An imported local database is bound to one authenticated account. A different signed-in account cannot open or import into that database; deleting the account clears the local database and its binding.

The shared exercise catalog must remain a separate, remotely replaceable database. It must not be mixed into the user's workout database or its sync stream.

## Completed legacy migration

The only legacy user database was reconciled into its phone database and
per-user Turso database. Both copies were verified with 122 workouts. The
legacy shared database export and recovery branch remain available as manual
recovery sources.

The mobile app no longer imports from the legacy API during startup. Keep the
server export endpoint only as a maintenance tool until the legacy database is
retired. New installations restore from the user's per-user Turso database.

## Migrations

`packages/workout-sdk/src/local-first-schema.ts` contains the shared append-only, monotonically numbered migrations. The mobile database runner and server-side per-user database provisioner both consume that list. Never edit a migration after a released build has used it.

Turso Sync does not copy client-created DDL to an empty remote database. Before the API returns sync credentials, it applies every pending shared migration to the per-user remote database. The mobile client then runs the same migrations locally before it pushes or pulls. This ordering is required for both first-device imports and empty-device restores.

The React Native Turso SDK currently requires statements to be executed through `Database.run()`. Do not use `Database.exec()`, manual `BEGIN`/`COMMIT` statements, or the SDK's `Database.transaction()` helper in version 0.6.1. Manual transaction control either fails parsing or reports `no transaction is active` after writes have already autocommitted. Multi-write operations must use an explicit, idempotent order so an interrupted operation can run again safely. Restore true atomic transactions when the SDK supports them reliably.

Before releasing a migration:

1. Upgrade a database created by the previous released app.
2. Create a database from an empty install.
3. Verify stored aggregates still parse through their versioned Zod schemas.
4. Keep destructive data transforms in a new migration and preserve a recovery copy until the release is verified.

## Optional cloud sync

When `TURSO_PLATFORM_ORG` and `TURSO_PLATFORM_TOKEN` are configured, the authenticated API provisions one opaque database per stable app user, migrates it to the current shared schema, and returns a one-hour database-scoped token. Set `TURSO_USER_DB_GROUP=lift-users` so newly provisioned databases stay isolated from unrelated Turso projects. The central `UserSyncDatabase` registry records the opaque database name, group, status, and schema version for support and deletion workflows without exposing email addresses in Turso resource names. Existing databases can remain in their original group and are registered explicitly because Turso does not support moving an individual database between groups in place.

Mobile reopens the same local file in sync mode, refreshes that token through the authenticated API, then pushes and pulls while all UI reads and writes remain local. Without the platform variables, the API reports sync disabled and the app remains fully local-only.

Before opening a synchronized connection, the app binds an unbound local
database to the authenticated app user. A database already bound to another
user is rejected before any push. This prevents local data from reaching the
wrong per-user database.

Connecting cloud backup merges independent local and remote records:

- A new phone with an empty local database restores the remote database.
- A phone with local-only workouts pushes those UUID-addressed workouts and
  then pulls existing remote workouts. Both sets remain.
- Two devices that created different workouts while local-only converge after
  both sign in and sync. Each device receives both workouts after its next
  synchronization.
- Concurrent changes to the same workout, exercise preference, or active draft
  are not field-merged. Turso uses last-push-wins for that row.
- Independently created custom exercises can remain separate even when they
  have the same name because they have different IDs.
- The app supports one active workout draft per account. Starting different
  active workouts on two offline devices is not a supported merge case; the
  last pushed draft wins. Completed workouts use independent IDs and coexist.
- Signing out keeps the local workout log and its account binding. Signing back
  into the same account resumes synchronization. A different account is
  rejected before sync instead of receiving the first account's local data.
- Uninstalling the app before a pending offline change reaches Turso can still
  lose that unsynchronized change. Settings shows when backup is waiting for a
  connection; do not treat an unconfirmed pending state as a cloud backup.

Deleting an account records the per-user database in
`UserSyncDatabaseDeletion` in the same central transaction that removes the
app and authentication records. The server then attempts the external Turso
deletion. A failed external deletion remains queued with its error and attempt
time so maintenance can retry it. Untried requests run before earlier failures,
and queue maintenance is not part of the mobile sync-credential request path.
A missing sync database is treated as already deleted. This operation never
targets the legacy shared database.

Vercel calls `/api/maintenance/sync-database-deletions` daily with
`CRON_SECRET`. The job retries a bounded queue batch and writes a structured
success or failure event to server logs.

After cloud sync connects, mobile coalesces local writes into background pushes and retries when connectivity returns or the app enters the foreground. If the initial cloud connection fails, Settings shows the pending state and `Back Up Now` retries bootstrap. Local reads and writes never wait for cloud access.

Turso resolves concurrent statements with last-push-wins semantics. The app uses that rule at the workout aggregate and user-exercise row boundaries. Stable IDs let independently created workouts coexist; concurrent edits to the same workout intentionally resolve to the last pushed aggregate. Workout deletion also writes an independent tombstone, so a stale edit from another device cannot make a deleted workout visible again.

On July 10, 2026, the matching official Turso Sync `0.6.1` engine was exercised against an isolated temporary cloud database with two writers and an empty restore client. Independent workout inserts merged, the later push won a same-workout edit, the tombstone prevented stale resurrection, and the empty client restored the surviving rows. The temporary database was deleted after the test.

Before a public multi-user release, verify the complete authenticated restore
from an empty second installation and add a user-facing choice before merging a
non-empty local database with a non-empty remote database. Automatic union is
safe for independent workout IDs, but the choice makes account intent clear.

Never point this path at the legacy shared `lift-prog` database.
