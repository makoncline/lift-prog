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
} from "@/components/workout-reference/workout_reference_types";

type PreviousWorkoutExerciseProps = {
  exerciseName: string;
  exerciseNote: string;
  history: PreviousExercise[];
  initialCurrentSets?: CurrentExerciseSet[];
  workoutExerciseNote?: string;
  onWorkoutExerciseNoteChange?: (note: string) => void;
  onCurrentSetsChange?: (sets: CurrentExerciseSet[]) => void;
  shellClassName?: string;
};

export function PreviousWorkoutExercise({
  exerciseName,
  exerciseNote,
  history,
  initialCurrentSets: initialCurrentSetsOverride,
  workoutExerciseNote = "",
  onWorkoutExerciseNoteChange,
  onCurrentSetsChange,
  shellClassName,
}: PreviousWorkoutExerciseProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [exerciseNoteEditorOpen, setExerciseNoteEditorOpen] = useState(false);
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
        onToggleHistory={() => setIsExpanded((visible) => !visible)}
        onEditWorkoutExerciseNote={() => setExerciseNoteEditorOpen(true)}
      />
      <HistoryDisclosure expanded={isExpanded}>
        <HistoryViewport history={history} />
      </HistoryDisclosure>
      <TimelineExerciseInput
        exerciseName={exerciseName}
        initialSets={currentSets}
        restTypes={restTypes}
        workoutExerciseNote={workoutExerciseNote}
        onEditWorkoutExerciseNote={() => setExerciseNoteEditorOpen(true)}
        onSetsChange={onCurrentSetsChange}
      />
      <NoteEditorDialog
        open={exerciseNoteEditorOpen}
        title="Exercise note"
        description="Add a note for this exercise in the current workout."
        label="exercise note"
        note={workoutExerciseNote}
        deleteLabel="Delete exercise note"
        onOpenChange={setExerciseNoteEditorOpen}
        onSave={(note) => onWorkoutExerciseNoteChange?.(note)}
        onDelete={() => onWorkoutExerciseNoteChange?.("")}
      />
    </ExerciseReferenceShell>
  );
}
