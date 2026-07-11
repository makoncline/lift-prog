import { describe, expect, it, vi } from "vitest";

import { createLocalSyncCoordinator } from "./sync-coordinator";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe("local sync coordinator", () => {
  it("coalesces overlapping changes into one follow-up sync", async () => {
    const firstPush = deferred();
    const push = vi
      .fn<() => Promise<void>>()
      .mockImplementationOnce(() => firstPush.promise)
      .mockResolvedValue(undefined);
    const pull = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const onPulled = vi.fn();
    const onStatusChange = vi.fn();
    const coordinator = createLocalSyncCoordinator({
      database: { push, pull },
      onPulled,
      onStatusChange,
    });

    const syncing = coordinator.sync();
    coordinator.localDataChanged();
    coordinator.localDataChanged();
    firstPush.resolve();
    await syncing;

    expect(push).toHaveBeenCalledTimes(2);
    expect(pull).toHaveBeenCalledTimes(2);
    expect(onPulled).toHaveBeenCalledTimes(2);
    expect(onStatusChange.mock.calls).toEqual([
      ["syncing"],
      ["synced"],
      ["syncing"],
      ["synced"],
    ]);
  });

  it("keeps local operation successful and retries after a sync error", async () => {
    const push = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(undefined);
    const pull = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const onError = vi.fn();
    const onStatusChange = vi.fn();
    const coordinator = createLocalSyncCoordinator({
      database: { push, pull },
      onError,
      onStatusChange,
    });

    await coordinator.sync();
    await coordinator.sync();

    expect(onError).toHaveBeenCalledOnce();
    expect(push).toHaveBeenCalledTimes(2);
    expect(pull).toHaveBeenCalledOnce();
    expect(onStatusChange.mock.calls).toEqual([
      ["syncing"],
      ["pending"],
      ["syncing"],
      ["synced"],
    ]);
  });
});
