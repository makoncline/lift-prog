import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/server/api/trpc";

export const exerciseRouter = createTRPCRouter({
  // Procedure to list all exercises
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.exercise.findMany({
      orderBy: { name: "asc" },
    });
  }),

  // Procedure to add a new exercise
  add: protectedProcedure
    .input(z.object({ name: z.string().min(1, "Name cannot be empty") }))
    .mutation(async ({ ctx, input }) => {
      // Check if exercise already exists (case-insensitive check might be better)
      const existing = await ctx.db.exercise.findUnique({
        where: { name: input.name },
      });
      if (existing) {
        throw new Error(`Exercise named "${input.name}" already exists.`);
      }
      return ctx.db.exercise.create({
        data: {
          name: input.name,
        },
      });
    }),

  // Procedure to delete an exercise
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // TODO: Consider implications - deleting an exercise referenced by workouts?
      // Maybe add a confirmation step or prevent deletion if referenced.
      // For now, simple delete.
      try {
        return await ctx.db.exercise.delete({
          where: { id: input.id },
        });
      } catch (error) {
        // Handle potential errors, e.g., exercise not found or foreign key constraints
        console.error("Error deleting exercise:", error);
        throw new Error("Failed to delete exercise. It might be in use.");
      }
    }),
});
