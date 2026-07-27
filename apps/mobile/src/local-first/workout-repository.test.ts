import { createClient, type Client, type InValue } from "@libsql/client";
import { LOCAL_FIRST_MIGRATIONS } from "@lift-prog/workout-sdk";
import { afterEach, describe, expect, it } from "vitest";
import type {
  BindParams,
  Row,
  SQLiteValue,
} from "@tursodatabase/sync-react-native";

import type { LocalDatabase } from "./database-port";
import {
  bindOrAssertLocalAuthAccount,
  bindOrAssertLocalUserAccount,
  clearLegacyLocalAccountBinding,
  createLocalWorkoutDataClient,
} from "./workout-repository";

const clients: Client[] = [];

function toInValues(params: BindParams[]) {
  return params as SQLiteValue[] as InValue[];
}

function toLocalRow(row: Record<string, InValue>): Row {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      typeof value === "bigint" ? Number(value) : value,
    ]),
  ) as Row;
}

async function createTestDatabase() {
  const client = createClient({ url: ":memory:" });
  clients.push(client);

  for (const migration of LOCAL_FIRST_MIGRATIONS) {
    for (const statement of migration.statements) {
      await client.execute(statement);
    }
  }

  const database: LocalDatabase = {
    async run(sql: string, ...params: BindParams[]) {
      const result = await client.execute({ sql, args: toInValues(params) });
      return {
        changes: result.rowsAffected,
        lastInsertRowid: Number(result.lastInsertRowid ?? 0),
      };
    },
    async get(sql: string, ...params: BindParams[]) {
      const result = await client.execute({
        sql,
        args: toInValues(params),
      });
      return result.rows[0] ? toLocalRow(result.rows[0]) : undefined;
    },
    async all(sql: string, ...params: BindParams[]) {
      const result = await client.execute({
        sql,
        args: toInValues(params),
      });
      return result.rows.map(toLocalRow);
    },
  };

  return { client, database };
}

async function readBoundAccount(client: Client, key: string) {
  const result = await client.execute({
    sql: "SELECT value FROM app_metadata WHERE key = ?",
    args: [key],
  });
  return result.rows[0]?.value;
}

afterEach(() => {
  for (const client of clients.splice(0)) client.close();
});

