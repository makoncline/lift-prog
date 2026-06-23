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
    <div className="flex flex-col gap-3">
      <div className="text-[18px] leading-6 text-[#7a7468]">
        {setLabel} note
      </div>
      <textarea
        aria-label="Set note"
        autoFocus
        value={draftNote}
        className="min-h-[150px] w-full resize-none rounded-[7px] border border-[#d7cab8] bg-[#fffefa] px-[9px] py-[9px] font-mono text-[20px] leading-7 text-[#1f1c17] outline-none focus:ring-1 focus:ring-[#383225]"
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
      className="grid h-[265px] w-full min-w-0 grid-rows-[1fr_auto] gap-[7px]"
      style={{ touchAction: "manipulation" }}
    >
      <div className="flex min-w-0 flex-col gap-[7px]">
        <div className="text-[18px] leading-6 text-[#7a7468]">break time</div>
        <div className="grid min-w-0 grid-cols-2 gap-[7px]">
          {FIXED_REST_CHOICES.map((restChoice) => {
            const selected = restChoice.id === selectedRestTypeId;

            return (
              <Button
                key={restChoice.id}
                type="button"
                variant="outline"
                aria-pressed={selected}
                className={cn(
                  "h-[58px] rounded-[7px] border-[#d7cab8] bg-[#fffefa] px-2 font-mono text-[22px] font-normal text-[#1f1c17] shadow-none hover:bg-[#eee9df]",
                  selected && "bg-[#eee9df] ring-1 ring-[#383225]",
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
        className="h-[58px] rounded-[7px] bg-[#383225] font-mono text-[22px] font-normal text-[#fffefa] shadow-none hover:bg-[#383225]/90"
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
