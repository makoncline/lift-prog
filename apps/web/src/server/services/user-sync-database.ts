import "server-only";

import { createHash } from "node:crypto";
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

export async function provisionUserSyncCredentials({
  userId,
  config,
  client,
  now = new Date(),
}: {
  userId: string;
  config: SyncPlatformConfig;
  client: SyncPlatformClient;
  now?: Date;
}) {
  const database = await getOrCreateDatabase(userId, config, client);
  const { jwt } = await client.databases.createToken(database.name, {
    expiration: "1h",
    authorization: "full-access",
  });

  return {
    enabled: true as const,
    userId,
    url: `libsql://${database.hostname}`,
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
