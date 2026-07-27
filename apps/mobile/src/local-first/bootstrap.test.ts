import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  bindOrAssertLocalAuthAccount: vi.fn(),
  bindOrAssertLocalUserAccount: vi.fn(),
  clearLegacyLocalAccountBinding: vi.fn(),
  closeLocalDatabaseConnection: vi.fn(),
  createLocalSyncCoordinator: vi.fn(),
  getLocalSyncCredentials: vi.fn(),
  openLocalDatabase: vi.fn(),
  reopenLocalDatabaseWithSync: vi.fn(),
}));

vi.mock("@lift-prog/workout-sdk", () => ({
  createWorkoutApiClient: () => ({
    getLocalSyncCredentials: mocks.getLocalSyncCredentials,
  }),
}));
vi.mock("../lib/config", () => ({
  mobileWorkoutApiBaseUrl: "https://example.test",
}));
vi.mock("./database", () => ({
  closeLocalDatabaseConnection: mocks.closeLocalDatabaseConnection,
  openLocalDatabase: mocks.openLocalDatabase,
  reopenLocalDatabaseWithSync: mocks.reopenLocalDatabaseWithSync,
}));
vi.mock("./sync-coordinator", () => ({
  createLocalSyncCoordinator: mocks.createLocalSyncCoordinator,
}));
vi.mock("./workout-repository", () => ({
  bindOrAssertLocalAuthAccount: mocks.bindOrAssertLocalAuthAccount,
  bindOrAssertLocalUserAccount: mocks.bindOrAssertLocalUserAccount,
  clearLegacyLocalAccountBinding: mocks.clearLegacyLocalAccountBinding,
}));

import { bootstrapLocalWorkoutStore } from "./bootstrap";

