"use client";

import { useState } from "react";
import { NoteEditorDialog } from "@/components/workout/note_editor_dialog";
import {
  HistoryDisclosure,
  HistoryViewport,
} from "@/components/workout-reference/workout_history";
import {
  ExerciseReferenceHeader,
  ExerciseReferenceShell,
} from "@/components/workout-reference/exercise_reference_frame";
import { TimelineExerciseInput } from "@/components/workout-reference/timeline_exercise_input";
import {
  DEFAULT_REST_TYPES,
  initialCurrentSets,
} from "@/components/workout-reference/current_exercise_sets";
import type {
  CurrentExerciseSet,
  PreviousExercise,
  SetChangeOptions,
} from "@/components/workout-reference/workout_reference_types";

type PreviousWorkoutExerciseProps = {
  exerciseName: string;
  exerciseNote: string;
  history: PreviousExercise[];
  initialCurrentSets?: CurrentExerciseSet[];
  workoutExerciseNote?: string;
  onExerciseNoteChange?: (note: string) => void;
  onWorkoutExerciseNoteChange?: (note: string) => void;
  onCurrentSetsChange?: (
    sets: CurrentExerciseSet[],
    options?: SetChangeOptions,
  ) => void;
  onCommitPendingHistory?: () => void;
  shellClassName?: string;
};

export function PreviousWorkoutExercise({
  exerciseName,
  exerciseNote,
  history,
  initialCurrentSets: initialCurrentSetsOverride,
  workoutExerciseNote = "",
  onExerciseNoteChange,
  onWorkoutExerciseNoteChange,
  onCurrentSetsChange,
  onCommitPendingHistory,
  shellClassName,
}: PreviousWorkoutExerciseProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [userExerciseNoteEditorOpen, setUserExerciseNoteEditorOpen] =
    useState(false);
  const [workoutExerciseNoteEditorOpen, setWorkoutExerciseNoteEditorOpen] =
    useState(false);
  const restTypes = DEFAULT_REST_TYPES;
  const currentSets =
    initialCurrentSetsOverride ?? initialCurrentSets(history, restTypes);

  return (
    <ExerciseReferenceShell className={shellClassName}>
      <ExerciseReferenceHeader
        name={exerciseName}
        note={exerciseNote}
        workoutExerciseNote={workoutExerciseNote}
        hasHistory={history.length > 0}
        historyVisible={isExpanded}
        onEditExerciseNote={() => setUserExerciseNoteEditorOpen(true)}
        onToggleHistory={() => setIsExpanded((visible) => !visible)}
        onEditWorkoutExerciseNote={() => setWorkoutExerciseNoteEditorOpen(true)}
      />
      <HistoryDisclosure expanded={isExpanded}>
        <HistoryViewport history={history} />
      </HistoryDisclosure>
      <TimelineExerciseInput
        exerciseName={exerciseName}
        initialSets={currentSets}
        restTypes={restTypes}
        workoutExerciseNote={workoutExerciseNote}
        onEditWorkoutExerciseNote={() => setWorkoutExerciseNoteEditorOpen(true)}
        onSetsChange={onCurrentSetsChange}
        onCommitPendingHistory={onCommitPendingHistory}
      />
      <NoteEditorDialog
        open={userExerciseNoteEditorOpen}
        title={`${exerciseName} pinned exercise note`}
        description={`Edit the pinned exercise note for ${exerciseName}.`}
        label={
          <span className="flex flex-col">
            <span className="text-[#17150f]">{exerciseName}</span>
            <span>pinned exercise note</span>
          </span>
        }
        note={exerciseNote}
        deleteLabel="Delete pinned exercise note"
        onOpenChange={setUserExerciseNoteEditorOpen}
        onSave={(note) => onExerciseNoteChange?.(note)}
        onDelete={() => onExerciseNoteChange?.("")}
      />
      <NoteEditorDialog
        open={workoutExerciseNoteEditorOpen}
        title={`${exerciseName} note for this workout`}
        description={`Add a note for ${exerciseName} in this workout only.`}
        label={
          <span className="flex flex-col">
            <span className="text-[#17150f]">{exerciseName}</span>
            <span>this workout note</span>
          </span>
        }
        note={workoutExerciseNote}
        deleteLabel="Delete workout note"
        onOpenChange={setWorkoutExerciseNoteEditorOpen}
        onSave={(note) => onWorkoutExerciseNoteChange?.(note)}
        onDelete={() => onWorkoutExerciseNoteChange?.("")}
      />
    </ExerciseReferenceShell>
  );
}
