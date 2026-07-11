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
      authUserId: "auth_user_admin",
      createdAt: new Date("2026-06-18T12:00:00Z"),
      updatedAt: new Date("2026-06-18T12:00:00Z"),
    },
  ]);
  const userFindFirst = vi.fn().mockResolvedValue(null);
  const userFindUnique = vi.fn().mockResolvedValue({
    id: userId,
    authUserId: `auth_${userId}`,
    email: `${userId}@example.com`,
  });
  const userCreate = vi.fn().mockImplementation(async ({ data }) => ({
    ...data,
    createdAt: new Date("2026-06-18T12:00:00Z"),
    updatedAt: new Date("2026-06-18T12:00:00Z"),
  }));
  const userDelete = vi.fn();
  const authUserDeleteMany = vi.fn();
  const transaction = vi
    .fn()
    .mockImplementation(async (cb: (tx: any) => Promise<unknown>) =>
      cb({
        user: {
          delete: userDelete,
        },
        authUser: {
          deleteMany: authUserDeleteMany,
        },
      }),
    );

  const caller = createCaller(async () => ({
    db: {
      user: {
        findMany: userFindMany,
        findFirst: userFindFirst,
        findUnique: userFindUnique,
        create: userCreate,
        delete: userDelete,
      },
      authUser: {
        deleteMany: authUserDeleteMany,
      },
      $transaction: transaction,
    } as any,
    session: { userId },
    headers: new Headers(),
  }));

  return {
    caller,
    spies: {
      userFindMany,
      userFindFirst,
      userFindUnique,
      userCreate,
      userDelete,
      authUserDeleteMany,
      transaction,
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
        authUserId: "auth_user_admin",
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

    await expect(
      caller.user.delete({ id: "user_other" }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(spies.userDelete).not.toHaveBeenCalled();
  });

  it("allows an admin signed-in user to add a Better Auth user", async () => {
    process.env.ADMIN_USER_IDS = "user_admin";
    const { caller, spies } = makeCaller("user_admin");

    await expect(
      caller.user.add({ authUserId: "auth_user_new" }),
    ).resolves.toMatchObject({
      id: "auth_user_new",
      authUserId: "auth_user_new",
      authProvider: "better-auth",
    });

    expect(spies.userFindFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { id: "auth_user_new" },
          { clerkUserId: "auth_user_new" },
          { authUserId: "auth_user_new" },
        ],
      },
    });
    expect(spies.userCreate).toHaveBeenCalledWith({
      data: {
        id: "auth_user_new",
        clerkUserId: "auth_user_new",
        authUserId: "auth_user_new",
        authProvider: "better-auth",
      },
    });
  });

  it("allows a signed-in user to delete their own account", async () => {
    const { caller, spies } = makeCaller("user_member");

    await expect(caller.user.deleteCurrent()).resolves.toEqual({
      success: true,
    });

    expect(spies.userFindUnique).toHaveBeenCalledWith({
      where: { id: "user_member" },
      select: {
        id: true,
        authUserId: true,
        email: true,
      },
    });
    expect(spies.userDelete).toHaveBeenCalledWith({
      where: { id: "user_member" },
    });
    expect(spies.authUserDeleteMany).toHaveBeenCalledWith({
      where: {
        OR: [{ id: "auth_user_member" }, { email: "user_member@example.com" }],
      },
    });
  });
});
