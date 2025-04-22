"use client";
import React, { useReducer, useState, useRef, useEffect } from "react";
import type { TouchEvent } from "react";
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
import { cn } from "@/lib/utils";
import {
  Keyboard as KeyboardIcon,
  ChevronLeft,
  Plus,
  Minus,
  Delete,
  ChevronDown,
  Check,
  ChevronRight,
  Trash2,
  MoreVertical,
  MessageSquare,
  Save,
  Clipboard,
  CheckCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
  type ActiveField,
  type CompletedWorkout,
  type Note,
} from "@/lib/workoutLogic";

// Keyboard Container Component
interface KeyboardContainerProps {
  children: React.ReactNode;
  className?: string;
}

const KeyboardContainer = ({ children, className }: KeyboardContainerProps) => {
  return (
    <div
      className={cn(
        "bg-background border-border fixed right-0 bottom-0 left-0 border-t p-4",
        className,
      )}
    >
      {children}
    </div>
  );
};

// KeyboardButton component for all buttons
interface KeyboardButtonProps {
  onKeyPress: (value: string) => void;
  value: string;
  children: React.ReactNode;
  className?: string;
  gridArea: string;
  variant?: "default" | "outline" | "primary";
}

const KeyboardButton = ({
  onKeyPress,
  value,
  children,
  className,
  gridArea,
  variant = "outline",
}: KeyboardButtonProps) => {
  return (
    <div className="h-full w-full" style={{ gridArea }}>
      <Button
        variant={variant === "primary" ? "default" : "outline"}
        className={cn(
          "h-full w-full",
          variant === "primary" && "bg-primary hover:bg-primary/90",
          className,
        )}
        onClick={() => onKeyPress(value)}
      >
        {children}
      </Button>
    </div>
  );
};

// Main Keyboard Grid Component
const Keyboard = ({
  onKeyPress,
  inputType,
}: {
  onKeyPress: (value: string) => void;
  inputType: "weight" | "reps";
}) => {
  return (
    <KeyboardContainer>
      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: "repeat(4, 1fr)",
          gridTemplateRows: "repeat(4, 1fr)",
          gridTemplateAreas: `
            "btn1  btn2  btn3  collapse"
            "btn4  btn5  btn6  minus-plus"
            "btn7  btn8  btn9  empty"
            "decimal btn0 backspace next"
          `,
          height: "300px",
        }}
      >
        {/* Number buttons */}
        <KeyboardButton onKeyPress={onKeyPress} value="1" gridArea="btn1">
          1
        </KeyboardButton>
        <KeyboardButton onKeyPress={onKeyPress} value="2" gridArea="btn2">
          2
        </KeyboardButton>
        <KeyboardButton onKeyPress={onKeyPress} value="3" gridArea="btn3">
          3
        </KeyboardButton>
        <KeyboardButton onKeyPress={onKeyPress} value="4" gridArea="btn4">
          4
        </KeyboardButton>
        <KeyboardButton onKeyPress={onKeyPress} value="5" gridArea="btn5">
          5
        </KeyboardButton>
        <KeyboardButton onKeyPress={onKeyPress} value="6" gridArea="btn6">
          6
        </KeyboardButton>
        <KeyboardButton onKeyPress={onKeyPress} value="7" gridArea="btn7">
          7
        </KeyboardButton>
        <KeyboardButton onKeyPress={onKeyPress} value="8" gridArea="btn8">
          8
        </KeyboardButton>
        <KeyboardButton onKeyPress={onKeyPress} value="9" gridArea="btn9">
          9
        </KeyboardButton>
        <KeyboardButton onKeyPress={onKeyPress} value="0" gridArea="btn0">
          0
        </KeyboardButton>

        {/* Decimal button (conditional) */}
        {inputType === "weight" ? (
          <KeyboardButton onKeyPress={onKeyPress} value="." gridArea="decimal">
            .
          </KeyboardButton>
        ) : (
          <div style={{ gridArea: "decimal" }}></div>
        )}

        {/* Backspace button */}
        <KeyboardButton
          onKeyPress={onKeyPress}
          value="backspace"
          gridArea="backspace"
        >
          <Delete size={24} />
        </KeyboardButton>

        {/* Collapse button */}
        <KeyboardButton
          onKeyPress={onKeyPress}
          value="collapse"
          gridArea="collapse"
        >
          <div className="flex flex-col items-center">
            <KeyboardIcon size={24} />
            <ChevronDown size={16} />
          </div>
        </KeyboardButton>

        {/* Plus/Minus buttons in one grid area */}
        <div
          className="grid grid-cols-2 gap-2"
          style={{ gridArea: "minus-plus" }}
        >
          <KeyboardButton onKeyPress={onKeyPress} value="minus" gridArea="">
            <Minus size={24} />
          </KeyboardButton>
          <KeyboardButton onKeyPress={onKeyPress} value="plus" gridArea="">
            <Plus size={24} />
          </KeyboardButton>
        </div>

        {/* Empty slot */}
        <div style={{ gridArea: "empty" }}></div>

        {/* Next button */}
        <KeyboardButton
          onKeyPress={onKeyPress}
          value="next"
          gridArea="next"
          variant="primary"
          className="text-2xl"
        >
          Next
        </KeyboardButton>
      </div>
    </KeyboardContainer>
  );
};

