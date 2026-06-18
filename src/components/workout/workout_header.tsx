"use client";

import { useState } from "react";
import { Pencil, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { TitleEditor } from "@/components/workout/title_editor";
import {
  WorkoutEditorContent,
  WorkoutEditorLabel,
  WorkoutEditorPrimaryAction,
} from "@/components/workout/workout_editor_primitives";

export function WorkoutHeader({
  name,
  startTime,
  completedAt,
  contextLabel,
  editableName,
  isEditingName,
  workoutNote,
  showFinishAction = true,
  onStartTimeChange,
  onCompletedAtChange,
  onEditableNameChange,
  onStartEditingName,
  onCancelEditingName,
  onSaveName,
  onEditWorkoutNote,
  onFinishWorkout,
}: {
  name: string;
  startTime: number;
  completedAt: Date;
  contextLabel?: string;
  editableName: string;
  isEditingName: boolean;
  workoutNote: string;
  showFinishAction?: boolean;
  onStartTimeChange: (startTime: number) => void;
  onCompletedAtChange: (completedAt: Date) => void;
  onEditableNameChange: (name: string) => void;
  onStartEditingName: () => void;
  onCancelEditingName: () => void;
  onSaveName: () => void;
  onEditWorkoutNote: () => void;
  onFinishWorkout: () => void;
}) {
  const [editingTimePart, setEditingTimePart] = useState<TimeEditorPart>(null);
  const startDate = new Date(startTime);
  const durationMinutes = getDurationMinutes(startDate, completedAt);

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
          {contextLabel ? (
            <div className="mt-0.5 font-mono text-[10px] leading-3 text-[#8a8373]">
              {contextLabel}
            </div>
          ) : null}
          <div className="mt-1 grid max-w-[280px] grid-cols-[auto_1fr] gap-x-2 gap-y-px font-mono text-[11px] leading-4">
            <TimeFieldButton
              label="start date"
              value={formatStartDate(startDate)}
              onClick={() => setEditingTimePart("start-date")}
            />
            <TimeFieldButton
              label="start time"
              value={formatStartTime(startDate)}
              onClick={() => setEditingTimePart("start-time")}
            />
            <TimeFieldButton
              label="end time"
              value={formatStartTime(completedAt)}
              onClick={() => setEditingTimePart("end-time")}
            />
            <TimeFieldButton
              label="duration"
              value={formatDurationMinutes(durationMinutes)}
              onClick={() => setEditingTimePart("duration")}
            />
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
          {showFinishAction ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onFinishWorkout}
              aria-label="Finish workout"
              className="size-7 shrink-0 rounded-[4px] border-[#d7cfbc] bg-[#fdfcf8] p-0 font-mono text-[12px] font-normal text-[#373226] shadow-none"
            >
              <Save className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      </div>
      <WorkoutTimePartEditor
        part={editingTimePart}
        startTime={startTime}
        completedAt={completedAt}
        onStartTimeChange={onStartTimeChange}
        onCompletedAtChange={onCompletedAtChange}
        onOpenChange={(open) => {
          if (!open) setEditingTimePart(null);
        }}
      />
    </>
  );
}

type TimeEditorPart =
  | "start-date"
  | "start-time"
  | "end-time"
  | "duration"
  | null;

function TimeFieldButton({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <>
      <button
        type="button"
        className="text-left text-[#8a8373] hover:text-[#373226]"
        onClick={onClick}
      >
        {label}
      </button>
      <button
        type="button"
        className="min-w-0 rounded-[3px] px-0.5 text-left text-[#373226] hover:bg-[#eee8da]"
        onClick={onClick}
      >
        {value}
      </button>
    </>
  );
}

function WorkoutTimePartEditor({
  part,
  startTime,
  completedAt,
  onStartTimeChange,
  onCompletedAtChange,
  onOpenChange,
}: {
  part: TimeEditorPart;
  startTime: number;
  completedAt: Date;
  onStartTimeChange: (startTime: number) => void;
  onCompletedAtChange: (completedAt: Date) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const open = part !== null;
  const startDate = new Date(startTime);
  const durationMinutes = getDurationMinutes(startDate, completedAt);

  function updateDate(value: string) {
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return;

    const nextDate = new Date(startDate);
    nextDate.setFullYear(year, month - 1, day);
    onStartTimeChange(nextDate.getTime());
  }

  function updateStartTime(value: string) {
    const [hours, minutes] = value.split(":").map(Number);
    if (hours == null || minutes == null) return;

    const nextDate = new Date(startDate);
    nextDate.setHours(hours, minutes, 0, 0);
    onStartTimeChange(nextDate.getTime());
  }

  function updateEndTime(value: string) {
    const [hours, minutes] = value.split(":").map(Number);
    if (hours == null || minutes == null) return;

    const nextDate = new Date(startDate);
    nextDate.setHours(hours, minutes, 0, 0);
    if (nextDate.getTime() <= startDate.getTime()) {
      nextDate.setDate(nextDate.getDate() + 1);
    }
    onCompletedAtChange(nextDate);
  }

  function updateDuration(value: string) {
    const minutes = Number(value);
    if (!Number.isFinite(minutes) || minutes < 1) return;

    onCompletedAtChange(new Date(startTime + Math.round(minutes) * 60_000));
  }

  const isDate = part === "start-date";
  const isDuration = part === "duration";
  const inputType = isDate ? "date" : isDuration ? "number" : "time";
  const inputValue =
    part === "start-date"
      ? formatDateInputValue(startDate)
      : part === "start-time"
        ? formatTimeInputValue(startDate)
        : part === "end-time"
          ? formatTimeInputValue(completedAt)
          : String(durationMinutes);
  const label =
    part === "start-date"
      ? "start date"
      : part === "start-time"
        ? "start time"
        : part === "end-time"
          ? "end time"
          : "duration";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {part ? (
        <WorkoutEditorContent>
          <DialogTitle className="sr-only">Edit workout {label}</DialogTitle>
          <DialogDescription className="sr-only">
            Change the workout {label}.
          </DialogDescription>
          <WorkoutEditorLabel>{label}</WorkoutEditorLabel>
          <Input
            autoFocus
            type={inputType}
            min={isDuration ? 1 : undefined}
            inputMode={isDuration ? "numeric" : undefined}
            value={inputValue}
            onChange={(event) => {
              if (part === "start-date") updateDate(event.target.value);
              if (part === "start-time") updateStartTime(event.target.value);
              if (part === "end-time") updateEndTime(event.target.value);
              if (part === "duration") updateDuration(event.target.value);
            }}
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

function getDurationMinutes(startDate: Date, completedAt: Date) {
  return Math.max(
    1,
    Math.round((completedAt.getTime() - startDate.getTime()) / 60_000),
  );
}

function formatDurationMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes === 0
    ? `${hours}h`
    : `${hours}h ${remainingMinutes}m`;
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
