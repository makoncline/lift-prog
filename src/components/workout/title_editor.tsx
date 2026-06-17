"use client";
import {
  Dialog,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { H4 } from "@/components/ui/typography";
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
    <div className="mb-2 flex items-center justify-between">
      <Dialog
        open={isEditing}
        onOpenChange={(open) => {
          if (!open) onCancel();
        }}
      >
        <button
          type="button"
          className="min-w-0 cursor-pointer appearance-none bg-transparent p-0 text-left text-inherit"
          onClick={onStartEditing}
        >
          <H4>{name}</H4>
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
            className="h-9 rounded-[4px] border-[#d7cfbc] bg-[#fdfcf8] font-mono text-[14px] text-[#17150f] shadow-none focus-visible:ring-[#a79b83]"
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
