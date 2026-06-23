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

export async function assertAuthEmailCanSignIn(email: string) {
  const authEmail = normalizeEmail(email);
  if (!authEmail) {
    throw new Error("Email is required.");
  }

  const existingAuthUser = await db.authUser.findUnique({
    where: { email: authEmail },
    select: { id: true },
  });

  if (existingAuthUser) {
    return;
  }

  const matchingAppUser = await db.user.findFirst({
    where: {
      OR: [{ email: authEmail }, { authUserId: authEmail }],
    },
    select: { id: true },
  });

  if (matchingAppUser) {
    return;
  }

  const ownerEmail = normalizeEmail(env.AUTH_OWNER_EMAIL);
  if (ownerEmail && ownerEmail === authEmail) {
    return;
  }

  const existingUserCount = await db.user.count();
  if (existingUserCount === 0) {
    return;
  }

  throw new Error("This email is not linked to an app user.");
}

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

const syncAppUserAuthIdentity = async ({
  appUser,
  authUser,
}: {
  appUser: {
    id: string;
    authUserId: string | null;
    authProvider: string | null;
    email: string | null;
  };
  authUser: BetterAuthUser;
}) => {
  const authEmail = normalizeEmail(authUser.email);
  if (
    appUser.authUserId === authUser.id &&
    appUser.authProvider === AUTH_PROVIDER &&
    appUser.email === authEmail
  ) {
    return;
  }

  await updateAppUserAuthIdentity({ appUserId: appUser.id, authUser });
};

export async function resolveAppUserIdForAuthUser(authUser: BetterAuthUser) {
  const authEmail = normalizeEmail(authUser.email);
  const existing = await db.user.findFirst({
    where: {
      OR: [
        { authUserId: authUser.id },
        { clerkUserId: authUser.id },
        { authUserId: authEmail },
        { email: authEmail },
      ],
    },
    select: {
      id: true,
      authUserId: true,
      authProvider: true,
      email: true,
    },
  });

  if (existing) {
    await syncAppUserAuthIdentity({ appUser: existing, authUser });
    return existing.id;
  }

  const ownerEmail = normalizeEmail(env.AUTH_OWNER_EMAIL);

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

  const existingUserCount = await db.user.count();

  if (existingUserCount > 0) {
    throw new Error(
      "Authenticated user is not linked to an app user. Set AUTH_OWNER_EMAIL to the legacy account email before signing in, or backfill User.authUserId.",
    );
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
