import type {
  RestTimes,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from "@lift-prog/workout-core";

export const DEFAULT_REST_SECONDS = 180;

export const DEFAULT_WORKOUT_REST_TIMES: RestTimes = {
  warmupSeconds: DEFAULT_REST_SECONDS,
  workingSeconds: DEFAULT_REST_SECONDS,
};

export function normalizeRestTimes(
  restTimes: RestTimes | undefined,
): RestTimes {
  return {
    warmupSeconds: restTimes?.warmupSeconds ?? DEFAULT_REST_SECONDS,
    workingSeconds: restTimes?.workingSeconds ?? DEFAULT_REST_SECONDS,
  };
}

export function getEffectiveExerciseRestTimes(
  workout: Workout,
  exercise: WorkoutExercise,
): RestTimes {
  const workoutRestTimes = normalizeRestTimes(workout.restTimes);
  return {
    warmupSeconds:
      exercise.restTimes?.warmupSeconds ?? workoutRestTimes.warmupSeconds,
    workingSeconds:
      exercise.restTimes?.workingSeconds ?? workoutRestTimes.workingSeconds,
  };
}

export function getRestSecondsForSet(set: WorkoutSet, restTimes: RestTimes) {
  if (set.restBefore === "short") return null;
  if (set.modifier === "warmup") {
    return restTimes.warmupSeconds ?? DEFAULT_REST_SECONDS;
  }
  return restTimes.workingSeconds ?? DEFAULT_REST_SECONDS;
}

export function applyDefaultRestBoundaries(
  exercise: WorkoutExercise,
  restTimes: RestTimes,
): WorkoutExercise {
  return {
    ...exercise,
    sets: exercise.sets.map((set, index, sets) => {
      if (index === 0) {
        return { ...set, restBefore: undefined, restSeconds: undefined };
      }

      const previousSet = sets[index - 1];
      const restBefore =
        set.restBefore ??
        (previousSet?.modifier === "warmup" && set.modifier === "warmup"
          ? "short"
          : "standard");

      return {
        ...set,
        restBefore,
        restSeconds:
          restBefore === "short"
            ? null
            : (set.restSeconds ?? getRestSecondsForSet(set, restTimes)),
      };
    }),
  };
}

export function normalizeActiveWorkoutRestDefaults(workout: Workout): Workout {
  const restTimes = normalizeRestTimes(workout.restTimes);
  return {
    ...workout,
    restTimes,
    exercises: workout.exercises.map((exercise) => {
      const exerciseRestTimes = {
        warmupSeconds:
          exercise.restTimes?.warmupSeconds ?? restTimes.warmupSeconds,
        workingSeconds:
          exercise.restTimes?.workingSeconds ?? restTimes.workingSeconds,
      };
      return applyDefaultRestBoundaries(exercise, exerciseRestTimes);
    }),
  };
}

export function applyRestTimesToExerciseSets(
  exercise: WorkoutExercise,
  restTimes: RestTimes,
) {
  const normalizedExercise = applyDefaultRestBoundaries(exercise, restTimes);
  return normalizedExercise.sets.map((set, index) => {
    if (index === 0 || set.restBefore === "short") return set;
    return {
      ...set,
      restBefore: "standard" as const,
      restSeconds: getRestSecondsForSet(set, restTimes),
    };
  });
}

export function getRestTimerSecondsAfterSet(
  exercise: WorkoutExercise,
  setIndex: number,
  restTimes: RestTimes,
) {
  let groupEndIndex = setIndex;
  while (
    exercise.sets[groupEndIndex]?.modifier !== "warmup" &&
    exercise.sets[groupEndIndex + 1]?.restBefore === "short" &&
    exercise.sets[groupEndIndex + 1]?.modifier !== "warmup"
  ) {
    groupEndIndex += 1;
  }

  const nextSet = exercise.sets[groupEndIndex + 1];
  if (!nextSet) {
    return restTimes.workingSeconds ?? DEFAULT_REST_SECONDS;
  }
  if (nextSet.restBefore === "short") return null;

  const seconds =
    nextSet.restSeconds ?? getRestSecondsForSet(nextSet, restTimes);
  return seconds != null && seconds > 0 ? seconds : DEFAULT_REST_SECONDS;
}
