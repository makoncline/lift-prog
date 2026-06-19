import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { normalizeExerciseNameForCompare } from "@/lib/exercise-name";
import { TRPCError } from "@trpc/server";

const plateLoadModeInput = z.enum(["equal-sides", "total"]);

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
        plateStartingWeight: true,
        plateLoadMode: true,
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
      const normalizedName = normalizeExerciseNameForCompare(name);
      const existingUserExercises = await ctx.db.userExercise.findMany({
        where: { userId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      });
      const matches = existingUserExercises.filter(
        (exercise) =>
          normalizeExerciseNameForCompare(exercise.name) === normalizedName,
      );

      if (matches.length > 1) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Multiple user exercises match "${name}". Merge duplicates before creating exercises.`,
        });
      }

      const existing = matches[0] ?? null;
      if (existing) {
        throw new Error(`Exercise named "${existing.name}" already exists.`);
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

      const notes = input.note.trim() || null;

      if (input.id !== undefined) {
        const result = await ctx.db.userExercise.updateMany({
          where: {
            id: input.id,
            userId,
          },
          data: { notes },
        });

        if (result.count === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Exercise not found.",
          });
        }

        return result;
      }

      const name = input.name?.trim();
      if (!name) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Exercise name cannot be empty.",
        });
      }

      const normalizedName = normalizeExerciseNameForCompare(name);
      const userExercises = await ctx.db.userExercise.findMany({
        where: { userId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      });
      const matches = userExercises.filter(
        (exercise) =>
          normalizeExerciseNameForCompare(exercise.name) === normalizedName,
      );

      if (matches.length > 1) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Multiple user exercises match "${name}". Merge duplicates before updating notes.`,
        });
      }

      const existing = matches[0] ?? null;
      if (existing) {
        const result = await ctx.db.userExercise.updateMany({
          where: {
            id: existing.id,
            userId,
          },
          data: { notes },
        });

        if (result.count === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Exercise not found.",
          });
        }

        return result;
      }

      const catalogExercise = await ctx.db.exercise.findUnique({
        where: { name },
        select: { id: true },
      });

      await ctx.db.userExercise.upsert({
        where: {
          userId_name: {
            userId,
            name,
          },
        },
        update: { notes },
        create: {
          userId,
          name,
          exerciseId: catalogExercise?.id ?? null,
          notes,
        },
      });

      return { count: 1 };
    }),

  updatePlateDefaults: protectedProcedure
    .input(
      z
        .object({
          id: z.number().optional(),
          name: z.string().min(1).optional(),
          plateStartingWeight: z.number().min(0).nullable(),
          plateLoadMode: plateLoadModeInput,
        })
        .refine((input) => input.id !== undefined || input.name !== undefined, {
          message: "Exercise id or name is required.",
        }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.userId;
      if (!userId) throw new Error("User not found.");

      const data = {
        plateStartingWeight: input.plateStartingWeight,
        plateLoadMode: input.plateLoadMode,
      };

      if (input.id !== undefined) {
        const result = await ctx.db.userExercise.updateMany({
          where: {
            id: input.id,
            userId,
          },
          data,
        });

        if (result.count === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Exercise not found.",
          });
        }

        return result;
      }

      const name = input.name?.trim();
      if (!name) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Exercise name cannot be empty.",
        });
      }

      const normalizedName = normalizeExerciseNameForCompare(name);
      const userExercises = await ctx.db.userExercise.findMany({
        where: { userId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      });
      const matches = userExercises.filter(
        (exercise) =>
          normalizeExerciseNameForCompare(exercise.name) === normalizedName,
      );

      if (matches.length > 1) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Multiple user exercises match "${name}". Merge duplicates before updating plate defaults.`,
        });
      }

      const existing = matches[0] ?? null;
      if (existing) {
        const result = await ctx.db.userExercise.updateMany({
          where: {
            id: existing.id,
            userId,
          },
          data,
        });

        if (result.count === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Exercise not found.",
          });
        }

        return result;
      }

      const catalogExercise = await ctx.db.exercise.findUnique({
        where: { name },
        select: { id: true },
      });

      await ctx.db.userExercise.upsert({
        where: {
          userId_name: {
            userId,
            name,
          },
        },
        update: data,
        create: {
          userId,
          name,
          exerciseId: catalogExercise?.id ?? null,
          ...data,
        },
      });

      return { count: 1 };
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
