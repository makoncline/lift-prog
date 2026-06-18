import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import {
  CompletedWorkoutSchema,
  type CompletedExercise,
} from "@/lib/schemas/workout-schema";
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

async function resolveUserExerciseIds({
  prisma,
  userId,
  exercises,
}: {
  prisma: PrismaClient;
  userId: string;
  exercises: CompletedExercise[];
}) {
  const userExerciseIdByName = new Map<string, number>();

  for (const exerciseInput of exercises) {
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
          select: { id: true },
        })
      : null;

    if (existingById) {
      const rec = await prisma.userExercise.update({
        where: { id: existingById.id },
        data: {
          name: exerciseInput.name,
          ...notesUpdate,
        },
        select: { id: true, name: true },
      });
      userExerciseIdByName.set(rec.name, rec.id);
      continue;
    }

    const catalogExercise = await prisma.exercise.findUnique({
      where: { name: exerciseInput.name },
      select: { id: true },
    });

    const rec = await prisma.userExercise.upsert({
      where: {
        userId_name: {
          userId,
          name: exerciseInput.name,
        },
      },
      update: notesUpdate,
      create: {
        userId,
        name: exerciseInput.name,
        exerciseId: catalogExercise?.id ?? null,
        ...notesUpdate,
      },
      select: { id: true, name: true },
    });
    userExerciseIdByName.set(rec.name, rec.id);
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

      const userExerciseIdByName = await resolveUserExerciseIds({
        prisma,
        userId,
        exercises,
      });

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
          const userExerciseId = userExerciseIdByName.get(exerciseInput.name);
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
      const userExerciseIdByName = await resolveUserExerciseIds({
        prisma,
        userId,
        exercises,
      });

      return prisma.$transaction(async (tx) => {
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
          const userExerciseId = userExerciseIdByName.get(exerciseInput.name);
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
