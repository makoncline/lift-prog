import { LOCAL_FIRST_MIGRATIONS } from "@lift-prog/workout-sdk";

import type { LocalDatabase } from "./database-port";

export const LOCAL_MIGRATIONS = LOCAL_FIRST_MIGRATIONS;

export async function runLocalMigrations(database: LocalDatabase) {
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

    // The current React Native sync SDK cannot keep an explicit SQL
    // transaction open across run() calls. Each statement is idempotent so an
    // interrupted migration can run again before its version is recorded.
    for (const statement of migration.statements) {
      try {
        await database.run(statement);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
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
  }
}
