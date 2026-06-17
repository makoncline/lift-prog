"use client";

import { useState } from "react";
import {
  CurrentExerciseHeader,
  TimelineSetHeading,
  TimelineSetLine,
} from "@/components/workout-reference/current_timeline";
import {
  getDefaultRestTypeId,
  getResolvedRestTypeId,
  normalizeRestBlocks,
} from "@/components/workout-reference/current_exercise_sets";
import { getCurrentSetLabel } from "@/components/workout-reference/set_formatting";
import { SetValueDialog } from "@/components/workout-reference/set_value_dialog";
import type {
  CurrentExerciseSet,
  EditorField,
  RestType,
} from "@/components/workout-reference/workout_reference_types";

type SetEditorState = {
  setId: string;
  field: EditorField;
} | null;

type TimelineExerciseInputProps = {
  exerciseName: string;
  initialSets: CurrentExerciseSet[];
  restTypes: RestType[];
  workoutExerciseNote: string;
  onEditWorkoutExerciseNote: () => void;
  onSetsChange?: (sets: CurrentExerciseSet[]) => void;
};

export function TimelineExerciseInput({
  exerciseName,
  initialSets,
  restTypes,
  workoutExerciseNote,
  onEditWorkoutExerciseNote,
  onSetsChange,
}: TimelineExerciseInputProps) {
  const [sets, setSets] = useState<CurrentExerciseSet[]>(() =>
    normalizeRestBlocks(initialSets, restTypes),
  );
  const [editor, setEditor] = useState<SetEditorState>(null);
  const defaultRestTypeId = getDefaultRestTypeId(restTypes);
  const activeSet = editor
    ? (sets.find((set) => set.id === editor.setId) ?? null)
    : null;
  const warmupSets = sets.filter((set) => set.kind === "warmup");
  const workingSets = sets.filter((set) => set.kind === "working");
  const activeSetLabel = editor
    ? getCurrentSetLabel(sets, editor.setId, restTypes)
    : "";

  function commitSets(nextSets: CurrentExerciseSet[]) {
    setSets(nextSets);
    onSetsChange?.(nextSets);
  }

  function updateSet(
    setId: string,
    nextSet: (set: CurrentExerciseSet) => CurrentExerciseSet,
  ) {
    commitSets(
      sets.map((set) => (set.id === setId ? nextSet(set) : set)),
    );
  }

  function addWorkingSet() {
    const nextSetId = `timeline-working-${Date.now()}`;

    const lastWorkingSet = [...sets]
      .reverse()
      .find((set) => set.kind === "working");
    const baseSet = lastWorkingSet ?? sets[sets.length - 1];

    commitSets([
      ...sets,
      {
        id: nextSetId,
        kind: "working",
        weightMode: baseSet?.weightMode ?? "standard",
        weightAmount: baseSet?.weightAmount ?? "",
        weightSign: baseSet?.weightSign ?? 1,
        reps: baseSet?.reps ?? "",
        restBefore: sets.length > 0 ? defaultRestTypeId : undefined,
        completed: false,
      },
    ]);
    setEditor({ setId: nextSetId, field: "reps" });
  }

  function cycleRestBefore(setId: string) {
    commitSets(
      sets.map((set) => {
        if (set.id !== setId) return set;

        const resolvedRestTypeId = getResolvedRestTypeId(
          set.restBefore,
          restTypes,
        );

        return {
          ...set,
          restBefore:
            resolvedRestTypeId === "short" ? defaultRestTypeId : "short",
        };
      }),
    );
  }

  function deleteSet(setId: string) {
    const deletedSetIndex = sets.findIndex((set) => set.id === setId);
    const nextSets = normalizeRestBlocks(
      sets.filter((set) => set.id !== setId),
      restTypes,
    );
    const nextSet =
      nextSets[Math.min(Math.max(deletedSetIndex, 0), nextSets.length - 1)] ??
      null;

    commitSets(nextSets);
    setEditor((currentEditor) => {
      if (currentEditor?.setId !== setId) return currentEditor;
      if (!nextSet) return null;

      return {
        setId: nextSet.id,
        field: currentEditor.field === "note" ? "reps" : currentEditor.field,
      };
    });
  }

  return (
    <section className="mt-2 text-[14px] leading-5">
      <CurrentExerciseHeader
        note={workoutExerciseNote}
        onEditNote={onEditWorkoutExerciseNote}
      />
      <div className="mt-0.5 flex flex-col gap-1.5">
        {warmupSets.length > 0 ? (
          <div className="flex flex-col gap-px">
            <TimelineSetHeading>warm-up</TimelineSetHeading>
            <TimelineSetLine
              sets={warmupSets}
              allSets={sets}
              restTypes={restTypes}
              onEdit={(setId, field) => setEditor({ setId, field })}
              onEditNote={(setId) => setEditor({ setId, field: "note" })}
              onCycleRest={cycleRestBefore}
            />
          </div>
        ) : null}
        <div className="flex flex-col gap-px">
          <TimelineSetHeading>working sets</TimelineSetHeading>
          <TimelineSetLine
            sets={workingSets}
            allSets={sets}
            restTypes={restTypes}
            onEdit={(setId, field) => setEditor({ setId, field })}
            onEditNote={(setId) => setEditor({ setId, field: "note" })}
            onCycleRest={cycleRestBefore}
            onAddSet={addWorkingSet}
          />
        </div>
      </div>

      <SetValueDialog
        editor={editor}
        exerciseName={exerciseName}
        set={activeSet}
        sets={sets}
        restTypes={restTypes}
        setLabel={activeSetLabel}
        onDelete={() => {
          if (!activeSet) return;
          deleteSet(activeSet.id);
        }}
        onAddSet={addWorkingSet}
        onSelectSet={(setId) => {
          setEditor((currentEditor) =>
            currentEditor ? { ...currentEditor, setId } : currentEditor,
          );
        }}
        onOpenChange={(open) => {
          if (!open) setEditor(null);
        }}
        onFieldChange={(field) => {
          setEditor((currentEditor) =>
            currentEditor ? { ...currentEditor, field } : currentEditor,
          );
        }}
        onUpdate={(nextSet) => {
          if (!editor) return;
          updateSet(editor.setId, () => nextSet);
        }}
      />
    </section>
  );
}
