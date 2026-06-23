import "server-only";

import { env } from "@/env";
import { db } from "@/server/db";

type BetterAuthUser = {
  id: string;
  email: string;
  name?: string | null;
};

const AUTH_PROVIDER = "better-auth";

const normalizeEmail = (email: string | null | undefined) =>
  email?.trim().toLowerCase() ?? "";

const updateAppUserAuthIdentity = async ({
  appUserId,
  authUser,
}: {
  appUserId: string;
  authUser: BetterAuthUser;
}) =>
  db.user.update({
    where: { id: appUserId },
    data: {
      authUserId: authUser.id,
      authProvider: AUTH_PROVIDER,
      email: normalizeEmail(authUser.email),
    },
  });

export async function resolveAppUserIdForAuthUser(authUser: BetterAuthUser) {
  const existing = await db.user.findFirst({
    where: {
      OR: [{ authUserId: authUser.id }, { clerkUserId: authUser.id }],
    },
    select: { id: true },
  });

  if (existing) {
    await updateAppUserAuthIdentity({ appUserId: existing.id, authUser });
    return existing.id;
  }

  const ownerEmail = normalizeEmail(env.AUTH_OWNER_EMAIL);
  const authEmail = normalizeEmail(authUser.email);

  if (ownerEmail && ownerEmail === authEmail) {
    const owner = await db.user.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    if (owner) {
      await updateAppUserAuthIdentity({ appUserId: owner.id, authUser });
      return owner.id;
    }
  }

  const created = await db.user.create({
    data: {
      id: authUser.id,
      clerkUserId: authUser.id,
      authUserId: authUser.id,
      authProvider: AUTH_PROVIDER,
      email: authEmail,
    },
    select: { id: true },
  });

  return created.id;
}
