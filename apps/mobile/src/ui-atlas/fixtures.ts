import {
  initialiseExercises,
  type CompletedWorkout,
  type PreviousExerciseData,
  type Workout,
} from "@lift-prog/workout-core";

import type {
  LocalExerciseListItem,
  LocalPreparedWorkout,
  LocalRecentWorkout,
  LocalWorkoutDataClient,
  LocalWorkoutDetails,
} from "../local-first/model";

const STARTED_AT = new Date("2026-07-24T18:30:00-06:00");
const COMPLETED_AT = new Date("2026-07-24T19:18:00-06:00");
export const ATLAS_NOW_MS = Date.parse("2026-07-26T13:18:00-06:00");

const pullUpHistory: PreviousExerciseData["history"] = [
  {
    relation: "last time",
    relativeDate: "3 days ago",
    date: "7/21",
    bodyWeightLb: 172.4,
    workoutNote: "Pull day felt focused.",
    workoutExerciseNote: "Clean pauses between working sets.",
    exerciseNotesSnapshot: "Hold dumbbell between thighs.",
    sets: [
      {
        weight: -95,
        reps: 15,
        modifier: "warmup",
        weightModifier: "bodyweight",
        notes: "Foot assist.",
      },
      {
        weight: 25,
        reps: 11,
        weightModifier: "bodyweight",
        notes: "Smooth final rep.",
      },
      {
        weight: 25,
        reps: 8,
        weightModifier: "bodyweight",
      },
      {
        weight: 25,
        reps: 3,
        weightModifier: "bodyweight",
        restBefore: "short",
      },
    ],
  },
  {
    relation: "2 times ago",
    relativeDate: "10 days ago",
    date: "7/14",
    bodyWeightLb: 171.8,
    workoutExerciseNote: "Grip faded on the last set.",
    exerciseNotesSnapshot: "Hold dumbbell between thighs.",
    sets: [
      {
        weight: -100,
        reps: 15,
        modifier: "warmup",
        weightModifier: "bodyweight",
      },
      {
        weight: 20,
        reps: 13,
        weightModifier: "bodyweight",
      },
      {
        weight: 20,
        reps: 8,
        weightModifier: "bodyweight",
      },
    ],
  },
];

export const atlasExercises: PreviousExerciseData[] = [
  {
    userExerciseId: "atlas-pull-ups",
    name: "Pull-ups",
    exerciseNotes: "Hold dumbbell between thighs.",
    plateStartingWeight: null,
    plateLoadMode: "total",
    restTimes: { warmupSeconds: 20, workingSeconds: 180 },
    notes: "Stay tight through the final rep.",
    sets: [
      {
        weight: -95,
        reps: 15,
        modifier: "warmup",
        weightModifier: "bodyweight",
        restSeconds: 20,
      },
      {
        weight: 25,
        reps: 11,
        weightModifier: "bodyweight",
        restBefore: "standard",
        restSeconds: 180,
        notes: "Smooth final rep.",
      },
      {
        weight: 25,
        reps: 8,
        weightModifier: "bodyweight",
        restBefore: "standard",
        restSeconds: 180,
      },
      {
        weight: 25,
        reps: 3,
        weightModifier: "bodyweight",
        restBefore: "short",
      },
    ],
    history: pullUpHistory,
  },
  {
    userExerciseId: "atlas-row",
    name: "Rows",
    exerciseNotes: "Chest against pad.",
    plateStartingWeight: 0,
    plateLoadMode: "equal-sides",
    restTimes: { warmupSeconds: 20, workingSeconds: 180 },
    notes: "Return to 75lb next time.",
    sets: [
      {
        weight: 0,
        reps: 30,
        modifier: "warmup",
        restSeconds: 20,
      },
      {
        weight: 65,
        reps: 14,
        restBefore: "standard",
        restSeconds: 180,
        notes: "Keep elbows low.",
      },
      {
        weight: 65,
        reps: 13,
        restBefore: "standard",
        restSeconds: 180,
      },
    ],
    history: [
      {
        relation: "last time",
        relativeDate: "6 days ago",
        date: "7/18",
        exerciseNotesSnapshot: "Chest against pad.",
        sets: [
          { weight: 0, reps: 25, modifier: "warmup" },
          { weight: 60, reps: 14 },
          { weight: 60, reps: 12 },
        ],
      },
    ],
  },
  {
    userExerciseId: "atlas-curl",
    name: "Dumbbell bicep curl",
    exerciseNotes: "One dumbbell per hand.",
    plateStartingWeight: 0,
    plateLoadMode: "equal-sides",
    restTimes: { warmupSeconds: 20, workingSeconds: 180 },
    sets: [
      {
        weight: 35,
        reps: 12,
        restSeconds: 180,
      },
      {
        weight: 35,
        reps: 10,
        restBefore: "standard",
        restSeconds: 180,
      },
    ],
    history: [],
  },
];

