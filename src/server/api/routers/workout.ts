import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { CompletedWorkoutSchema } from "@/lib/schemas/workout-schema";

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

          const workoutExercise = await tx.workoutExercise.create({
            data: {
              workoutSessionId: workout.id,
              exerciseId: exerciseId,
              order: exerciseInput.order,
              notes: exerciseInput.notes,
            },
          });

          const setsData = exerciseInput.sets.map((set, _setIndex) => ({
            workoutExerciseId: workoutExercise.id,
            order: set.order,
            weight: set.weight,
            reps: set.reps,
            modifier: set.modifier,
            weightModifier: set.weightModifier ?? null,
            completed: set.completed,
          }));

          await tx.workoutExerciseSet.createMany({
            data: setsData,
          });
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

      return ctx.db.workout.findMany({
        where: {
          userId: userId, // Now guaranteed non-null
          completedAt: { not: null },
        },
        select: {
          id: true,
          name: true,
          completedAt: true,
          startedAt: true, // Add startedAt to calculate duration
        },
        orderBy: {
          completedAt: "desc",
        },
        take: input.limit,
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

      const workout = await ctx.db.workout.findUnique({
        where: {
          id: input.workoutId,
          // Ensure the user requesting owns this workout
          userId: userId,
        },
        include: {
          // Include related exercises
          workoutExercises: {
            orderBy: { order: "asc" }, // Ensure exercises are ordered correctly
            include: {
              // Include the base exercise details (like name)
              exercise: {
                select: { name: true },
              },
              // Include related sets for each exercise
              sets: {
                orderBy: { order: "asc" }, // Ensure sets are ordered correctly
                select: {
                  // Select fields needed for initialization
                  weight: true,
                  reps: true,
                  modifier: true,
                  weightModifier: true, // Select weightModifier
                },
              },
            },
          },
        },
      });

      if (!workout) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Workout with ID ${input.workoutId} not found or access denied.`,
        });
      }

      // Format the data to match the PreviousExerciseData structure expected by WorkoutComponent
      const formattedExercises = workout.workoutExercises.map((workoutEx) => ({
        name: workoutEx.exercise.name,
        sets: workoutEx.sets.map((set) => ({
          weight: set.weight,
          reps: set.reps,
          modifier: set.modifier ?? undefined, // Map null modifier back to undefined
          weightModifier: set.weightModifier ?? undefined, // Map null weightModifier back to undefined
          // Map modifier back to isWarmup boolean if that's what WorkoutComponent expects
          // Adjust based on how WorkoutComponent/initialiseExercises handles modifiers vs isWarmup
          isWarmup: set.modifier === "warmup",
        })),
      }));

      return {
        workoutName: workout.name,
        exercises: formattedExercises,
      };
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
