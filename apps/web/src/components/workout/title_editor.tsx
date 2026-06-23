"use client";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  WorkoutEditorActionRow,
  WorkoutEditorContent,
  WorkoutEditorLabel,
  WorkoutEditorPrimaryAction,
  WorkoutEditorSecondaryAction,
} from "@/components/workout/workout_editor_primitives";

export function TitleEditor({
  name,
  editableName,
  isEditing,
  onChange,
  onStartEditing,
  onCancel,
  onSave,
}: {
  name: string;
  editableName: string;
  isEditing: boolean;
  onChange: (value: string) => void;
  onStartEditing: () => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="flex min-w-0 items-center">
      <Dialog
        open={isEditing}
        onOpenChange={(open) => {
          if (!open) onCancel();
        }}
      >
        <button
          type="button"
          className="max-w-full min-w-0 cursor-pointer appearance-none rounded-[5px] border border-[#d7cab8] bg-[#fffefa] px-2 py-1 text-left text-[34px] leading-10 font-extrabold tracking-normal text-[#1f1c17] hover:bg-[#eee9df]"
          onClick={onStartEditing}
        >
          <span className="block truncate">{name}</span>
        </button>
        <WorkoutEditorContent>
          <DialogTitle className="sr-only">Workout name</DialogTitle>
          <DialogDescription className="sr-only">
            Edit the workout name.
          </DialogDescription>
          <WorkoutEditorLabel>workout name</WorkoutEditorLabel>
          <Input
            autoFocus
            value={editableName}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSave();
              if (e.key === "Escape") onCancel();
            }}
            className="h-12 rounded-[5px] border-[#d7cab8] bg-[#fffefa] font-mono text-[28px] text-[#1f1c17] shadow-none focus-visible:ring-[#383225]"
            placeholder="Workout name"
          />
          <WorkoutEditorActionRow>
            <WorkoutEditorSecondaryAction onClick={onCancel}>
              cancel
            </WorkoutEditorSecondaryAction>
            <WorkoutEditorPrimaryAction onClick={onSave}>
              save
            </WorkoutEditorPrimaryAction>
          </WorkoutEditorActionRow>
        </WorkoutEditorContent>
      </Dialog>
    </div>
  );
}
