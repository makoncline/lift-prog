import type { Database } from "@tursodatabase/sync-react-native";

import { withLocalTransaction } from "./transaction";

type Migration = {
  version: number;
  sql: string;
};

export const LOCAL_MIGRATIONS: Migration[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS app_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS user_exercises (
        id TEXT PRIMARY KEY,
        legacy_server_id INTEGER UNIQUE,
        catalog_exercise_id TEXT,
        name TEXT NOT NULL,
        notes TEXT,
        plate_starting_weight REAL,
        plate_load_mode TEXT,
        rest_warmup_seconds INTEGER,
        rest_working_seconds INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );

      CREATE INDEX IF NOT EXISTS user_exercises_updated_at_idx
        ON user_exercises(updated_at);

      CREATE TABLE IF NOT EXISTS workouts (
        id TEXT PRIMARY KEY,
        legacy_server_id INTEGER UNIQUE,
        name TEXT NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        body_weight_lb REAL,
        aggregate_json TEXT NOT NULL,
        schema_version INTEGER NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );

      CREATE INDEX IF NOT EXISTS workouts_completed_at_idx
        ON workouts(completed_at DESC);
      CREATE INDEX IF NOT EXISTS workouts_updated_at_idx
        ON workouts(updated_at);

      CREATE TABLE IF NOT EXISTS active_workout_draft (
        slot TEXT PRIMARY KEY,
        aggregate_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
  {
    version: 2,
    sql: `
      CREATE TABLE IF NOT EXISTS quarantined_workout_draft (
        slot TEXT PRIMARY KEY,
        aggregate_json TEXT NOT NULL,
        reason TEXT NOT NULL,
        quarantined_at TEXT NOT NULL
      );
    `,
  },
];

export async function runLocalMigrations(database: Database) {
  await database.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const rows = await database.all(
    "SELECT version FROM schema_migrations ORDER BY version ASC",
  );
  const applied = new Set(
    rows.flatMap((row) =>
      typeof row.version === "number" ? [row.version] : [],
    ),
  );

  for (const migration of LOCAL_MIGRATIONS) {
    if (applied.has(migration.version)) continue;

    await withLocalTransaction(database, async () => {
      // The current React Native sync SDK cannot keep an explicit SQL
      // transaction open across run() calls. Every migration statement must
      // therefore be safe to retry until true transaction support is restored
      // in withLocalTransaction().
      const statements = migration.sql
        .split(";")
        .map((statement) => statement.trim())
        .filter(Boolean);
      for (const statement of statements) {
        try {
          await database.run(statement);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          throw new Error(
            `Migration ${migration.version} failed for ${statement.slice(0, 80)}: ${message}`,
          );
        }
      }
      await database.run(
        "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)",
        migration.version,
        new Date().toISOString(),
      );
    });
  }
}
