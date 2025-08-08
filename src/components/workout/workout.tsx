"use client";
import React, { useEffect, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MessageSquare, MoreVertical, Save } from "lucide-react";
import { RestTimer } from "@/components/RestTimer";
import { PlateCalculator } from "@/components/plate-calculator";
import { WeightKeyboard, RepsKeyboard } from "@/components/WorkoutKeyboard";
import { api } from "@/trpc/react";
import { LOCAL_STORAGE_WORKOUT_KEY } from "@/lib/constants";
import { formatDuration } from "@/lib/utils";
import {
  initialiseExercises,
  workoutReducer,
  finalizeWorkout,
  type Workout,
  type WorkoutSet,
  type WeightModifier,
  type SetModifier,
} from "@/lib/workoutLogic";
import { TitleEditor } from "./title_editor";
import { WorkoutNotes } from "./workout_notes";
import { ExerciseSection } from "./exercise_section";
import { DeleteSetDialog } from "./delete_set_dialog";
import { FinishDialog } from "./finish_dialog";
import { DebugPanel } from "./debug_panel";
import type { CompletedWorkout } from "@/lib/schemas/workout-schema";

interface PreviousExerciseData {
  name: string;
  sets: Array<{
    weight: number | null;
    reps: number | null;
    isWarmup?: boolean;
    modifier?: SetModifier;
    weightModifier?: WeightModifier | null;
  }>;
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

type WorkoutProps = {
  workoutName?: string;
  exercises?: PreviousExerciseData[];
  autoRestore?: boolean;
  onInitialSave?: () => void;
};

export function WorkoutComponent({
  workoutName = "",
  exercises: initialExercises = [],
  autoRestore = false,
  onInitialSave,
}: WorkoutProps) {
  const router = useRouter();
  const { user, isLoaded: isUserLoaded } = useUser();

  const initialState: Workout = {
    currentExerciseIndex: 0,
    exercises: initialiseExercises(
      (initialExercises ?? []).map((ex) => ({
        ...ex,
        sets: ex.sets.map((set) => ({
          ...set,
          weightModifier: set.weightModifier ?? undefined,
        })),
      })),
    ),
    notes: [],
    startTime: Date.now(),
    name: workoutName || "Workout",
    isInProgress: true,
    activeField: { exerciseIndex: null, setIndex: null, field: null },
    inputValue: "",
    isFirstInteraction: false,
  };

  const [state, dispatch] = useReducer(workoutReducer, initialState);
  const [showRestore, setShowRestore] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editableName, setEditableName] = useState(state.name);

  useEffect(() => {
    if (workoutName)
      dispatch({ type: "UPDATE_WORKOUT_NAME", name: workoutName });
  }, [workoutName]);

  const handleWorkoutNameUpdate = () => {
    if (editableName.trim()) {
      dispatch({ type: "UPDATE_WORKOUT_NAME", name: editableName.trim() });
      setIsEditingName(false);
    } else {
      setEditableName(state.name);
      setIsEditingName(false);
    }
  };

  useEffect(() => {
    setEditableName(state.name);
  }, [state.name]);

  const handleRestore = () => {
    const stored =
      typeof window !== "undefined"
        ? localStorage.getItem(LOCAL_STORAGE_WORKOUT_KEY)
        : null;
    const parsedState = safelyParseWorkoutState(stored);
    if (parsedState) {
      dispatch({ type: "REPLACE_STATE", state: parsedState });
      setShowRestore(false);
    } else {
      toast.error(
        "Failed to restore progress. Stored data might be corrupted.",
      );
      if (typeof window !== "undefined")
        localStorage.removeItem(LOCAL_STORAGE_WORKOUT_KEY);
      setShowRestore(false);
    }
  };

  useEffect(() => {
    const savedWorkout =
      typeof window !== "undefined"
        ? localStorage.getItem(LOCAL_STORAGE_WORKOUT_KEY)
        : null;
    if (savedWorkout) {
      if (autoRestore) handleRestore();
      else setShowRestore(true);
    }
  }, [autoRestore]);

