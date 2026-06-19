"use client";

import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { WorkoutEditorContent } from "@/components/workout/workout_editor_primitives";
import { SetEditorKeyboard } from "@/components/workout-reference/set_editor_keyboard";
import {
  SetNoteEditor,
  SetRestKeyboard,
} from "@/components/workout-reference/set_editor_modes";
import { SetEditorReadout } from "@/components/workout-reference/set_editor_readout";
import type { PlateSettings } from "@/components/workout-reference/weight_helper_dialog";
import type { PlateMode } from "@/lib/weight-helper";
import type {
  CurrentExerciseSet,
  EditorField,
  RestType,
  SetChangeOptions,
} from "@/components/workout-reference/workout_reference_types";

type SetValueDialogProps = {
  editor: { field: EditorField } | null;
  exerciseName: string;
  set: CurrentExerciseSet | null;
  sets: CurrentExerciseSet[];
  restTypes: RestType[];
  setLabel: string;
  plateStartingWeight?: number | null;
  plateLoadMode?: PlateMode | null;
  onDelete: () => void;
  onAddSet: () => void;
  onAddShortRestSet: (setId: string) => void;
  onCycleRestBefore: (setId: string) => void;
  onUseStandardRestBefore: (setId: string) => void;
  onSelectSet: (setId: string) => void;
  onOpenChange: (open: boolean) => void;
  onFieldChange: (field: EditorField) => void;
  onUpdate: (set: CurrentExerciseSet, options?: SetChangeOptions) => void;
  onPlateSettingsChange?: (settings: PlateSettings) => void;
};

export function SetValueDialog({
  editor,
  exerciseName,
  set,
  sets,
  restTypes,
  setLabel,
  plateStartingWeight,
  plateLoadMode,
  onDelete,
  onAddSet,
  onAddShortRestSet,
  onCycleRestBefore,
  onUseStandardRestBefore,
  onSelectSet,
  onOpenChange,
  onFieldChange,
  onUpdate,
  onPlateSettingsChange,
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
            plateStartingWeight={plateStartingWeight}
            plateLoadMode={plateLoadMode}
            field={field}
            onDelete={onDelete}
            onAddSet={onAddSet}
            onAddShortRestSet={onAddShortRestSet}
            onCycleRestBefore={onCycleRestBefore}
            onUseStandardRestBefore={onUseStandardRestBefore}
            onSelectSet={onSelectSet}
            onOpenChange={onOpenChange}
            onFieldChange={onFieldChange}
            onUpdate={onUpdate}
            onPlateSettingsChange={onPlateSettingsChange}
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
  plateStartingWeight,
  plateLoadMode,
  field,
  onDelete,
  onAddSet,
  onAddShortRestSet,
  onCycleRestBefore,
  onUseStandardRestBefore,
  onSelectSet,
  onOpenChange,
  onFieldChange,
  onUpdate,
  onPlateSettingsChange,
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
        onCycleRestBefore={onCycleRestBefore}
        onUseStandardRestBefore={onUseStandardRestBefore}
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
          key={set.id}
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
          key={`${set.id}-${field}`}
          field={field}
          set={set}
          plateStartingWeight={plateStartingWeight}
          plateLoadMode={plateLoadMode}
          onPlateSettingsChange={onPlateSettingsChange}
          onAddShortRest={
            field === "reps" ? () => onAddShortRestSet(set.id) : undefined
          }
          onDone={() => onOpenChange(false)}
          onNext={() => onFieldChange(field === "weight" ? "reps" : "weight")}
          onUpdate={(nextSet) => onUpdate(nextSet, { deferHistory: true })}
        />
      )}
    </>
  );
}
