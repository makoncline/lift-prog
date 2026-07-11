import "server-only";

import { createHash } from "node:crypto";
import { createClient as createDatabaseClient } from "@libsql/client";
import {
  getLocalFirstMigrationStatements,
  LOCAL_FIRST_MIGRATIONS,
} from "@lift-prog/workout-sdk";
import {
  createClient,
  type Database,
  type CreatedDatabase,
} from "@tursodatabase/api";

type DatabaseReference = Pick<Database | CreatedDatabase, "hostname" | "name">;

type SyncPlatformConfig = {
  org: string;
  token: string;
  group: string;
};

type SyncPlatformClient = ReturnType<typeof createClient>;

type UserSyncDatabaseClient = Pick<
  ReturnType<typeof createDatabaseClient>,
  "execute"
>;

function errorStatus(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    return error.status;
  }
  return null;
}

export function userSyncDatabaseName(userId: string) {
  const digest = createHash("sha256").update(userId).digest("hex").slice(0, 32);
  return `lift-user-${digest}`;
}

export function readSyncPlatformConfig(): SyncPlatformConfig | null {
  const org = process.env.TURSO_PLATFORM_ORG?.trim();
  const token = process.env.TURSO_PLATFORM_TOKEN?.trim();
  if (!org || !token) return null;

  return {
    org,
    token,
    group: process.env.TURSO_USER_DB_GROUP?.trim() || "default",
  };
}

async function getOrCreateDatabase(
  userId: string,
  config: SyncPlatformConfig,
  client: SyncPlatformClient,
): Promise<DatabaseReference> {
  const databaseName = userSyncDatabaseName(userId);

  try {
    return await client.databases.get(databaseName);
  } catch (error) {
    if (errorStatus(error) !== 404) {
      throw error;
    }
  }

  try {
    return await client.databases.create(databaseName, {
      group: config.group,
    });
  } catch (error) {
    // Concurrent first requests may race. Resolve the winner instead of
    // creating a second database or surfacing an avoidable conflict.
    if (errorStatus(error) === 409) {
      return client.databases.get(databaseName);
    }
    throw error;
  }
}

export async function ensureUserSyncDatabaseSchema(
  database: UserSyncDatabaseClient,
) {
  await database.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const appliedResult = await database.execute(
    "SELECT version FROM schema_migrations ORDER BY version ASC",
  );
  const applied = new Set(
    appliedResult.rows.flatMap((row) =>
      typeof row.version === "number" ? [row.version] : [],
    ),
  );

  for (const migration of LOCAL_FIRST_MIGRATIONS) {
    if (applied.has(migration.version)) continue;

    for (const statement of getLocalFirstMigrationStatements(migration.sql)) {
      await database.execute(statement);
    }
    await database.execute({
      sql: `INSERT OR IGNORE INTO schema_migrations (version, applied_at)
            VALUES (?, ?)`,
      args: [migration.version, new Date().toISOString()],
    });
  }
}

export async function provisionUserSyncCredentials({
  userId,
  config,
  client,
  now = new Date(),
  connectToDatabase = ({ url, authToken }) =>
    createDatabaseClient({ url, authToken }),
}: {
  userId: string;
  config: SyncPlatformConfig;
  client: SyncPlatformClient;
  now?: Date;
  connectToDatabase?: (credentials: {
    url: string;
    authToken: string;
  }) => ReturnType<typeof createDatabaseClient>;
}) {
  const database = await getOrCreateDatabase(userId, config, client);
  const { jwt } = await client.databases.createToken(database.name, {
    expiration: "1h",
    authorization: "full-access",
  });
  const url = `libsql://${database.hostname}`;
  const syncDatabase = connectToDatabase({ url, authToken: jwt });
  try {
    await ensureUserSyncDatabaseSchema(syncDatabase);
  } finally {
    syncDatabase.close();
  }

  return {
    enabled: true as const,
    userId,
    url,
    authToken: jwt,
    expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
  };
}

export async function getUserSyncCredentials(userId: string) {
  const config = readSyncPlatformConfig();
  if (!config) {
    return { enabled: false as const, userId };
  }

  const client = createClient({ org: config.org, token: config.token });
  return provisionUserSyncCredentials({
    userId,
    config,
    client,
  });
}

export async function deleteUserSyncDatabase(userId: string) {
  const config = readSyncPlatformConfig();
  if (!config) return;

  const client = createClient({ org: config.org, token: config.token });
  return deleteProvisionedUserSyncDatabase({ userId, client });
}

export async function deleteProvisionedUserSyncDatabase({
  userId,
  client,
}: {
  userId: string;
  client: SyncPlatformClient;
}) {
  try {
    await client.databases.delete(userSyncDatabaseName(userId));
  } catch (error) {
    if (errorStatus(error) !== 404) throw error;
  }
}
