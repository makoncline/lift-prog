import type { Database } from "@tursodatabase/sync-react-native";
import {
  getLocalFirstMigrationStatements,
  LOCAL_FIRST_MIGRATIONS,
} from "@lift-prog/workout-sdk";

import { withLocalTransaction } from "./transaction";

export const LOCAL_MIGRATIONS = LOCAL_FIRST_MIGRATIONS;

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
      const statements = getLocalFirstMigrationStatements(migration.sql);
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