describe("local account binding", () => {
  it("stores provider and canonical user identities separately", async () => {
    const { client, database } = await createTestDatabase();

    await bindOrAssertLocalAuthAccount(database, "auth-account-1", {
      bindIfUnbound: true,
    });
    await bindOrAssertLocalUserAccount(database, "app-user-1", {
      bindIfUnbound: true,
    });

    expect(await readBoundAccount(client, "bound-auth-account-id")).toBe(
      "auth-account-1",
    );
    expect(await readBoundAccount(client, "bound-user-account-id")).toBe(
      "app-user-1",
    );
  });

  it("rejects a different auth account without changing ownership", async () => {
    const { client, database } = await createTestDatabase();
    await bindOrAssertLocalAuthAccount(database, "auth-account-1", {
      bindIfUnbound: true,
    });

    await expect(
      bindOrAssertLocalAuthAccount(database, "auth-account-2", {
        bindIfUnbound: true,
      }),
    ).rejects.toThrow(
      "This local workout log belongs to a different signed-in account.",
    );
    expect(await readBoundAccount(client, "bound-auth-account-id")).toBe(
      "auth-account-1",
    );
  });

  it("migrates a legacy auth binding when the canonical user differs", async () => {
    const { client, database } = await createTestDatabase();
    const now = new Date().toISOString();
    await client.execute({
      sql: `INSERT INTO app_metadata (key, value, updated_at)
            VALUES ('bound-account-id', 'auth-account-1', ?)`,
      args: [now],
    });

    await bindOrAssertLocalAuthAccount(database, "auth-account-1", {
      bindIfUnbound: true,
    });
    expect(
      await readBoundAccount(client, "bound-auth-account-id"),
    ).toBeUndefined();

    await bindOrAssertLocalUserAccount(database, "app-user-1", {
      bindIfUnbound: false,
      compatibleLegacyIds: ["auth-account-1"],
    });
    await bindOrAssertLocalAuthAccount(database, "auth-account-1", {
      bindIfUnbound: true,
      canonicalOwnershipVerified: true,
    });
    await bindOrAssertLocalUserAccount(database, "app-user-1", {
      bindIfUnbound: true,
      compatibleLegacyIds: ["auth-account-1"],
    });
    await clearLegacyLocalAccountBinding(database);

    expect(await readBoundAccount(client, "bound-account-id")).toBeUndefined();
    expect(await readBoundAccount(client, "bound-auth-account-id")).toBe(
      "auth-account-1",
    );
    expect(await readBoundAccount(client, "bound-user-account-id")).toBe(
      "app-user-1",
    );
  });

  it("accepts the same provider and canonical identities after relaunch", async () => {
    const { database } = await createTestDatabase();
    await bindOrAssertLocalAuthAccount(database, "auth-account-1", {
      bindIfUnbound: true,
    });
    await bindOrAssertLocalUserAccount(database, "app-user-1", {
      bindIfUnbound: true,
    });

    await expect(
      bindOrAssertLocalAuthAccount(database, "auth-account-1", {
        bindIfUnbound: true,
      }),
    ).resolves.toBe("verified");
    await expect(
      bindOrAssertLocalUserAccount(database, "app-user-1", {
        bindIfUnbound: true,
      }),
    ).resolves.toBeUndefined();
  });

  it("does not let another provider claim a partially migrated database", async () => {
    const { client, database } = await createTestDatabase();
    await client.execute({
      sql: `INSERT INTO app_metadata (key, value, updated_at)
            VALUES ('bound-account-id', 'app-user-1', ?)`,
      args: [new Date().toISOString()],
    });

    await bindOrAssertLocalUserAccount(database, "app-user-1", {
      bindIfUnbound: false,
      compatibleLegacyIds: ["auth-account-1"],
    });
    await bindOrAssertLocalAuthAccount(database, "auth-account-1", {
      bindIfUnbound: true,
      canonicalOwnershipVerified: true,
    });

    await expect(
      bindOrAssertLocalAuthAccount(database, "auth-account-2", {
        bindIfUnbound: true,
      }),
    ).rejects.toThrow(
      "This local workout log belongs to a different signed-in account.",
    );
  });

  it("requires canonical verification when only a canonical binding exists", async () => {
    const { database } = await createTestDatabase();
    await bindOrAssertLocalUserAccount(database, "app-user-1", {
      bindIfUnbound: true,
    });

    await expect(
      bindOrAssertLocalAuthAccount(database, "auth-account-1", {
        bindIfUnbound: true,
      }),
    ).resolves.toBe("requires-canonical-verification");
  });
});

describe("retry-safe local deletion", () => {
  it("keeps the deletion marker until an interrupted account wipe can retry", async () => {
    const { client, database } = await createTestDatabase();
    const now = new Date().toISOString();
    await client.execute({
      sql: `INSERT INTO app_metadata (key, value, updated_at)
            VALUES ('account-deletion-requested', 'true', ?)`,
      args: [now],
    });
    await client.execute({
      sql: `INSERT INTO user_exercises (
              id, name, created_at, updated_at
            ) VALUES ('exercise-1', 'Rows', ?, ?)`,
      args: [now, now],
    });
    await client.execute({
      sql: `INSERT INTO quarantined_workout_draft (
              slot, aggregate_json, reason, quarantined_at
            ) VALUES ('current', '{"name":"private draft"}', 'test', ?)`,
      args: [now],
    });

    let interrupted = false;
    const interruptedDatabase: LocalDatabase = {
      ...database,
      async run(sql, ...params) {
        if (!interrupted && sql.includes("DELETE FROM active_workout_draft")) {
          interrupted = true;
          throw new Error("simulated interruption");
        }
        return database.run(sql, ...params);
      },
    };

    await expect(
      createLocalWorkoutDataClient(interruptedDatabase).deleteCurrentUser(),
    ).rejects.toThrow("simulated interruption");

    const marker = await client.execute(
      `SELECT value FROM app_metadata
       WHERE key = 'account-deletion-requested'`,
    );
    expect(marker.rows[0]?.value).toBe("true");

    await createLocalWorkoutDataClient(database).deleteCurrentUser();
    const remaining = await client.execute(
      `SELECT
         (SELECT COUNT(*) FROM app_metadata) +
         (SELECT COUNT(*) FROM user_exercises) +
         (SELECT COUNT(*) FROM workouts) +
         (SELECT COUNT(*) FROM active_workout_draft) +
         (SELECT COUNT(*) FROM quarantined_workout_draft) +
         (SELECT COUNT(*) FROM record_tombstones) AS count`,
    );
    expect(Number(remaining.rows[0]?.count)).toBe(0);
  });
});
