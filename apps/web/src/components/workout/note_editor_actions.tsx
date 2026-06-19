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
      className="inline-flex h-8 w-9 items-center justify-center rounded-[4px] border border-[#d7cfbc] text-[#817a69] hover:bg-[#eee8da] hover:text-[#5f2018]"
      onClick={onDelete}
    >
      <Trash2 className="size-3.5" aria-hidden="true" />
    </button>
  );
}
