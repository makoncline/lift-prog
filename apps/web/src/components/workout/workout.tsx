"use client";
import { useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";
import { authClient } from "@/lib/auth-client";
import { normalizeExerciseNameForCompare } from "@/lib/exercise-name";
import { NoteEditorDialog } from "@/components/workout/note_editor_dialog";
import { DeleteExerciseDialog } from "@/components/workout/delete_exercise_dialog";
import { DeleteWorkoutDialog } from "@/components/workout/delete_workout_dialog";
import { WorkoutExercisePlan } from "@/components/workout/workout_exercise_plan";
import {
  currentSetToWorkoutSet,
  normalizeCurrentSetOrder,
} from "@/components/workout/workout_reference_adapters";
import {
  LOCAL_STORAGE_WORKOUT_KEY,
  initialiseExercises,
  workoutReducer,
  finalizeWorkout,
  type Action,
  type Workout,
  type WeightModifier,
  type SetModifier,
  type CompletedWorkout,
} from "@lift-prog/workout-core";
import { FinishDialog } from "./finish_dialog";
import { WorkoutHeader } from "@/components/workout/workout_header";
import { useWorkoutPersistence } from "@/components/workout/use_workout_persistence";
import { useWorkoutFinishDialog } from "@/components/workout/use_workout_finish_dialog";
import { WorkoutExerciseList } from "@/components/workout/workout_exercise_list";
import type { PlateSettings } from "@/components/workout-reference/weight_helper_dialog";

interface PreviousExerciseData {
  userExerciseId?: number;
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
  plateStartingWeight?: number | null;
  plateLoadMode?: string | null;
  history?: Workout["exercises"][number]["history"];
}

type WorkoutProps = {
  workoutId?: number;
  workoutName?: string;
  exercises?: PreviousExerciseData[];
  autoRestore?: boolean;
  startTime?: number;
  completedAt?: Date;
  bodyWeightLb?: number | null;
  workoutNote?: string;
  contextLabel?: string;
  persistDraft?: boolean;
  onInitialSave?: () => void;
};

type WorkoutDraft = {
  workout: Workout;
  completedAt: Date;
};

type WorkoutDraftSession = {
  past: WorkoutDraft[];
  present: WorkoutDraft;
  future: WorkoutDraft[];
  saved: WorkoutDraft;
  pendingHistoryBase?: WorkoutDraft;
};

type WorkoutDraftAction =
  | {
      type: "APPLY_WORKOUT_ACTION";
      action: Action;
      track?: boolean;
      deferHistory?: boolean;
    }
  | { type: "SET_COMPLETED_AT"; completedAt: Date }
  | { type: "SET_TIME_RANGE"; startTime: number; completedAt: Date }
  | { type: "REPLACE_DRAFT"; draft: WorkoutDraft }
  | { type: "COMMIT_PENDING_HISTORY" }
  | { type: "MARK_SAVED" }
  | { type: "UNDO" }
  | { type: "REDO" };

const MAX_DRAFT_HISTORY = 100;
const EPHEMERAL_WORKOUT_ACTIONS = new Set<Action["type"]>([
  "FOCUS_FIELD",
  "COLLAPSE_KEYBOARD",
  "NAV_EXERCISE",
  "REPLACE_STATE",
]);

function workoutDraftReducer(
  session: WorkoutDraftSession,
  action: WorkoutDraftAction,
): WorkoutDraftSession {
  if (action.type === "UNDO") {
    if (session.pendingHistoryBase) {
      return {
        ...session,
        present: cloneWorkoutDraft(session.pendingHistoryBase),
        future: [cloneWorkoutDraft(session.present), ...session.future],
        pendingHistoryBase: undefined,
      };
    }

    const previous = session.past[session.past.length - 1];
    if (!previous) return session;

    return {
      ...session,
      past: session.past.slice(0, -1),
      present: cloneWorkoutDraft(previous),
      future: [cloneWorkoutDraft(session.present), ...session.future],
      pendingHistoryBase: undefined,
    };
  }

  if (action.type === "REDO") {
    const [next, ...future] = session.future;
    if (!next) return session;

    return {
      ...session,
      past: [...session.past, cloneWorkoutDraft(session.present)].slice(
        -MAX_DRAFT_HISTORY,
      ),
      present: cloneWorkoutDraft(next),
      future,
      pendingHistoryBase: undefined,
    };
  }

  if (action.type === "REPLACE_DRAFT") {
    const draft = cloneWorkoutDraft(action.draft);
    return {
      past: [],
      present: draft,
      future: [],
      saved: draft,
      pendingHistoryBase: undefined,
    };
  }

  if (action.type === "COMMIT_PENDING_HISTORY") {
    if (!session.pendingHistoryBase) return session;

    if (isSameDraft(session.pendingHistoryBase, session.present)) {
      return {
        ...session,
        pendingHistoryBase: undefined,
      };
    }

    return {
      ...session,
      past: [
        ...session.past,
        cloneWorkoutDraft(session.pendingHistoryBase),
      ].slice(-MAX_DRAFT_HISTORY),
      future: [],
      pendingHistoryBase: undefined,
    };
  }

  if (action.type === "MARK_SAVED") {
    return {
      ...session,
      past: [],
      future: [],
      saved: cloneWorkoutDraft(session.present),
      pendingHistoryBase: undefined,
    };
  }

  const nextDraft =
    action.type === "SET_COMPLETED_AT"
      ? { ...session.present, completedAt: action.completedAt }
      : action.type === "SET_TIME_RANGE"
        ? {
            ...session.present,
            workout: {
              ...session.present.workout,
              startTime: action.startTime,
            },
            completedAt: action.completedAt,
          }
        : {
            ...session.present,
            workout: workoutReducer(session.present.workout, action.action),
          };

  if (
    nextDraft === session.present ||
    isSameDraft(nextDraft, session.present)
  ) {
    return session;
  }

  const shouldTrack =
    action.type === "SET_COMPLETED_AT" ||
    action.type === "SET_TIME_RANGE" ||
    (action.track ?? !EPHEMERAL_WORKOUT_ACTIONS.has(action.action.type));

  if (action.type === "APPLY_WORKOUT_ACTION" && action.deferHistory) {
    return {
      ...session,
      present: nextDraft,
      future: [],
      pendingHistoryBase:
        session.pendingHistoryBase ?? cloneWorkoutDraft(session.present),
    };
  }

  const committedPast =
    shouldTrack &&
    session.pendingHistoryBase &&
    !isSameDraft(session.pendingHistoryBase, session.present)
      ? [...session.past, cloneWorkoutDraft(session.pendingHistoryBase)]
      : session.past;

  return {
    ...session,
    past: shouldTrack
      ? [...committedPast, cloneWorkoutDraft(session.present)].slice(
          -MAX_DRAFT_HISTORY,
        )
      : committedPast.slice(-MAX_DRAFT_HISTORY),
    present: nextDraft,
    future: shouldTrack ? [] : session.future,
    pendingHistoryBase: shouldTrack ? undefined : session.pendingHistoryBase,
  };
}

function isSameDraft(a: WorkoutDraft, b: WorkoutDraft) {
  return (
    a.completedAt.getTime() === b.completedAt.getTime() &&
    JSON.stringify(a.workout) === JSON.stringify(b.workout)
  );
}

function cloneWorkoutDraft(draft: WorkoutDraft): WorkoutDraft {
  return {
    workout: cloneWorkout(draft.workout),
    completedAt: new Date(draft.completedAt.getTime()),
  };
}

function cloneWorkout(workout: Workout): Workout {
  if (typeof structuredClone === "function") {
    return structuredClone(workout);
  }

  return JSON.parse(JSON.stringify(workout)) as Workout;
}

export function WorkoutComponent({ ...props }: WorkoutProps) {
  const { data: session, isPending } = authClient.useSession();
  return (
    <WorkoutComponentInner
      {...props}
      canSaveWorkout={Boolean(session?.user)}
      userStateLoaded={!isPending}
    />
  );
}

function WorkoutComponentInner({
  workoutId,
  workoutName = "",
  exercises: initialExercises = [],
  autoRestore = false,
  startTime = Date.now(),
  completedAt,
  bodyWeightLb,
  workoutNote = "",
  contextLabel,
  persistDraft = true,
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
    notes: workoutNote.trim() ? [{ text: workoutNote.trim() }] : [],
    startTime,
    name: workoutName || "Workout",
    bodyWeightLb: bodyWeightLb ?? null,
    isInProgress: true,
    activeField: { exerciseIndex: null, setIndex: null, field: null },
    inputValue: "",
    isFirstInteraction: false,
  };

  const initialDraft: WorkoutDraft = {
    workout: initialState,
    completedAt: completedAt ?? new Date(),
  };
  const [draftSession, dispatchDraft] = useReducer(workoutDraftReducer, {
    past: [],
    present: initialDraft,
    future: [],
    saved: initialDraft,
  });
  const state = draftSession.present.workout;
  const workoutCompletedAt = draftSession.present.completedAt;
  const hasUnsavedChanges = !isSameDraft(
    draftSession.present,
    draftSession.saved,
  );
  const dispatch = (
    action: Action,
    options?: { track?: boolean; deferHistory?: boolean },
  ) =>
    dispatchDraft({
      type: "APPLY_WORKOUT_ACTION",
      action,
      ...(options?.track === undefined ? {} : { track: options.track }),
      ...(options?.deferHistory === undefined
        ? {}
        : { deferHistory: options.deferHistory }),
    });
  const commitPendingHistory = () =>
    dispatchDraft({ type: "COMMIT_PENDING_HISTORY" });
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

  const handleStartTimeChange = (nextStartTime: number) => {
    const durationMs = workoutCompletedAt.getTime() - state.startTime;
    dispatchDraft({
      type: "SET_TIME_RANGE",
      startTime: nextStartTime,
      completedAt: new Date(nextStartTime + Math.max(60_000, durationMs)),
    });
  };

  const handleBodyWeightChange = (nextBodyWeightLb: number | null) => {
    dispatch({
      type: "UPDATE_BODY_WEIGHT",
      bodyWeightLb: nextBodyWeightLb,
    });
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
    enabled: persistDraft,
    onInitialSave,
    initialExerciseCount: initialExercises.length,
    onRestore: (restoredState) => {
      dispatchDraft({
        type: "REPLACE_DRAFT",
        draft: {
          workout: restoredState,
          completedAt: workoutCompletedAt,
        },
      });
      setShowRestore(false);
    },
    onRestorePrompt: () => setShowRestore(true),
  });

  const [workoutNoteEditorOpen, setWorkoutNoteEditorOpen] = useState(false);
  const [deleteWorkoutDialogOpen, setDeleteWorkoutDialogOpen] = useState(false);
  const [addingExerciseName, setAddingExerciseName] = useState<string | null>(
    null,
  );
  const [newExerciseName, setNewExerciseName] = useState("");
  const finishDialog = useWorkoutFinishDialog();
  const utils = api.useUtils();
  const exercisesQuery = api.exercise.list.useQuery(undefined, {
    staleTime: Infinity,
  });

  const saveWorkoutMutation = api.workout.saveWorkout.useMutation({
    onSuccess: async () => {
      toast.success("Workout saved successfully!");
      dispatchDraft({ type: "MARK_SAVED" });
      if (typeof window !== "undefined")
        localStorage.removeItem(LOCAL_STORAGE_WORKOUT_KEY);
      await utils.workout.listRecent.invalidate();
      finishDialog.reset();
      router.push("/");
    },
    onError: (error) => {
      toast.error(`Error saving workout: ${error.message}`);
      finishDialog.setFinishedWorkout(null);
    },
  });
  const updateWorkoutMutation = api.workout.updateWorkout.useMutation({
    onSuccess: async () => {
      toast.success("Workout updated successfully.");
      dispatchDraft({ type: "MARK_SAVED" });
      await utils.workout.listRecent.invalidate();
      router.push("/");
    },
    onError: (error) => {
      toast.error(`Error updating workout: ${error.message}`);
    },
  });
  const deleteWorkoutMutation = api.workout.deleteWorkout.useMutation({
    onSuccess: async () => {
      toast.success("Workout deleted.");
      dispatchDraft({ type: "MARK_SAVED" });
      setDeleteWorkoutDialogOpen(false);
      if (typeof window !== "undefined") {
        localStorage.removeItem(LOCAL_STORAGE_WORKOUT_KEY);
      }
      await utils.workout.listRecent.invalidate();
      router.push("/");
    },
    onError: (error) => {
      toast.error(`Error deleting workout: ${error.message}`);
    },
  });
  const addExerciseMutation = api.exercise.add.useMutation({
    onSuccess: async () => {
      await utils.exercise.list.invalidate();
    },
    onError: (error) => {
      if (!error.message.includes("already exists")) {
        toast.error(`Error creating exercise: ${error.message}`);
      }
    },
  });
  const updateUserExerciseNoteMutation = api.exercise.updateNote.useMutation({
    onSuccess: async () => {
      await utils.exercise.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Error updating exercise note: ${error.message}`);
    },
  });
  const updateUserExercisePlateDefaultsMutation =
    api.exercise.updatePlateDefaults.useMutation({
      onSuccess: async () => {
        await utils.exercise.list.invalidate();
      },
      onError: (error) => {
        toast.error(`Error updating plate defaults: ${error.message}`);
      },
    });

  const discardWorkoutChanges = () => {
    if (
      hasUnsavedChanges &&
      !window.confirm("Discard unsaved workout changes?")
    ) {
      return;
    }

    router.push("/");
  };

  const deleteWorkout = () => {
    if (workoutId) {
      deleteWorkoutMutation.mutate({ workoutId });
      return;
    }

    dispatchDraft({ type: "MARK_SAVED" });
    setDeleteWorkoutDialogOpen(false);
    if (typeof window !== "undefined") {
      localStorage.removeItem(LOCAL_STORAGE_WORKOUT_KEY);
    }
    router.push("/");
  };

  const handleAddExercise = async (exerciseName: string) => {
    const trimmedName = exerciseName.trim();
    if (!trimmedName) return;
    const matchingExercise = exercisesQuery.data?.find(
      (existingExercise) =>
        normalizeExerciseNameForCompare(existingExercise.name) ===
        normalizeExerciseNameForCompare(trimmedName),
    );
    const canonicalName = matchingExercise?.name ?? trimmedName;
    const normalizedCanonicalName =
      normalizeExerciseNameForCompare(canonicalName);

    if (
      state.exercises.some(
        (exercise) =>
          normalizeExerciseNameForCompare(exercise.name) ===
          normalizedCanonicalName,
      )
    ) {
      toast.error(`${canonicalName} is already in this workout.`);
      return;
    }

    setAddingExerciseName(canonicalName);
    try {
      const prepared = await utils.workout.prepareInitialWorkout.fetch({
        mode: "exerciseList",
        workoutName: state.name,
        exerciseNames: [canonicalName],
      });
      const [exercise] = initialiseExercises(prepared.exercises);
      if (!exercise) {
        toast.error(`Could not prepare ${canonicalName}.`);
        return;
      }
      dispatch({ type: "ADD_EXERCISE", exercise });
      setNewExerciseName("");
      if (!matchingExercise) {
        addExerciseMutation.mutate({ name: trimmedName });
      }
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

  const updateUserExerciseNote = (exerciseIndex: number, note: string) => {
    const exercise = state.exercises[exerciseIndex];
    if (!exercise) return;

    const nextNote = note.trim();
    dispatch({
      type: "UPDATE_USER_EXERCISE_NOTE",
      exerciseIndex,
      note: nextNote,
    });

    if (exercise.userExerciseId) {
      updateUserExerciseNoteMutation.mutate({
        id: exercise.userExerciseId,
        note: nextNote,
      });
    } else {
      updateUserExerciseNoteMutation.mutate({
        name: exercise.name,
        note: nextNote,
      });
    }
  };

  const updateUserExercisePlateDefaults = (
    exerciseIndex: number,
    settings: PlateSettings,
  ) => {
    const exercise = state.exercises[exerciseIndex];
    if (!exercise) return;

    dispatch(
      {
        type: "UPDATE_USER_EXERCISE_PLATE_DEFAULTS",
        exerciseIndex,
        plateStartingWeight: settings.startingWeight,
        plateLoadMode: settings.loadMode,
      },
      { track: false },
    );

    const payload = {
      plateStartingWeight: settings.startingWeight,
      plateLoadMode: settings.loadMode,
    };

    if (exercise.userExerciseId) {
      updateUserExercisePlateDefaultsMutation.mutate({
        id: exercise.userExerciseId,
        ...payload,
      });
    } else {
      updateUserExercisePlateDefaultsMutation.mutate({
        name: exercise.name,
        ...payload,
      });
    }
  };

  const buildFinishedWorkoutPayload = (): CompletedWorkout => {
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

    return payload;
  };

  const handleFinishWorkout = () => {
    if (!canSaveWorkout || !userStateLoaded) {
      toast.error("User not loaded. Cannot save workout.");
      return;
    }

    if (workoutId) {
      const payload = finalizeWorkout(state, getWorkoutNoteText());
      updateWorkoutMutation.mutate({
        workoutId,
        workout: {
          ...payload,
          completedAt: workoutCompletedAt,
        },
      });
      return;
    }

    const payload = buildFinishedWorkoutPayload();
    saveWorkoutMutation.mutate(payload);
  };

  return (
    <div
      className="mx-auto w-full max-w-[390px] bg-[#fbfaf7] p-[14px] pb-[220px] font-mono text-[#1f1c17]"
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
        startTime={state.startTime}
        completedAt={workoutCompletedAt}
        bodyWeightLb={state.bodyWeightLb ?? null}
        showBodyWeight={shouldShowBodyWeight(state, Boolean(workoutId))}
        contextLabel={contextLabel}
        editableName={editableName}
        isEditingName={isEditingName}
        workoutNote={getWorkoutNoteText()}
        isInProgress={!workoutId}
        showDiscardAction={Boolean(workoutId)}
        showDeleteAction
        canUndo={
          draftSession.past.length > 0 ||
          Boolean(draftSession.pendingHistoryBase)
        }
        canRedo={draftSession.future.length > 0}
        onStartTimeChange={handleStartTimeChange}
        onBodyWeightChange={handleBodyWeightChange}
        onCompletedAtChange={(nextCompletedAt) =>
          dispatchDraft({
            type: "SET_COMPLETED_AT",
            completedAt: nextCompletedAt,
          })
        }
        onEditableNameChange={setEditableName}
        onStartEditingName={handleStartEditingName}
        onCancelEditingName={handleCancelEditingName}
        onSaveName={handleWorkoutNameUpdate}
        onEditWorkoutNote={() => setWorkoutNoteEditorOpen(true)}
        onDiscardWorkout={discardWorkoutChanges}
        onDeleteWorkout={() => setDeleteWorkoutDialogOpen(true)}
        onUndo={() => dispatchDraft({ type: "UNDO" })}
        onRedo={() => dispatchDraft({ type: "REDO" })}
        onFinishWorkout={() => {
          if (workoutId) {
            handleFinishWorkout();
            return;
          }
          finishDialog.openForWorkout(state.startTime);
        }}
      />

      <WorkoutExercisePlan
        exercises={state.exercises.map((exercise) => exercise.name)}
        draggingIndex={draggingExerciseIndex}
        newExerciseName={newExerciseName}
        addingExerciseName={addingExerciseName}
        exerciseSuggestions={
          exercisesQuery.data?.map((exercise) => exercise.name) ?? []
        }
        exerciseSuggestionsLoaded={Boolean(exercisesQuery.data)}
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
        onExerciseNoteChange={updateUserExerciseNote}
        onPlateSettingsChange={updateUserExercisePlateDefaults}
        onWorkoutExerciseNoteChange={updateWorkoutExerciseNote}
        onCommitPendingHistory={commitPendingHistory}
        onCurrentSetsChange={(exerciseIndex, sets, options) =>
          dispatch(
            {
              type: "REPLACE_EXERCISE_SETS",
              exerciseIndex,
              sets: normalizeCurrentSetOrder(sets).map(currentSetToWorkoutSet),
            },
            options,
          )
        }
      />

      <FinishDialog
        open={finishDialog.open}
        isSaving={saveWorkoutMutation.isPending}
        workout={finishDialog.open ? buildFinishedWorkoutPayload() : null}
        onOpenChange={(open) =>
          finishDialog.handleOpenChange(open, saveWorkoutMutation.isPending)
        }
        onBack={() =>
          finishDialog.handleOpenChange(false, saveWorkoutMutation.isPending)
        }
        onSave={handleFinishWorkout}
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
            : (state.exercises[pendingDeleteExerciseIndex]?.name ?? "")
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
      <DeleteWorkoutDialog
        open={deleteWorkoutDialogOpen}
        workoutName={state.name}
        isDeleting={deleteWorkoutMutation.isPending}
        onOpenChange={setDeleteWorkoutDialogOpen}
        onConfirm={deleteWorkout}
      />
    </div>
  );
}

function shouldShowBodyWeight(workout: Workout, isSavedWorkout: boolean) {
  if (isSavedWorkout && workout.bodyWeightLb != null) return true;

  return workout.exercises.some((exercise) => {
    const hasCurrentBodyweight = exercise.sets.some(
      (set) => set.weightModifier === "bodyweight",
    );
    const hasPreviousBodyweight = exercise.previousSets.some(
      (set) => set.weightModifier === "bodyweight",
    );
    const hasHistoryBodyweight = exercise.history?.some((entry) =>
      entry.sets.some((set) => set.weightModifier === "bodyweight"),
    );

    return (
      hasCurrentBodyweight || hasPreviousBodyweight || hasHistoryBodyweight
    );
  });
}
