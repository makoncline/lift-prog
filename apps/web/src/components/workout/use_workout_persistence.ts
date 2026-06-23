"use client";

import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import {
  LOCAL_STORAGE_WORKOUT_KEY,
  parsePlateLoadMode,
  type Workout,
  type WorkoutExercise,
  type WorkoutSet,
  type SetRestType,
} from "@lift-prog/workout-core";

export function useWorkoutPersistence({
  state,
  autoRestore,
  enabled = true,
  onInitialSave,
  initialExerciseCount,
  onRestore,
  onRestorePrompt,
}: {
  state: Workout;
  autoRestore: boolean;
  enabled?: boolean;
  onInitialSave?: () => void;
  initialExerciseCount: number;
  onRestore: (state: Workout) => void;
  onRestorePrompt: () => void;
}) {
  const restoreWorkout = useCallback(() => {
    const stored =
      typeof window !== "undefined"
        ? localStorage.getItem(LOCAL_STORAGE_WORKOUT_KEY)
        : null;
    const parsedState = safelyParseWorkoutState(stored);
    if (parsedState) {
      onRestore(parsedState);
      return;
    }

    toast.error("Failed to restore progress. Stored data might be corrupted.");
    if (typeof window !== "undefined") {
      localStorage.removeItem(LOCAL_STORAGE_WORKOUT_KEY);
    }
  }, [onRestore]);

  useEffect(() => {
    if (!enabled) return;

    const savedWorkout =
      typeof window !== "undefined"
        ? localStorage.getItem(LOCAL_STORAGE_WORKOUT_KEY)
        : null;
    if (savedWorkout) {
      if (autoRestore) restoreWorkout();
      else onRestorePrompt();
    }
  }, [autoRestore, enabled, onRestorePrompt, restoreWorkout]);

  useEffect(() => {
    if (!enabled) return;

    if (state.exercises.length > 0 && typeof window !== "undefined") {
      localStorage.setItem(LOCAL_STORAGE_WORKOUT_KEY, JSON.stringify(state));
      if (onInitialSave && initialExerciseCount > 0) onInitialSave();
    }
  }, [state, enabled, onInitialSave, initialExerciseCount]);

  return { restoreWorkout };
}

function safelyParseWorkoutState(jsonString: string | null): Workout | null {
  if (!jsonString) return null;
  try {
    const parsed = JSON.parse(jsonString) as unknown;
    function isWorkout(obj: unknown): obj is Workout {
      return (
        typeof obj === "object" &&
        obj !== null &&
        "exercises" in obj &&
        Array.isArray((obj as Record<string, unknown>).exercises) &&
        "currentExerciseIndex" in obj &&
        typeof (obj as Record<string, unknown>).currentExerciseIndex ===
          "number" &&
        "activeField" in obj &&
        "inputValue" in obj &&
        typeof (obj as Record<string, unknown>).inputValue === "string"
      );
    }
    if (isWorkout(parsed)) return normalizeWorkoutState(parsed);
    return null;
  } catch {
    return null;
  }
}

type UnknownRecord = Record<string, unknown>;

function normalizeWorkoutState(workout: Workout): Workout {
  const exercises = workout.exercises.map(normalizeWorkoutExercise);
  return {
    currentExerciseIndex: clampIndex(workout.currentExerciseIndex, exercises),
    exercises,
    activeField: { exerciseIndex: null, setIndex: null, field: null },
    inputValue: "",
    isFirstInteraction: false,
    notes: normalizeNotes(workout.notes),
    startTime: finiteNumber(workout.startTime) ?? Date.now(),
    name: stringValue(workout.name) ?? "Workout",
    bodyWeightLb: finiteNumber(workout.bodyWeightLb),
    isInProgress:
      typeof workout.isInProgress === "boolean" ? workout.isInProgress : true,
  };
}

