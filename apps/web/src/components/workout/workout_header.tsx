"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Pencil, Redo2, Save, Trash2, Undo2, X } from "lucide-react";
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
  bodyWeightLb,
  showBodyWeight = false,
  contextLabel,
  editableName,
  isEditingName,
  workoutNote,
  isInProgress = false,
  showFinishAction = true,
  showDiscardAction = false,
  showDeleteAction = false,
  canUndo = false,
  canRedo = false,
  onStartTimeChange,
  onBodyWeightChange,
  onCompletedAtChange,
  onEditableNameChange,
  onStartEditingName,
  onCancelEditingName,
  onSaveName,
  onEditWorkoutNote,
  onFinishWorkout,
  onDiscardWorkout,
  onDeleteWorkout,
  onUndo,
  onRedo,
}: {
  name: string;
  startTime: number;
  completedAt: Date;
  bodyWeightLb?: number | null;
  showBodyWeight?: boolean;
  contextLabel?: string;
  editableName: string;
  isEditingName: boolean;
  workoutNote: string;
  isInProgress?: boolean;
  showFinishAction?: boolean;
  showDiscardAction?: boolean;
  showDeleteAction?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  onStartTimeChange: (startTime: number) => void;
  onBodyWeightChange: (bodyWeightLb: number | null) => void;
  onCompletedAtChange: (completedAt: Date) => void;
  onEditableNameChange: (name: string) => void;
  onStartEditingName: () => void;
  onCancelEditingName: () => void;
  onSaveName: () => void;
  onEditWorkoutNote: () => void;
  onFinishWorkout: () => void;
  onDiscardWorkout?: () => void;
  onDeleteWorkout?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
}) {
  const [editingTimePart, setEditingTimePart] = useState<TimeEditorPart>(null);
  const [bodyWeightEditorOpen, setBodyWeightEditorOpen] = useState(false);
  const [bodyWeightInput, setBodyWeightInput] = useState("");
  const [now, setNow] = useState(() => new Date());
  const startDate = new Date(startTime);
  const displayEnd = isInProgress ? now : completedAt;
  const durationMinutes = getDurationMinutes(startDate, displayEnd);
  const relativeDate = formatRelativeDate(startDate);

  useEffect(() => {
    if (!isInProgress) return;

    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, [isInProgress]);

  function openBodyWeightEditor() {
    setBodyWeightInput(
      bodyWeightLb == null ? "" : formatBodyWeight(bodyWeightLb),
    );
    setBodyWeightEditorOpen(true);
  }

  function saveBodyWeight() {
    const nextValue = parseBodyWeightInput(bodyWeightInput);
    onBodyWeightChange(nextValue);
    setBodyWeightEditorOpen(false);
  }

  return (
    <>
      <div className="mb-[22px]">
        <div className="mb-2 flex items-center justify-end gap-2">
          {showDiscardAction ? (
            <button
              type="button"
              aria-label="Discard changes"
              className="inline-flex h-10 min-w-12 items-center justify-center rounded-[7px] border border-[#d7cab8] bg-[#fffefa] px-2 text-[#7a7468] hover:bg-[#eee9df]"
              onClick={onDiscardWorkout}
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Undo"
            className="inline-flex h-10 min-w-12 items-center justify-center rounded-[7px] border border-[#d7cab8] bg-[#fffefa] px-2 text-[#7a7468] hover:bg-[#eee9df] disabled:opacity-35"
            disabled={!canUndo}
            onClick={onUndo}
          >
            <Undo2 className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Redo"
            className="inline-flex h-10 min-w-12 items-center justify-center rounded-[7px] border border-[#d7cab8] bg-[#fffefa] px-2 text-[#7a7468] hover:bg-[#eee9df] disabled:opacity-35"
            disabled={!canRedo}
            onClick={onRedo}
          >
            <Redo2 className="size-5" aria-hidden="true" />
          </button>
          {showDeleteAction ? (
            <button
              type="button"
              aria-label="Delete workout"
              className="inline-flex h-10 min-w-12 items-center justify-center rounded-[7px] border border-[#d7cab8] bg-[#fffefa] px-2 text-[#7a7468] hover:bg-[#eee9df] hover:text-[#9f2f2f]"
              onClick={onDeleteWorkout}
            >
              <Trash2 className="size-5" aria-hidden="true" />
            </button>
          ) : null}
          {showFinishAction ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onFinishWorkout}
              aria-label="Finish workout"
              className="h-10 min-w-12 shrink-0 rounded-[7px] border-[#d7cab8] bg-[#fffefa] p-0 font-mono text-[20px] font-normal text-[#1f1c17] shadow-none hover:bg-[#eee9df]"
            >
              <Save className="h-5 w-5" />
            </Button>
          ) : null}
        </div>
        <div className="flex w-full items-start gap-2">
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
          </div>
          <button
            type="button"
            aria-label={workoutNote ? "Edit workout note" : "Add workout note"}
            className="inline-flex h-[34px] min-w-[44px] shrink-0 items-center justify-center rounded-[7px] border border-[#d7cab8] bg-[#fffefa] px-2 text-[#7a7468] hover:bg-[#eee9df]"
            onClick={onEditWorkoutNote}
          >
            <Pencil className="size-4" aria-hidden="true" />
          </button>
        </div>
        {contextLabel ? (
          <div className="mt-1 font-mono text-[18px] leading-6 text-[#7a7468]">
            {contextLabel}
          </div>
        ) : null}
        <div className="mt-1 flex w-full min-w-0 flex-wrap items-baseline font-mono text-[18px] leading-6 text-[#7a7468]">
          <span>{relativeDate}</span>
          <span className="px-1">·</span>
          <TimeTextButton
            ariaLabel="Edit start date"
            onClick={() => setEditingTimePart("start-date")}
          >
            {formatStartDate(startDate)}
          </TimeTextButton>
          <span className="px-1"> </span>
          <TimeTextButton
            ariaLabel="Edit start time"
            onClick={() => setEditingTimePart("start-time")}
          >
            {formatStartTime(startDate)}
          </TimeTextButton>
          {isInProgress ? (
            <>
              <span className="pl-1">(</span>
              <TimeTextButton
                ariaLabel="Edit duration"
                onClick={() => setEditingTimePart("duration")}
              >
                {formatDurationMinutes(durationMinutes)}
              </TimeTextButton>
              <span>)</span>
            </>
          ) : (
            <>
              <span className="px-1">-</span>
              <TimeTextButton
                ariaLabel="Edit end time"
                onClick={() => setEditingTimePart("end-time")}
              >
                {formatStartTime(completedAt)}
              </TimeTextButton>
              <span className="pl-1">(</span>
              <TimeTextButton
                ariaLabel="Edit duration"
                onClick={() => setEditingTimePart("duration")}
              >
                {formatDurationMinutes(durationMinutes)}
              </TimeTextButton>
              <span>)</span>
            </>
          )}
        </div>
        {showBodyWeight ? (
          <div className="mt-1 flex w-full min-w-0 flex-wrap items-baseline font-mono text-[18px] leading-6 text-[#7a7468]">
            <span>bw</span>
            <span className="px-1">·</span>
            <TimeTextButton
              ariaLabel="Edit body weight"
              onClick={openBodyWeightEditor}
            >
              {bodyWeightLb == null
                ? "set"
                : `${formatBodyWeight(bodyWeightLb)}lb`}
            </TimeTextButton>
          </div>
        ) : null}
        {workoutNote ? (
          <div className="mt-2 inline-flex max-w-full rounded-[5px] bg-[#eee9df] px-[7px] py-[3px] text-[18px] leading-6 text-[#1f1c17]">
            {workoutNote}
          </div>
        ) : null}
      </div>
      <WorkoutTimePartEditor
        part={editingTimePart}
        startTime={startTime}
        completedAt={displayEnd}
        isInProgress={isInProgress}
        onStartTimeChange={onStartTimeChange}
        onCompletedAtChange={onCompletedAtChange}
        onOpenChange={(open) => {
          if (!open) setEditingTimePart(null);
        }}
      />
      <BodyWeightEditor
        open={bodyWeightEditorOpen}
        value={bodyWeightInput}
        onValueChange={setBodyWeightInput}
        onSave={saveBodyWeight}
        onClear={() => {
          onBodyWeightChange(null);
          setBodyWeightInput("");
          setBodyWeightEditorOpen(false);
        }}
        onOpenChange={(open) => setBodyWeightEditorOpen(open)}
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

function TimeTextButton({
  ariaLabel,
  children,
  onClick,
}: {
  ariaLabel: string;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className="rounded-[5px] border border-[#eee9df] bg-[#fffefa] px-1 text-left hover:bg-[#eee9df] hover:text-[#1f1c17]"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function WorkoutTimePartEditor({
  part,
  startTime,
  completedAt,
  isInProgress,
  onStartTimeChange,
  onCompletedAtChange,
  onOpenChange,
}: {
  part: TimeEditorPart;
  startTime: number;
  completedAt: Date;
  isInProgress: boolean;
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

    if (isInProgress) {
      onStartTimeChange(Date.now() - Math.round(minutes) * 60_000);
      return;
    }

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
            className="h-10 rounded-[5px] border-[#d7cab8] bg-[#fffefa] font-mono text-[20px] text-[#1f1c17] shadow-none focus-visible:ring-[#383225]"
          />
          <WorkoutEditorPrimaryAction onClick={() => onOpenChange(false)}>
            done
          </WorkoutEditorPrimaryAction>
        </WorkoutEditorContent>
      ) : null}
    </Dialog>
  );
}

function BodyWeightEditor({
  open,
  value,
  onValueChange,
  onSave,
  onClear,
  onOpenChange,
}: {
  open: boolean;
  value: string;
  onValueChange: (value: string) => void;
  onSave: () => void;
  onClear: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <WorkoutEditorContent>
          <DialogTitle className="sr-only">Edit body weight</DialogTitle>
          <DialogDescription className="sr-only">
            Set an approximate body weight for this workout.
          </DialogDescription>
          <WorkoutEditorLabel>body weight</WorkoutEditorLabel>
          <div className="flex items-baseline gap-1">
            <Input
              autoFocus
              aria-label="Body weight"
              type="number"
              min={1}
              step="0.1"
              inputMode="decimal"
              value={value}
              onChange={(event) => onValueChange(event.target.value)}
              className="h-10 rounded-[5px] border-[#d7cab8] bg-[#fffefa] font-mono text-[20px] text-[#1f1c17] shadow-none focus-visible:ring-[#383225]"
            />
            <span className="text-[18px] text-[#7a7468]">lb</span>
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center rounded-[7px] border border-[#d7cab8] bg-[#fffefa] px-3 font-mono text-[18px] text-[#7a7468] hover:bg-[#eee9df]"
              onClick={onClear}
            >
              clear
            </button>
            <WorkoutEditorPrimaryAction onClick={onSave}>
              done
            </WorkoutEditorPrimaryAction>
          </div>
        </WorkoutEditorContent>
      ) : null}
    </Dialog>
  );
}

function formatStartDate(date: Date) {
  return date
    .toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    .toLowerCase();
}

function formatRelativeDate(date: Date, now = new Date()) {
  const dayMs = 24 * 60 * 60 * 1000;
  const startOfDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysAgo = Math.round(
    (startOfNow.getTime() - startOfDate.getTime()) / dayMs,
  );

  if (daysAgo === 0) return "today";
  if (daysAgo === 1) return "1 day ago";
  if (daysAgo > 1) return `${daysAgo} days ago`;
  if (daysAgo === -1) return "tomorrow";
  return `in ${Math.abs(daysAgo)} days`;
}

function formatStartTime(date: Date) {
  return date
    .toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    })
    .toLowerCase()
    .replace(/\s/g, "");
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

function parseBodyWeightInput(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Number(parsed.toFixed(1));
}

function formatBodyWeight(value: number) {
  const rounded = Number(value.toFixed(1));
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
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
