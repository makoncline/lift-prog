import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import {
  CompletedWorkoutSchema,
  type CompletedExercise,
  summarizeWorkingSets,
} from "@lift-prog/workout-core";
import { normalizeExerciseNameForCompare } from "@/lib/exercise-name";
import {
  ListRecentWorkoutsInputSchema,
  PrepareInitialWorkoutInputSchema,
} from "@lift-prog/workout-sdk";
import {
  buildInitialExercisesForNames,
  buildInitialExercisesFromWorkout,
} from "@/server/services/workout-initializer";

type WorkoutPrisma = Pick<PrismaClient, "exercise" | "userExercise">;

async function resolveUserExerciseIds({
  prisma,
  userId,
  exercises,
}: {
  prisma: WorkoutPrisma;
  userId: string;
  exercises: CompletedExercise[];
}) {
  const userExerciseIdByName = new Map<string, number>();
  const existingUserExercises = await prisma.userExercise.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const rememberUserExercise = (exercise: { id: number; name: string }) => {
    const index = existingUserExercises.findIndex(
      (existing) => existing.id === exercise.id,
    );
    if (index >= 0) {
      existingUserExercises[index] = exercise;
    } else {
      existingUserExercises.push(exercise);
    }
    userExerciseIdByName.set(
      normalizeExerciseNameForCompare(exercise.name),
      exercise.id,
    );
  };

  const findExistingByName = (name: string) => {
    const normalizedName = normalizeExerciseNameForCompare(name);
    const matches = existingUserExercises.filter(
      (exercise) =>
        normalizeExerciseNameForCompare(exercise.name) === normalizedName,
    );

    if (matches.length > 1) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `Multiple user exercises match "${name}". Merge duplicates before saving this workout.`,
      });
    }

    return matches[0] ?? null;
  };

  for (const exerciseInput of exercises) {
    const exerciseName = exerciseInput.name.trim();
    if (!exerciseName) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Exercise name cannot be empty.",
      });
    }

    const notesUpdate =
      exerciseInput.exerciseNotes === undefined
        ? {}
        : { notes: exerciseInput.exerciseNotes.trim() || null };

    const existingById = exerciseInput.userExerciseId
      ? await prisma.userExercise.findFirst({
          where: {
            id: exerciseInput.userExerciseId,
            userId,
          },
          select: { id: true, name: true },
        })
      : null;

    if (existingById) {
      const rec =
        exerciseInput.exerciseNotes === undefined
          ? existingById
          : await prisma.userExercise.update({
              where: { id: existingById.id },
              data: notesUpdate,
              select: { id: true, name: true },
            });
      rememberUserExercise(rec);
      userExerciseIdByName.set(
        normalizeExerciseNameForCompare(exerciseName),
        rec.id,
      );
      continue;
    }

    const existingByName = findExistingByName(exerciseName);
    if (existingByName) {
      const rec =
        exerciseInput.exerciseNotes === undefined
          ? existingByName
          : await prisma.userExercise.update({
              where: { id: existingByName.id },
              data: notesUpdate,
              select: { id: true, name: true },
            });
      rememberUserExercise(rec);
      userExerciseIdByName.set(
        normalizeExerciseNameForCompare(exerciseName),
        rec.id,
      );
      continue;
    }

    const catalogExercise = await prisma.exercise.findUnique({
      where: { name: exerciseName },
      select: { id: true },
    });

    const rec = await prisma.userExercise.upsert({
      where: {
        userId_name: {
          userId,
          name: exerciseName,
        },
      },
      update: notesUpdate,
      create: {
        userId,
        name: exerciseName,
        exerciseId: catalogExercise?.id ?? null,
        ...notesUpdate,
      },
      select: { id: true, name: true },
    });
    rememberUserExercise(rec);
    userExerciseIdByName.set(
      normalizeExerciseNameForCompare(exerciseName),
      rec.id,
    );
  }

  return userExerciseIdByName;
}

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

      await prisma.user.upsert({
        where: { id: userId },
        update: {},
        create: {
          id: userId,
          clerkUserId: userId,
        },
      });

      // 2. Use Prisma transaction to save the workout atomically
      return prisma.$transaction(async (tx) => {
        const userExerciseIdByName = await resolveUserExerciseIds({
          prisma: tx,
          userId,
          exercises,
        });

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
          const userExerciseId = userExerciseIdByName.get(
            normalizeExerciseNameForCompare(exerciseInput.name),
          );
          if (!userExerciseId) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `User exercise ID not found for: ${exerciseInput.name}`,
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
              userExerciseId,
              order: exerciseInput.order,
              notes: exerciseInput.notes,
              ...(exerciseInput.exerciseNotesSnapshot === undefined
                ? {}
                : {
                    exerciseNotesSnapshot: exerciseInput.exerciseNotesSnapshot,
                  }),
            },
          });

          const setsData = completedSets.map((set) => ({
            workoutExerciseId: workoutExercise.id,
            order: set.order,
            weight: set.weight,
            reps: set.reps,
            modifier: set.modifier,
            weightModifier: set.weightModifier ?? null,
            ...(set.restBefore === undefined
              ? {}
              : { restBefore: set.restBefore }),
            ...(set.notes === undefined ? {} : { notes: set.notes }),
            ...(set.rir === undefined ? {} : { rir: set.rir }),
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

  updateWorkout: protectedProcedure
    .input(
      z.object({
        workoutId: z.number(),
        workout: CompletedWorkoutSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const prisma = ctx.db;
      const userId = ctx.session.userId;

      if (!userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Unauthorized: User ID mismatch",
        });
      }

      const existingWorkout = await prisma.workout.findFirst({
        where: {
          id: input.workoutId,
          userId,
        },
        select: { id: true },
      });

      if (!existingWorkout) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Workout with ID ${input.workoutId} not found or access denied.`,
        });
      }

      const { name, exercises, notes, completedAt, startedAt } = input.workout;

      return prisma.$transaction(async (tx) => {
        const userExerciseIdByName = await resolveUserExerciseIds({
          prisma: tx,
          userId,
          exercises,
        });

        await tx.workout.update({
          where: { id: input.workoutId },
          data: {
            name,
            notes,
            startedAt,
            completedAt,
          },
        });

        await tx.workoutExercise.deleteMany({
          where: { workoutSessionId: input.workoutId },
        });

        for (const exerciseInput of exercises) {
          const userExerciseId = userExerciseIdByName.get(
            normalizeExerciseNameForCompare(exerciseInput.name),
          );
          if (!userExerciseId) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `User exercise ID not found for: ${exerciseInput.name}`,
            });
          }

          const completedSets = exerciseInput.sets.filter(
            (set) => set.completed,
          );

          if (completedSets.length === 0) continue;

          const workoutExercise = await tx.workoutExercise.create({
            data: {
              workoutSessionId: input.workoutId,
              userExerciseId,
              order: exerciseInput.order,
              notes: exerciseInput.notes,
              ...(exerciseInput.exerciseNotesSnapshot === undefined
                ? {}
                : {
                    exerciseNotesSnapshot: exerciseInput.exerciseNotesSnapshot,
                  }),
            },
          });

          const setsData = completedSets.map((set) => ({
            workoutExerciseId: workoutExercise.id,
            order: set.order,
            weight: set.weight,
            reps: set.reps,
            modifier: set.modifier,
            weightModifier: set.weightModifier ?? null,
            ...(set.restBefore === undefined
              ? {}
              : { restBefore: set.restBefore }),
            ...(set.notes === undefined ? {} : { notes: set.notes }),
            ...(set.rir === undefined ? {} : { rir: set.rir }),
            completed: true,
          }));

          if (setsData.length > 0) {
            await tx.workoutExerciseSet.createMany({
              data: setsData,
            });
          }
        }

        return { success: true, workoutId: input.workoutId };
      });
    }),

  // New procedure to list recent workouts for the logged-in user
  listRecent: protectedProcedure
    .input(ListRecentWorkoutsInputSchema)
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
              userExercise: { select: { name: true } },
              sets: {
                orderBy: { order: "asc" },
                select: {
                  weight: true,
                  reps: true,
                  modifier: true,
                  weightModifier: true,
                  restBefore: true,
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
              exercise.userExercise.name,
              exercise.sets.map((set) => ({
                weight: set.weight,
                reps: set.reps,
                modifier: set.modifier ?? undefined,
                weightModifier: set.weightModifier ?? undefined,
                restBefore: set.restBefore,
              })),
            ),
          )
          .filter((summary): summary is string => Boolean(summary));

        return {
          id: workout.id,
          name: workout.name,
          completedAt: workout.completedAt,
          startedAt: workout.startedAt,
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
        return await buildInitialExercisesFromWorkout({
          prisma: ctx.db,
          userId,
          workoutId: input.workoutId,
          options: { preserveInstanceNotes: true },
        });
      } catch (error) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Workout with ID ${input.workoutId} not found or access denied.`,
          cause: error,
        });
      }
    }),

  prepareInitialWorkout: protectedProcedure
    .input(PrepareInitialWorkoutInputSchema)
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
          options: { preserveInstanceNotes: false },
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
