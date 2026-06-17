"use client";

import type { ComponentProps } from "react";
import { CircleChevronUp, Clock, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { NoteBadge } from "@/components/workout-reference/timeline_notes";

export function ExerciseReferenceShell({
  className,
  ...props
}: ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "mx-auto min-h-screen w-full max-w-[390px] overflow-hidden bg-[#fdfcf8] px-3 py-5 font-mono text-[#17150f]",
        className,
      )}
      {...props}
    />
  );
}

export function ExerciseReferenceHeader({
  name,
  note,
  workoutExerciseNote,
  hasHistory,
  historyVisible,
  onToggleHistory,
  onEditWorkoutExerciseNote,
}: {
  name: string;
  note: string;
  workoutExerciseNote: string;
  hasHistory: boolean;
  historyVisible: boolean;
  onToggleHistory: () => void;
  onEditWorkoutExerciseNote: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <h1 className="min-w-0 text-[18px] leading-6 font-semibold tracking-normal">
          {name}
        </h1>
        <div className="flex shrink-0 items-center gap-1">
          <ExerciseNoteButton
            hasNote={Boolean(workoutExerciseNote.trim())}
            onEdit={onEditWorkoutExerciseNote}
          />
          {hasHistory ? (
            <HistoryToggleButton
              visible={historyVisible}
              onToggle={onToggleHistory}
            />
          ) : null}
        </div>
      </div>
      {note.trim() ? <NoteBadge>{note}</NoteBadge> : null}
    </div>
  );
}

function ExerciseNoteButton({
  hasNote,
  onEdit,
}: {
  hasNote: boolean;
  onEdit: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={hasNote ? "Edit exercise note" : "Add exercise note"}
      className="inline-flex size-6 items-center justify-center rounded-[4px] border border-[#ebe4d6] text-[#817a69] hover:bg-[#eee8da]"
      onClick={onEdit}
    >
      <Pencil className="size-3.5" aria-hidden="true" />
    </button>
  );
}

function HistoryToggleButton({
  visible,
  onToggle,
}: {
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={visible ? "Hide exercise history" : "Show exercise history"}
      aria-pressed={visible}
      className="inline-flex size-6 shrink-0 items-center justify-center rounded-[4px] border border-[#ebe4d6] text-[#817a69] hover:bg-[#eee8da]"
      onClick={onToggle}
    >
      {visible ? (
        <CircleChevronUp className="size-3.5" aria-hidden="true" />
      ) : (
        <Clock className="size-3.5" aria-hidden="true" />
      )}
    </button>
  );
}
