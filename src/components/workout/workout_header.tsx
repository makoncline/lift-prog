"use client";

import { useState } from "react";
import { Pencil, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { TitleEditor } from "@/components/workout/title_editor";
import {
  WorkoutEditorContent,
  WorkoutEditorLabel,
  WorkoutEditorPrimaryAction,
} from "@/components/workout/workout_editor_primitives";

export function WorkoutHeader({
  name,
  startTime,
  editableName,
  isEditingName,
  workoutNote,
  onStartTimeChange,
  onEditableNameChange,
  onStartEditingName,
  onCancelEditingName,
  onSaveName,
  onEditWorkoutNote,
  onFinishWorkout,
}: {
  name: string;
  startTime: number;
  editableName: string;
  isEditingName: boolean;
  workoutNote: string;
  onStartTimeChange: (startTime: number) => void;
  onEditableNameChange: (name: string) => void;
  onStartEditingName: () => void;
  onCancelEditingName: () => void;
  onSaveName: () => void;
  onEditWorkoutNote: () => void;
  onFinishWorkout: () => void;
}) {
  const [editingStartPart, setEditingStartPart] = useState<
    "date" | "time" | null
  >(null);
  const startDate = new Date(startTime);

  return (
    <>
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
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] leading-4 text-[#716b5d]">
            <button
              type="button"
              className="rounded-[3px] px-0.5 hover:bg-[#eee8da]"
              onClick={() => setEditingStartPart("date")}
            >
              {formatStartDate(startDate)}
            </button>
            <button
              type="button"
              className="rounded-[3px] px-0.5 hover:bg-[#eee8da]"
              onClick={() => setEditingStartPart("time")}
            >
              {formatStartTime(startDate)}
            </button>
          </div>
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
      <StartTimePartEditor
        part={editingStartPart}
        startTime={startTime}
        onStartTimeChange={onStartTimeChange}
        onOpenChange={(open) => {
          if (!open) setEditingStartPart(null);
        }}
      />
    </>
  );
}

function StartTimePartEditor({
  part,
  startTime,
  onStartTimeChange,
  onOpenChange,
}: {
  part: "date" | "time" | null;
  startTime: number;
  onStartTimeChange: (startTime: number) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const open = part !== null;
  const startDate = new Date(startTime);

  function updateDate(value: string) {
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return;

    const nextDate = new Date(startDate);
    nextDate.setFullYear(year, month - 1, day);
    onStartTimeChange(nextDate.getTime());
  }

  function updateTime(value: string) {
    const [hours, minutes] = value.split(":").map(Number);
    if (hours == null || minutes == null) return;

    const nextDate = new Date(startDate);
    nextDate.setHours(hours, minutes, 0, 0);
    onStartTimeChange(nextDate.getTime());
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {part ? (
        <WorkoutEditorContent>
          <DialogTitle className="sr-only">
            Edit workout start {part}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Change the workout start {part}.
          </DialogDescription>
          <WorkoutEditorLabel>start {part}</WorkoutEditorLabel>
          <Input
            autoFocus
            type={part === "date" ? "date" : "time"}
            value={
              part === "date"
                ? formatDateInputValue(startDate)
                : formatTimeInputValue(startDate)
            }
            onChange={(event) =>
              part === "date"
                ? updateDate(event.target.value)
                : updateTime(event.target.value)
            }
            className="h-9 rounded-[4px] border-[#d7cfbc] bg-[#fdfcf8] font-mono text-[16px] text-[#17150f] shadow-none focus-visible:ring-[#a79b83]"
          />
          <WorkoutEditorPrimaryAction onClick={() => onOpenChange(false)}>
            done
          </WorkoutEditorPrimaryAction>
        </WorkoutEditorContent>
      ) : null}
    </Dialog>
  );
}

function formatStartDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatStartTime(date: Date) {
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateInputValue(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatTimeInputValue(date: Date) {
  return [
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
  ].join(":");
}