  useEffect(() => {
    if (state.exercises.length > 0 && typeof window !== "undefined") {
      localStorage.setItem(LOCAL_STORAGE_WORKOUT_KEY, JSON.stringify(state));
      if (onInitialSave && initialExercises.length > 0) onInitialSave();
    }
  }, [state, onInitialSave, initialExercises.length]);

  const [showWorkoutNotes, setShowWorkoutNotes] = useState(false);
  const [finishDialogOpen, setFinishDialogOpen] = useState(false);
  const [finishedWorkout, setFinishedWorkout] =
    useState<CompletedWorkout | null>(null);
  const [finishDialogDate, setFinishDialogDate] = useState<string>("");
  const [finishDialogStartTime, setFinishDialogStartTime] =
    useState<string>("");
  const [finishDialogEndTime, setFinishDialogEndTime] = useState<string>("");
  const [finishDialogDuration, setFinishDialogDuration] = useState<string>("");

  const initializeFinishDialogValues = () => {
    const now = new Date();
    const workoutStart = new Date(state.startTime);
    setFinishDialogDate(now.toISOString().split("T")[0]!);
    const endHours = String(now.getHours()).padStart(2, "0");
    const endMinutes = String(now.getMinutes()).padStart(2, "0");
    setFinishDialogEndTime(`${endHours}:${endMinutes}`);
    const startHours = String(workoutStart.getHours()).padStart(2, "0");
    const startMinutes = String(workoutStart.getMinutes()).padStart(2, "0");
    setFinishDialogStartTime(`${startHours}:${startMinutes}`);
    const durationInSeconds = Math.floor((Date.now() - state.startTime) / 1000);
    const durationInMinutes = Math.max(1, Math.round(durationInSeconds / 60));
    setFinishDialogDuration(durationInMinutes.toString());
  };

  const calculateDurationFromTimes = (startTime: string, endTime: string) => {
    if (!startTime || !endTime) return;
    const [startHours = 0, startMinutes = 0] = startTime.split(":").map(Number);
    const [endHours = 0, endMinutes = 0] = endTime.split(":").map(Number);
    const startTotalMinutes = startHours * 60 + startMinutes;
    const endTotalMinutes = endHours * 60 + endMinutes;
    let durationMinutes = endTotalMinutes - startTotalMinutes;
    if (durationMinutes < 0) durationMinutes += 24 * 60;
    setFinishDialogDuration(Math.max(1, durationMinutes).toString());
  };

  const calculateStartFromDuration = (durationStr: string) => {
    if (!durationStr || !finishDialogEndTime) return;
    const durationMinutes = parseInt(durationStr, 10);
    if (isNaN(durationMinutes) || durationMinutes < 1) return;
    const [endHours = 0, endMinutes = 0] = finishDialogEndTime
      .split(":")
      .map(Number);
    const endTotalMinutes = endHours * 60 + endMinutes;
    let startTotalMinutes = endTotalMinutes - durationMinutes;
    if (startTotalMinutes < 0) startTotalMinutes += 24 * 60;
    const startHours = Math.floor(startTotalMinutes / 60) % 24;
    const startMinutes = startTotalMinutes % 60;
    const formattedStartTime = `${String(startHours).padStart(2, "0")}:${String(startMinutes).padStart(2, "0")}`;
    setFinishDialogStartTime(formattedStartTime);
  };