export const atlasPreparedWorkout: LocalPreparedWorkout = {
  workoutName: "Pull day",
  bodyWeightLb: 172.4,
  restTimes: { warmupSeconds: 20, workingSeconds: 180 },
  exercises: atlasExercises,
};

export function createAtlasDraftWorkout(
  options: {
    completed?: boolean;
    empty?: boolean;
    name?: string;
  } = {},
): Workout {
  const exercises = options.empty ? [] : initialiseExercises(atlasExercises);
  return {
    clientId: "atlas-workout-client",
    currentExerciseIndex: 0,
    exercises: exercises.map((exercise, exerciseIndex) => ({
      ...exercise,
      sets: exercise.sets.map((set, setIndex) => ({
        ...set,
        clientId: `atlas-set-${exerciseIndex}-${setIndex}`,
        completed:
          options.completed === true ? true : setIndex < 2 && exerciseIndex < 2,
      })),
    })),
    activeField: { exerciseIndex: null, setIndex: null, field: null },
    inputValue: "",
    isFirstInteraction: false,
    notes: [{ text: "Focus on clean reps and steady pacing." }],
    startTime: STARTED_AT.getTime(),
    name: options.name ?? "Pull day",
    bodyWeightLb: 172.4,
    restTimes: { warmupSeconds: 20, workingSeconds: 180 },
    isInProgress: true,
  };
}

function toCompletedWorkout(
  id: string,
  name: string,
  dayOffset: number,
): CompletedWorkout {
  const completedAt = new Date(COMPLETED_AT);
  completedAt.setDate(completedAt.getDate() - dayOffset);
  const startedAt = new Date(completedAt.getTime() - 48 * 60_000);

  return {
    clientId: id,
    name,
    notes:
      dayOffset === 0 ? "Focus on clean reps and steady pacing." : undefined,
    startedAt,
    completedAt,
    bodyWeightLb: 172.4 - dayOffset * 0.1,
    restTimes: { warmupSeconds: 20, workingSeconds: 180 },
    exercises: atlasExercises.map((exercise, exerciseIndex) => ({
      userExerciseId: exercise.userExerciseId,
      name: exercise.name,
      order: exerciseIndex,
      exerciseNotes: exercise.notes ?? undefined,
      exerciseNotesSnapshot: exercise.exerciseNotes ?? undefined,
      restTimes: exercise.restTimes,
      sets: exercise.sets.map((set, setIndex) => ({
        order: setIndex,
        weight: set.weight,
        reps: set.reps,
        modifier: set.modifier ?? null,
        weightModifier: set.weightModifier ?? null,
        restBefore: set.restBefore ?? null,
        restSeconds: set.restSeconds ?? null,
        notes: set.notes ?? undefined,
        completed: true,
      })),
    })),
  };
}

const completedWorkouts = [
  toCompletedWorkout("atlas-workout-1", "Pull day", 0),
  toCompletedWorkout("atlas-workout-2", "Legs", 4),
  toCompletedWorkout("atlas-workout-3", "Push day", 8),
  toCompletedWorkout("atlas-workout-4", "Pull day", 12),
  toCompletedWorkout("atlas-workout-5", "Legs", 16),
  toCompletedWorkout("atlas-workout-6", "Push day", 20),
  toCompletedWorkout("atlas-workout-7", "Pull day", 24),
  toCompletedWorkout("atlas-workout-8", "Legs", 28),
  toCompletedWorkout("atlas-workout-9", "Push day", 32),
  toCompletedWorkout("atlas-workout-10", "Pull day", 36),
  toCompletedWorkout("atlas-workout-11", "Legs", 40),
];

