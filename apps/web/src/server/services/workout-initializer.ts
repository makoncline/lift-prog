import type { PrismaClient } from "@prisma/client";
import { normalizeExerciseNameForCompare } from "@/lib/exercise-name";
import type {
  PreviousExerciseData,
  SetModifier,
  SetRestType,
  WeightModifier,
} from "@lift-prog/workout-core";

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

const mapSet = (
  set: {
    weight: number | null;
    reps: number | null;
    modifier: SetModifier | null;
    weightModifier: WeightModifier | null;
    restBefore?: SetRestType | null;
    notes?: string | null;
    rir?: number | null;
  },
  options: { includeNotes?: boolean } = {},
): PreviousExerciseData["sets"][number] => ({
  weight: set.weight ?? null,
  reps: set.reps ?? null,
  ...(set.modifier ? { modifier: set.modifier } : {}),
  ...(set.weightModifier ? { weightModifier: set.weightModifier } : {}),
  ...(set.restBefore ? { restBefore: set.restBefore } : {}),
  ...(options.includeNotes !== false && set.notes ? { notes: set.notes } : {}),
  ...(set.rir != null ? { rir: set.rir } : {}),
});

type WorkoutExerciseHistoryRecord = {
  userExerciseId: number;
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
    rir?: number | null;
    completed: boolean;
  }>;
};