function normalizeWorkoutExercise(
  exercise: Workout["exercises"][number],
  exerciseIndex: number,
): WorkoutExercise {
  const record = exercise as unknown as UnknownRecord;
  const sets = Array.isArray(record.sets)
    ? record.sets.map((set, setIndex) => normalizeWorkoutSet(set, setIndex))
    : [];
  const previousSets = Array.isArray(record.previousSets)
    ? record.previousSets.map(normalizePreviousSet)
    : [];
  const history = Array.isArray(record.history)
    ? record.history.map(normalizeHistoryEntry)
    : undefined;
  const userExerciseId = finiteNumber(record.userExerciseId);

  return {
    ...(userExerciseId == null ? {} : { userExerciseId }),
    name: stringValue(record.name) ?? `Exercise ${exerciseIndex + 1}`,
    exerciseNotes: stringOrNull(record.exerciseNotes),
    plateStartingWeight: finiteNumber(record.plateStartingWeight),
    plateLoadMode:
      typeof record.plateLoadMode === "string"
        ? parsePlateLoadMode(record.plateLoadMode)
        : null,
    sets,
    previousSets,
    ...(history ? { history } : {}),
    ...(stringValue(record.previousSummary)
      ? { previousSummary: stringValue(record.previousSummary) }
      : {}),
    ...(stringValue(record.previousNotes)
      ? { previousNotes: stringValue(record.previousNotes) }
      : {}),
    notes: normalizeNotes(record.notes),
  };
}

function normalizeWorkoutSet(value: unknown, index: number): WorkoutSet {
  const record = asRecord(value);
  const weight = finiteNumber(record.weight);
  const reps = finiteNumber(record.reps);
  const clientId = stringValue(record.clientId) ?? stringValue(record.id);
  const notes = stringValue(record.notes);
  const rir = finiteNumber(record.rir);

  return {
    ...(clientId ? { clientId } : { clientId: `restored-set-${index}` }),
    weight,
    reps,
    completed:
      typeof record.completed === "boolean"
        ? record.completed
        : weight !== null && reps !== null,
    weightExplicit:
      typeof record.weightExplicit === "boolean"
        ? record.weightExplicit
        : weight !== null,
    repsExplicit:
      typeof record.repsExplicit === "boolean"
        ? record.repsExplicit
        : reps !== null,
    prevWeight: finiteNumber(record.prevWeight),
    prevReps: finiteNumber(record.prevReps),
    ...(record.modifier === "warmup" ? { modifier: "warmup" as const } : {}),
    ...(record.weightModifier === "bodyweight"
      ? { weightModifier: "bodyweight" as const }
      : {}),
    ...(record.restBefore === "short" || record.restBefore === "standard"
      ? { restBefore: record.restBefore }
      : {}),
    ...(notes ? { notes } : {}),
    ...(rir == null ? {} : { rir }),
  };
}

function normalizePreviousSet(value: unknown) {
  const record = asRecord(value);
  const notes = stringOrNull(record.notes);
  const rir = finiteNumber(record.rir);
  const restBefore = normalizeRestBefore(record.restBefore);

  return {
    weight: finiteNumber(record.weight),
    reps: finiteNumber(record.reps),
    ...(record.modifier === "warmup" ? { modifier: "warmup" as const } : {}),
    ...(record.weightModifier === "bodyweight"
      ? { weightModifier: "bodyweight" as const }
      : {}),
    ...(restBefore ? { restBefore } : {}),
    ...(notes == null ? {} : { notes }),
    ...(rir == null ? {} : { rir }),
  };
}

function normalizeHistoryEntry(
  value: unknown,
): NonNullable<WorkoutExercise["history"]>[number] {
  const record = asRecord(value);
  const rawSets = Array.isArray(record.sets) ? record.sets : [];

  return {
    relation: stringValue(record.relation) ?? "",
    relativeDate: stringValue(record.relativeDate) ?? "",
    date: stringValue(record.date) ?? "",
    bodyWeightLb: finiteNumber(record.bodyWeightLb),
    workoutNote: stringOrNull(record.workoutNote),
    workoutExerciseNote: stringOrNull(record.workoutExerciseNote),
    exerciseNotesSnapshot: stringOrNull(record.exerciseNotesSnapshot),
    sets: rawSets.map(normalizePreviousSet),
  };
}

function normalizeNotes(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.flatMap((note) => {
    const record = asRecord(note);
    const text = stringValue(record.text);
    return text ? [{ text }] : [];
  });
}

function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null
    ? (value as UnknownRecord)
    : {};
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function stringOrNull(value: unknown): string | null {
  return stringValue(value) ?? null;
}

function normalizeRestBefore(value: unknown): SetRestType | undefined {
  return value === "short" || value === "standard" ? value : undefined;
}

function clampIndex<T>(index: number, items: T[]) {
  if (items.length === 0) return 0;
  if (!Number.isFinite(index)) return 0;
  return Math.min(Math.max(0, index), items.length - 1);
}
