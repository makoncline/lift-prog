"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ConfirmableNoteDeleteAction,
  ImmediateNoteDeleteAction,
  NoteEditorActions,
} from "@/components/workout/note_editor_actions";
import { cn } from "@/lib/utils";
import type {
  CurrentExerciseSet,
  RestType,
} from "@/components/workout-reference/workout_reference_types";

const FIXED_REST_CHOICES = [
  { id: "default", label: "standard" },
  { id: "short", label: "short" },
] as const;

export function SetNoteEditor({
  set,
  setLabel,
  onDelete,
  onDone,
  onUpdate,
}: {
  set: CurrentExerciseSet;
  setLabel: string;
  onDelete: () => void;
  onDone: () => void;
  onUpdate: (set: CurrentExerciseSet) => void;
}) {
  const [draftNote, setDraftNote] = useState(set.note ?? "");

  function blurActiveInput() {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  function doneAfterBlur() {
    blurActiveInput();
    window.requestAnimationFrame(() => {
      if (draftNote !== (set.note ?? "")) {
        onUpdate({
          ...set,
          note: draftNote,
        });
      }
      onDone();
    });
  }

  function deleteAfterBlur() {
    blurActiveInput();
    window.requestAnimationFrame(onDelete);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="text-[11px] leading-4 text-[#716b5d]">
        {setLabel} note
      </div>
      <textarea
        aria-label="Set note"
        autoFocus
        value={draftNote}
        className="min-h-20 w-full resize-none rounded-[4px] border border-[#d7cfbc] bg-[#fdfcf8] px-2 py-1 font-mono text-[16px] leading-5 text-[#17150f] outline-none focus:ring-1 focus:ring-[#a79b83]"
        onChange={(event) => setDraftNote(event.target.value)}
      />
      <NoteEditorActions onDone={doneAfterBlur}>
        {draftNote.trim() ? (
          <ConfirmableNoteDeleteAction
            deleteLabel="Delete set note"
            onDelete={deleteAfterBlur}
          />
        ) : (
          <ImmediateNoteDeleteAction
            deleteLabel="Delete set note"
            onDelete={deleteAfterBlur}
          />
        )}
      </NoteEditorActions>
    </div>
  );
}

export function SetRestKeyboard({
  set,
  restTypes,
  onDone,
  onUpdate,
}: {
  set: CurrentExerciseSet;
  restTypes: RestType[];
  onDone: () => void;
  onUpdate: (set: CurrentExerciseSet) => void;
}) {
  const selectedRestTypeId = getResolvedRestTypeId(set.restBefore, restTypes);

  return (
    <div
      className="grid h-[180px] w-full min-w-0 grid-rows-[1fr_auto] gap-1"
      style={{ touchAction: "manipulation" }}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <div className="text-[11px] leading-4 text-[#716b5d]">break time</div>
        <div className="grid min-w-0 grid-cols-2 gap-1">
          {FIXED_REST_CHOICES.map((restChoice) => {
            const selected = restChoice.id === selectedRestTypeId;

            return (
              <Button
                key={restChoice.id}
                type="button"
                variant="outline"
                aria-pressed={selected}
                className={cn(
                  "h-10 rounded-[4px] border-[#d7cfbc] bg-[#fdfcf8] px-2 font-mono text-[13px] font-normal text-[#373226] shadow-none hover:bg-[#eee8da]",
                  selected && "border-[#a79b83] bg-[#eee8da]",
                )}
                onClick={() =>
                  onUpdate({
                    ...set,
                    restBefore: restChoice.id,
                  })
                }
              >
                {restChoice.label}
              </Button>
            );
          })}
        </div>
      </div>
      <Button
        type="button"
        className="h-10 rounded-[4px] bg-[#373226] font-mono text-[12px] font-normal text-[#fdfcf8] shadow-none hover:bg-[#373226]/90"
        onClick={onDone}
      >
        done
      </Button>
    </div>
  );
}

function getResolvedRestTypeId(
  restTypeId: string | undefined,
  restTypes: RestType[],
) {
  if (restTypeId && restTypes.some((restType) => restType.id === restTypeId)) {
    return restTypeId;
  }

  return (
    restTypes.find((restType) => restType.isDefault)?.id ??
    restTypes[0]?.id ??
    "default"
  );
}