type BuildInitialExercisesFromWorkoutOptions = {
  preserveInstanceNotes?: boolean;
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
      const sets = record.sets
        .filter((set) => set.completed)
        .map((set) => mapSet(set));

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

async function getHistoriesByUserExerciseId({
  prisma,
  userId,
  userExerciseIds,
}: {
  prisma: PrismaClient;
  userId: string;
  userExerciseIds: number[];
}): Promise<Map<number, WorkoutExerciseHistoryRecord[]>> {
  const uniqueUserExerciseIds = [...new Set(userExerciseIds)];

  if (uniqueUserExerciseIds.length === 0) {
    return new Map();
  }

  const records = await prisma.workoutExercise.findMany({
    where: {
      userExerciseId: { in: uniqueUserExerciseIds },
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
      userExerciseId: true,
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
    take: HISTORY_LIMIT * uniqueUserExerciseIds.length,
  });

  const recordsByUserExerciseId = new Map<
    number,
    WorkoutExerciseHistoryRecord[]
  >();

  for (const record of records) {
    const exerciseRecords =
      recordsByUserExerciseId.get(record.userExerciseId) ?? [];

    if (exerciseRecords.length < HISTORY_LIMIT) {
      exerciseRecords.push(record);
      recordsByUserExerciseId.set(record.userExerciseId, exerciseRecords);
    }
  }

  return recordsByUserExerciseId;
}

function buildExerciseFromHistory({
  userExerciseId,
  name,
  exerciseNotes,
  historyRecords,
}: {
  userExerciseId: number;
  name: string;
  exerciseNotes: string | null;
  historyRecords: WorkoutExerciseHistoryRecord[];
}): PreviousExerciseData {
  const latestExercise = historyRecords[0] ?? null;
  const completedSets = latestExercise?.sets.filter((set) => set.completed);
  const previousNotes = latestExercise?.notes ?? null;
  const history = mapHistory(historyRecords);

  if (!latestExercise || !completedSets || completedSets.length === 0) {
    return {
      userExerciseId,
      name,
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
    userExerciseId,
    name,
    sets: completedSets.map((set) => mapSet(set)),
    ...(exerciseNotes ? { exerciseNotes } : {}),
    notes: previousNotes,
    ...(latestExercise.exerciseNotesSnapshot
      ? { exerciseNotesSnapshot: latestExercise.exerciseNotesSnapshot }
      : {}),
    ...(history.length > 0 ? { history } : {}),
  } satisfies PreviousExerciseData;
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

  const requestedNames = new Set(
    exerciseNames.map((name) => normalizeExerciseNameForCompare(name)),
  );
  const userExercises = (
    await prisma.userExercise.findMany({
      where: {
        userId,
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, notes: true },
    })
  ).filter((exercise) =>
    requestedNames.has(normalizeExerciseNameForCompare(exercise.name)),
  );

  const userExerciseByName = new Map<
    string,
    (typeof userExercises)[number]
  >();
  for (const exercise of userExercises) {
    const normalizedName = normalizeExerciseNameForCompare(exercise.name);
    if (userExerciseByName.has(normalizedName)) {
      throw new Error(
        `Multiple user exercises match "${exercise.name}" by normalized name.`,
      );
    }
    userExerciseByName.set(normalizedName, exercise);
  }
  const historiesByUserExerciseId = await getHistoriesByUserExerciseId({
    prisma,
    userId,
    userExerciseIds: userExercises.map((exercise) => exercise.id),
  });

  const results = exerciseNames.map((exerciseName) => {
    const userExercise = userExerciseByName.get(
      normalizeExerciseNameForCompare(exerciseName),
    );

    if (!userExercise) {
      return {
        name: exerciseName,
        sets: DEFAULT_EXERCISE_SETS.map((set) => ({ ...set })),
        notes: null,
      } satisfies PreviousExerciseData;
    }

    return buildExerciseFromHistory({
      userExerciseId: userExercise.id,
      name: userExercise.name,
      exerciseNotes: userExercise.notes ?? null,
      historyRecords: historiesByUserExerciseId.get(userExercise.id) ?? [],
    });
  });

  return results;
}

export async function buildInitialExercisesFromWorkout({
  prisma,
  userId,
  workoutId,
  options = {},
}: {
  prisma: PrismaClient;
  userId: string;
  workoutId: number;
  options?: BuildInitialExercisesFromWorkoutOptions;
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
          userExercise: {
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

  const historiesByUserExerciseId = await getHistoriesByUserExerciseId({
    prisma,
    userId,
    userExerciseIds: workout.workoutExercises.map(
      (workoutExercise) => workoutExercise.userExercise.id,
    ),
  });
  const preserveInstanceNotes = options.preserveInstanceNotes === true;

  const exercises: PreviousExerciseData[] = workout.workoutExercises.map(
    (workoutExercise) => {
      const name = workoutExercise.userExercise.name;
      const sets = workoutExercise.sets.map((set) =>
        mapSet(set, { includeNotes: preserveInstanceNotes }),
      );
      const exerciseHistory =
        historiesByUserExerciseId.get(workoutExercise.userExercise.id) ?? [];
      const history = mapHistory(exerciseHistory);

      if (sets.length > 0) {
        return {
          userExerciseId: workoutExercise.userExercise.id,
          name,
          sets,
          ...(workoutExercise.userExercise.notes
            ? { exerciseNotes: workoutExercise.userExercise.notes }
            : {}),
          notes: preserveInstanceNotes ? workoutExercise.notes : null,
          ...(workoutExercise.exerciseNotesSnapshot
            ? { exerciseNotesSnapshot: workoutExercise.exerciseNotesSnapshot }
            : {}),
          ...(history.length > 0 ? { history } : {}),
        } satisfies PreviousExerciseData;
      }

      const fallback = buildExerciseFromHistory({
        userExerciseId: workoutExercise.userExercise.id,
        name,
        exerciseNotes: workoutExercise.userExercise.notes ?? null,
        historyRecords: exerciseHistory,
      });

      return {
        ...fallback,
        notes: preserveInstanceNotes ? workoutExercise.notes : null,
        ...(workoutExercise.exerciseNotesSnapshot
          ? { exerciseNotesSnapshot: workoutExercise.exerciseNotesSnapshot }
          : {}),
      } satisfies PreviousExerciseData;
    },
  );

  return {
    workoutName: workout.name,
    exercises,
    startedAt: workout.startedAt,
    completedAt: workout.completedAt,
    notes: workout.notes,
  };
}