// Add success class variants for Tailwind
const successVariants = {
  outline:
    "border-success/20 text-success hover:bg-success/10 hover:text-success",
  success: "bg-success text-success-foreground hover:bg-success/90",
  successLight: "bg-success/10 text-success hover:bg-success/20",
};

interface PreviousExerciseData {
  name: string;
  sets: Array<{
    weight: number | null;
    reps: number | null;
    isWarmup?: boolean;
  }>;
}

export default function Workout({
  workoutName = "Today's Workout",
  exercises: previousExercises = [
    {
      name: "Squat (Barbell)",
      sets: [
        { weight: 45, reps: 20, isWarmup: true },
        { weight: 135, reps: 8, isWarmup: false },
        { weight: 135, reps: 8, isWarmup: false },
      ],
    },
    {
      name: "Bench Press",
      sets: [
        { weight: 45, reps: 15, isWarmup: true },
        { weight: 135, reps: 12, isWarmup: false },
        { weight: 145, reps: 8, isWarmup: false },
        { weight: 155, reps: 6, isWarmup: false },
      ],
    },
    {
      name: "Incline Press",
      sets: [
        { weight: 45, reps: 15, isWarmup: true },
        { weight: 115, reps: 10, isWarmup: false },
        { weight: 115, reps: 9, isWarmup: false },
      ],
    },
  ],
  minReps = 8,
  maxReps = 12,
  onWorkoutComplete,
}: {
  workoutName?: string;
  exercises?: PreviousExerciseData[];
  minReps?: number;
  maxReps?: number;
  onWorkoutComplete?: (workout: CompletedWorkout) => void;
}) {
  // Initialize workout state with the reducer
  const initialState: Workout = {
    currentExerciseIndex: 0,
    exercises: initialiseExercises(previousExercises),
    activeField: { exerciseIndex: null, setIndex: null, field: null },
    inputValue: "",
    isFirstInteraction: false,
    notes: [],
  };

  const [state, dispatch] = useReducer(workoutReducer, initialState);

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
  const { exercises, currentExerciseIndex, activeField, inputValue } = state;

  // Current exercise being displayed
  const currentExercise = exercises[currentExerciseIndex] ?? null;

  // State for showing/hiding notes
  const [showNotes, setShowNotes] = useState<Record<number, boolean>>({});

  // State for finish workout dialog
  const [finishDialogOpen, setFinishDialogOpen] = useState(false);
  const [workoutNotes, setWorkoutNotes] = useState("");
  const [workoutDuration, setWorkoutDuration] = useState<number | undefined>(
    undefined,
  );
  const [finishedWorkout, setFinishedWorkout] =
    useState<CompletedWorkout | null>(null);

  // For calculating workout duration
  const workoutStartTime = useRef(Date.now());

  // State for showing/hiding workout notes
  const [showWorkoutNotes, setShowWorkoutNotes] = useState(false);

  // Function to update workout notes
  const updateWorkoutNote = (text: string) => {
    // For simplicity, we'll just update the first note or create one if it doesn't exist
    dispatch({
      type: "ADD_WORKOUT_NOTE",
      text,
    });
  };

  // Get the current workout note text
  const getWorkoutNoteText = () => {
    if (!state.notes || state.notes.length === 0) {
      return "";
    }
    const note = state.notes[0];
    return note?.text ?? "";
  };

  // Function to toggle note visibility for a specific exercise
  const toggleNoteVisibility = (exerciseId: number) => {
    setShowNotes((prev) => ({
      ...prev,
      [exerciseId]: !prev[exerciseId],
    }));
  };

  // Function to update notes for an exercise
  const updateExerciseNote = (exerciseId: number, notes: string) => {
    dispatch({
      type: "UPDATE_NOTES",
      exerciseId,
      notes,
    });
  };

  // Display notes for an exercise
  const getExerciseNoteText = (exercise: WorkoutExercise) => {
    if (!exercise?.notes || exercise.notes.length === 0) {
      return "";
    }
    const note = exercise.notes[0];
    return note?.text ?? "";
  };

  // Delete a set
  const handleDeleteSet = (setId: number) => {
    if (!deleteDialog.setId || !deleteDialog.exerciseId) return;

    // Find which exercise contains this set
    const exerciseIndex = exercises.findIndex(
      (ex) => ex.id === deleteDialog.exerciseId,
    );

    if (exerciseIndex !== -1) {
      const exercise = exercises[exerciseIndex];
      if (!exercise) return;

      const setIndex = exercise.sets.findIndex(
        (s) => s.id === deleteDialog.setId,
      );

      if (setIndex !== -1) {
        dispatch({
          type: "DELETE_SET",
          exerciseIndex,
          setIndex,
        });
      }
    }

    // Close the dialog
    setDeleteDialog({
      isOpen: false,
      setId: null,
      exerciseId: null,
      exerciseName: "",
      setNumber: 0,
      isWarmup: false,
    });
  };

  // Open delete confirmation dialog
  const openDeleteDialog = (exerciseId: number, setId: number) => {
    const exercise = exercises.find((ex) => ex.id === exerciseId);
    if (!exercise) return;

    const set = exercise.sets.find((s) => s.id === setId);
    if (!set) return;

    // Calculate working set number (count only non-warmup sets)
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

  // Keyboard interaction handler
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
    } else {
      // For digits and decimal point
      dispatch({ type: "INPUT_DIGIT", value });
    }
  };

  // UI interaction handlers
  const handleFocus = (
    exerciseId: number,
    setId: number,
    field: "weight" | "reps",
  ) => {
    // Find indexes from IDs
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

  // Function to toggle set completion for the current exercise
  const toggleCompleted = (setId: number) => {
    if (!currentExercise) return;

    const setIndex = currentExercise.sets.findIndex((s) => s.id === setId);
    if (setIndex === -1) return;

    dispatch({
      type: "TOGGLE_COMPLETE",
      exerciseIndex: currentExerciseIndex,
      setIndex,
    });
  };

  // Function to add a set to the current exercise
  const addSet = () => {
    if (!currentExercise) return;

    dispatch({
      type: "ADD_SET",
      exerciseIndex: currentExerciseIndex,
    });
  };

  // Navigation between exercises
  const goToNextExercise = () => {
    dispatch({ type: "NAV_EXERCISE", direction: 1 });
  };

  const goToPreviousExercise = () => {
    dispatch({ type: "NAV_EXERCISE", direction: -1 });
  };

  // Swipe gesture handlers
  const handleTouchStart = (
    e: TouchEvent<HTMLTableRowElement>,
    exerciseId: number,
    setId: number,
  ) => {
    if (!e.touches[0]) return;
    touchStartX.current = e.touches[0].clientX;
    e.stopPropagation();
  };

  const handleTouchMove = (
    e: TouchEvent<HTMLTableRowElement>,
    exerciseId: number,
    setId: number,
  ) => {
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

  // Function to handle workout completion
  const handleFinishWorkout = () => {
    // Calculate duration in seconds
    const duration = Math.floor((Date.now() - workoutStartTime.current) / 1000);

    // Create the finalized workout object - pass undefined for notes since we're using state.notes
    const completedWorkout = finalizeWorkout(
      state,
      workoutName,
      undefined, // Don't add additional notes from the dialog
      duration,
    );

    setFinishedWorkout(completedWorkout);

    // Call the callback if provided
    if (onWorkoutComplete) {
      onWorkoutComplete(completedWorkout);
    }

    // Close the dialog
    setFinishDialogOpen(false);
  };

  // Function to copy workout data to clipboard
  const copyWorkoutToClipboard = () => {
    if (!finishedWorkout) return;

    navigator.clipboard
      .writeText(JSON.stringify(finishedWorkout, null, 2))
      .catch((err) => console.error("Failed to copy to clipboard:", err));
  };

  return (
    <div className="container mx-auto max-w-md p-2 pb-[340px]">
      <div className="mb-2 flex items-center justify-between">
        <RestTimer />
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
      <div className="flex flex-col">
        <div className="mb-2 flex items-center justify-between">
          <H4>{workoutName}</H4>
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
                  const isWeightEstimated =
                    !set.weightExplicit && !set.completed;
                  const isRepsEstimated = !set.repsExplicit && !set.completed;

                  // Calculate working set number (count only non-warmup sets)
                  const workingSetNumber =
                    exercise.sets
                      .filter((s) => s.modifier !== "warmup")
                      .findIndex((s) => s.id === set.id) + 1;

                  return (
                    <TableRow
                      key={set.id}
                      className={cn(
                        "relative",
                        set.completed && "bg-success/5",
                      )}
                      onTouchStart={(e) =>
                        handleTouchStart(e, exercise.id, set.id)
                      }
                      onTouchMove={(e) =>
                        handleTouchMove(e, exercise.id, set.id)
                      }
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
                          return prevData.weight && prevData.reps
                            ? `${prevData.weight}lb × ${prevData.reps}${prevData.weight && set.modifier === "warmup" ? " (W)" : ""}`
                            : "-";
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
                          )}
                        >
                          <div
                            className="h-full w-full"
                            onClick={() =>
                              handleFocus(exercise.id, set.id, "weight")
                            }
                          >
                            {activeField.exerciseIndex === exerciseIndex &&
                            activeField.setIndex === index &&
                            activeField.field === "weight" ? (
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
                                  isWeightEstimated && "text-muted-foreground",
                                )}
                              >
                                {weightValue ?? "-"}
                              </div>
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

      {activeField.exerciseIndex !== null && activeField.field !== null && (
        <Keyboard onKeyPress={handleKeyPress} inputType={activeField.field} />
      )}

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
                onClick={() =>
                  deleteDialog.setId && handleDeleteSet(deleteDialog.setId)
                }
                className="px-6"
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Finish Workout Dialog */}
      <Dialog open={finishDialogOpen} onOpenChange={setFinishDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Finish Workout</DialogTitle>
            <DialogDescription>
              Review and save your completed workout.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {finishedWorkout ? (
              // Show workout summary if already finished
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
            ) : (
              // Show finish form if not yet finished
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
                        Math.floor(
                          (Date.now() - workoutStartTime.current) / 1000,
                        ),
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            {!finishedWorkout ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setFinishDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleFinishWorkout}>Save Workout</Button>
              </>
            ) : (
              <Button onClick={() => setFinishDialogOpen(false)}>Close</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Format seconds to HH:MM:SS or MM:SS format
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
  } else {
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  }
}
