import { Database, getDbPath } from "@tursodatabase/sync-react-native";

import { runLocalMigrations } from "./migrations";

export type LocalDatabaseSyncConfig = {
  url: string;
  authToken: () => Promise<string>;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

let databasePromise: Promise<Database> | null = null;

export function openLocalDatabase(sync?: LocalDatabaseSyncConfig) {
  if (databasePromise) return databasePromise;

  databasePromise = (async () => {
    const path = getDbPath("lift-prog-user.db");
    const database = new Database({
      path,
      ...(sync
        ? {
            url: sync.url,
            authToken: sync.authToken,
            bootstrapIfEmpty: true,
            clientName: "lift-prog-ios",
          }
        : {}),
    });
    try {
      await database.connect();
    } catch (error) {
      throw new Error(
        `Could not open local database at ${path}: ${errorMessage(error)}`,
      );
    }
    try {
      await runLocalMigrations(database);
    } catch (error) {
      database.close();
      throw new Error(
        `Could not migrate local database: ${errorMessage(error)}`,
      );
    }
    return database;
  })().catch((error) => {
    databasePromise = null;
    throw error;
  });

  return databasePromise;
}

export async function closeLocalDatabaseConnection() {
  const database = await databasePromise;
  database?.close();
  databasePromise = null;
}

export async function reopenLocalDatabaseWithSync(
  sync: LocalDatabaseSyncConfig,
) {
  const database = await databasePromise;
  database?.close();
  databasePromise = null;
  return openLocalDatabase(sync);
}
