"use client";

import type { ComponentProps } from "react";
import { CircleChevronUp, Clock, Pencil, Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import { NoteBadge } from "@/components/workout-reference/timeline_notes";

export function ExerciseReferenceShell({
  className,
  ...props
}: ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "mx-auto min-h-screen w-full max-w-[390px] overflow-hidden bg-[#fbfaf7] px-[14px] py-0 font-mono text-[#1f1c17]",
        className,
      )}
      {...props}
    />
  );
}

export function ExerciseReferenceHeader({
  name,
  note,
  plateSettingsText,
  workoutExerciseNote,
  hasHistory,
  historyVisible,
  onEditExerciseNote,
  onToggleHistory,
  onEditWorkoutExerciseNote,
}: {
  name: string;
  note: string;
  plateSettingsText?: string;
  workoutExerciseNote: string;
  hasHistory: boolean;
  historyVisible: boolean;
  onEditExerciseNote: () => void;
  onToggleHistory: () => void;
  onEditWorkoutExerciseNote: () => void;
}) {
  return (
    <div className="flex flex-col gap-[5px]">
      <div className="flex items-center justify-between gap-[7px]">
        <button
          type="button"
          aria-label={`Edit ${name} pinned exercise note`}
          className="min-w-0 text-left"
          onClick={onEditExerciseNote}
        >
          <h1 className="min-w-0 text-[31px] leading-9 font-extrabold tracking-normal">
            {name}
          </h1>
        </button>
        <div className="flex shrink-0 items-center gap-[7px]">
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
      {note.trim() ? (
        <button
          type="button"
          aria-label={`Edit ${name} pinned exercise note`}
          className="w-fit max-w-full text-left"
          onClick={onEditExerciseNote}
        >
          <NoteBadge className="gap-1">
            <Pin className="size-3 shrink-0 text-[#817a69]" aria-hidden />
            <span>{note}</span>
          </NoteBadge>
        </button>
      ) : null}
      {plateSettingsText?.trim() ? (
        <div className="text-[18px] leading-6 text-[#7a7468]">
          {plateSettingsText}
        </div>
      ) : null}
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
      aria-label={
        hasNote ? "Edit workout exercise note" : "Add workout exercise note"
      }
      className="inline-flex h-[34px] min-w-[44px] items-center justify-center rounded-[7px] border border-[#d7cab8] bg-[#fffefa] px-2 text-[#7a7468] hover:bg-[#eee9df]"
      onClick={onEdit}
    >
      <Pencil className="size-4" aria-hidden="true" />
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
      className="inline-flex h-[34px] min-w-[44px] shrink-0 items-center justify-center rounded-[7px] border border-[#d7cab8] bg-[#fffefa] px-2 text-[#7a7468] hover:bg-[#eee9df]"
      onClick={onToggle}
    >
      {visible ? (
        <CircleChevronUp className="size-4" aria-hidden="true" />
      ) : (
        <Clock className="size-4" aria-hidden="true" />
      )}
    </button>
  );
}
