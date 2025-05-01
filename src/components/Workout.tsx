"use client";
import React, { useReducer, useState, useRef, useEffect } from "react";
import type { TouchEvent } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import { H4 } from "@/components/ui/typography";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Delete,
  ChevronDown,
  Check,
  MoreVertical,
  MessageSquare,
  Save,
  Clipboard,
  CheckCircle,
  Loader2,
  User,
  Edit2,
} from "lucide-react";
import { WeightKeyboard, RepsKeyboard } from "@/components/WorkoutKeyboard";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { RestTimer } from "@/components/RestTimer";

import {
  initialiseExercises,
  workoutReducer,
  displayWeight,
  displayReps,
  getPreviousSetData,
  finalizeWorkout,
  type Workout,
  type WorkoutExercise,
  type WorkoutSet,
  type CompletedWorkout,
  type WeightModifier,
  type SetModifier,
} from "@/lib/workoutLogic";
import { api } from "@/trpc/react";
import { LOCAL_STORAGE_WORKOUT_KEY } from "@/lib/constants"; // Import the constant

// TODO: Replace with a more robust ID generation method if needed
const generateId = () => Math.random().toString(36).substring(2, 15);

// Type definition for data structure expected from previous workouts or templates
interface PreviousExerciseData {
  name: string;
  sets: Array<{
    weight: number | null;
    reps: number | null;
    isWarmup?: boolean; // Keep for potential backward compatibility if templates use it
    modifier?: SetModifier; // Explicitly use SetModifier type
    weightModifier?: WeightModifier | null; // Add weightModifier (allow null from DB)
  }>;
}

function safelyParseWorkoutState(jsonString: string | null): Workout | null {
  if (!jsonString) return null;
  try {
    // Parse as unknown first to avoid direct any assignment
    const parsed = JSON.parse(jsonString) as unknown;

    // Type guard function to validate if the parsed object is a Workout
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

    // Apply the type guard
    if (isWorkout(parsed)) {
      return parsed;
    }

    console.error("Parsed workout state is missing expected properties");
    return null;
  } catch (error) {
    console.error("Failed to parse workout state from localStorage:", error);
    return null;
  }
}

// Component props type
type WorkoutProps = {
  workoutName?: string;
  exercises?: PreviousExerciseData[];
  autoRestore?: boolean;
  onInitialSave?: () => void;
};