describe("local workout store bootstrap", () => {
  beforeEach(() => {
    mocks.bindOrAssertLocalAuthAccount.mockReset();
    mocks.bindOrAssertLocalUserAccount.mockReset();
    mocks.clearLegacyLocalAccountBinding.mockReset();
    mocks.closeLocalDatabaseConnection.mockReset();
    mocks.getLocalSyncCredentials.mockReset();
    mocks.openLocalDatabase.mockReset();
    mocks.reopenLocalDatabaseWithSync.mockReset();
    mocks.createLocalSyncCoordinator.mockReset();
    mocks.openLocalDatabase.mockResolvedValue({ id: "local-database" });
    mocks.reopenLocalDatabaseWithSync.mockResolvedValue({
      id: "sync-database",
    });
    mocks.bindOrAssertLocalAuthAccount.mockResolvedValue("verified");
    mocks.bindOrAssertLocalUserAccount.mockResolvedValue(undefined);
    mocks.createLocalSyncCoordinator.mockReturnValue({
      stop: vi.fn(),
      sync: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("checks local ownership before an unavailable cloud credential request", async () => {
    mocks.getLocalSyncCredentials.mockRejectedValue(
      new Error("network unavailable"),
    );

    await expect(
      bootstrapLocalWorkoutStore({
        accountId: "account-1",
        getHeaders: async () => ({ authorization: "test" }),
      }),
    ).resolves.toMatchObject({ syncCoordinator: null });

    expect(mocks.bindOrAssertLocalAuthAccount).toHaveBeenCalledWith(
      { id: "local-database" },
      "account-1",
      { bindIfUnbound: true },
    );
    expect(
      mocks.bindOrAssertLocalAuthAccount.mock.invocationCallOrder[0],
    ).toBeLessThan(mocks.getLocalSyncCredentials.mock.invocationCallOrder[0]!);
  });

  it("does not contact the cloud after a local ownership conflict", async () => {
    mocks.bindOrAssertLocalAuthAccount.mockRejectedValue(
      new Error("local ownership conflict"),
    );

    await expect(
      bootstrapLocalWorkoutStore({
        accountId: "account-2",
        getHeaders: async () => ({ authorization: "test" }),
      }),
    ).rejects.toThrow("local ownership conflict");
    expect(mocks.getLocalSyncCredentials).not.toHaveBeenCalled();
  });

  it("does not expose an ambiguous legacy database while offline", async () => {
    mocks.bindOrAssertLocalAuthAccount.mockResolvedValue(
      "requires-canonical-verification",
    );
    mocks.getLocalSyncCredentials.mockRejectedValue(
      new Error("network unavailable"),
    );

    await expect(
      bootstrapLocalWorkoutStore({
        accountId: "different-auth-account",
        getHeaders: async () => ({ authorization: "test" }),
      }),
    ).rejects.toThrow(
      "Connect to the internet to verify ownership of this local workout log.",
    );
  });

  it("does not expose an ambiguous legacy database without cloud headers", async () => {
    mocks.bindOrAssertLocalAuthAccount.mockResolvedValue(
      "requires-canonical-verification",
    );

    await expect(
      bootstrapLocalWorkoutStore({
        accountId: "auth-account-1",
      }),
    ).rejects.toThrow(
      "Connect to the internet to verify ownership of this local workout log.",
    );
  });

  it("keeps provider and canonical user bindings stable when they differ", async () => {
    mocks.getLocalSyncCredentials.mockResolvedValue({
      enabled: false,
      userId: "app-user-1",
    });

    await bootstrapLocalWorkoutStore({
      accountId: "auth-account-1",
      getHeaders: async () => ({ authorization: "test" }),
    });
    await bootstrapLocalWorkoutStore({
      accountId: "auth-account-1",
      getHeaders: async () => ({ authorization: "test" }),
    });

    expect(mocks.bindOrAssertLocalAuthAccount).toHaveBeenCalledTimes(4);
    expect(mocks.bindOrAssertLocalUserAccount).toHaveBeenCalledTimes(4);
    expect(mocks.bindOrAssertLocalUserAccount).toHaveBeenLastCalledWith(
      { id: "local-database" },
      "app-user-1",
      {
        bindIfUnbound: true,
        compatibleLegacyIds: ["auth-account-1"],
      },
    );
  });

  it("cancels a stale bootstrap before it can reopen the shared database", async () => {
    let releaseFirstCredentials!: () => void;
    const firstCredentials = new Promise<void>((resolve) => {
      releaseFirstCredentials = resolve;
    });
    mocks.getLocalSyncCredentials
      .mockImplementationOnce(async () => {
        await firstCredentials;
        return {
          enabled: true,
          userId: "app-user-1",
          url: "libsql://account-1",
          authToken: "token-1",
          expiresAt: new Date(Date.now() + 120_000),
        };
      })
      .mockResolvedValueOnce({
        enabled: true,
        userId: "app-user-2",
        url: "libsql://account-2",
        authToken: "token-2",
        expiresAt: new Date(Date.now() + 120_000),
      });

    let firstCurrent = true;
    const first = bootstrapLocalWorkoutStore({
      accountId: "auth-account-1",
      getHeaders: async () => ({ authorization: "one" }),
      isCurrent: () => firstCurrent,
    });
    await vi.waitFor(() => {
      expect(mocks.getLocalSyncCredentials).toHaveBeenCalledTimes(1);
    });

    firstCurrent = false;
    const second = bootstrapLocalWorkoutStore({
      accountId: "auth-account-2",
      getHeaders: async () => ({ authorization: "two" }),
      isCurrent: () => true,
    });
    releaseFirstCredentials();

    await expect(first).rejects.toThrow(
      "A newer local workout store configuration replaced this request.",
    );
    await expect(second).resolves.toMatchObject({
      database: { id: "sync-database" },
    });
    expect(mocks.reopenLocalDatabaseWithSync).toHaveBeenCalledTimes(1);
    expect(mocks.reopenLocalDatabaseWithSync).toHaveBeenCalledWith(
      expect.objectContaining({ url: "libsql://account-2" }),
    );
  });

  it("closes a sync database that finishes reopening after cancellation", async () => {
    let releaseFirstReopen!: () => void;
    const firstReopen = new Promise<void>((resolve) => {
      releaseFirstReopen = resolve;
    });
    mocks.getLocalSyncCredentials
      .mockResolvedValueOnce({
        enabled: true,
        userId: "app-user-1",
        url: "libsql://account-1",
        authToken: "token-1",
        expiresAt: new Date(Date.now() + 120_000),
      })
      .mockResolvedValueOnce({
        enabled: true,
        userId: "app-user-2",
        url: "libsql://account-2",
        authToken: "token-2",
        expiresAt: new Date(Date.now() + 120_000),
      });
    mocks.reopenLocalDatabaseWithSync
      .mockImplementationOnce(async () => {
        await firstReopen;
        return { id: "stale-sync-database" };
      })
      .mockResolvedValueOnce({ id: "current-sync-database" });

    let firstCurrent = true;
    const first = bootstrapLocalWorkoutStore({
      accountId: "auth-account-1",
      getHeaders: async () => ({ authorization: "one" }),
      isCurrent: () => firstCurrent,
    });
    await vi.waitFor(() => {
      expect(mocks.reopenLocalDatabaseWithSync).toHaveBeenCalledTimes(1);
    });

    firstCurrent = false;
    const second = bootstrapLocalWorkoutStore({
      accountId: "auth-account-2",
      getHeaders: async () => ({ authorization: "two" }),
      isCurrent: () => true,
    });
    releaseFirstReopen();

    await expect(first).rejects.toThrow(
      "A newer local workout store configuration replaced this request.",
    );
    await expect(second).resolves.toMatchObject({
      database: { id: "current-sync-database" },
    });
    expect(mocks.closeLocalDatabaseConnection).toHaveBeenCalledTimes(1);
    expect(mocks.reopenLocalDatabaseWithSync).toHaveBeenCalledTimes(2);
  });
});
