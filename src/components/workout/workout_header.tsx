"use client";

import { Pencil, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TitleEditor } from "@/components/workout/title_editor";

export function WorkoutHeader({
  name,
  editableName,
  isEditingName,
  workoutNote,
  onEditableNameChange,
  onStartEditingName,
  onCancelEditingName,
  onSaveName,
  onEditWorkoutNote,
  onFinishWorkout,
}: {
  name: string;
  editableName: string;
  isEditingName: boolean;
  workoutNote: string;
  onEditableNameChange: (name: string) => void;
  onStartEditingName: () => void;
  onCancelEditingName: () => void;
  onSaveName: () => void;
  onEditWorkoutNote: () => void;
  onFinishWorkout: () => void;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <TitleEditor
          name={name}
          editableName={editableName}
          isEditing={isEditingName}
          onChange={onEditableNameChange}
          onStartEditing={onStartEditingName}
          onCancel={onCancelEditingName}
          onSave={onSaveName}
        />
        {workoutNote ? (
          <div className="mt-1 inline-flex max-w-full rounded-[4px] bg-[#eee8da] px-1.5 py-0.5 text-[12px] leading-4 text-[#433e33]">
            {workoutNote}
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          aria-label={workoutNote ? "Edit workout note" : "Add workout note"}
          className="inline-flex size-7 items-center justify-center rounded-[4px] border border-[#d7cfbc] bg-[#fdfcf8] text-[#817a69] hover:bg-[#eee8da]"
          onClick={onEditWorkoutNote}
        >
          <Pencil className="size-3.5" aria-hidden="true" />
        </button>
        <Button
          variant="outline"
          size="sm"
          onClick={onFinishWorkout}
          aria-label="Finish workout"
          className="size-7 shrink-0 rounded-[4px] border-[#d7cfbc] bg-[#fdfcf8] p-0 font-mono text-[12px] font-normal text-[#373226] shadow-none"
        >
          <Save className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
