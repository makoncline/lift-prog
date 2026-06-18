import type {
  CurrentExerciseSet,
  ExerciseSet as ReferenceExerciseSet,
  PreviousExercise,
} from "@/components/workout-reference/workout_reference_types";
import type { Workout, WorkoutSet, WeightModifier } from "@/lib/workoutLogic";

export function workoutSetToCurrentSet(
  set: WorkoutSet,
  exercise: Workout["exercises"][number],
  exerciseIndex: number,
  setIndex: number,
): CurrentExerciseSet {
  const id = set.clientId ?? `exercise-${exerciseIndex}-set-${setIndex}`;
  const previousSet = exercise.previousSets[setIndex];
  const displayWeight = set.weight ?? set.prevWeight ?? previousSet?.weight;
  const displayReps = set.reps ?? set.prevReps ?? previousSet?.reps;
  const displayNote = set.notes ?? previousSet?.notes;
  const displayRestBefore = set.restBefore ?? previousSet?.restBefore;
  const rawWeight = displayWeight ?? 0;
  const weightModifier = set.weightModifier ?? previousSet?.weightModifier;
  const isBodyweight = weightModifier === "bodyweight";

  return {
    id,
    kind: set.modifier === "warmup" ? "warmup" : "working",
    weightMode: isBodyweight ? "bodyweight" : "standard",
    weightAmount:
      displayWeight == null || (isBodyweight && displayWeight === 0)
        ? ""
        : String(Math.abs(rawWeight)),
    weightSign: rawWeight < 0 ? -1 : 1,
    reps: displayReps == null ? "" : String(displayReps),
    ...(displayNote ? { note: displayNote } : {}),
    ...(displayRestBefore
      ? { restBefore: displayRestBefore === "short" ? "short" : "default" }
      : {}),
    completed: set.completed,
  };
}

export function currentSetToWorkoutSet(set: CurrentExerciseSet): WorkoutSet {
  const parsedWeight =
    set.weightAmount.trim() === "" ? null : Number(set.weightAmount);
  const signedWeight =
    parsedWeight == null ? null : set.weightSign * parsedWeight;
  const weight =
    set.weightMode === "bodyweight" ? (signedWeight ?? 0) : parsedWeight;
  const reps = set.reps.trim() === "" ? null : Number(set.reps);

  return {
    clientId: set.id,
    weight,
    reps,
    completed: set.completed || (weight !== null && reps !== null),
    weightExplicit: weight !== null,
    repsExplicit: reps !== null,
    prevWeight: null,
    prevReps: null,
    ...(set.kind === "warmup" ? { modifier: "warmup" as const } : {}),
    ...(set.weightMode === "bodyweight"
      ? { weightModifier: "bodyweight" as const }
      : {}),
    ...(set.restBefore
      ? { restBefore: set.restBefore === "short" ? "short" : "standard" }
      : {}),
    ...(set.note?.trim() ? { notes: set.note.trim() } : {}),
  };
}

export function normalizeCurrentSetOrder(sets: CurrentExerciseSet[]) {
  const groupedSets = [
    ...sets.filter((set) => set.kind === "warmup"),
    ...sets.filter((set) => set.kind === "working"),
  ];

  return groupedSets.map((set, index, allSets) => {
    const previousSet = allSets[index - 1];
    if (!previousSet || previousSet.kind !== set.kind) {
      return { ...set, restBefore: undefined };
    }
    return set;
  });
}

export function buildReferenceHistory(
  exercise: Workout["exercises"][number],
): PreviousExercise[] {
  if (exercise.history && exercise.history.length > 0) {
    return exercise.history.map((entry) => ({
      relation: entry.relation,
      relativeDate: entry.relativeDate,
      date: entry.date,
      ...(entry.workoutNote ? { workoutNote: entry.workoutNote } : {}),
      ...(entry.workoutExerciseNote
        ? { workoutExerciseNote: entry.workoutExerciseNote }
        : {}),
      ...(entry.exerciseNotesSnapshot &&
      entry.exerciseNotesSnapshot !== exercise.exerciseNotes
        ? {
            exerciseNoteChanged: true,
            historicalExerciseNote: entry.exerciseNotesSnapshot,
          }
        : {}),
      warmups: entry.sets
        .filter((set) => set.modifier === "warmup")
        .map(referenceSet),
      workingSets: entry.sets
        .filter((set) => set.modifier !== "warmup")
        .map(referenceSet),
    }));
  }

  if (exercise.previousSets.length === 0) return [];

  return [
    {
      relation: "last time",
      relativeDate: "",
      date: "",
      ...(exercise.previousNotes
        ? { workoutExerciseNote: exercise.previousNotes }
        : {}),
      warmups: exercise.previousSets
        .filter((set) => set.modifier === "warmup")
        .map(referenceSet),
      workingSets: exercise.previousSets
        .filter((set) => set.modifier !== "warmup")
        .map(referenceSet),
    },
  ];
}

function referenceSet(
  set: Workout["exercises"][number]["previousSets"][number],
): ReferenceExerciseSet {
  return {
    weight: formatReferenceWeight(set),
    reps: [set.reps ?? ""],
    ...(set.notes ? { note: set.notes } : {}),
    ...(set.restBefore
      ? { restBefore: set.restBefore === "short" ? "short" : "default" }
      : {}),
  };
}

function formatReferenceWeight(set: {
  weight: number | null;
  weightModifier?: WeightModifier | null;
}) {
  if (set.weightModifier === "bodyweight") {
    if (!set.weight) return "BW";
    return set.weight > 0 ? `BW+${set.weight} lb` : `BW${set.weight} lb`;
  }

  return set.weight == null ? "BW" : `${set.weight} lb`;
}
