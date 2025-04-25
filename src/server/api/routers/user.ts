import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";

export const userRouter = createTRPCRouter({
  // Procedure to list all users
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.user.findMany({
      orderBy: { createdAt: "desc" }, // Show newest users first
    });
  }),

  // Procedure to add a new user by Clerk ID
  add: protectedProcedure
    .input(
      z.object({
        clerkUserId: z.string().min(1, "Clerk User ID cannot be empty"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { clerkUserId } = input;

      // Check if user already exists by clerkUserId (which is also the primary id)
      const existingUser = await ctx.db.user.findUnique({
        where: { id: clerkUserId }, // Check using the primary ID field
      });

      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `User with Clerk ID "${clerkUserId}" already exists.`,
        });
      }

      // Create the new user
      const newUser = await ctx.db.user.create({
        data: {
          id: clerkUserId, // Set the primary key
          clerkUserId: clerkUserId, // Set the unique clerkUserId field
        },
      });

      return newUser;
    }),

  // Procedure to delete a user
  delete: protectedProcedure
    .input(z.object({ id: z.string() })) // User ID is string (Clerk ID)
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
});
