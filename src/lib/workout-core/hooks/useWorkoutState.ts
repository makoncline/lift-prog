import { useReducer, useCallback } from "react";
import {
  type Workout,
  type WorkoutExercise,
  type WorkoutSet,
  type Note,
  type ActiveField,
  type SetModifier,
  type WeightModifier,
  workoutReducer,
  initialiseExercises,
  finalizeWorkout,
} from "@/lib/workoutLogic";

interface UseWorkoutStateParams {
  mode: "new" | "edit";
  workoutName?: string;
  previousExercises?: Array<{
    name: string;
    sets: Array<{
      weight: number | null;
      reps: number | null;
      isWarmup?: boolean;
      modifier?: SetModifier;
      weightModifier?: WeightModifier;
    }>;
  }>;
  initialWorkout?: Workout; // Used for "edit" mode
  minReps?: number;
  maxReps?: number;
}

export function useWorkoutState({
  mode,
  workoutName = "Today's Workout",
  previousExercises = [],
  initialWorkout,
  minReps = 8,
  maxReps = 12,
}: UseWorkoutStateParams) {
  // Initialize state based on mode
  const initialState: Workout = initialWorkout ?? {
    currentExerciseIndex: 0,
    exercises: initialiseExercises(previousExercises),
    activeField: { exerciseIndex: null, setIndex: null, field: null },
    inputValue: "",
    isFirstInteraction: true,
    notes: [],
  };

  const [state, dispatch] = useReducer(workoutReducer, initialState);

  // Extract common commands as functions
  const completeSet = useCallback((exerciseIndex: number, setIndex: number) => {
    dispatch({ type: "TOGGLE_COMPLETE", exerciseIndex, setIndex });
  }, []);

  const focusField = useCallback(
    (exerciseIndex: number, setIndex: number, field: "weight" | "reps") => {
      dispatch({
        type: "FOCUS_FIELD",
        exerciseIndex,
        setIndex,
        field,
      });
    },
    [],
  );

  const updateInputValue = useCallback((value: string) => {
    dispatch({ type: "INPUT_DIGIT", value });
  }, []);

  const backspace = useCallback(() => {
    dispatch({ type: "BACKSPACE" });
  }, []);

  const adjustValue = useCallback((sign: 1 | -1) => {
    dispatch({ type: "PLUS_MINUS", sign });
  }, []);

  const toggleBodyweight = useCallback(() => {
    dispatch({ type: "TOGGLE_BODYWEIGHT" });
  }, []);

  const toggleSetType = useCallback(
    (exerciseIndex: number, setIndex: number) => {
      dispatch({ type: "TOGGLE_WARMUP", exerciseIndex, setIndex });
    },
    [],
  );

  const deleteSet = useCallback((exerciseIndex: number, setIndex: number) => {
    dispatch({ type: "DELETE_SET", exerciseIndex, setIndex });
  }, []);

  const addSet = useCallback((exerciseIndex: number) => {
    dispatch({ type: "ADD_SET", exerciseIndex });
  }, []);

  const navigateExercise = useCallback((direction: 1 | -1) => {
    dispatch({ type: "NAV_EXERCISE", direction });
  }, []);

  const collapseKeyboard = useCallback(() => {
    dispatch({ type: "COLLAPSE_KEYBOARD" });
  }, []);

  const addExerciseNote = useCallback((exerciseId: number, text: string) => {
    dispatch({ type: "ADD_EXERCISE_NOTE", exerciseId, text });
  }, []);

  const addWorkoutNote = useCallback((text: string) => {
    dispatch({ type: "ADD_WORKOUT_NOTE", text });
  }, []);

  const updateNotes = useCallback((exerciseId: number, notes: string) => {
    dispatch({ type: "UPDATE_NOTES", exerciseId, notes });
  }, []);

  const completeWorkout = useCallback(
    (duration?: number) => {
      return finalizeWorkout(
        state,
        workoutName,
        state.notes.map((n) => n.text).join("\n"),
        duration,
      );
    },
    [state, workoutName],
  );

  // Handler for numerical keyboard
  const handleKeyPress = useCallback(
    (value: string) => {
      if (value === "backspace") {
        backspace();
      } else if (value === "plus") {
        adjustValue(1);
      } else if (value === "minus") {
        adjustValue(-1);
      } else if (value === "bw") {
        toggleBodyweight();
      } else if (value === "collapse") {
        collapseKeyboard();
      } else if (value === "next") {
        dispatch({ type: "NEXT" });
      } else {
        updateInputValue(value);
      }
    },
    [
      backspace,
      adjustValue,
      toggleBodyweight,
      collapseKeyboard,
      updateInputValue,
    ],
  );

  return {
    // State
    state,
    currentExercise: state.exercises[state.currentExerciseIndex],
    activeField: state.activeField,
    inputValue: state.inputValue,

    // Commands
    completeSet,
    focusField,
    handleKeyPress,
    toggleBodyweight,
    toggleSetType,
    deleteSet,
    addSet,
    navigateExercise,
    addExerciseNote,
    addWorkoutNote,
    updateNotes,
    completeWorkout,

    // Original dispatch if needed for advanced cases
    dispatch,
  };
}
