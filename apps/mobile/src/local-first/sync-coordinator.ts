type SyncDatabase = {
  push(): Promise<unknown>;
  pull(): Promise<unknown>;
};

type LocalSyncCoordinatorOptions = {
  database: SyncDatabase;
  onPulled?: () => void;
  onError?: (error: unknown) => void;
  onStatusChange?: (status: LocalSyncStatus) => void;
};

export type LocalSyncStatus = "syncing" | "synced" | "pending";

export type LocalSyncCoordinator = {
  sync(): Promise<void>;
  localDataChanged(): void;
  stop(): void;
};

export function createLocalSyncCoordinator({
  database,
  onPulled,
  onError,
  onStatusChange,
}: LocalSyncCoordinatorOptions): LocalSyncCoordinator {
  let stopped = false;
  let rerunRequested = false;
  let inFlight: Promise<void> | null = null;

  const sync = (): Promise<void> => {
    if (stopped) return Promise.resolve();
    if (inFlight) {
      rerunRequested = true;
      return inFlight;
    }

    inFlight = (async () => {
      do {
        rerunRequested = false;
        onStatusChange?.("syncing");
        try {
          await database.push();
          await database.pull();
          if (!stopped) {
            onStatusChange?.("synced");
            onPulled?.();
          }
        } catch (error) {
          if (!stopped) {
            onStatusChange?.("pending");
            onError?.(error);
          }
        }
      } while (!stopped && rerunRequested);
    })().finally(() => {
      inFlight = null;
    });

    return inFlight;
  };

  return {
    sync,
    localDataChanged() {
      void sync();
    },
    stop() {
      stopped = true;
    },
  };
}
