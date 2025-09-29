import type { PrismaClient } from "@prisma/client";
import type { PreviousExerciseData } from "@/lib/workoutLogic";
import type { SetModifier, WeightModifier } from "@/lib/workoutLogic";

const WARMUP_MODIFIER: SetModifier = "warmup";

const DEFAULT_EXERCISE_SETS: PreviousExerciseData["sets"] = [
  {
    weight: null,
    reps: 20,
    modifier: WARMUP_MODIFIER,
  },
  {
    weight: null,
    reps: 8,
  },
  {
    weight: null,
    reps: 8,
  },
  {
    weight: null,
    reps: 8,
  },
];

const mapSet = (set: {
  weight: number | null;
  reps: number | null;
  modifier: SetModifier | null;
  weightModifier: WeightModifier | null;
}): PreviousExerciseData["sets"][number] => ({
  weight: set.weight ?? null,
  reps: set.reps ?? null,
  modifier: set.modifier ?? undefined,
  weightModifier: set.weightModifier ?? undefined,
});

export async function buildInitialExercisesForNames({
  prisma,
  userId,
  exerciseNames,
}: {
  prisma: PrismaClient;
  userId: string;
  exerciseNames: string[];
}): Promise<PreviousExerciseData[]> {
  if (exerciseNames.length === 0) return [];

  const existingExercises = await prisma.exercise.findMany({
    where: { name: { in: exerciseNames } },
    select: { id: true, name: true },
  });

  const exerciseIdByName = new Map(existingExercises.map((ex) => [ex.name, ex.id]));

  const results = await Promise.all(
    exerciseNames.map(async (exerciseName) => {
      const exerciseId = exerciseIdByName.get(exerciseName);

      if (!exerciseId) {
        return {
          name: exerciseName,
          sets: DEFAULT_EXERCISE_SETS.map((set) => ({ ...set })),
          notes: null,
        } satisfies PreviousExerciseData;
      }

      const latestExercise = await prisma.workoutExercise.findFirst({
        where: {
          exerciseId,
          workout: {
            userId,
            completedAt: { not: null },
          },
        },
        orderBy: {
          workout: {
            completedAt: "desc",
          },
        },
        select: {
          notes: true,
          sets: {
            orderBy: { order: "asc" },
            select: {
              weight: true,
              reps: true,
              modifier: true,
              weightModifier: true,
              completed: true,
            },
          },
        },
      });

      const completedSets = latestExercise?.sets.filter((set) => set.completed);
      const previousNotes = latestExercise?.notes ?? null;

      if (!latestExercise || !completedSets || completedSets.length === 0) {
        return {
          name: exerciseName,
          sets: DEFAULT_EXERCISE_SETS.map((set) => ({ ...set })),
          notes: previousNotes,
        } satisfies PreviousExerciseData;
      }

      return {
        name: exerciseName,
        sets: completedSets.map(mapSet),
        notes: previousNotes,
      } satisfies PreviousExerciseData;
    }),
  );

  return results;
}

export async function buildInitialExercisesFromWorkout({
  prisma,
  userId,
  workoutId,
}: {
  prisma: PrismaClient;
  userId: string;
  workoutId: number;
}): Promise<{ workoutName: string; exercises: PreviousExerciseData[] }>
{
  const workout = await prisma.workout.findFirst({
    where: {
      id: workoutId,
      userId,
    },
    include: {
      workoutExercises: {
        orderBy: { order: "asc" },
        select: {
          notes: true,
          exercise: {
            select: { name: true },
          },
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
  });

  if (!workout) {
    throw new Error(`Workout with ID ${workoutId} not found for user`);
  }

  const exercises: PreviousExerciseData[] = await Promise.all(
    workout.workoutExercises.map(async (workoutExercise) => {
      const name = workoutExercise.exercise.name;
      const sets = workoutExercise.sets.map(mapSet);

      if (sets.length > 0) {
        return {
          name,
          sets,
          notes: workoutExercise.notes ?? null,
        } satisfies PreviousExerciseData;
      }

      const [fallback] = await buildInitialExercisesForNames({
        prisma,
        userId,
        exerciseNames: [name],
      });

      return fallback ?? {
        name,
        sets: DEFAULT_EXERCISE_SETS.map((set) => ({ ...set })),
        notes: null,
      } satisfies PreviousExerciseData;
    }),
  );

  return {
    workoutName: workout.name,
    exercises,
  };
}
