"use client";
import { useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";
import { LOCAL_STORAGE_WORKOUT_KEY } from "@/lib/constants";
import { formatDuration } from "@/lib/utils";
import { NoteEditorDialog } from "@/components/workout/note_editor_dialog";
import { DeleteExerciseDialog } from "@/components/workout/delete_exercise_dialog";
import { WorkoutExercisePlan } from "@/components/workout/workout_exercise_plan";
import { currentSetToWorkoutSet } from "@/components/workout/workout_reference_adapters";
import {
  initialiseExercises,
  workoutReducer,
  finalizeWorkout,
  type Workout,
  type WeightModifier,
  type SetModifier,
} from "@/lib/workoutLogic";
import { FinishDialog } from "./finish_dialog";
import { WorkoutHeader } from "@/components/workout/workout_header";
import { useWorkoutPersistence } from "@/components/workout/use_workout_persistence";
import { useWorkoutFinishDialog } from "@/components/workout/use_workout_finish_dialog";
import { WorkoutExerciseList } from "@/components/workout/workout_exercise_list";
import type { CompletedWorkout } from "@/lib/schemas/workout-schema";

interface PreviousExerciseData {
  name: string;
  sets: Array<{
    weight: number | null;
    reps: number | null;
    isWarmup?: boolean;
    modifier?: SetModifier;
    weightModifier?: WeightModifier | null;
    restBefore?: "standard" | "short";
    notes?: string | null;
  }>;
  exerciseNotes?: string | null;
  notes?: string | null;
  exerciseNotesSnapshot?: string | null;
  history?: Workout["exercises"][number]["history"];
}

type WorkoutProps = {
  workoutName?: string;
  exercises?: PreviousExerciseData[];
  autoRestore?: boolean;
  onInitialSave?: () => void;
};

export function WorkoutComponent({ ...props }: WorkoutProps) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return <WorkoutComponentInner {...props} canSaveWorkout userStateLoaded />;
  }

  return <ClerkWorkoutComponent {...props} />;
}

function ClerkWorkoutComponent(props: WorkoutProps) {
  const { user, isLoaded } = useUser();
  return (
    <WorkoutComponentInner
      {...props}
      canSaveWorkout={Boolean(user)}
      userStateLoaded={isLoaded}
    />
  );
}

