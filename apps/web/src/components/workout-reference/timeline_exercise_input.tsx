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
import type { PlateSettings } from "@/components/workout-reference/weight_helper_dialog";
import type { PlateMode } from "@/lib/weight-helper";
import type {
  CurrentExerciseSet,
  EditorField,
  RestType,
  SetChangeOptions,
} from "@/components/workout-reference/workout_reference_types";

type SetEditorState = {
  setId: string;
  field: EditorField;
} | null;

type TimelineExerciseInputProps = {
  exerciseName: string;
  initialSets: CurrentExerciseSet[];
  plateStartingWeight?: number | null;
  plateLoadMode?: PlateMode | null;
  restTypes: RestType[];
  workoutExerciseNote: string;
  onEditWorkoutExerciseNote: () => void;
  onSetsChange?: (
    sets: CurrentExerciseSet[],
    options?: SetChangeOptions,
  ) => void;
  onCommitPendingHistory?: () => void;
  onPlateSettingsChange?: (settings: PlateSettings) => void;
};

export function TimelineExerciseInput({
  exerciseName,
  initialSets,
  plateStartingWeight,
  plateLoadMode,
  restTypes,
  workoutExerciseNote,
  onEditWorkoutExerciseNote,
  onSetsChange,
  onCommitPendingHistory,
  onPlateSettingsChange,
}: TimelineExerciseInputProps) {
  const controlled = Boolean(onSetsChange);
  const [uncontrolledSets, setUncontrolledSets] = useState<
    CurrentExerciseSet[]
  >(() => normalizeRestBlocks(initialSets, restTypes));
  const sets = controlled
    ? normalizeRestBlocks(initialSets, restTypes)
    : uncontrolledSets;
  const [editor, setEditor] = useState<SetEditorState>(null);
  const defaultRestTypeId = getDefaultRestTypeId(restTypes);
  const activeSet = editor
    ? (sets.find((set) => set.id === editor.setId) ?? null)
    : null;
  const warmupSets = sets.filter((set) => set.kind === "warmup");
  const workingSets = sets.filter((set) => set.kind === "working");
  const displaySets = [...warmupSets, ...workingSets];
  const activeSetLabel = editor
    ? getCurrentSetLabel(displaySets, editor.setId, restTypes)
    : "";

  function commitPendingHistory() {
    onCommitPendingHistory?.();
  }

  function commitSets(
    nextSets: CurrentExerciseSet[],
    options?: SetChangeOptions,
  ) {
    if (!controlled) {
      setUncontrolledSets(nextSets);
    }
    onSetsChange?.(nextSets, options);
  }

  function updateSet(
    setId: string,
    nextSet: (set: CurrentExerciseSet) => CurrentExerciseSet,
    options?: SetChangeOptions,
  ) {
    commitSets(
      sets.map((set) => (set.id === setId ? nextSet(set) : set)),
      options,
    );
  }

  function addWorkingSet() {
    commitPendingHistory();
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

  function addShortRestSet(afterSetId: string) {
    commitPendingHistory();
    const setIndex = sets.findIndex((set) => set.id === afterSetId);
    const baseSet = sets[setIndex];
    if (!baseSet) return;

    const nextSetId = `timeline-${baseSet.kind}-short-${Date.now()}`;
    const nextSet: CurrentExerciseSet = {
      ...baseSet,
      id: nextSetId,
      reps: "",
      note: undefined,
      restBefore: "short",
      completed: false,
    };

    commitSets([
      ...sets.slice(0, setIndex + 1),
      nextSet,
      ...sets.slice(setIndex + 1),
    ]);
    setEditor({ setId: nextSetId, field: "reps" });
  }

  function cycleRestBefore(setId: string) {
    commitPendingHistory();
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

  function useStandardRestBefore(setId: string) {
    commitPendingHistory();
    updateSet(setId, (set) => ({
      ...set,
      restBefore: defaultRestTypeId,
    }));
  }

  function deleteSet(setId: string) {
    commitPendingHistory();
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
              onEdit={(setId, field) => {
                commitPendingHistory();
                setEditor({ setId, field });
              }}
              onEditNote={(setId) => {
                commitPendingHistory();
                setEditor({ setId, field: "note" });
              }}
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
            onEdit={(setId, field) => {
              commitPendingHistory();
              setEditor({ setId, field });
            }}
            onEditNote={(setId) => {
              commitPendingHistory();
              setEditor({ setId, field: "note" });
            }}
            onCycleRest={cycleRestBefore}
            onAddSet={addWorkingSet}
          />
        </div>
      </div>

      <SetValueDialog
        editor={editor}
        exerciseName={exerciseName}
        set={activeSet}
        sets={displaySets}
        restTypes={restTypes}
        setLabel={activeSetLabel}
        plateStartingWeight={plateStartingWeight}
        plateLoadMode={plateLoadMode}
        onDelete={() => {
          if (!activeSet) return;
          deleteSet(activeSet.id);
        }}
        onAddSet={addWorkingSet}
        onAddShortRestSet={addShortRestSet}
        onCycleRestBefore={cycleRestBefore}
        onUseStandardRestBefore={useStandardRestBefore}
        onPlateSettingsChange={onPlateSettingsChange}
        onSelectSet={(setId) => {
          commitPendingHistory();
          setEditor((currentEditor) =>
            currentEditor ? { ...currentEditor, setId } : currentEditor,
          );
        }}
        onOpenChange={(open) => {
          if (!open) {
            commitPendingHistory();
            setEditor(null);
          }
        }}
        onFieldChange={(field) => {
          commitPendingHistory();
          setEditor((currentEditor) =>
            currentEditor ? { ...currentEditor, field } : currentEditor,
          );
        }}
        onUpdate={(nextSet, options) => {
          if (!editor) return;
          if (!options?.deferHistory) commitPendingHistory();
          updateSet(editor.setId, () => nextSet, options);
        }}
      />
    </section>
  );
}
