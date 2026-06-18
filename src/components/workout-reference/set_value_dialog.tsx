"use client";

import {
  Dialog,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { WorkoutEditorContent } from "@/components/workout/workout_editor_primitives";
import { SetEditorKeyboard } from "@/components/workout-reference/set_editor_keyboard";
import {
  SetNoteEditor,
  SetRestKeyboard,
} from "@/components/workout-reference/set_editor_modes";
import { SetEditorReadout } from "@/components/workout-reference/set_editor_readout";
import type {
  CurrentExerciseSet,
  EditorField,
  RestType,
} from "@/components/workout-reference/workout_reference_types";

type SetValueDialogProps = {
  editor: { field: EditorField } | null;
  exerciseName: string;
  set: CurrentExerciseSet | null;
  sets: CurrentExerciseSet[];
  restTypes: RestType[];
  setLabel: string;
  onDelete: () => void;
  onAddSet: () => void;
  onSelectSet: (setId: string) => void;
  onOpenChange: (open: boolean) => void;
  onFieldChange: (field: EditorField) => void;
  onUpdate: (set: CurrentExerciseSet) => void;
};

export function SetValueDialog({
  editor,
  exerciseName,
  set,
  sets,
  restTypes,
  setLabel,
  onDelete,
  onAddSet,
  onSelectSet,
  onOpenChange,
  onFieldChange,
  onUpdate,
}: SetValueDialogProps) {
  const open = Boolean(editor && set);
  const field = editor?.field ?? "weight";
  const displaySets = groupSetsForEditor(sets);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <WorkoutEditorContent className="overflow-hidden [&_[data-slot=dialog-close]]:!top-1 [&_[data-slot=dialog-close]]:!right-1">
        <DialogTitle className="sr-only">Edit set</DialogTitle>
        <DialogDescription className="sr-only">
          Enter weight and reps for the current set.
        </DialogDescription>
        {set ? (
          <SetValueDialogContent
            exerciseName={exerciseName}
            set={set}
            sets={displaySets}
            restTypes={restTypes}
            setLabel={setLabel}
            field={field}
            onDelete={onDelete}
            onAddSet={onAddSet}
            onSelectSet={onSelectSet}
            onOpenChange={onOpenChange}
            onFieldChange={onFieldChange}
            onUpdate={onUpdate}
          />
        ) : null}
      </WorkoutEditorContent>
    </Dialog>
  );
}

function groupSetsForEditor(sets: CurrentExerciseSet[]) {
  return [
    ...sets.filter((candidateSet) => candidateSet.kind === "warmup"),
    ...sets.filter((candidateSet) => candidateSet.kind === "working"),
  ];
}

function SetValueDialogContent({
  exerciseName,
  set,
  sets,
  restTypes,
  setLabel,
  field,
  onDelete,
  onAddSet,
  onSelectSet,
  onOpenChange,
  onFieldChange,
  onUpdate,
}: Omit<SetValueDialogProps, "editor"> & {
  set: CurrentExerciseSet;
  field: EditorField;
}) {
  return (
    <>
      <SetEditorReadout
        exerciseName={exerciseName}
        set={set}
        sets={sets}
        restTypes={restTypes}
        setLabel={setLabel}
        field={field}
        onFieldChange={onFieldChange}
        onEditNote={() => onFieldChange("note")}
        onDelete={onDelete}
        onAddSet={onAddSet}
        onSelectSet={onSelectSet}
        onToggleWarmup={() =>
          onUpdate({
            ...set,
            kind: set.kind === "warmup" ? "working" : "warmup",
          })
        }
      />
      {field === "note" ? (
        <SetNoteEditor
          set={set}
          setLabel={setLabel}
          onDelete={() => {
            onUpdate({ ...set, note: "" });
            onFieldChange("reps");
          }}
          onDone={() => onOpenChange(false)}
          onUpdate={onUpdate}
        />
      ) : field === "rest" ? (
        <SetRestKeyboard
          set={set}
          restTypes={restTypes}
          onDone={() => onOpenChange(false)}
          onUpdate={onUpdate}
        />
      ) : (
        <SetEditorKeyboard
          field={field}
          set={set}
          onDone={() => onOpenChange(false)}
          onNext={() => onFieldChange(field === "weight" ? "reps" : "weight")}
          onUpdate={onUpdate}
        />
      )}
    </>
  );
}
