"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { LOCAL_STORAGE_WORKOUT_KEY } from "@/lib/constants";
import type { Workout } from "@/lib/workoutLogic";

export function useWorkoutPersistence({
  state,
  autoRestore,
  onInitialSave,
  initialExerciseCount,
  onRestore,
  onRestorePrompt,
}: {
  state: Workout;
  autoRestore: boolean;
  onInitialSave?: () => void;
  initialExerciseCount: number;
  onRestore: (state: Workout) => void;
  onRestorePrompt: () => void;
}) {
  function restoreWorkout() {
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
  }

  useEffect(() => {
    const savedWorkout =
      typeof window !== "undefined"
        ? localStorage.getItem(LOCAL_STORAGE_WORKOUT_KEY)
        : null;
    if (savedWorkout) {
      if (autoRestore) restoreWorkout();
      else onRestorePrompt();
    }
  }, [autoRestore]);

  useEffect(() => {
    if (state.exercises.length > 0 && typeof window !== "undefined") {
      localStorage.setItem(LOCAL_STORAGE_WORKOUT_KEY, JSON.stringify(state));
      if (onInitialSave && initialExerciseCount > 0) onInitialSave();
    }
  }, [state, onInitialSave, initialExerciseCount]);

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
    if (isWorkout(parsed)) return parsed;
    return null;
  } catch {
    return null;
  }
}
