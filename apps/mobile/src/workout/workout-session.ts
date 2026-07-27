import {
  initialiseExercises,
  workoutReducer,
  type Action,
  type PreviousExerciseData,
  type Workout,
  type WorkoutExercise,
} from "@lift-prog/workout-core";

import type { LocalPreparedWorkout } from "../local-first/model";
import { DEFAULT_WORKOUT_REST_TIMES } from "./rest";

export type WorkoutSession = {
  past: Workout[];
  present: Workout;
  future: Workout[];
  pendingHistoryBase?: Workout;
};

export type WorkoutDispatchOptions = {
  track?: boolean;
  deferHistory?: boolean;
};

const MAX_MOBILE_DRAFT_HISTORY = 80;
const EPHEMERAL_WORKOUT_ACTIONS = new Set<Action["type"]>([
  "FOCUS_FIELD",
  "COLLAPSE_KEYBOARD",
  "NAV_EXERCISE",
  "SELECT_EXERCISE",
]);

let nextClientId = 1;

export function makeClientId() {
  const id = `mobile-set-${Date.now()}-${nextClientId}`;
  nextClientId += 1;
  return id;
}

function makeWorkoutClientId() {
  return `workout-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeBodyWeightLb(value: unknown): number | null {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : null;

  return numeric != null && Number.isFinite(numeric) && numeric > 0
    ? numeric
    : null;
}

export function ensureWorkoutSetIds(workout: Workout): Workout {
  return {
    ...workout,
    exercises: workout.exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set) => ({
        ...set,
        clientId: set.clientId ?? makeClientId(),
      })),
    })),
  };
}

export function resetExerciseCompletion(
  exercise: WorkoutExercise,
): WorkoutExercise {
  return {
    ...exercise,
    sets: exercise.sets.map((set) => ({
      ...set,
      completed: false,
    })),
  };
}

export function createWorkoutState(
  prepared: LocalPreparedWorkout,
  options: {
    startedAt?: Date;
    notes?: string | null;
    isInProgress?: boolean;
    preservePreparedValues?: boolean;
  } = {},
): Workout {
  const exercises = initialiseExercises(
    prepared.exercises as PreviousExerciseData[],
  );
  const hydratedExercises = options.preservePreparedValues
    ? exercises.map((exercise, exerciseIndex) => {
        const preparedExercise = prepared.exercises[exerciseIndex];
        if (!preparedExercise) return exercise;

        return {
          ...exercise,
          restTimes: preparedExercise.restTimes,
          notes: preparedExercise.notes?.trim()
            ? [{ text: preparedExercise.notes.trim() }]
            : [],
          sets: exercise.sets.map((set, setIndex) => {
            const preparedSet = preparedExercise.sets[setIndex];
            if (!preparedSet) return set;
            const modifier =
              preparedSet.modifier ??
              (preparedSet.isWarmup ? "warmup" : undefined);

            return {
              ...set,
              weight: preparedSet.weight,
              reps: preparedSet.reps,
              completed: true,
              weightExplicit: preparedSet.weight !== null,
              repsExplicit: preparedSet.reps !== null,
              prevWeight: preparedSet.weight,
              prevReps: preparedSet.reps,
              modifier,
              weightModifier: preparedSet.weightModifier,
              restBefore: preparedSet.restBefore,
              restSeconds: preparedSet.restSeconds,
              notes: preparedSet.notes ?? undefined,
              rir: preparedSet.rir,
            };
          }),
        };
      })
    : exercises.map(resetExerciseCompletion);

  return ensureWorkoutSetIds({
    clientId: makeWorkoutClientId(),
    currentExerciseIndex: 0,
    exercises: hydratedExercises,
    activeField: { exerciseIndex: null, setIndex: null, field: null },
    inputValue: "",
    isFirstInteraction: false,
    notes: options.notes?.trim() ? [{ text: options.notes.trim() }] : [],
    startTime: options.startedAt?.getTime() ?? Date.now(),
    name: prepared.workoutName || "Workout",
    bodyWeightLb: normalizeBodyWeightLb(prepared.bodyWeightLb),
    restTimes: prepared.restTimes ?? DEFAULT_WORKOUT_REST_TIMES,
    isInProgress: options.isInProgress ?? true,
  });
}

export function blankPreparedWorkout(
  bodyWeightLb: number | null = null,
): LocalPreparedWorkout {
  return {
    workoutName: "Custom Workout",
    bodyWeightLb,
    restTimes: DEFAULT_WORKOUT_REST_TIMES,
    exercises: [],
  };
}

function applyWorkoutAction(workout: Workout, action: Action) {
  return ensureWorkoutSetIds(workoutReducer(workout, action));
}

export function createWorkoutSession(workout: Workout): WorkoutSession {
  return {
    past: [],
    present: ensureWorkoutSetIds(workout),
    future: [],
  };
}

export function applyWorkoutSessionAction(
  session: WorkoutSession,
  action: Action,
  options: WorkoutDispatchOptions = {},
): WorkoutSession {
  const nextWorkout = applyWorkoutAction(session.present, action);
  const shouldTrack =
    options.track ?? !EPHEMERAL_WORKOUT_ACTIONS.has(action.type);

  if (!shouldTrack) {
    return { ...session, present: nextWorkout };
  }

  if (options.deferHistory) {
    return {
      ...session,
      present: nextWorkout,
      future: [],
      pendingHistoryBase: session.pendingHistoryBase ?? session.present,
    };
  }

  return pushWorkoutHistory(session, nextWorkout);
}

function pushWorkoutHistory(
  session: WorkoutSession,
  nextWorkout: Workout,
): WorkoutSession {
  const base = session.pendingHistoryBase ?? session.present;
  return {
    past: [...session.past, base].slice(-MAX_MOBILE_DRAFT_HISTORY),
    present: nextWorkout,
    future: [],
    pendingHistoryBase: undefined,
  };
}

export function commitPendingWorkoutHistory(
  session: WorkoutSession,
): WorkoutSession {
  if (!session.pendingHistoryBase) return session;
  return {
    ...session,
    past: [...session.past, session.pendingHistoryBase].slice(
      -MAX_MOBILE_DRAFT_HISTORY,
    ),
    future: [],
    pendingHistoryBase: undefined,
  };
}

export function undoWorkoutSession(session: WorkoutSession): WorkoutSession {
  if (session.pendingHistoryBase) {
    return {
      ...session,
      present: session.pendingHistoryBase,
      future: [session.present, ...session.future],
      pendingHistoryBase: undefined,
    };
  }

  const previous = session.past[session.past.length - 1];
  if (!previous) return session;

  return {
    past: session.past.slice(0, -1),
    present: previous,
    future: [session.present, ...session.future],
  };
}

export function redoWorkoutSession(session: WorkoutSession): WorkoutSession {
  const next = session.future[0];
  if (!next) return session;

  return {
    past: [...session.past, session.present].slice(-MAX_MOBILE_DRAFT_HISTORY),
    present: next,
    future: session.future.slice(1),
  };
}
