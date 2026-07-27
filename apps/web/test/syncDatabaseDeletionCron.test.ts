import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  drain: vi.fn(),
  queue: {},
}));

vi.mock("@/server/db", () => ({
  db: { userSyncDatabaseDeletion: mocks.queue },
}));
vi.mock("@/server/services/user-sync-database", () => ({
  drainUserSyncDatabaseDeletionQueue: mocks.drain,
}));

import { GET } from "@/app/api/maintenance/sync-database-deletions/route";

describe("sync database deletion cron", () => {
  beforeEach(() => {
    mocks.drain.mockReset();
    process.env.CRON_SECRET = "cron-test-secret";
  });

  it("rejects a request without the cron secret", async () => {
    const response = await GET(
      new Request(
        "https://example.test/api/maintenance/sync-database-deletions",
      ),
    );

    expect(response.status).toBe(401);
    expect(mocks.drain).not.toHaveBeenCalled();
  });

  it("drains the durable queue for an authenticated request", async () => {
    mocks.drain.mockResolvedValue({ deleted: 2, pending: false });

    const response = await GET(
      new Request(
        "https://example.test/api/maintenance/sync-database-deletions",
        {
          headers: { authorization: "Bearer cron-test-secret" },
        },
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      deleted: 2,
      pending: false,
    });
    expect(mocks.drain).toHaveBeenCalledWith(mocks.queue);
  });
});