function toRecent(workout: CompletedWorkout): LocalRecentWorkout {
  return {
    id: workout.clientId ?? "atlas-workout",
    name: workout.name,
    completedAt: workout.completedAt,
    startedAt: workout.startedAt,
    bodyWeightLb: workout.bodyWeightLb,
    exerciseSummaries: workout.exercises.map((exercise) => {
      const sets = exercise.sets
        .filter((set) => set.modifier !== "warmup")
        .map((set) => `${set.weight ?? "-"}lb x ${set.reps ?? "-"}`)
        .join(", ");
      return `${exercise.name} - ${sets}`;
    }),
  };
}

export const atlasRecentWorkouts = completedWorkouts.map(toRecent);

function toDetails(workout: CompletedWorkout): LocalWorkoutDetails {
  return {
    workoutName: workout.name,
    bodyWeightLb: workout.bodyWeightLb,
    restTimes: workout.restTimes,
    exercises: atlasExercises,
    startedAt: workout.startedAt,
    completedAt: workout.completedAt,
    notes: workout.notes ?? null,
  };
}

export type AtlasClientMode = "normal" | "empty" | "loading" | "error" | "slow";

export function createAtlasWorkoutClient(
  mode: AtlasClientMode = "normal",
): LocalWorkoutDataClient {
  let workouts = mode === "empty" ? [] : [...completedWorkouts];
  const wait = mode === "loading" ? new Promise<never>(() => undefined) : null;
  const delay = () =>
    mode === "slow"
      ? new Promise<void>((resolve) => setTimeout(resolve, 30_000))
      : Promise.resolve();
  const fail = () => {
    if (mode === "error")
      throw new Error("Could not load the fixture workout log.");
  };

  return {
    async listRecent(input) {
      if (wait) return wait;
      fail();
      await delay();
      return workouts.slice(0, input?.limit ?? 10).map(toRecent);
    },
    async prepareInitialWorkout(input) {
      fail();
      await delay();
      if (input.mode === "exerciseList") {
        const selected = input.exerciseNames
          .map((name) =>
            atlasExercises.find(
              (exercise) => exercise.name.toLowerCase() === name.toLowerCase(),
            ),
          )
          .filter((exercise): exercise is PreviousExerciseData =>
            Boolean(exercise),
          );
        return {
          ...atlasPreparedWorkout,
          workoutName: input.workoutName ?? "Custom Workout",
          exercises:
            selected.length > 0
              ? selected
              : [
                  {
                    name: input.exerciseNames[0] ?? "New exercise",
                    sets: [{ weight: null, reps: null }],
                  },
                ],
        };
      }
      const workout = workouts.find(
        (entry) => entry.clientId === input.workoutId,
      );
      return workout ? toDetails(workout) : atlasPreparedWorkout;
    },
    async listExercises() {
      fail();
      return atlasExercises.map(
        (exercise, index): LocalExerciseListItem => ({
          id: String(exercise.userExerciseId ?? `atlas-exercise-${index}`),
          name: exercise.name,
          notes: exercise.exerciseNotes ?? null,
          exerciseId: null,
          plateStartingWeight: exercise.plateStartingWeight ?? null,
          plateLoadMode:
            exercise.plateLoadMode === "total" ? "total" : "equal-sides",
        }),
      );
    },
    async updateExerciseNote() {
      return { count: 1 };
    },
    async updateExercisePlateDefaults() {
      return { count: 1 };
    },
    async saveWorkout(input) {
      workouts = [input, ...workouts];
      return {
        success: true,
        workoutId: input.clientId ?? "atlas-saved-workout",
      };
    },
    async getWorkoutDetails(input) {
      fail();
      const workout = workouts.find(
        (entry) => entry.clientId === input.workoutId,
      );
      return workout ? toDetails(workout) : toDetails(completedWorkouts[0]);
    },
    async updateWorkout(input) {
      workouts = workouts.map((workout) =>
        workout.clientId === input.workoutId ? input.workout : workout,
      );
      return { success: true, workoutId: input.workoutId };
    },
    async deleteWorkout(input) {
      workouts = workouts.filter(
        (workout) => workout.clientId !== input.workoutId,
      );
      return { success: true };
    },
    async isAccountDeletionRequested() {
      return false;
    },
    async requestAccountDeletion() {},
    async cancelAccountDeletionRequest() {},
    async deleteCurrentUser() {
      workouts = [];
      return { success: true };
    },
  };
}

export const atlasPastWorkout = completedWorkouts[0];
export const atlasPastWorkoutDetails = toDetails(atlasPastWorkout);