// Main Workout component
export default function WorkoutComponent({
  workoutName = "",
  exercises: initialExercises = [],
  autoRestore = false,
  onInitialSave,
}: WorkoutProps) {
  const router = useRouter();
  const { user, isLoaded: isUserLoaded } = useUser();

  // Initialize workout state with the reducer
  const initialState: Workout = {
    currentExerciseIndex: 0,
    exercises: initialiseExercises(
      (initialExercises ?? []).map((ex) => ({
        ...ex,
        sets: ex.sets.map((set) => ({
          ...set,
          // Handle potential null weightModifier from input
          weightModifier: set.weightModifier ?? undefined,
          id: generateId(),
        })),
      })),
    ),
    notes: [], // Initialize notes as an empty array
    startTime: Date.now(),
    name: workoutName || "Workout", // Fallback to "Workout" if no name provided
    isInProgress: true,
    // Add missing initial state fields
    activeField: { exerciseIndex: null, setIndex: null, field: null },
    inputValue: "",
    isFirstInteraction: false,
  };

  const [state, dispatch] = useReducer(workoutReducer, initialState);
  const [showRestore, setShowRestore] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editableName, setEditableName] = useState(state.name);
  const [editableDate, setEditableDate] = useState(() => {
    const now = new Date();
    return now.toISOString().split("T")[0]; // YYYY-MM-DD format
  });
  const [editableTime, setEditableTime] = useState(() => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  });
  const [editableDuration, setEditableDuration] = useState<string>("60");
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Update the useEffect that deals with workoutName prop changes
  useEffect(() => {
    // Directly use the workoutName without modification or prefix
    if (workoutName) {
      dispatch({ type: "UPDATE_WORKOUT_NAME", name: workoutName });
    }
  }, [workoutName]);

  // Update the handleWorkoutNameUpdate function to not add any prefixes
  const handleWorkoutNameUpdate = () => {
    if (editableName.trim()) {
      // Update state name with exactly what user entered without any prefix
      dispatch({ type: "UPDATE_WORKOUT_NAME", name: editableName.trim() });

      // Calculate and update start time based on duration
      if (editableDuration && editableDate && editableTime) {
        const durationMs = parseInt(editableDuration, 10) * 60 * 1000;
        const completionDate = getCompletionDate();

        // Set the start time to completion time minus duration
        const startTime = completionDate.getTime() - durationMs;

        // Update the current workout start time for duration calculations
        workoutStartTime.current = startTime;

        console.log(`[Workout] Updated workout timing:
          Completion Date: ${completionDate.toISOString()}
          Duration: ${editableDuration} minutes
          Calculated Start: ${new Date(startTime).toISOString()}`);
      }

      setIsEditingName(false);
    } else {
      setEditableName(state.name);
      setIsEditingName(false);
    }
  };

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [isEditingName]);

  // Update editable name when state name changes
  useEffect(() => {
    setEditableName(state.name);
  }, [state.name]);

  // Handle restoring workout from localStorage
  const handleRestore = () => {
    const stored = localStorage.getItem(LOCAL_STORAGE_WORKOUT_KEY);
    const parsedState = safelyParseWorkoutState(stored);
    if (parsedState) {
      dispatch({ type: "REPLACE_STATE", state: parsedState });
      setShowRestore(false);
    } else {
      // Handle case where parsing failed or storage was unexpectedly empty
      toast.error(
        "Failed to restore progress. Stored data might be corrupted.",
      );
      localStorage.removeItem(LOCAL_STORAGE_WORKOUT_KEY); // Clean up corrupted data
      setShowRestore(false);
    }
  };

  // Load saved workout from localStorage if available
  useEffect(() => {
    const savedWorkout = localStorage.getItem(LOCAL_STORAGE_WORKOUT_KEY);
    console.log(
      "[Workout] Initial localStorage check:",
      savedWorkout ? "Found workout data" : "No saved workout",
      { autoRestore },
    );

    if (savedWorkout) {
      if (autoRestore) {
        // Auto-restore the workout if specified
        console.log("[Workout] Auto-restoring workout from localStorage");
        handleRestore();
      } else {
        // Show restore prompt if not auto-restoring
        console.log("[Workout] Showing restore button");
        setShowRestore(true);
      }
    }
  }, [autoRestore]);

  // Save workout to localStorage whenever it changes
  useEffect(() => {
    // Only save if the workout is in progress (has exercises)
    if (state.exercises.length > 0) {
      console.log(
        "[Workout] Saving workout to localStorage",
        state.exercises.length,
        "exercises",
      );
      localStorage.setItem(LOCAL_STORAGE_WORKOUT_KEY, JSON.stringify(state));

      // Signal that we've saved initial state, if callback exists
      if (onInitialSave && initialExercises.length > 0) {
        console.log("[Workout] Calling onInitialSave callback");
        onInitialSave();
      }
    }
  }, [state, onInitialSave, initialExercises.length]);

  // State for delete confirmation dialog
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    setId: number | null;
    exerciseId: number | null;
    exerciseName: string;
    setNumber: number;
    isWarmup: boolean;
  }>({
    isOpen: false,
    setId: null,
    exerciseId: null,
    exerciseName: "",
    setNumber: 0,
    isWarmup: false,
  });

  // State for tracking swipe gestures
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  // Extract current state values for easier access
  const { exercises, activeField, inputValue } = state;

  // State for showing/hiding notes
  const [showNotes, setShowNotes] = useState<Record<number, boolean>>({});

  // State for finish workout dialog
  const [finishDialogOpen, setFinishDialogOpen] = useState(false);
  const [finishedWorkout, setFinishedWorkout] =
    useState<CompletedWorkout | null>(null);

  // For calculating workout duration
  const workoutStartTime = useRef(Date.now());

  // State for showing/hiding workout notes
  const [showWorkoutNotes, setShowWorkoutNotes] = useState(false);

  // State for showing debug data
  const [showDebugData, setShowDebugData] = useState(false);

  // tRPC Mutation for saving the workout
  const saveWorkoutMutation = api.workout.saveWorkout.useMutation({
    onSuccess: (_data) => {
      toast.success("Workout saved successfully!");
      localStorage.removeItem(LOCAL_STORAGE_WORKOUT_KEY);
    },
    onError: (error) => {
      console.error("Failed to save workout:", error);
      toast.error(`Error saving workout: ${error.message}`);
      setFinishedWorkout(null);
    },
  });

  // Function to update workout notes
  const updateWorkoutNote = (text: string) => {
    dispatch({ type: "ADD_WORKOUT_NOTE", text });
  };

  const getWorkoutNoteText = () => {
    return state.notes[0]?.text ?? "";
  };

  const toggleNoteVisibility = (exerciseId: number) => {
    setShowNotes((prev) => ({ ...prev, [exerciseId]: !prev[exerciseId] }));
  };

  const updateExerciseNote = (exerciseId: number, notes: string) => {
    dispatch({ type: "UPDATE_NOTES", exerciseId, notes });
  };

  const getExerciseNoteText = (exercise: WorkoutExercise) => {
    return exercise.notes[0]?.text ?? "";
  };

  const handleDeleteSet = (setId: number) => {
    if (deleteDialog.setId === null || deleteDialog.exerciseId === null) return;

    const exerciseIndex = exercises.findIndex(
      (ex) => ex.id === deleteDialog.exerciseId,
    );

    if (exerciseIndex !== -1) {
      const exercise = exercises[exerciseIndex];
      if (!exercise) return;

      const setIndex = exercise.sets.findIndex((s) => s.id === setId);

      if (setIndex !== -1) {
        dispatch({
          type: "DELETE_SET",
          exerciseIndex,
          setIndex,
        });
      }
    }

    setDeleteDialog({
      isOpen: false,
      setId: null,
      exerciseId: null,
      exerciseName: "",
      setNumber: 0,
      isWarmup: false,
    });
  };

  const openDeleteDialog = (exerciseId: number, setId: number) => {
    const exercise = exercises.find((ex) => ex.id === exerciseId);
    if (!exercise) return;

    const set = exercise.sets.find((s) => s.id === setId);
    if (!set) return;

    const workingSetNumber =
      exercise.sets
        .filter((s) => s.modifier !== "warmup")
        .findIndex((s) => s.id === setId) + 1;

    setDeleteDialog({
      isOpen: true,
      setId,
      exerciseId,
      exerciseName: exercise.name,
      setNumber: workingSetNumber,
      isWarmup: set.modifier === "warmup",
    });
  };

  // Helper to get the currently active set for passing to Keyboard
  const getActiveSet = React.useCallback((): WorkoutSet | null => {
    if (activeField.exerciseIndex === null || activeField.setIndex === null) {
      return null;
    }
    const exercise = exercises[activeField.exerciseIndex];
    return exercise?.sets[activeField.setIndex] ?? null;
  }, [activeField.exerciseIndex, activeField.setIndex, exercises]);

  const activeSet = getActiveSet();

  const handleKeyPress = (value: string) => {
    if (value === "backspace") {
      dispatch({ type: "BACKSPACE" });
    } else if (value === "next") {
      dispatch({ type: "NEXT" });
    } else if (value === "plus") {
      dispatch({ type: "PLUS_MINUS", sign: 1 });
    } else if (value === "minus") {
      dispatch({ type: "PLUS_MINUS", sign: -1 });
    } else if (value === "collapse") {
      dispatch({ type: "COLLAPSE_KEYBOARD" });
    } else if (value === "bw") {
      if (state.activeField.field === "weight") {
        dispatch({ type: "TOGGLE_BODYWEIGHT" });
      }
    } else if (value === "toggle-sign") {
      if (state.activeField.field === "weight") {
        dispatch({ type: "TOGGLE_SIGN" });
      }
    } else {
      dispatch({ type: "INPUT_DIGIT", value });
    }
  };

  const handleFocus = (
    exerciseId: number,
    setId: number,
    field: "weight" | "reps",
  ) => {
    const exerciseIndex = exercises.findIndex((ex) => ex.id === exerciseId);
    if (exerciseIndex === -1) return;

    const exercise = exercises[exerciseIndex];
    if (!exercise) return;

    const setIndex = exercise.sets.findIndex((set) => set.id === setId);
    if (setIndex === -1) return;

    dispatch({
      type: "FOCUS_FIELD",
      exerciseIndex,
      setIndex,
      field,
    });
  };

  // Swipe gesture handlers
  const handleTouchStart = (e: TouchEvent<HTMLTableRowElement>) => {
    if (!e.touches[0]) return;
    touchStartX.current = e.touches[0].clientX;
    e.stopPropagation();
  };

  const handleTouchMove = (e: TouchEvent<HTMLTableRowElement>) => {
    if (!touchStartX.current || !e.touches[0]) return;
    touchEndX.current = e.touches[0].clientX;
    e.stopPropagation();
  };

  const handleTouchEnd = (
    e: TouchEvent<HTMLTableRowElement>,
    exerciseId: number,
    setId: number,
  ) => {
    if (!touchStartX.current || !touchEndX.current) {
      touchStartX.current = null;
      touchEndX.current = null;
      return;
    }

    const swipeDistance = touchStartX.current - touchEndX.current;
    // If swipe left and distance is significant, open delete dialog
    if (swipeDistance > 50) {
      openDeleteDialog(exerciseId, setId);
    }

    touchStartX.current = null;
    touchEndX.current = null;
    e.stopPropagation();
  };

  // Updated function to handle workout completion and save data
  const handleFinishWorkout = () => {
    if (!user || !isUserLoaded) {
      toast.error("User not loaded. Cannot save workout.");
      return;
    }

    // Calculate duration from input or use elapsed time
    const durationInSeconds = editableDuration
      ? parseInt(editableDuration, 10) * 60
      : Math.floor((Date.now() - workoutStartTime.current) / 1000);

    const finalWorkoutData = finalizeWorkout(
      state,
      getWorkoutNoteText(),
      durationInSeconds,
    );

    setFinishedWorkout(finalWorkoutData);

    // Create completion date from date and time inputs
    const completionDate = getCompletionDate();

    // Calculate the proper start time by subtracting duration from completion time
    // This ensures the duration is correctly represented in the database
    const startTime = new Date(
      completionDate.getTime() - durationInSeconds * 1000,
    );

    // Prepare data for mutation, ensuring types match Zod schema
    const mutationInput = {
      userId: user.id,
      name: finalWorkoutData.name,
      completedAt: completionDate,
      startedAt: startTime, // Add startedAt to the mutation input
      notes:
        finalWorkoutData.notes.length > 0
          ? finalWorkoutData.notes[0]?.text
          : undefined,
      exercises: finalWorkoutData.exercises.map((ex, exIndex) => ({
        name: ex.name,
        order: exIndex,
        notes: ex.notes.length > 0 ? ex.notes[0]?.text : undefined,
        sets: ex.sets.map((set, setIndex) => ({
          order: setIndex,
          weight: set.weight,
          reps: set.reps,
          modifier: set.modifier ?? null,
          weightModifier: set.weightModifier ?? null,
          completed: set.completed,
        })),
      })),
    };

    // Call the tRPC mutation
    console.log(
      "[WorkoutComponent] Data sent to saveWorkout mutation:",
      JSON.stringify(mutationInput, null, 2),
    );
    saveWorkoutMutation.mutate(mutationInput);
  };

  // Function to copy workout data to clipboard
  const copyWorkoutToClipboard = () => {
    if (!finishedWorkout) return;

    navigator.clipboard
      .writeText(JSON.stringify(finishedWorkout, null, 2))
      .catch((err) => console.error("Failed to copy to clipboard:", err));
  };

  // Create completion date from date and time inputs
  const getCompletionDate = () => {
    let completionDate = new Date();
    if (editableDate) {
      // Parse date components with fallbacks
      const dateComponents = editableDate
        .split("-")
        .map((n) => parseInt(n, 10));
      const timeComponents = editableTime
        .split(":")
        .map((n) => parseInt(n, 10));

      const year = dateComponents[0] ?? completionDate.getFullYear();
      const month = dateComponents[1] ?? 1;
      const day = dateComponents[2] ?? 1;
      const hours = timeComponents[0] ?? 0;
      const minutes = timeComponents[1] ?? 0;

      completionDate = new Date(year, month - 1, day, hours, minutes);
    }
    return completionDate;
  };

  return (
    <div
      className="container mx-auto max-w-md p-2 pb-[200px]"
      style={{ touchAction: "pan-x pan-y" }}
    >
      {showRestore && !autoRestore && (
        <div className="mb-2">
          <Button size="sm" variant="outline" onClick={handleRestore}>
            Restore Progress
          </Button>
        </div>
      )}
      <div className="mb-2 flex items-center justify-between">
        <RestTimer />
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFinishDialogOpen(true)}
            className="flex items-center gap-1"
          >
            <Save className="h-4 w-4" />
            <span>Finish</span>
          </Button>
        </div>
      </div>
      <div className="flex flex-col">
        <div className="mb-2 flex items-center justify-between">
          {isEditingName ? (
            <div className="flex w-full flex-col gap-2">
              <div className="flex items-center justify-between">
                <Input
                  ref={nameInputRef}
                  value={editableName}
                  onChange={(e) => setEditableName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleWorkoutNameUpdate();
                    }
                  }}
                  className="h-9"
                  placeholder="Workout name"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-2"
                  onClick={() => setIsEditingName(false)}
                >
                  Cancel
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label htmlFor="date" className="text-xs font-medium">
                    Date
                  </label>
                  <Input
                    id="date"
                    type="date"
                    value={editableDate}
                    onChange={(e) => setEditableDate(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="time" className="text-xs font-medium">
                    Time
                  </label>
                  <Input
                    id="time"
                    type="time"
                    value={editableTime}
                    onChange={(e) => setEditableTime(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label htmlFor="duration" className="text-xs font-medium">
                  Duration (minutes)
                </label>
                <Input
                  id="duration"
                  type="number"
                  value={editableDuration}
                  onChange={(e) => setEditableDuration(e.target.value)}
                  className="h-9"
                  min="1"
                  step="1"
                />
              </div>
              <div className="flex justify-end">
                <Button size="sm" onClick={handleWorkoutNameUpdate}>
                  Save Details
                </Button>
              </div>
            </div>
          ) : (
            <div
              className="flex cursor-pointer items-center gap-1.5"
              onClick={() => setIsEditingName(true)}
            >
              <H4>{state.name}</H4>
              <Edit2 className="text-muted-foreground h-3.5 w-3.5" />
            </div>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setShowWorkoutNotes(!showWorkoutNotes)}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                {showWorkoutNotes ? "Hide note" : "Add a note"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Workout notes text area */}
        {showWorkoutNotes && (
          <div className="mb-4">
            <Textarea
              placeholder="Add a note about your workout..."
              className="min-h-[60px] text-sm"
              value={getWorkoutNoteText()}
              onChange={(e) => updateWorkoutNote(e.target.value)}
            />
          </div>
        )}
      </div>

      {exercises.map((exercise, exerciseIndex) => (
        <div key={exercise.id} className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-bold">{exercise.name}</h2>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => toggleNoteVisibility(exercise.id)}
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  {showNotes[exercise.id] ? "Hide note" : "Add a note"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Exercise note input */}
          {showNotes[exercise.id] && (
            <div className="mb-2">
              <Textarea
                placeholder="Add a note about this exercise..."
                className="min-h-[60px] text-sm"
                value={getExerciseNoteText(exercise)}
                onChange={(e) =>
                  updateExerciseNote(exercise.id, e.target.value)
                }
              />
            </div>
          )}

          <div className="overflow-hidden">
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[10%] px-1 py-1 text-xs">
                    Set
                  </TableHead>
                  <TableHead className="w-[25%] px-1 py-1 text-xs">
                    Previous
                  </TableHead>
                  <TableHead className="w-[20%] px-1 py-1 text-xs">
                    lbs
                  </TableHead>
                  <TableHead className="w-[15%] px-1 py-1 text-xs">
                    Reps
                  </TableHead>
                  <TableHead className="w-[10%] px-1 py-1 text-xs">✓</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exercise.sets.map((set, index) => {
                  const weightValue = displayWeight(
                    set,
                    exercise.sets,
                    index,
                    exercise,
                  );
                  const repsValue = displayReps(
                    set,
                    exercise.sets,
                    index,
                    exercise,
                  );

                  // Determine if values are estimated (not explicitly set and not completed)
                  const isRepsEstimated = !set.repsExplicit && !set.completed;

                  // Calculate working set number (count only non-warmup sets)
                  const workingSetNumber =
                    exercise.sets
                      .filter((s) => s.modifier !== "warmup")
                      .findIndex((s) => s.id === set.id) + 1;

                  return (
                    <TableRow
                      key={index}
                      className={cn(
                        "relative",
                        set.completed && "bg-success/5",
                        // Add distinct background for bodyweight sets
                        set.weightModifier === "bodyweight" &&
                          "bg-blue-100/30 dark:bg-blue-900/20",
                      )}
                      onTouchStart={(e) => handleTouchStart(e)}
                      onTouchMove={(e) => handleTouchMove(e)}
                      onTouchEnd={(e) => handleTouchEnd(e, exercise.id, set.id)}
                    >
                      <TableCell className="px-1 py-1 text-center">
                        <div
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-md text-sm",
                            set.modifier === "warmup"
                              ? "bg-orange-500 text-white"
                              : "bg-gray-100 text-gray-700",
                          )}
                          onClick={() => {
                            const setIndex = exercise.sets.findIndex(
                              (s) => s.id === set.id,
                            );
                            if (setIndex !== -1) {
                              dispatch({
                                type: "TOGGLE_WARMUP",
                                exerciseIndex,
                                setIndex,
                              });
                            }
                          }}
                        >
                          {set.modifier === "warmup" ? "W" : workingSetNumber}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground px-1 py-1 text-center text-xs">
                        {(() => {
                          const prevData = getPreviousSetData(
                            exercise,
                            set,
                            exercise.sets,
                          );

                          // Handle case where previous data doesn't exist
                          if (
                            prevData.weight === null ||
                            prevData.reps === null
                          ) {
                            return "-";
                          }

                          // Format based on weightModifier
                          let formattedWeight:
                            | React.ReactNode
                            | string
                            | number = "";
                          if (prevData.weightModifier === "bodyweight") {
                            formattedWeight = (
                              <span className="inline-flex items-center gap-0.5">
                                {" "}
                                {/* Inline flex for icon+sign+value */}
                                <User className="h-2.5 w-2.5 flex-shrink-0" />{" "}
                                {/* Slightly smaller icon */}
                                <span className="font-medium">
                                  {prevData.weight >= 0 ? "+" : "-"}
                                </span>
                                <span>{Math.abs(prevData.weight)}</span>
                              </span>
                            );
                          } else {
                            formattedWeight = `${prevData.weight}lb`;
                          }

                          // Combine weight, reps, and warmup indicator
                          return (
                            <>
                              {formattedWeight} × {prevData.reps}
                              {set.modifier === "warmup" ? " (W)" : ""}
                            </>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="px-1 py-1">
                        <div
                          className={cn(
                            "flex h-8 w-full items-center justify-center rounded-md bg-gray-100",
                            activeField.exerciseIndex === exerciseIndex &&
                              activeField.setIndex === index &&
                              activeField.field === "weight" &&
                              "bg-white ring-2 ring-blue-400",
                            set.weightModifier === "bodyweight" &&
                              "border-input border",
                          )}
                        >
                          <div
                            className="flex h-full w-full items-center justify-center gap-1 px-1"
                            onClick={() =>
                              handleFocus(exercise.id, set.id, "weight")
                            }
                          >
                            {/* 1. Icon (Conditional) */}
                            {set.weightModifier === "bodyweight" && (
                              <User className="text-muted-foreground h-3 w-3 flex-shrink-0" />
                            )}

                            {/* 2. Sign (Conditional) */}
                            {set.weightModifier === "bodyweight" && (
                              <span className="text-muted-foreground flex-shrink-0 text-sm font-medium">
                                {
                                  activeField.exerciseIndex === exerciseIndex &&
                                  activeField.setIndex === index &&
                                  activeField.field === "weight"
                                    ? (parseFloat(inputValue) || 0) >= 0
                                      ? "+"
                                      : "-" // Use inputValue if focused
                                    : (weightValue ?? 0) >= 0
                                      ? "+"
                                      : "-" // Use weightValue if not focused
                                }
                              </span>
                            )}

                            {/* 3. Value (Input OR Span) */}
                            {activeField.exerciseIndex === exerciseIndex &&
                            activeField.setIndex === index &&
                            activeField.field === "weight" ? (
                              // Focused: Render Input
                              <input
                                type="text"
                                value={
                                  set.weightModifier === "bodyweight"
                                    ? String(
                                        Math.abs(parseFloat(inputValue) || 0),
                                      )
                                    : inputValue
                                }
                                readOnly
                                autoFocus
                                // Explicitly set inline-block and auto width
                                className="inline-block h-full w-auto rounded bg-transparent text-center text-sm outline-none"
                                // Optional: Add a small size attribute for visual hint, though CSS controls actual width
                                size={inputValue.length + 1}
                              />
                            ) : (
                              // Not Focused: Render Span
                              <span
                                className={cn(
                                  "w-auto",
                                  // Apply dimming if not completed AND not explicit
                                  !set.completed &&
                                    !set.weightExplicit &&
                                    "text-muted-foreground",
                                )}
                              >
                                {set.weightModifier === "bodyweight"
                                  ? String(Math.abs(weightValue ?? 0))
                                  : (weightValue ?? "-")}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-1 py-1">
                        <div
                          className={cn(
                            "flex h-8 w-full items-center justify-center rounded-md bg-gray-100",
                            activeField.exerciseIndex === exerciseIndex &&
                              activeField.setIndex === index &&
                              activeField.field === "reps" &&
                              "bg-white ring-2 ring-blue-400",
                          )}
                        >
                          <div
                            className="h-full w-full"
                            onClick={() =>
                              handleFocus(exercise.id, set.id, "reps")
                            }
                          >
                            {activeField.exerciseIndex === exerciseIndex &&
                            activeField.setIndex === index &&
                            activeField.field === "reps" ? (
                              <input
                                type="text"
                                value={inputValue}
                                readOnly
                                autoFocus
                                className="h-full w-full rounded bg-transparent px-1 text-center text-sm outline-none"
                              />
                            ) : (
                              <div
                                className={cn(
                                  "flex h-full w-full items-center justify-center text-center text-sm",
                                  isRepsEstimated && "text-muted-foreground",
                                )}
                              >
                                {repsValue ?? "-"}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-1 py-1">
                        <Button
                          size="icon"
                          variant={set.completed ? "default" : "secondary"}
                          className={cn(
                            "h-8 w-8",
                            set.completed && "bg-success hover:bg-success/90",
                          )}
                          onClick={() => {
                            const setIndex = exercise.sets.findIndex(
                              (s) => s.id === set.id,
                            );
                            if (setIndex !== -1) {
                              dispatch({
                                type: "TOGGLE_COMPLETE",
                                exerciseIndex,
                                setIndex,
                              });
                            }
                          }}
                        >
                          <Check
                            className={cn(
                              "h-4 w-4",
                              set.completed
                                ? "text-success-foreground"
                                : "text-muted-foreground",
                            )}
                          />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="mt-2 space-y-2">
            <Button
              variant="secondary"
              size="xs"
              className="text-muted-foreground w-full"
              onClick={() => {
                dispatch({
                  type: "ADD_SET",
                  exerciseIndex,
                });
              }}
            >
              + Add Set
            </Button>
          </div>
        </div>
      ))}

      {activeField.exerciseIndex !== null &&
        activeField.field !== null &&
        (activeField.field === "weight" ? (
          <WeightKeyboard
            onKeyPress={handleKeyPress}
            activeSetWeightModifier={activeSet?.weightModifier}
          />
        ) : (
          <RepsKeyboard onKeyPress={handleKeyPress} />
        ))}

      {deleteDialog.isOpen && (
        <Dialog
          open={deleteDialog.isOpen}
          onOpenChange={(open) => {
            if (!open)
              setDeleteDialog({
                isOpen: false,
                setId: null,
                exerciseId: null,
                exerciseName: "",
                setNumber: 0,
                isWarmup: false,
              });
          }}
        >
          <DialogContent className="overflow-hidden p-0 sm:max-w-[425px]">
            <DialogHeader className="p-6 pb-2">
              <DialogTitle className="text-xl">Delete Set</DialogTitle>
              <DialogDescription className="mt-2 text-base">
                Are you sure you want to delete{" "}
                {deleteDialog.isWarmup
                  ? "warmup set"
                  : `set ${deleteDialog.setNumber}`}{" "}
                from{" "}
                <span className="font-medium">
                  &ldquo;{deleteDialog.exerciseName}&rdquo;
                </span>
                ?
              </DialogDescription>
              <p className="text-muted-foreground mt-2 text-sm">
                This action cannot be undone.
              </p>
            </DialogHeader>
            <DialogFooter className="bg-muted/20 flex flex-row justify-end gap-3 border-t p-4">
              <Button
                variant="outline"
                onClick={() =>
                  setDeleteDialog({
                    isOpen: false,
                    setId: null,
                    exerciseId: null,
                    exerciseName: "",
                    setNumber: 0,
                    isWarmup: false,
                  })
                }
                className="px-6"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (deleteDialog.setId !== null) {
                    handleDeleteSet(deleteDialog.setId);
                  }
                }}
                className="px-6"
                disabled={deleteDialog.setId === null}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Finish Workout Dialog */}
      <Dialog
        open={finishDialogOpen}
        onOpenChange={(open) => {
          if (!open && !saveWorkoutMutation.isPending) {
            setFinishDialogOpen(false);
            setFinishedWorkout(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Finish Workout</DialogTitle>
            <DialogDescription>
              {saveWorkoutMutation.isPending
                ? "Saving your workout..."
                : finishedWorkout
                  ? "Workout Saved!"
                  : "Review and save your completed workout."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {saveWorkoutMutation.isPending && (
              <div className="flex items-center justify-center space-x-2">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span>Saving...</span>
              </div>
            )}
            {!saveWorkoutMutation.isPending && finishedWorkout && (
              <div className="space-y-4">
                <div className="bg-muted rounded-md p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Workout Saved!</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={copyWorkoutToClipboard}
                      className="h-8 gap-1"
                    >
                      <Clipboard className="h-4 w-4" />
                      <span>Copy</span>
                    </Button>
                  </div>

                  <div className="mt-2 text-sm">
                    <p>
                      <span className="font-medium">Duration:</span>{" "}
                      {formatDuration(finishedWorkout.duration ?? 0)}
                    </p>
                    <p>
                      <span className="font-medium">Start:</span>{" "}
                      {(() => {
                        const completionDate = new Date(finishedWorkout.date);
                        const durationMs =
                          (finishedWorkout.duration ?? 0) * 1000;
                        const startTime = new Date(
                          completionDate.getTime() - durationMs,
                        );
                        return `${startTime.toLocaleDateString()} ${startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
                      })()}
                    </p>
                    <p>
                      <span className="font-medium">Finish:</span>{" "}
                      {`${new Date(finishedWorkout.date).toLocaleDateString()} ${new Date(finishedWorkout.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                    </p>
                    <p>
                      <span className="font-medium">Exercises:</span>{" "}
                      {finishedWorkout.exercises.length}
                    </p>
                    <p>
                      <span className="font-medium">Total Sets:</span>{" "}
                      {finishedWorkout.exercises.reduce(
                        (acc, ex) => acc + ex.sets.length,
                        0,
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex justify-center">
                  <CheckCircle className="text-success h-12 w-12" />
                </div>
              </div>
            )}
            {!saveWorkoutMutation.isPending && !finishedWorkout && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium">Workout Summary</h3>
                  <div className="bg-muted mt-2 space-y-2 rounded-md p-3 text-sm">
                    <p>
                      <span className="font-medium">Exercises:</span>{" "}
                      {
                        exercises.filter((ex) =>
                          ex.sets.some((set) => set.completed),
                        ).length
                      }
                    </p>
                    <p>
                      <span className="font-medium">Completed Sets:</span>{" "}
                      {exercises.reduce(
                        (acc, ex) =>
                          acc + ex.sets.filter((set) => set.completed).length,
                        0,
                      )}
                    </p>
                    <p>
                      <span className="font-medium">Duration:</span>{" "}
                      {formatDuration(
                        editableDuration
                          ? parseInt(editableDuration, 10) * 60
                          : Math.floor(
                              (Date.now() - workoutStartTime.current) / 1000,
                            ),
                      )}
                    </p>
                    {editableDate && (
                      <>
                        <p>
                          <span className="font-medium">Start:</span>{" "}
                          {(() => {
                            const completionDate = getCompletionDate();
                            const durationMs =
                              parseInt(editableDuration || "0", 10) * 60 * 1000;
                            const startTime = new Date(
                              completionDate.getTime() - durationMs,
                            );
                            return `${startTime.toLocaleDateString()} ${startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
                          })()}
                        </p>
                        <p>
                          <span className="font-medium">Finish:</span>{" "}
                          {`${getCompletionDate().toLocaleDateString()} ${getCompletionDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            {saveWorkoutMutation.isPending ? (
              // Saving State
              <Button disabled className="w-full">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </Button>
            ) : finishedWorkout ? (
              // Success State
              <Button
                onClick={() => {
                  setFinishDialogOpen(false);
                  setFinishedWorkout(null); // Reset summary state
                  router.push("/"); // <-- Navigate to home page
                }}
                className="w-full"
              >
                Done
              </Button>
            ) : (
              // Initial/Error State
              <>
                <Button
                  variant="outline"
                  onClick={() => setFinishDialogOpen(false)}
                  disabled={saveWorkoutMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleFinishWorkout}
                  disabled={saveWorkoutMutation.isPending}
                >
                  Save Workout
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Debug Panel - For development purposes */}
      <div className="mt-8 rounded-md border border-gray-300 p-2">
        <div
          className="flex cursor-pointer items-center justify-between p-2"
          onClick={() => setShowDebugData(!showDebugData)}
        >
          <h3 className="text-sm font-semibold">Debug Data</h3>
          <ChevronDown
            className={`h-4 w-4 transform transition-transform ${showDebugData ? "rotate-180" : ""}`}
          />
        </div>

        {showDebugData && (
          <div className="mt-2 max-h-[500px] overflow-auto">
            <pre className="text-xs break-words whitespace-pre-wrap">
              {JSON.stringify(
                {
                  state,
                  finishedWorkout,
                  initialExercises: initialExercises,
                },
                null,
                2,
              )}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// Format seconds to MM:SS format (simple version)
function formatDuration(sec: number): string {
  if (isNaN(sec) || sec < 0) {
    return "0:00";
  }

  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
