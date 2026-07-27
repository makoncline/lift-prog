import {
  createWorkoutApiClient,
  type LocalSyncCredentialsResult,
} from "@lift-prog/workout-sdk";
import type { Database } from "@tursodatabase/sync-react-native";

import { mobileWorkoutApiBaseUrl } from "../lib/config";
import {
  closeLocalDatabaseConnection,
  openLocalDatabase,
  reopenLocalDatabaseWithSync,
} from "./database";
import {
  createLocalSyncCoordinator,
  type LocalSyncCoordinator,
  type LocalSyncStatus,
} from "./sync-coordinator";
import {
  bindOrAssertLocalAuthAccount,
  bindOrAssertLocalUserAccount,
  clearLegacyLocalAccountBinding,
} from "./workout-repository";

type BootstrapLocalWorkoutStoreOptions = {
  accountId?: string;
  getHeaders?: () => Promise<Record<string, string>>;
  isCurrent?: () => boolean;
  onPulled?: () => void;
  onSyncError?: (error: unknown) => void;
  onSyncStatusChange?: (status: LocalSyncStatus) => void;
};

export type LocalWorkoutStore = {
  database: Database;
  syncCoordinator: LocalSyncCoordinator | null;
};

export class StaleLocalWorkoutStoreBootstrapError extends Error {
  constructor() {
    super("A newer local workout store configuration replaced this request.");
    this.name = "StaleLocalWorkoutStoreBootstrapError";
  }
}

let bootstrapQueue: Promise<void> = Promise.resolve();

function assertCurrent(isCurrent?: () => boolean) {
  if (isCurrent?.() === false) {
    throw new StaleLocalWorkoutStoreBootstrapError();
  }
}

function serializeBootstrap<T>(operation: () => Promise<T>) {
  const result = bootstrapQueue.then(operation, operation);
  bootstrapQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export function bootstrapLocalWorkoutStore(
  options: BootstrapLocalWorkoutStoreOptions,
): Promise<LocalWorkoutStore> {
  return serializeBootstrap(() => bootstrapLocalWorkoutStoreExclusive(options));
}

async function bootstrapLocalWorkoutStoreExclusive({
  accountId,
  getHeaders,
  isCurrent,
  onPulled,
  onSyncError,
  onSyncStatusChange,
}: BootstrapLocalWorkoutStoreOptions): Promise<LocalWorkoutStore> {
  assertCurrent(isCurrent);
  let database = await openLocalDatabase();
  assertCurrent(isCurrent);
  let authBinding = "verified";
  if (accountId) {
    authBinding = await bindOrAssertLocalAuthAccount(database, accountId, {
      bindIfUnbound: true,
    });
  }
  assertCurrent(isCurrent);
  if (!getHeaders) {
    if (authBinding === "requires-canonical-verification") {
      throw new Error(
        "Connect to the internet to verify ownership of this local workout log.",
      );
    }
    return { database, syncCoordinator: null };
  }

  const identityClient = createWorkoutApiClient({
    baseUrl: mobileWorkoutApiBaseUrl,
    getHeaders,
  });

  let syncCredentials: LocalSyncCredentialsResult;
  try {
    syncCredentials = await identityClient.getLocalSyncCredentials();
  } catch (error) {
    assertCurrent(isCurrent);
    if (authBinding === "requires-canonical-verification") {
      throw new Error(
        "Connect to the internet to verify ownership of this local workout log.",
      );
    }
    onSyncError?.(error);
    onSyncStatusChange?.("pending");
    return { database, syncCoordinator: null };
  }

  assertCurrent(isCurrent);
  await bindOrAssertLocalUserAccount(database, syncCredentials.userId, {
    bindIfUnbound: false,
    compatibleLegacyIds: accountId ? [accountId] : [],
  });
  if (accountId) {
    await bindOrAssertLocalAuthAccount(database, accountId, {
      bindIfUnbound: true,
      canonicalOwnershipVerified: true,
    });
  }
  await bindOrAssertLocalUserAccount(database, syncCredentials.userId, {
    bindIfUnbound: true,
    compatibleLegacyIds: accountId ? [accountId] : [],
  });
  await clearLegacyLocalAccountBinding(database);
  assertCurrent(isCurrent);

  if (!syncCredentials.enabled) {
    return { database, syncCoordinator: null };
  }

  const syncUrl = syncCredentials.url;
  let syncCoordinator: LocalSyncCoordinator | null = null;
  try {
    database = await reopenLocalDatabaseWithSync({
      url: syncUrl,
      authToken: async () => {
        if (
          syncCredentials.enabled &&
          syncCredentials.expiresAt.getTime() > Date.now() + 60_000
        ) {
          return syncCredentials.authToken;
        }

        const refreshed = await identityClient.getLocalSyncCredentials();
        if (!refreshed.enabled || refreshed.url !== syncUrl) {
          throw new Error("Workout sync is no longer available.");
        }
        syncCredentials = refreshed;
        return refreshed.authToken;
      },
    });
    assertCurrent(isCurrent);

    syncCoordinator = createLocalSyncCoordinator({
      database,
      onPulled,
      onError: onSyncError,
      onStatusChange: onSyncStatusChange,
    });
    await syncCoordinator.sync();
    assertCurrent(isCurrent);
    return { database, syncCoordinator };
  } catch (error) {
    syncCoordinator?.stop();
    await closeLocalDatabaseConnection();
    throw error;
  }
}
