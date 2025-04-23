import React, { createContext, useContext } from "react";
import {
  type Workout,
  type WorkoutExercise,
  type WorkoutSet,
  type SetModifier,
  type WeightModifier,
  type CompletedWorkout,
} from "@/lib/workoutLogic";
import { useWorkoutState } from "../hooks/useWorkoutState";

// The shape of our context
interface WorkoutContextType {
  // State
  state: Workout;
  currentExercise: WorkoutExercise | undefined;
  activeField: {
    exerciseIndex: number | null;
    setIndex: number | null;
    field: "weight" | "reps" | null;
  };
  inputValue: string;

  // Commands
  completeSet: (exerciseIndex: number, setIndex: number) => void;
  focusField: (
    exerciseIndex: number,
    setIndex: number,
    field: "weight" | "reps",
  ) => void;
  handleKeyPress: (value: string) => void;
  toggleBodyweight: () => void;
  toggleSetType: (exerciseIndex: number, setIndex: number) => void;
  deleteSet: (exerciseIndex: number, setIndex: number) => void;
  addSet: (exerciseIndex: number) => void;
  navigateExercise: (direction: 1 | -1) => void;
  addExerciseNote: (exerciseId: number, text: string) => void;
  addWorkoutNote: (text: string) => void;
  updateNotes: (exerciseId: number, notes: string) => void;
  completeWorkout: (duration?: number) => CompletedWorkout;
}

// Create the context with a default undefined value (will be set by provider)
const WorkoutContext = createContext<WorkoutContextType | undefined>(undefined);

// Props for the provider
interface WorkoutProviderProps {
  children: React.ReactNode;
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

// The provider component
export function WorkoutProvider({
  children,
  mode,
  workoutName,
  previousExercises,
  initialWorkout,
  minReps,
  maxReps,
}: WorkoutProviderProps) {
  const workout = useWorkoutState({
    mode,
    workoutName,
    previousExercises,
    initialWorkout,
    minReps,
    maxReps,
  });

  return (
    <WorkoutContext.Provider value={workout}>
      {children}
    </WorkoutContext.Provider>
  );
}

// Custom hook to use the workout context
export function useWorkout() {
  const context = useContext(WorkoutContext);

  if (context === undefined) {
    throw new Error("useWorkout must be used within a WorkoutProvider");
  }

  return context;
}
