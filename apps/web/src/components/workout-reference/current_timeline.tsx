"use client";

import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  CurrentExerciseSet,
  EditorField,
  RestType,
} from "@/components/workout-reference/workout_reference_types";
import {
  getTimelineNoteMarker,
  NoteBadge,
  SetNote,
  TimelineFootnoteMarker,
  TimelineFootnoteRef,
} from "@/components/workout-reference/timeline_notes";
import {
  currentSetNumber,
  formatCompactCurrentWeight,
  formatCurrentReps,
  isCompoundRest,
} from "@/components/workout-reference/set_formatting";

export function CurrentExerciseHeader({
  note,
  onEditNote,
}: {
  note: string;
  onEditNote: () => void;
}) {
  if (!note.trim()) return null;

  return (
    <div className="mb-1 flex flex-col gap-0.5">
      <button
        type="button"
        className="w-fit max-w-full text-left"
        onClick={onEditNote}
      >
        <NoteBadge className="max-w-full">{note}</NoteBadge>
      </button>
    </div>
  );
}

export function TimelineSetHeading({ children }: { children: ReactNode }) {
  return (
    <div className="font-mono text-[10px] leading-3 text-[#8a8373]">
      {children}
    </div>
  );
}

export function TimelineSetLine({
  sets,
  allSets,
  restTypes,
  onEdit,
  onEditNote,
  onCycleRest,
  onAddSet,
}: {
  sets: CurrentExerciseSet[];
  allSets: CurrentExerciseSet[];
  restTypes: RestType[];
  onEdit: (setId: string, field: EditorField) => void;
  onEditNote: (setId: string) => void;
  onCycleRest: (setId: string) => void;
  onAddSet?: () => void;
}) {
  if (sets.length === 0) return null;

  return (
    <div className="relative w-full pb-1">
      <div className="relative">
        <div
          className={cn(
            "flex flex-wrap items-baseline gap-x-0 gap-y-0.5",
            onAddSet && "pr-7",
          )}
        >
          {sets.map((set, index) => {
            const previousSet = sets[index - 1];
            const weight = formatCompactCurrentWeight(set);
            const previousWeight = previousSet
              ? formatCompactCurrentWeight(previousSet)
              : "";
            const showWeight = index === 0 || previousWeight !== weight;
            const setIndex = allSets.findIndex((item) => item.id === set.id);
            const setNumber = currentSetNumber(allSets, setIndex, restTypes);
            const setName =
              set.kind === "warmup"
                ? `warmup set ${setNumber}`
                : `set ${setNumber}`;

            return (
              <span key={set.id} className="inline-flex items-baseline gap-0">
                {index > 0 ? (
                  <TimelineRestToken
                    set={set}
                    setName={setName}
                    restTypes={restTypes}
                    onCycle={() => onCycleRest(set.id)}
                  />
                ) : null}
                {showWeight ? (
                  <>
                    <button
                      type="button"
                      aria-label={`Edit ${setName} weight`}
                      className="rounded-[3px] border border-[#ebe4d6] px-0.5 hover:bg-[#eee8da]"
                      onClick={() => onEdit(set.id, "weight")}
                    >
                      {weight}
                    </button>
                    <span>×</span>
                  </>
                ) : null}
                <button
                  type="button"
                  aria-label={`Edit ${setName} reps`}
                  className="relative inline-flex items-baseline rounded-[3px] border border-[#ebe4d6] px-0.5 hover:bg-[#eee8da]"
                  onClick={() => onEdit(set.id, "reps")}
                >
                  {formatCurrentReps(set)}
                  {set.note ? (
                    <TimelineFootnoteRef>
                      {getTimelineNoteMarker(sets, index)}
                    </TimelineFootnoteRef>
                  ) : null}
                </button>
              </span>
            );
          })}
        </div>
        {onAddSet ? (
          <button
            type="button"
            aria-label="Add set"
            className="absolute top-0 right-0 inline-flex size-6 items-center justify-center rounded-[4px] border border-[#ebe4d6] text-[#817a69] hover:bg-[#eee8da]"
            onClick={onAddSet}
          >
            <Plus className="size-3.5" aria-hidden="true" />
          </button>
        ) : null}
        <TimelineSetNoteLane sets={sets} onEditNote={onEditNote} />
      </div>
    </div>
  );
}

function TimelineSetNoteLane({
  sets,
  onEditNote,
}: {
  sets: CurrentExerciseSet[];
  onEditNote: (setId: string) => void;
}) {
  if (!sets.some((set) => set.note)) return null;

  return (
    <div className="relative z-10 mt-px flex w-full flex-col gap-0.5 text-[11px]">
      {sets.map((set, index) =>
        set.note ? (
          <SetNote
            key={`${set.id}-timeline-note`}
            refCallback={() => undefined}
            marker={
              <TimelineFootnoteMarker>
                {getTimelineNoteMarker(sets, index)}
              </TimelineFootnoteMarker>
            }
            fullWidth
            onClick={() => onEditNote(set.id)}
          >
            {set.note}
          </SetNote>
        ) : null,
      )}
    </div>
  );
}

function TimelineRestToken({
  set,
  setName,
  restTypes,
  onCycle,
}: {
  set: CurrentExerciseSet;
  setName: string;
  restTypes: RestType[];
  onCycle: () => void;
}) {
  const compound = isCompoundRest(set.restBefore, restTypes);
  const label = compound ? "short" : "standard";

  return (
    <button
      type="button"
      aria-label={`Change rest before ${setName}`}
      title={label}
      className={cn(
        "inline-flex min-w-3 justify-center rounded-[3px] border border-[#ebe4d6] text-[#716b5d] hover:bg-[#eee8da]",
        compound && "font-semibold text-[#373226]",
      )}
      onClick={onCycle}
    >
      {compound ? "+" : ","}
    </button>
  );
}
