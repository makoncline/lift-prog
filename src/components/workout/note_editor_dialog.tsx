"use client";

import { useState } from "react";
import {
  Dialog,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ConfirmableNoteDeleteAction,
  NoteEditorActions,
} from "@/components/workout/note_editor_actions";
import {
  WorkoutEditorContent,
  WorkoutEditorLabel,
} from "@/components/workout/workout_editor_primitives";

export function NoteEditorDialog({
  open,
  title,
  description,
  label,
  note,
  deleteLabel,
  onOpenChange,
  onSave,
  onDelete,
}: {
  open: boolean;
  title: string;
  description: string;
  label: string;
  note: string;
  deleteLabel: string;
  onOpenChange: (open: boolean) => void;
  onSave: (note: string) => void;
  onDelete: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <NoteEditorDialogContent
          key={note}
          title={title}
          description={description}
          label={label}
          note={note}
          deleteLabel={deleteLabel}
          onOpenChange={onOpenChange}
          onSave={onSave}
          onDelete={onDelete}
        />
      ) : null}
    </Dialog>
  );
}

function NoteEditorDialogContent({
  title,
  description,
  label,
  note,
  deleteLabel,
  onOpenChange,
  onSave,
  onDelete,
}: {
  title: string;
  description: string;
  label: string;
  note: string;
  deleteLabel: string;
  onOpenChange: (open: boolean) => void;
  onSave: (note: string) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(note);

  function save() {
    onSave(draft.trim());
    onOpenChange(false);
  }

  function deleteNote() {
    onDelete();
    onOpenChange(false);
  }

  return (
    <WorkoutEditorContent>
      <DialogTitle className="sr-only">{title}</DialogTitle>
      <DialogDescription className="sr-only">{description}</DialogDescription>
      <WorkoutEditorLabel>{label}</WorkoutEditorLabel>
      <textarea
        aria-label={title}
        autoFocus
        value={draft}
        className="min-h-24 w-full resize-none rounded-[4px] border border-[#d7cfbc] bg-[#fdfcf8] px-2 py-1 font-mono text-[13px] leading-5 text-[#17150f] outline-none focus:ring-1 focus:ring-[#a79b83]"
        onChange={(event) => setDraft(event.target.value)}
      />
      <NoteEditorActions onDone={save}>
        {note.trim() ? (
          <ConfirmableNoteDeleteAction
            deleteLabel={deleteLabel}
            onDelete={deleteNote}
          />
        ) : null}
      </NoteEditorActions>
    </WorkoutEditorContent>
  );
}