  const setEndTimeToNow = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const nowTime = `${hours}:${minutes}`;
    setFinishDialogEndTime(nowTime);
    calculateDurationFromTimes(finishDialogStartTime, nowTime);
  };

  const getCompletionDate = () => {
    let completionDate = new Date();
    if (finishDialogDate) {
      const dateComponents = finishDialogDate
        .split("-")
        .map((n: string) => parseInt(n, 10));
      const timeComponents = finishDialogEndTime
        .split(":")
        .map((n: string) => parseInt(n, 10));
      const year = dateComponents[0] ?? completionDate.getFullYear();
      const month = dateComponents[1] ?? 1;
      const day = dateComponents[2] ?? 1;
      const hours = timeComponents[0] ?? 0;
      const minutes = timeComponents[1] ?? 0;
      completionDate = new Date(year, month - 1, day, hours, minutes);
    }
    return completionDate;
  };

  const saveWorkoutMutation = api.workout.saveWorkout.useMutation({
    onSuccess: (_data, variables) => {
      toast.success("Workout saved successfully!");
      if (typeof window !== "undefined")
        localStorage.removeItem(LOCAL_STORAGE_WORKOUT_KEY);
      setFinishedWorkout(variables);
    },
    onError: (error) => {
      toast.error(`Error saving workout: ${error.message}`);
      setFinishedWorkout(null);
    },
  });

  const getWorkoutNoteText = () => state.notes[0]?.text ?? "";

  const openDeleteDialogRef = useRef<{
    isOpen: boolean;
    setIndex: number | null;
    exerciseIndex: number | null;
    exerciseName: string;
    setNumber: number;
    isWarmup: boolean;
  }>({
    isOpen: false,
    setIndex: null,
    exerciseIndex: null,
    exerciseName: "",
    setNumber: 0,
    isWarmup: false,
  });
  const [deleteDialog, setDeleteDialog] = useState(openDeleteDialogRef.current);

  const handleDeleteSet = (exerciseIndex: number, setIndex: number) => {
    dispatch({ type: "DELETE_SET", exerciseIndex, setIndex });
    setDeleteDialog({
      isOpen: false,
      setIndex: null,
      exerciseIndex: null,
      exerciseName: "",
      setNumber: 0,
      isWarmup: false,
    });
  };

  // reserved for future swipe-to-delete integration per set

  const getActiveSet = React.useCallback((): WorkoutSet | null => {
    if (
      state.activeField.exerciseIndex === null ||
      state.activeField.setIndex === null
    )
      return null;
    const exercise = state.exercises[state.activeField.exerciseIndex];
    return exercise?.sets[state.activeField.setIndex] ?? null;
  }, [
    state.activeField.exerciseIndex,
    state.activeField.setIndex,
    state.exercises,
  ]);
  const activeSet = getActiveSet();

  const handleKeyPress = (value: string) => {
    if (value === "backspace") dispatch({ type: "BACKSPACE" });
    else if (value === "next") dispatch({ type: "NEXT" });
    else if (value === "plus") dispatch({ type: "PLUS_MINUS", sign: 1 });
    else if (value === "minus") dispatch({ type: "PLUS_MINUS", sign: -1 });
    else if (value === "collapse") dispatch({ type: "COLLAPSE_KEYBOARD" });
    else if (value === "bw") {
      if (state.activeField.field === "weight")
        dispatch({ type: "TOGGLE_BODYWEIGHT" });
    } else if (value === "toggle-sign") {
      if (state.activeField.field === "weight")
        dispatch({ type: "TOGGLE_SIGN" });
    } else dispatch({ type: "INPUT_DIGIT", value });
  };

  const handleFocus = (
    exerciseIndex: number,
    setIndex: number,
    field: "weight" | "reps",
  ) => {
    dispatch({ type: "FOCUS_FIELD", exerciseIndex, setIndex, field });
  };

  const handleFinishWorkout = () => {
    if (!user || !isUserLoaded) {
      toast.error("User not loaded. Cannot save workout.");
      return;
    }
    const durationInSeconds = finishDialogDuration
      ? parseInt(finishDialogDuration, 10) * 60
      : Math.floor((Date.now() - state.startTime) / 1000);
    const completionDate = getCompletionDate();
    const startedAt = new Date(
      completionDate.getTime() - durationInSeconds * 1000,
    );
    const base = finalizeWorkout(state, getWorkoutNoteText());
    const payload: CompletedWorkout = {
      ...base,
      startedAt,
      completedAt: completionDate,
    };
    saveWorkoutMutation.mutate(payload);
  };

  const copyWorkoutToClipboard = (): Promise<void> => {
    if (!finishedWorkout) return Promise.resolve();
    const workoutSummary =
      `\nWorkout: ${finishedWorkout.name}\nDate: ${finishedWorkout.completedAt.toLocaleDateString()}\nDuration: ${formatDuration((finishedWorkout.completedAt.getTime() - finishedWorkout.startedAt.getTime()) / 1000)}\n\nExercises:\n${finishedWorkout.exercises
        .map(
          (ex) =>
            `  - ${ex.name}:\n${ex.sets.map((s) => `    - ${s.weight ?? "-"} lbs x ${s.reps ?? "-"} reps ${s.modifier ? `(${s.modifier})` : ""}`).join("\n")}`,
        )
        .join("\n\n")}`.trim();
    return navigator.clipboard
      .writeText(workoutSummary)
      .then(() => {
        toast.success("Workout summary copied to clipboard!");
      })
      .catch(() => {
        // swallow to satisfy Promise<void>
      });
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
        <div className="flex items-center gap-2">
          <RestTimer />
          <PlateCalculator />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              initializeFinishDialogValues();
              setFinishDialogOpen(true);
            }}
            className="flex items-center gap-1"
          >
            <Save className="h-4 w-4" />
            <span>Finish</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-col">
        <div className="mb-2 flex items-center justify-between">
          <TitleEditor
            name={state.name}
            editableName={editableName}
            isEditing={isEditingName}
            onChange={setEditableName}
            onStartEditing={() => setIsEditingName(true)}
            onCancel={() => setIsEditingName(false)}
            onSave={handleWorkoutNameUpdate}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                data-testid="workout-menu"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setShowWorkoutNotes(!showWorkoutNotes)}
                data-testid="toggle-workout-note"
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                {showWorkoutNotes ? "Hide note" : "Add a note"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <WorkoutNotes
          visible={true}
          notes={state.notes}
          onAdd={(text: string) => dispatch({ type: "ADD_WORKOUT_NOTE", text })}
          onUpdate={(noteIndex: number, text: string) =>
            dispatch({ type: "UPDATE_WORKOUT_NOTE", noteIndex, text })
          }
          onDelete={(noteIndex: number) =>
            dispatch({ type: "DELETE_WORKOUT_NOTE", noteIndex })
          }
          onReorder={(fromIndex: number, toIndex: number) =>
            dispatch({ type: "REORDER_WORKOUT_NOTES", fromIndex, toIndex })
          }
        />
      </div>

      {state.exercises.map((exercise, exerciseIndex) => (
        <ExerciseSection
          key={exerciseIndex}
          exercise={exercise}
          exerciseIndex={exerciseIndex}
          activeField={state.activeField}
          inputValue={state.inputValue}
          onFocusField={handleFocus}
          onToggleWarmup={(exIdx, setIdx) =>
            dispatch({
              type: "TOGGLE_WARMUP",
              exerciseIndex: exIdx,
              setIndex: setIdx,
            })
          }
          onToggleComplete={(exIdx, setIdx) =>
            dispatch({
              type: "TOGGLE_COMPLETE",
              exerciseIndex: exIdx,
              setIndex: setIdx,
            })
          }
          onOpenDelete={(_exIdx, _setIdx, _ex, _set) => {
            const workingSetNumber =
              _ex.sets.filter((s) => s.modifier !== "warmup").indexOf(_set) + 1;
            setDeleteDialog({
              isOpen: true,
              setIndex: _setIdx,
              exerciseIndex: _exIdx,
              exerciseName: _ex.name,
              setNumber: workingSetNumber,
              isWarmup: _set.modifier === "warmup",
            });
          }}
          onAddSet={(exIdx) =>
            dispatch({ type: "ADD_SET", exerciseIndex: exIdx })
          }
          notes={exercise.notes}
          onAddExerciseNote={(exerciseIndex: number, text: string) =>
            dispatch({ type: "ADD_EXERCISE_NOTE", exerciseIndex, text })
          }
          onUpdateExerciseNote={(
            exerciseIndex: number,
            noteIndex: number,
            text: string,
          ) =>
            dispatch({
              type: "UPDATE_EXERCISE_NOTE",
              exerciseIndex,
              noteIndex,
              text,
            })
          }
          onDeleteExerciseNote={(exerciseIndex: number, noteIndex: number) =>
            dispatch({ type: "DELETE_EXERCISE_NOTE", exerciseIndex, noteIndex })
          }
          onReorderExerciseNotes={(
            exerciseIndex: number,
            fromIndex: number,
            toIndex: number,
          ) =>
            dispatch({
              type: "REORDER_EXERCISE_NOTES",
              exerciseIndex,
              fromIndex,
              toIndex,
            })
          }
        />
      ))}

      {state.activeField.exerciseIndex !== null &&
        state.activeField.field !== null &&
        (state.activeField.field === "weight" ? (
          <WeightKeyboard
            onKeyPress={handleKeyPress}
            activeSetWeightModifier={activeSet?.weightModifier}
            currentWeight={parseFloat(state.inputValue) || undefined}
          />
        ) : (
          <RepsKeyboard onKeyPress={handleKeyPress} />
        ))}

      <DeleteSetDialog
        isOpen={deleteDialog.isOpen}
        exerciseName={deleteDialog.exerciseName}
        setNumber={deleteDialog.setNumber}
        isWarmup={deleteDialog.isWarmup}
        onCancel={() =>
          setDeleteDialog({
            isOpen: false,
            setIndex: null,
            exerciseIndex: null,
            exerciseName: "",
            setNumber: 0,
            isWarmup: false,
          })
        }
        onConfirm={() => {
          if (
            deleteDialog.exerciseIndex !== null &&
            deleteDialog.setIndex !== null
          ) {
            handleDeleteSet(deleteDialog.exerciseIndex, deleteDialog.setIndex);
          }
        }}
        disabled={
          deleteDialog.setIndex === null || deleteDialog.exerciseIndex === null
        }
      />

      <FinishDialog
        open={finishDialogOpen}
        isSaving={saveWorkoutMutation.isPending}
        finishedWorkout={finishedWorkout}
        date={finishDialogDate}
        startTime={finishDialogStartTime}
        endTime={finishDialogEndTime}
        duration={finishDialogDuration}
        setDate={setFinishDialogDate}
        setStartTime={(v) => {
          setFinishDialogStartTime(v);
          calculateDurationFromTimes(v, finishDialogEndTime);
        }}
        setEndTime={(v) => {
          setFinishDialogEndTime(v);
          calculateDurationFromTimes(finishDialogStartTime, v);
        }}
        setDuration={(v) => {
          setFinishDialogDuration(v);
          calculateStartFromDuration(v);
        }}
        onOpenChange={(open) => {
          if (!open && !saveWorkoutMutation.isPending) {
            setFinishDialogOpen(false);
            setFinishedWorkout(null);
            setFinishDialogDate("");
            setFinishDialogStartTime("");
            setFinishDialogEndTime("");
            setFinishDialogDuration("");
          } else setFinishDialogOpen(open);
        }}
        onCopy={copyWorkoutToClipboard}
        onSetEndToNow={setEndTimeToNow}
        onSave={handleFinishWorkout}
        onDone={() => {
          if (typeof window !== "undefined") {
            try {
              localStorage.removeItem(LOCAL_STORAGE_WORKOUT_KEY);
            } catch {}
          }
          setFinishDialogOpen(false);
          setFinishedWorkout(null);
          setFinishDialogDate("");
          setFinishDialogStartTime("");
          setFinishDialogEndTime("");
          setFinishDialogDuration("");
          router.push("/");
        }}
      />

      <DebugPanel data={{ state, finishedWorkout, initialExercises }} />
    </div>
  );
}
