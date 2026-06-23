import {
  displayReps,
  displayWeight,
  estimate1RM,
  summarizeSetEntries,
  type CompletedExercise,
  type CompletedWorkout,
  type SummaryInputSet,
  type Workout,
  type WorkoutExercise,
  type WorkoutSet,
} from "@lift-prog/workout-core";

export type IndexedWorkoutSet = {
  set: WorkoutSet;
  index: number;
};

const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

export function formatNumber(value: number) {
  const rounded = Number(value.toFixed(1));
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export function formatDateTime(value: Date) {
  const hours = value.getHours();
  const hour12 = hours % 12 || 12;
  const minutes = String(value.getMinutes()).padStart(2, "0");
  const suffix = hours >= 12 ? "pm" : "am";
  return `${MONTHS[value.getMonth()]} ${value.getDate()}, ${value.getFullYear()} ${hour12}:${minutes}${suffix}`;
}

export function formatTime(value: Date) {
  const hours = value.getHours();
  const hour12 = hours % 12 || 12;
  const minutes = String(value.getMinutes()).padStart(2, "0");
  const suffix = hours >= 12 ? "pm" : "am";
  return `${hour12}:${minutes}${suffix}`;
}

export function formatRelativeDate(value: Date, now = new Date()) {
  const dayMs = 24 * 60 * 60 * 1000;
  const start = new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
  );
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysAgo = Math.max(
    0,
    Math.round((today.getTime() - start.getTime()) / dayMs),
  );

  if (daysAgo === 0) return "today";
  if (daysAgo === 1) return "1 day ago";
  if (daysAgo < 14) return `${daysAgo} days ago`;
  const weeks = Math.round(daysAgo / 7);
  if (weeks < 8) return `${weeks} weeks ago`;
  const months = Math.round(daysAgo / 30);
  if (months < 18) return `${months} months ago`;
  const years = Math.round(daysAgo / 365);
  return `${years} years ago`;
}

export function formatDuration(startedAt: Date, completedAt: Date) {
  const minutes = Math.max(
    1,
    Math.round((completedAt.getTime() - startedAt.getTime()) / 60_000),
  );
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

export function splitSets(exercise: WorkoutExercise) {
  const warmups: IndexedWorkoutSet[] = [];
  const working: IndexedWorkoutSet[] = [];

  exercise.sets.forEach((set, index) => {
    if (set.modifier === "warmup") {
      warmups.push({ set, index });
    } else {
      working.push({ set, index });
    }
  });

  return { warmups, working };
}

export function formatWeightLabel(
  weight: number | null,
  weightModifier?: "bodyweight",
) {
  if (weightModifier === "bodyweight") {
    if (weight == null || Math.abs(weight) < 0.001) return "BW";
    const sign = weight > 0 ? "+" : "-";
    return `BW${sign}${formatNumber(Math.abs(weight))}lb`;
  }

  if (weight == null) return "";
  return `${formatNumber(weight)}lb`;
}

export function getSetDisplayValues(
  exercise: WorkoutExercise,
  set: WorkoutSet,
  setIndex: number,
) {
  const weightResult = displayWeight(set, exercise.sets, setIndex, exercise);
  const reps = displayReps(set, exercise.sets, setIndex, exercise);

  return {
    weight: weightResult.weight,
    weightModifier: weightResult.weightModifier,
    reps,
  };
}

export function formatSetInline(
  exercise: WorkoutExercise,
  indexedSet: IndexedWorkoutSet,
) {
  const { weight, weightModifier, reps } = getSetDisplayValues(
    exercise,
    indexedSet.set,
    indexedSet.index,
  );
  const weightLabel = formatWeightLabel(weight, weightModifier);
  const repLabel = reps == null ? "" : formatNumber(reps);
  if (!weightLabel && !repLabel) return "";
  if (!weightLabel) return repLabel;
  if (!repLabel) return `${weightLabel}x`;
  return `${weightLabel}x${repLabel}`;
}

export function countWorkingSets(exercise: WorkoutExercise) {
  return splitSets(exercise).working.filter(
    ({ set }) => set.restBefore !== "short",
  ).length;
}

export function countWorkoutWorkingSets(workout: CompletedWorkout) {
  return workout.exercises.reduce(
    (count, exercise) => count + countCompletedExerciseWorkingSets(exercise),
    0,
  );
}

export function countCompletedExerciseWorkingSets(exercise: CompletedExercise) {
  return exercise.sets.filter(
    (set) => set.modifier !== "warmup" && set.restBefore !== "short",
  ).length;
}

export function bestWorkingSetText(exercise: WorkoutExercise) {
  const working = splitSets(exercise).working;
  let best: { label: string; oneRm: number } | null = null;

  for (const indexedSet of working) {
    const { weight, weightModifier, reps } = getSetDisplayValues(
      exercise,
      indexedSet.set,
      indexedSet.index,
    );
    if (weight == null || reps == null || reps <= 0) continue;
    const oneRm = estimate1RM(
      weightModifier === "bodyweight" ? weight : weight,
      reps,
    );
    const label = formatSetInline(exercise, indexedSet);
    if (!best || oneRm > best.oneRm) best = { label, oneRm };
  }

  return best ? `${best.label} . ${formatNumber(best.oneRm)}lb 1rm` : "";
}

export function buildWorkoutSummaryLines(workout: Workout) {
  return workout.exercises.map((exercise) => {
    const summary = summarizeSetEntries(
      splitSets(exercise).working.map((indexedSet) =>
        toSummaryInputSet(exercise, indexedSet),
      ),
    );
    return `${exercise.name} - ${summary ?? ""}`;
  });
}

export function summarizeWorkoutExerciseSetGroup(
  exercise: WorkoutExercise,
  sets: IndexedWorkoutSet[],
) {
  return summarizeSetEntries(
    sets.map((indexedSet) => toSummaryInputSet(exercise, indexedSet)),
  );
}

export function summarizeCompletedExerciseSetGroup(
  sets: CompletedExercise["sets"],
) {
  return summarizeSetEntries(
    sets.map((set): SummaryInputSet => ({
      weight: set.weight,
      reps: set.reps,
      modifier: set.modifier ?? undefined,
      weightModifier: set.weightModifier ?? undefined,
      restBefore: set.restBefore ?? undefined,
    })),
  );
}

function toSummaryInputSet(
  exercise: WorkoutExercise,
  indexedSet: IndexedWorkoutSet,
): SummaryInputSet {
  const { weight, weightModifier, reps } = getSetDisplayValues(
    exercise,
    indexedSet.set,
    indexedSet.index,
  );

  return {
    weight,
    reps,
    modifier: indexedSet.set.modifier,
    weightModifier,
    restBefore: indexedSet.set.restBefore,
  };
}
