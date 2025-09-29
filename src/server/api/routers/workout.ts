import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { CompletedWorkoutSchema } from "@/lib/schemas/workout-schema";
import { summarizeWorkingSets } from "@/lib/workout-summary";
import {
  buildInitialExercisesForNames,
  buildInitialExercisesFromWorkout,
} from "@/server/services/workout-initializer";

const PrepareInitialWorkoutInput = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("exerciseList"),
    exerciseNames: z.array(z.string().min(1)).min(1),
    workoutName: z.string().optional(),
  }),
  z.object({
    mode: z.literal("workoutReference"),
    workoutId: z.number(),
  }),
]);

export const workoutRouter = createTRPCRouter({
  saveWorkout: protectedProcedure
    .input(CompletedWorkoutSchema)
    .mutation(async ({ ctx, input }) => {
      const { name, exercises, notes, completedAt, startedAt } = input;
      const prisma = ctx.db; // Use prisma client from context
      const userId = ctx.session.userId;

      if (!userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Unauthorized: User ID mismatch",
        });
      }

      // 1. Find or create Exercise records based on names
      const exerciseNameToIdMap = new Map<string, number>();
      const exerciseNames = exercises.map((ex) => ex.name);

      for (const name of exerciseNames) {
        const rec = await prisma.exercise.upsert({
          where: { name },
          update: {},
          create: { name },
          select: { id: true, name: true },
        });
        exerciseNameToIdMap.set(rec.name, rec.id);
      }

      // 2. Use Prisma transaction to save the workout atomically
      return prisma.$transaction(async (tx) => {
        // Use the transaction client `tx`
        const workout = await tx.workout.create({
          data: {
            userId: userId,
            name: name,
            notes: notes,
            completedAt: completedAt,
            startedAt: startedAt,
          },
        });

        for (const exerciseInput of exercises) {
          const exerciseId = exerciseNameToIdMap.get(exerciseInput.name);
          if (!exerciseId) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Exercise ID not found for: ${exerciseInput.name}`,
            });
          }

          const completedSets = exerciseInput.sets.filter(
            (set) => set.completed,
          );

          if (completedSets.length === 0) {
            continue; // Skip saving exercises with no completed sets
          }

          const workoutExercise = await tx.workoutExercise.create({
            data: {
              workoutSessionId: workout.id,
              exerciseId: exerciseId,
              order: exerciseInput.order,
              notes: exerciseInput.notes,
            },
          });

          const setsData = completedSets.map((set) => ({
            workoutExerciseId: workoutExercise.id,
            order: set.order,
            weight: set.weight,
            reps: set.reps,
            modifier: set.modifier,
            weightModifier: set.weightModifier ?? null,
            completed: true,
          }));

          if (setsData.length > 0) {
            await tx.workoutExerciseSet.createMany({
              data: setsData,
            });
          }
        }

        return { success: true, workoutId: workout.id };
      });
    }),

  // New procedure to list recent workouts for the logged-in user
  listRecent: protectedProcedure
    .input(
      z.object({ limit: z.number().min(1).max(50).optional().default(10) }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.userId;
      // Add runtime check although middleware should guarantee non-null
      if (!userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "User ID not found in session.",
        });
      }

      const workouts = await ctx.db.workout.findMany({
        where: {
          userId: userId, // Now guaranteed non-null
          completedAt: { not: null },
        },
        select: {
          id: true,
          name: true,
          completedAt: true,
          startedAt: true, // Add startedAt to calculate duration
          workoutExercises: {
            orderBy: { order: "asc" },
            select: {
              exercise: { select: { name: true } },
              sets: {
                orderBy: { order: "asc" },
                select: {
                  weight: true,
                  reps: true,
                  modifier: true,
                  weightModifier: true,
                },
              },
            },
          },
        },
        orderBy: {
          completedAt: "desc",
        },
        take: input.limit,
      });

      return workouts.map((workout) => {
        const summaries = workout.workoutExercises
          .map((exercise) =>
            summarizeWorkingSets(
              exercise.exercise.name,
              exercise.sets.map((set) => ({
                weight: set.weight,
                reps: set.reps,
                modifier: set.modifier ?? undefined,
                weightModifier: set.weightModifier ?? undefined,
              })),
            ),
          )
          .filter((summary): summary is string => Boolean(summary));

        const { workoutExercises, ...rest } = workout;
        return {
          ...rest,
          exerciseSummaries: summaries,
        };
      });
    }),

  // Procedure to get full details of a specific workout
  getWorkoutDetails: protectedProcedure
    .input(z.object({ workoutId: z.number() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.userId;
      if (!userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "User ID not found in session.",
        });
      }
      try {
        const { workoutName, exercises } = await buildInitialExercisesFromWorkout({
          prisma: ctx.db,
          userId,
          workoutId: input.workoutId,
        });

        return {
          workoutName,
          exercises,
        };
      } catch (error) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Workout with ID ${input.workoutId} not found or access denied.`,
          cause: error,
        });
      }
    }),

  prepareInitialWorkout: protectedProcedure
    .input(PrepareInitialWorkoutInput)
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.userId;
      if (!userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "User ID not found in session.",
        });
      }

      if (input.mode === "exerciseList") {
        const exercises = await buildInitialExercisesForNames({
          prisma: ctx.db,
          userId,
          exerciseNames: input.exerciseNames,
        });

        return {
          workoutName: input.workoutName ?? "Workout",
          exercises,
        };
      }

      try {
        return await buildInitialExercisesFromWorkout({
          prisma: ctx.db,
          userId,
          workoutId: input.workoutId,
        });
      } catch (error) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Workout with ID ${input.workoutId} not found or access denied.`,
          cause: error,
        });
      }
    }),

  // Procedure to delete a workout
  deleteWorkout: protectedProcedure
    .input(z.object({ workoutId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.userId;
      if (!userId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "User ID not found in session.",
        });
      }

      // First check if the workout exists and belongs to the user
      const workout = await ctx.db.workout.findFirst({
        where: {
          id: input.workoutId,
          userId: userId,
        },
        select: { id: true },
      });

      if (!workout) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Workout with ID ${input.workoutId} not found or access denied.`,
        });
      }

      // Delete the workout (cascades to workout exercises and sets because of the relation)
      await ctx.db.workout.delete({
        where: {
          id: input.workoutId,
        },
      });

      return { success: true };
    }),
});
