import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({ db: {} }));

import { createCaller } from "@/server/api/root";

const originalAdminUserIds = process.env.ADMIN_USER_IDS;

afterEach(() => {
  if (originalAdminUserIds === undefined) {
    delete process.env.ADMIN_USER_IDS;
  } else {
    process.env.ADMIN_USER_IDS = originalAdminUserIds;
  }
  vi.clearAllMocks();
});

const makeCaller = (userId: string) => {
  const userFindMany = vi.fn().mockResolvedValue([
    {
      id: "user_admin",
      clerkUserId: "user_admin",
      createdAt: new Date("2026-06-18T12:00:00Z"),
      updatedAt: new Date("2026-06-18T12:00:00Z"),
    },
  ]);
  const userDelete = vi.fn();

  const caller = createCaller(async () => ({
    db: {
      user: {
        findMany: userFindMany,
        delete: userDelete,
      },
    } as any,
    session: { userId },
    headers: new Headers(),
  }));

  return {
    caller,
    spies: {
      userFindMany,
      userDelete,
    },
  };
};

describe("user router admin guard", () => {
  it("prevents a non-admin signed-in user from listing users", async () => {
    process.env.ADMIN_USER_IDS = "user_admin";
    const { caller, spies } = makeCaller("user_member");

    await expect(caller.user.list()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(spies.userFindMany).not.toHaveBeenCalled();
  });

  it("allows an admin signed-in user to list users", async () => {
    process.env.ADMIN_USER_IDS = "user_owner,user_admin";
    const { caller, spies } = makeCaller("user_admin");

    await expect(caller.user.list()).resolves.toEqual([
      {
        id: "user_admin",
        clerkUserId: "user_admin",
        createdAt: new Date("2026-06-18T12:00:00Z"),
        updatedAt: new Date("2026-06-18T12:00:00Z"),
      },
    ]);
    expect(spies.userFindMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
    });
  });

  it("prevents a non-admin signed-in user from deleting users", async () => {
    process.env.ADMIN_USER_IDS = "user_admin";
    const { caller, spies } = makeCaller("user_member");

    await expect(caller.user.delete({ id: "user_other" })).rejects.toMatchObject(
      {
        code: "FORBIDDEN",
      },
    );
    expect(spies.userDelete).not.toHaveBeenCalled();
  });
});
