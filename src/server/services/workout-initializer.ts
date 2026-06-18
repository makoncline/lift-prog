import type { PrismaClient } from "@prisma/client";
import type { PreviousExerciseData } from "@/lib/workoutLogic";
import type {
  SetModifier,
  SetRestType,
  WeightModifier,
} from "@/lib/workoutLogic";

const WARMUP_MODIFIER: SetModifier = "warmup";
const HISTORY_LIMIT = 6;

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
  restBefore?: SetRestType | null;
  notes?: string | null;
  rir?: number | null;
}): PreviousExerciseData["sets"][number] => ({
  weight: set.weight ?? null,
  reps: set.reps ?? null,
  ...(set.modifier ? { modifier: set.modifier } : {}),
  ...(set.weightModifier ? { weightModifier: set.weightModifier } : {}),
  ...(set.restBefore ? { restBefore: set.restBefore } : {}),
  ...(set.notes ? { notes: set.notes } : {}),
  ...(set.rir != null ? { rir: set.rir } : {}),
});

type WorkoutExerciseHistoryRecord = {
  notes: string | null;
  exerciseNotesSnapshot: string | null;
  workout: {
    completedAt: Date | null;
    notes: string | null;
  };
  sets: Array<{
    weight: number | null;
    reps: number | null;
    modifier: SetModifier | null;
    weightModifier: WeightModifier | null;
    restBefore?: SetRestType | null;
    notes?: string | null;
    completed: boolean;
  }>;
};

function historyRelation(index: number) {
  if (index === 0) return "last time";
  return `${index + 1} times ago`;
}

function formatShortDate(date: Date | null) {
  if (!date) return "";
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatRelativeDate(date: Date | null, now = new Date()) {
  if (!date) return "";

  const dayMs = 24 * 60 * 60 * 1000;
  const startOfDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysAgo = Math.max(
    0,
    Math.round((startOfNow.getTime() - startOfDate.getTime()) / dayMs),
  );

  if (daysAgo === 0) return "today";
  if (daysAgo === 1) return "1 day ago";
  return `${daysAgo} days ago`;
}

function mapHistory(
  records: WorkoutExerciseHistoryRecord[],
): NonNullable<PreviousExerciseData["history"]> {
  return records
    .map((record, index) => {
      const sets = record.sets.filter((set) => set.completed).map(mapSet);

      return {
        relation: historyRelation(index),
        relativeDate: formatRelativeDate(record.workout.completedAt),
        date: formatShortDate(record.workout.completedAt),
        ...(record.workout.notes ? { workoutNote: record.workout.notes } : {}),
        ...(record.notes ? { workoutExerciseNote: record.notes } : {}),
        ...(record.exerciseNotesSnapshot
          ? { exerciseNotesSnapshot: record.exerciseNotesSnapshot }
          : {}),
        sets,
      };
    })
    .filter((entry) => entry.sets.length > 0);
}

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
    select: { id: true, name: true, notes: true },
  });

  const exerciseIdByName = new Map(
    existingExercises.map((ex) => [ex.name, ex.id]),
  );
  const exerciseNotesByName = new Map(
    existingExercises.map((ex) => [ex.name, ex.notes]),
  );

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

      const exerciseHistory = await prisma.workoutExercise.findMany({
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
          exerciseNotesSnapshot: true,
          workout: {
            select: {
              completedAt: true,
              notes: true,
            },
          },
          sets: {
            orderBy: { order: "asc" },
            select: {
              weight: true,
              reps: true,
              modifier: true,
              weightModifier: true,
              restBefore: true,
              notes: true,
              rir: true,
              completed: true,
            },
          },
        },
        take: HISTORY_LIMIT,
      });

      const latestExercise = exerciseHistory[0] ?? null;
      const completedSets = latestExercise?.sets.filter((set) => set.completed);
      const previousNotes = latestExercise?.notes ?? null;
      const exerciseNotes = exerciseNotesByName.get(exerciseName) ?? null;
      const history = mapHistory(exerciseHistory);

      if (!latestExercise || !completedSets || completedSets.length === 0) {
        return {
          name: exerciseName,
          sets: DEFAULT_EXERCISE_SETS.map((set) => ({ ...set })),
          ...(exerciseNotes ? { exerciseNotes } : {}),
          notes: previousNotes,
          ...(latestExercise?.exerciseNotesSnapshot
            ? { exerciseNotesSnapshot: latestExercise.exerciseNotesSnapshot }
            : {}),
          ...(history.length > 0 ? { history } : {}),
        } satisfies PreviousExerciseData;
      }

      return {
        name: exerciseName,
        sets: completedSets.map(mapSet),
        ...(exerciseNotes ? { exerciseNotes } : {}),
        notes: previousNotes,
        ...(latestExercise.exerciseNotesSnapshot
          ? { exerciseNotesSnapshot: latestExercise.exerciseNotesSnapshot }
          : {}),
        ...(history.length > 0 ? { history } : {}),
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
}): Promise<{
  workoutName: string;
  exercises: PreviousExerciseData[];
  startedAt: Date;
  completedAt: Date | null;
  notes: string | null;
}> {
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
          exerciseNotesSnapshot: true,
          exercise: {
            select: { id: true, name: true, notes: true },
          },
          sets: {
            orderBy: { order: "asc" },
            select: {
              weight: true,
              reps: true,
              modifier: true,
              weightModifier: true,
              restBefore: true,
              notes: true,
              rir: true,
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
      const exerciseHistory = await prisma.workoutExercise.findMany({
        where: {
          exerciseId: workoutExercise.exercise.id,
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
          exerciseNotesSnapshot: true,
          workout: {
            select: {
              completedAt: true,
              notes: true,
            },
          },
          sets: {
            orderBy: { order: "asc" },
            select: {
              weight: true,
              reps: true,
              modifier: true,
              weightModifier: true,
              restBefore: true,
              notes: true,
              completed: true,
            },
          },
        },
        take: HISTORY_LIMIT,
      });
      const history = mapHistory(exerciseHistory);

      if (sets.length > 0) {
        return {
          name,
          sets,
          ...(workoutExercise.exercise.notes
            ? { exerciseNotes: workoutExercise.exercise.notes }
            : {}),
          notes: workoutExercise.notes ?? null,
          ...(workoutExercise.exerciseNotesSnapshot
            ? { exerciseNotesSnapshot: workoutExercise.exerciseNotesSnapshot }
            : {}),
          ...(history.length > 0 ? { history } : {}),
        } satisfies PreviousExerciseData;
      }

      const [fallback] = await buildInitialExercisesForNames({
        prisma,
        userId,
        exerciseNames: [name],
      });

      return (
        fallback ??
        ({
          name,
          sets: DEFAULT_EXERCISE_SETS.map((set) => ({ ...set })),
          ...(workoutExercise.exercise.notes
            ? { exerciseNotes: workoutExercise.exercise.notes }
            : {}),
          notes: null,
        } satisfies PreviousExerciseData)
      );
    }),
  );

  return {
    workoutName: workout.name,
    exercises,
    startedAt: workout.startedAt,
    completedAt: workout.completedAt,
    notes: workout.notes,
  };
}
