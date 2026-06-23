"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import {
  WorkoutEditorActionRow,
  WorkoutEditorDangerAction,
  WorkoutEditorPrimaryAction,
  WorkoutEditorSecondaryAction,
} from "@/components/workout/workout_editor_primitives";

export function NoteEditorActions({
  children,
  onDone,
}: {
  children?: ReactNode;
  onDone: () => void;
}) {
  return (
    <WorkoutEditorActionRow columns="icon-primary">
      {children ?? <span aria-hidden="true" />}
      <NoteEditorDoneButton onDone={onDone} />
    </WorkoutEditorActionRow>
  );
}

function NoteEditorDoneButton({ onDone }: { onDone: () => void }) {
  return (
    <WorkoutEditorPrimaryAction onClick={onDone}>
      done
    </WorkoutEditorPrimaryAction>
  );
}

export function ConfirmableNoteDeleteAction({
  deleteLabel,
  onDelete,
}: {
  deleteLabel: string;
  onDelete: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (!confirmingDelete) {
    return (
      <NoteDeleteButton
        deleteLabel={deleteLabel}
        onDelete={() => setConfirmingDelete(true)}
      />
    );
  }

  return (
    <WorkoutEditorActionRow>
      <WorkoutEditorSecondaryAction onClick={() => setConfirmingDelete(false)}>
        cancel
      </WorkoutEditorSecondaryAction>
      <WorkoutEditorDangerAction onClick={onDelete}>
        delete
      </WorkoutEditorDangerAction>
    </WorkoutEditorActionRow>
  );
}

export function ImmediateNoteDeleteAction({
  deleteLabel,
  onDelete,
}: {
  deleteLabel: string;
  onDelete: () => void;
}) {
  return <NoteDeleteButton deleteLabel={deleteLabel} onDelete={onDelete} />;
}

function NoteDeleteButton({
  deleteLabel,
  onDelete,
}: {
  deleteLabel: string;
  onDelete: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={deleteLabel}
      className="inline-flex h-10 min-w-12 items-center justify-center rounded-[7px] border border-[#d7cab8] bg-[#fffefa] text-[#7a7468] hover:bg-[#eee9df] hover:text-[#9f2f2f]"
      onClick={onDelete}
    >
      <Trash2 className="size-4" aria-hidden="true" />
    </button>
  );
}
