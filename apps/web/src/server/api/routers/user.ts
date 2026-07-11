import { z } from "zod";
import {
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import {
  deleteUserSyncDatabase,
  getUserSyncCredentials,
} from "@/server/services/user-sync-database";

export const userRouter = createTRPCRouter({
  localSyncCredentials: protectedProcedure.query(({ ctx }) => {
    const userId = ctx.session.userId;
    if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });
    return getUserSyncCredentials(userId, ctx.db.userSyncDatabase);
  }),

  // Procedure to list all users
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.user.findMany({
      orderBy: { createdAt: "desc" }, // Show newest users first
    });
  }),

  // Procedure to add a new app user by Better Auth user ID.
  add: adminProcedure
    .input(
      z
        .object({
          authUserId: z
            .string()
            .min(1, "Auth user ID cannot be empty")
            .optional(),
          // Legacy input name kept so older callers do not break while the
          // database still stores this compatibility column.
          clerkUserId: z
            .string()
            .min(1, "Auth user ID cannot be empty")
            .optional(),
        })
        .refine((input) => input.authUserId ?? input.clerkUserId, {
          message: "Auth user ID cannot be empty",
        }),
    )
    .mutation(async ({ ctx, input }) => {
      const authUserId = input.authUserId ?? input.clerkUserId;

      if (!authUserId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Auth user ID cannot be empty.",
        });
      }

      const existingUser = await ctx.db.user.findFirst({
        where: {
          OR: [{ id: authUserId }, { clerkUserId: authUserId }, { authUserId }],
        },
      });

      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `User with auth ID "${authUserId}" already exists.`,
        });
      }

      const newUser = await ctx.db.user.create({
        data: {
          id: authUserId,
          clerkUserId: authUserId,
          authUserId,
          authProvider: "better-auth",
        },
      });

      return newUser;
    }),

  // Procedure to delete a user
  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // WARNING: Deleting a user will likely cascade delete their workouts
      // due to the schema relation (onDelete: Cascade).
      // Ensure this is the desired behavior or adjust the schema.
      if (ctx.session.userId === input.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot delete the currently logged-in user.",
        });
      }

      try {
        await deleteUserSyncDatabase(input.id, ctx.db.userSyncDatabase);
        return await ctx.db.user.delete({
          where: { id: input.id },
        });
      } catch (error) {
        console.error("Error deleting user:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete user.",
          cause: error, // Optionally include original error cause
        });
      }
    }),

  deleteCurrent: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.userId;
    if (!userId) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    const appUser = await ctx.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        authUserId: true,
        email: true,
      },
    });

    if (!appUser) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Current user was not found.",
      });
    }

    await deleteUserSyncDatabase(appUser.id, ctx.db.userSyncDatabase);

    await ctx.db.$transaction(async (tx) => {
      await tx.user.delete({
        where: { id: appUser.id },
      });

      const authUserMatches = [
        appUser.authUserId ? { id: appUser.authUserId } : null,
        appUser.email ? { email: appUser.email } : null,
      ].filter(
        (match): match is { id: string } | { email: string } => match !== null,
      );

      if (authUserMatches.length > 0) {
        await tx.authUser.deleteMany({
          where: { OR: authUserMatches },
        });
      }
    });

    return { success: true };
  }),
});