function WorkoutComponentInner({
  workoutName = "",
  exercises: initialExercises = [],
  autoRestore = false,
  onInitialSave,
  canSaveWorkout,
  userStateLoaded,
}: WorkoutProps & {
  canSaveWorkout: boolean;
  userStateLoaded: boolean;
}) {
  const router = useRouter();

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
  const [draggingExerciseIndex, setDraggingExerciseIndex] = useState<
    number | null
  >(null);
  const [pendingDeleteExerciseIndex, setPendingDeleteExerciseIndex] = useState<
    number | null
  >(null);

  const handleWorkoutNameUpdate = () => {
    if (editableName.trim()) {
      dispatch({ type: "UPDATE_WORKOUT_NAME", name: editableName.trim() });
      setIsEditingName(false);
    } else {
      setEditableName(state.name);
      setIsEditingName(false);
    }
  };

  const handleStartEditingName = () => {
    setEditableName(state.name);
    setIsEditingName(true);
  };

  const handleCancelEditingName = () => {
    setEditableName(state.name);
    setIsEditingName(false);
  };

  const { restoreWorkout } = useWorkoutPersistence({
    state,
    autoRestore,
    onInitialSave,
    initialExerciseCount: initialExercises.length,
    onRestore: (restoredState) => {
      dispatch({ type: "REPLACE_STATE", state: restoredState });
      setShowRestore(false);
    },
    onRestorePrompt: () => setShowRestore(true),
  });

  const [workoutNoteEditorOpen, setWorkoutNoteEditorOpen] = useState(false);
  const [addingExerciseName, setAddingExerciseName] = useState<string | null>(
    null,
  );
  const [newExerciseName, setNewExerciseName] = useState("");
  const finishDialog = useWorkoutFinishDialog();

  const saveWorkoutMutation = api.workout.saveWorkout.useMutation({
    onSuccess: (_data, variables) => {
      toast.success("Workout saved successfully!");
      if (typeof window !== "undefined")
        localStorage.removeItem(LOCAL_STORAGE_WORKOUT_KEY);
      finishDialog.setFinishedWorkout(variables);
    },
    onError: (error) => {
      toast.error(`Error saving workout: ${error.message}`);
      finishDialog.setFinishedWorkout(null);
    },
  });

  const utils = api.useUtils();
  const handleAddExercise = async (exerciseName: string) => {
    const trimmedName = exerciseName.trim();
    if (!trimmedName) return;

    if (state.exercises.some((exercise) => exercise.name === trimmedName)) {
      toast.error(`${trimmedName} is already in this workout.`);
      return;
    }

    setAddingExerciseName(trimmedName);
    try {
      const prepared = await utils.workout.prepareInitialWorkout.fetch({
        mode: "exerciseList",
        workoutName: state.name,
        exerciseNames: [trimmedName],
      });
      const [exercise] = initialiseExercises(prepared.exercises);
      if (!exercise) {
        toast.error(`Could not prepare ${trimmedName}.`);
        return;
      }
      dispatch({ type: "ADD_EXERCISE", exercise });
      setNewExerciseName("");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? `Error adding exercise: ${error.message}`
          : "Error adding exercise.",
      );
    } finally {
      setAddingExerciseName(null);
    }
  };

  const getWorkoutNoteText = () => state.notes[0]?.text ?? "";

  const updateWorkoutNote = (note: string) => {
    const nextNote = note.trim();
    if (!nextNote) {
      if (state.notes.length > 0) {
        dispatch({ type: "DELETE_WORKOUT_NOTE", noteIndex: 0 });
      }
      return;
    }

    if (state.notes.length > 0) {
      dispatch({ type: "UPDATE_WORKOUT_NOTE", noteIndex: 0, text: nextNote });
    } else {
      dispatch({ type: "ADD_WORKOUT_NOTE", text: nextNote });
    }
  };

  const updateWorkoutExerciseNote = (exerciseIndex: number, note: string) => {
    const exercise = state.exercises[exerciseIndex];
    if (!exercise) return;

    const nextNote = note.trim();
    if (!nextNote) {
      if (exercise.notes.length > 0) {
        dispatch({ type: "DELETE_EXERCISE_NOTE", exerciseIndex, noteIndex: 0 });
      }
      return;
    }

    if (exercise.notes.length > 0) {
      dispatch({
        type: "UPDATE_EXERCISE_NOTE",
        exerciseIndex,
        noteIndex: 0,
        text: nextNote,
      });
    } else {
      dispatch({ type: "ADD_EXERCISE_NOTE", exerciseIndex, text: nextNote });
    }
  };

  const handleFinishWorkout = () => {
    if (!canSaveWorkout || !userStateLoaded) {
      toast.error("User not loaded. Cannot save workout.");
      return;
    }
    const durationInSeconds = finishDialog.getDurationInSeconds(
      state.startTime,
    );
    const completionDate = finishDialog.getCompletedAt();
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
    if (!finishDialog.finishedWorkout) return Promise.resolve();
    const finishedWorkout = finishDialog.finishedWorkout;
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
      className="container mx-auto max-w-md p-3 pb-[200px] font-mono"
      style={{ touchAction: "pan-x pan-y" }}
    >
      {showRestore && !autoRestore && (
        <div className="mb-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              restoreWorkout();
              setShowRestore(false);
            }}
          >
            Restore Progress
          </Button>
        </div>
      )}
      <WorkoutHeader
        name={state.name}
        editableName={editableName}
        isEditingName={isEditingName}
        workoutNote={getWorkoutNoteText()}
        onEditableNameChange={setEditableName}
        onStartEditingName={handleStartEditingName}
        onCancelEditingName={handleCancelEditingName}
        onSaveName={handleWorkoutNameUpdate}
        onEditWorkoutNote={() => setWorkoutNoteEditorOpen(true)}
        onFinishWorkout={() => {
          finishDialog.openForWorkout(state.startTime);
        }}
      />

      <WorkoutExercisePlan
        exercises={state.exercises.map((exercise) => exercise.name)}
        draggingIndex={draggingExerciseIndex}
        newExerciseName={newExerciseName}
        addingExerciseName={addingExerciseName}
        onNewExerciseNameChange={setNewExerciseName}
        onAddExercise={(exerciseName) => void handleAddExercise(exerciseName)}
        onDeleteExercise={setPendingDeleteExerciseIndex}
        onDragStart={setDraggingExerciseIndex}
        onDragEnd={() => setDraggingExerciseIndex(null)}
        onDropExercise={(targetIndex) => {
          if (draggingExerciseIndex == null) return;
          dispatch({
            type: "MOVE_EXERCISE_TO",
            exerciseIndex: draggingExerciseIndex,
            targetIndex,
          });
          setDraggingExerciseIndex(null);
        }}
      />

      <WorkoutExerciseList
        exercises={state.exercises}
        onWorkoutExerciseNoteChange={updateWorkoutExerciseNote}
        onCurrentSetsChange={(exerciseIndex, sets) =>
          dispatch({
            type: "REPLACE_EXERCISE_SETS",
            exerciseIndex,
            sets: sets.map(currentSetToWorkoutSet),
          })
        }
      />

      <FinishDialog
        open={finishDialog.open}
        isSaving={saveWorkoutMutation.isPending}
        finishedWorkout={finishDialog.finishedWorkout}
        date={finishDialog.date}
        startTime={finishDialog.startTime}
        endTime={finishDialog.endTime}
        duration={finishDialog.duration}
        setDate={finishDialog.setDate}
        setStartTime={finishDialog.setStartTime}
        setEndTime={finishDialog.setEndTime}
        setDuration={finishDialog.setDuration}
        onOpenChange={(open) =>
          finishDialog.handleOpenChange(open, saveWorkoutMutation.isPending)
        }
        onCopy={copyWorkoutToClipboard}
        onSetEndToNow={finishDialog.setEndTimeToNow}
        onSave={handleFinishWorkout}
        onDone={() => {
          if (typeof window !== "undefined") {
            try {
              localStorage.removeItem(LOCAL_STORAGE_WORKOUT_KEY);
            } catch {}
          }
          finishDialog.reset();
          router.push("/");
        }}
      />

      <NoteEditorDialog
        open={workoutNoteEditorOpen}
        title="Workout note"
        description="Add a note for this workout."
        label="workout note"
        note={getWorkoutNoteText()}
        deleteLabel="Delete workout note"
        onOpenChange={setWorkoutNoteEditorOpen}
        onSave={updateWorkoutNote}
        onDelete={() => updateWorkoutNote("")}
      />
      <DeleteExerciseDialog
        exerciseName={
          pendingDeleteExerciseIndex == null
            ? ""
            : state.exercises[pendingDeleteExerciseIndex]?.name ?? ""
        }
        open={pendingDeleteExerciseIndex != null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteExerciseIndex(null);
        }}
        onConfirm={() => {
          if (pendingDeleteExerciseIndex == null) return;
          dispatch({
            type: "DELETE_EXERCISE",
            exerciseIndex: pendingDeleteExerciseIndex,
          });
          setPendingDeleteExerciseIndex(null);
        }}
      />
    </div>
  );
}
