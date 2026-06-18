import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

export const exerciseRouter = createTRPCRouter({
  // Procedure to list the signed-in user's exercise library
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.userId;
    if (!userId) throw new Error("User not found.");

    return ctx.db.userExercise.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        notes: true,
        exerciseId: true,
      },
    });
  }),

  // Procedure to add a new user exercise, optionally linked to a catalog exercise
  add: protectedProcedure
    .input(z.object({ name: z.string().min(1, "Name cannot be empty") }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.userId;
      if (!userId) throw new Error("User not found.");

      const name = input.name.trim();
      const existing = await ctx.db.userExercise.findUnique({
        where: {
          userId_name: {
            userId,
            name,
          },
        },
      });
      if (existing) {
        throw new Error(`Exercise named "${input.name}" already exists.`);
      }

      const catalogExercise = await ctx.db.exercise.findUnique({
        where: { name },
        select: { id: true },
      });

      return ctx.db.userExercise.create({
        data: {
          userId,
          name,
          exerciseId: catalogExercise?.id ?? null,
        },
      });
    }),

  updateNote: protectedProcedure
    .input(
      z
        .object({
          id: z.number().optional(),
          name: z.string().min(1).optional(),
          note: z.string(),
        })
        .refine((input) => input.id !== undefined || input.name !== undefined, {
          message: "Exercise id or name is required.",
        }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.userId;
      if (!userId) throw new Error("User not found.");

      return ctx.db.userExercise.updateMany({
        where: {
          userId,
          ...(input.id !== undefined
            ? { id: input.id }
            : { name: input.name?.trim() }),
        },
        data: {
          notes: input.note.trim() || null,
        },
      });
    }),

  // Procedure to delete a user exercise
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.userId;
      if (!userId) throw new Error("User not found.");

      try {
        return await ctx.db.userExercise.deleteMany({
          where: {
            id: input.id,
            userId,
          },
        });
      } catch (error) {
        console.error("Error deleting exercise:", error);
        throw new Error("Failed to delete exercise. It might be in use.");
      }
    }),
});
