import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deleteProvisionedUserSyncDatabase,
  deleteUserSyncDatabase,
  getUserSyncCredentials,
  provisionUserSyncCredentials,
  userSyncDatabaseName,
} from "@/server/services/user-sync-database";

const originalEnvironment = {
  org: process.env.TURSO_PLATFORM_ORG,
  token: process.env.TURSO_PLATFORM_TOKEN,
  group: process.env.TURSO_USER_DB_GROUP,
};

afterEach(() => {
  for (const [key, value] of Object.entries({
    TURSO_PLATFORM_ORG: originalEnvironment.org,
    TURSO_PLATFORM_TOKEN: originalEnvironment.token,
    TURSO_USER_DB_GROUP: originalEnvironment.group,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("user sync database provisioning", () => {
  it("stays disabled until platform credentials are configured", async () => {
    delete process.env.TURSO_PLATFORM_ORG;
    delete process.env.TURSO_PLATFORM_TOKEN;

    await expect(
      getUserSyncCredentials("app-user-1", {} as never),
    ).resolves.toEqual({
      enabled: false,
      userId: "app-user-1",
    });
  });

  it("uses a stable opaque database name", () => {
    expect(userSyncDatabaseName("app-user-1")).toMatch(
      /^lift-user-[a-f0-9]{32}$/,
    );
    expect(userSyncDatabaseName("app-user-1")).toBe(
      userSyncDatabaseName("app-user-1"),
    );
    expect(userSyncDatabaseName("app-user-1")).not.toBe(
      userSyncDatabaseName("app-user-2"),
    );
  });

  it("creates a missing database and returns a short-lived scoped token", async () => {
    const databaseName = userSyncDatabaseName("app-user-1");
    const client = {
      databases: {
        get: vi.fn().mockRejectedValueOnce({ status: 404, message: "missing" }),
        create: vi.fn().mockResolvedValue({
          name: databaseName,
          hostname: `${databaseName}-example.turso.io`,
        }),
        createToken: vi.fn().mockResolvedValue({ jwt: "database-token" }),
      },
    } as unknown as Parameters<
      typeof provisionUserSyncCredentials
    >[0]["client"];
    const execute = vi.fn().mockResolvedValue({ rows: [] });
    const close = vi.fn();
    const connectToDatabase = vi.fn().mockReturnValue({ execute, close });
    const onProvisioned = vi.fn().mockResolvedValue(undefined);

    const now = new Date("2026-07-11T00:00:00.000Z");
    await expect(
      provisionUserSyncCredentials({
        userId: "app-user-1",
        config: { org: "example", token: "platform-token", group: "users" },
        client,
        now,
        connectToDatabase,
        onProvisioned,
      }),
    ).resolves.toEqual({
      enabled: true,
      userId: "app-user-1",
      url: `libsql://${databaseName}-example.turso.io`,
      authToken: "database-token",
      expiresAt: new Date("2026-07-11T01:00:00.000Z"),
    });

    expect(client.databases.create).toHaveBeenCalledWith(databaseName, {
      group: "users",
    });
    expect(client.databases.createToken).toHaveBeenCalledWith(databaseName, {
      expiration: "1h",
      authorization: "full-access",
    });
    expect(connectToDatabase).toHaveBeenCalledWith({
      url: `libsql://${databaseName}-example.turso.io`,
      authToken: "database-token",
    });
    expect(
      execute.mock.calls.some(([statement]) =>
        String(statement).includes("CREATE TABLE IF NOT EXISTS app_metadata"),
      ),
    ).toBe(true);
    expect(close).toHaveBeenCalledOnce();
    expect(onProvisioned).toHaveBeenCalledWith({
      databaseName,
      groupName: "users",
      schemaVersion: 3,
    });
  });

  it("uses a registered database name instead of deriving another one", async () => {
    const databaseName = "lift-user-existing";
    const client = {
      databases: {
        get: vi.fn().mockResolvedValue({
          name: databaseName,
          hostname: `${databaseName}-example.turso.io`,
          group: "legacy",
        }),
        create: vi.fn(),
        createToken: vi.fn().mockResolvedValue({ jwt: "database-token" }),
      },
    } as unknown as Parameters<
      typeof provisionUserSyncCredentials
    >[0]["client"];
    const connectToDatabase = vi.fn().mockReturnValue({
      execute: vi.fn().mockResolvedValue({ rows: [] }),
      close: vi.fn(),
    });
    const onProvisioned = vi.fn().mockResolvedValue(undefined);

    await provisionUserSyncCredentials({
      userId: "app-user-1",
      databaseName,
      config: { org: "example", token: "platform-token", group: "users" },
      client,
      connectToDatabase,
      onProvisioned,
    });

    expect(client.databases.get).toHaveBeenCalledWith(databaseName);
    expect(client.databases.create).not.toHaveBeenCalled();
    expect(onProvisioned).toHaveBeenCalledWith({
      databaseName,
      groupName: "legacy",
      schemaVersion: 3,
    });
  });

  it("does not require platform access when deleting with sync disabled", async () => {
    delete process.env.TURSO_PLATFORM_ORG;
    delete process.env.TURSO_PLATFORM_TOKEN;

    await expect(
      deleteUserSyncDatabase("app-user-1", {} as never),
    ).resolves.toBeUndefined();
  });

  it("deletes only the stable per-user database and tolerates a retry", async () => {
    const remove = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce({ status: 404, message: "missing" });
    const client = {
      databases: { delete: remove },
    } as unknown as Parameters<
      typeof deleteProvisionedUserSyncDatabase
    >[0]["client"];

    await deleteProvisionedUserSyncDatabase({ userId: "app-user-1", client });
    await deleteProvisionedUserSyncDatabase({ userId: "app-user-1", client });

    expect(remove).toHaveBeenNthCalledWith(
      1,
      userSyncDatabaseName("app-user-1"),
    );
    expect(remove).toHaveBeenNthCalledWith(
      2,
      userSyncDatabaseName("app-user-1"),
    );
  });
});
