"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  CurrentExerciseSet,
  EditorField,
  RestType,
} from "@/components/workout-reference/workout_reference_types";
import {
  formatCompactCurrentWeight,
  formatCurrentReps,
  formatCurrentWeight,
  getCurrentSetLabel,
  isCompoundRest,
} from "@/components/workout-reference/set_formatting";

type SetReadoutPreview = {
  label: string;
  weight: string;
  reps: string;
  kind: CurrentExerciseSet["kind"];
};

export function SetEditorReadout({
  exerciseName,
  set,
  sets,
  restTypes,
  setLabel,
  field,
  onFieldChange,
  onEditNote,
  onDelete,
  onAddSet,
  onSelectSet,
  onToggleWarmup,
}: {
  exerciseName: string;
  set: CurrentExerciseSet;
  sets: CurrentExerciseSet[];
  restTypes: RestType[];
  setLabel: string;
  field: EditorField;
  onFieldChange: (field: EditorField) => void;
  onEditNote: () => void;
  onDelete: () => void;
  onAddSet: () => void;
  onSelectSet: (setId: string) => void;
  onToggleWarmup: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollEndTimeoutRef = useRef<number | null>(null);
  const programmaticScrollRef = useRef(false);
  const selectedByScrollRef = useRef(false);
  const activeIndex = Math.max(
    0,
    sets.findIndex((candidateSet) => candidateSet.id === set.id),
  );
  const summaryActiveField = field === "note" ? "reps" : field;
  const editingNote = field === "note";

  useEffect(() => {
    return () => {
      if (scrollEndTimeoutRef.current !== null) {
        window.clearTimeout(scrollEndTimeoutRef.current);
      }
    };
  }, []);

  useLayoutEffect(() => {
    const scrollNode = scrollRef.current;
    if (!scrollNode || editingNote) return;

    if (selectedByScrollRef.current) {
      selectedByScrollRef.current = false;
      return;
    }

    programmaticScrollRef.current = true;
    scrollNode.scrollLeft = activeIndex * scrollNode.clientWidth;

    window.requestAnimationFrame(() => {
      programmaticScrollRef.current = false;
    });
  }, [activeIndex, editingNote]);

  function handleScroll() {
    const scrollNode = scrollRef.current;
    if (programmaticScrollRef.current) return;
    if (!scrollNode) return;

    if (scrollEndTimeoutRef.current !== null) {
      window.clearTimeout(scrollEndTimeoutRef.current);
    }

    scrollEndTimeoutRef.current = window.setTimeout(() => {
      scrollEndTimeoutRef.current = null;
      const width = scrollNode.clientWidth;
      if (!width) return;

      const nextIndex = Math.min(
        sets.length - 1,
        Math.max(0, Math.round(scrollNode.scrollLeft / width)),
      );
      const nextSet = sets[nextIndex];
      if (nextSet && nextSet.id !== set.id) {
        selectedByScrollRef.current = true;
        onSelectSet(nextSet.id);
      }
    }, 120);
  }

  return (
    <div
      role="group"
      aria-label="Swipe between sets"
      className="w-full min-w-0 pb-1"
    >
      <div className="mb-0.5 truncate text-[11px] leading-4 text-[#716b5d]">
        {exerciseName}
      </div>
      <SetEditorSummaryLine
        sets={sets}
        activeSetId={set.id}
        activeField={summaryActiveField}
        restTypes={restTypes}
        onAddSet={editingNote ? undefined : onAddSet}
        onEdit={(setId, nextField) => {
          onSelectSet(setId);
          onFieldChange(nextField);
        }}
      />
      {editingNote ? null : (
        <div
          ref={scrollRef}
          className="flex h-[47px] w-full min-w-0 snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none" }}
          onScroll={handleScroll}
        >
          {sets.map((readoutSet) => {
            const isActive = readoutSet.id === set.id;
            const label = isActive
              ? setLabel
              : getCurrentSetLabel(sets, readoutSet.id, restTypes);
            const preview: SetReadoutPreview = {
              label,
              weight: formatCurrentWeight(readoutSet),
              reps: formatCurrentReps(readoutSet),
              kind: readoutSet.kind,
            };

            return (
              <div
                key={readoutSet.id}
                className="min-w-0 flex-[0_0_100%] snap-center snap-always"
              >
                <SetEditorReadoutPanel
                  preview={preview}
                  field={field}
                  interactive={isActive}
                  noteLabel={
                    readoutSet.note
                      ? `Edit ${label} note`
                      : `Add ${label} note`
                  }
                  deleteLabel={`Delete ${label}`}
                  className={cn(!isActive && "opacity-55")}
                  onFieldChange={onFieldChange}
                  onEditNote={onEditNote}
                  onDelete={onDelete}
                  onToggleWarmup={onToggleWarmup}
                />
              </div>
            );
          })}
          {sets.length === 0 ? (
            <SetEditorReadoutPanel
              preview={{
                label: setLabel,
                weight: formatCurrentWeight(set),
                reps: formatCurrentReps(set),
                kind: set.kind,
              }}
              field={field}
              interactive
              noteLabel={
                set.note ? `Edit ${setLabel} note` : `Add ${setLabel} note`
              }
              deleteLabel={`Delete ${setLabel}`}
              onFieldChange={onFieldChange}
              onEditNote={onEditNote}
              onDelete={onDelete}
              onToggleWarmup={onToggleWarmup}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

function SetEditorSummaryLine({
  sets,
  activeSetId,
  activeField,
  restTypes,
  onAddSet,
  onEdit,
}: {
  sets: CurrentExerciseSet[];
  activeSetId: string;
  activeField: EditorField;
  restTypes: RestType[];
  onAddSet?: () => void;
  onEdit: (setId: string, field: EditorField) => void;
}) {
  return (
    <div className={cn("relative mb-1 min-w-0", onAddSet && "pr-8")}>
      <div className="flex min-h-6 min-w-0 flex-wrap items-baseline gap-x-0 gap-y-1 text-[13px] leading-5 text-[#696457]">
        {sets.map((set, index) => {
          const previousSet = sets[index - 1];
          const sameKindAsPrevious = previousSet?.kind === set.kind;
          const weight = formatCompactCurrentWeight(set);
          const previousWeight = previousSet
            ? formatCompactCurrentWeight(previousSet)
            : "";
          const showWeight =
            index === 0 || !sameKindAsPrevious || previousWeight !== weight;
          const active = set.id === activeSetId;
          const separatorIsActive = active && activeField === "rest";
          const isCompound =
            sameKindAsPrevious && isCompoundRest(set.restBefore, restTypes);

          return (
            <span key={set.id} className="inline-flex items-baseline gap-0">
              {index > 0 ? (
                <button
                  type="button"
                  aria-label={`Edit rest before ${formatCurrentReps(set)}`}
                  className={cn(
                    "inline-flex min-w-3 justify-center rounded-[3px] border border-[#ebe4d6] text-[#817a69] hover:bg-[#eee8da]",
                    separatorIsActive &&
                      "bg-[#eee8da] text-[#17150f] outline outline-1 outline-offset-1 outline-[#a79b83]",
                  )}
                  onClick={() => onEdit(set.id, "rest")}
                >
                  {isCompound ? "+" : ","}
                </button>
              ) : null}
              {index === 0 && set.kind === "warmup" ? (
                <span className="rounded-[3px] px-0.5">W</span>
              ) : null}
              {showWeight ? (
                <>
                  <button
                    type="button"
                    aria-label={`Edit ${formatCurrentWeight(set)} weight`}
                    className={cn(
                      "rounded-[3px] border border-[#ebe4d6] px-0.5 hover:bg-[#eee8da]",
                      active &&
                        activeField === "weight" &&
                        "bg-[#eee8da] text-[#17150f] outline outline-1 outline-offset-1 outline-[#a79b83]",
                    )}
                    onClick={() => onEdit(set.id, "weight")}
                  >
                    {weight}
                  </button>
                  <span>×</span>
                </>
              ) : null}
              <button
                type="button"
                aria-label={`Edit ${formatCurrentReps(set)} reps`}
                className={cn(
                  "rounded-[3px] border border-[#ebe4d6] px-0.5 hover:bg-[#eee8da]",
                  active &&
                    activeField === "reps" &&
                    "bg-[#eee8da] text-[#17150f] outline outline-1 outline-offset-1 outline-[#a79b83]",
                )}
                onClick={() => onEdit(set.id, "reps")}
              >
                {formatCurrentReps(set)}
              </button>
            </span>
          );
        })}
      </div>
      {onAddSet ? (
        <button
          type="button"
          aria-label="Add set"
          className="absolute top-0 right-0 flex size-6 items-center justify-center rounded-[4px] border border-[#d7cfbc] text-[#817a69] hover:bg-[#eee8da]"
          onClick={onAddSet}
        >
          <Plus className="size-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

function SetEditorReadoutPanel({
  preview,
  field,
  interactive,
  noteLabel,
  deleteLabel,
  className,
  onFieldChange,
  onEditNote,
  onDelete,
  onToggleWarmup,
}: {
  preview: SetReadoutPreview;
  field: EditorField;
  interactive: boolean;
  noteLabel?: string;
  deleteLabel?: string;
  className?: string;
  onFieldChange?: (field: EditorField) => void;
  onEditNote?: () => void;
  onDelete?: () => void;
  onToggleWarmup?: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <div className={cn("w-full min-w-0", className)}>
      <div className="pb-0.5 text-[11px] leading-4 text-[#716b5d]">
        {preview.label}
      </div>
      <div className="flex min-w-0 items-center justify-between gap-2 text-[16px] leading-6">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
          <button
            type="button"
            aria-label="toggle warmup"
            disabled={!interactive}
            className={cn(
              "flex size-6 items-center justify-center rounded-[4px] border border-[#d7cfbc] text-[11px] leading-none text-[#5b5445]",
              preview.kind === "warmup" && "bg-[#e7e0d0] font-semibold",
              !interactive && "pointer-events-none",
            )}
            onClick={onToggleWarmup}
          >
            W
          </button>
          <button
            type="button"
            disabled={!interactive}
            className={cn(
              "min-w-0 truncate rounded-[4px] border border-[#ebe4d6] px-1 text-left",
              field === "weight" && interactive && "bg-[#eee8da]",
              !interactive && "pointer-events-none",
            )}
            onClick={() => onFieldChange?.("weight")}
          >
            {preview.weight}
          </button>
          <span className="text-[#8a8374]">×</span>
          <button
            type="button"
            disabled={!interactive}
            className={cn(
              "min-w-0 truncate rounded-[4px] border border-[#ebe4d6] px-1 text-left",
              field === "reps" && interactive && "bg-[#eee8da]",
              !interactive && "pointer-events-none",
            )}
            onClick={() => onFieldChange?.("reps")}
          >
            {preview.reps}
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {confirmingDelete ? (
            <>
              <button
                type="button"
                disabled={!interactive}
                className={cn(
                  "flex h-6 items-center justify-center rounded-[4px] border border-[#d7cfbc] px-1.5 text-[11px] leading-none text-[#817a69] hover:bg-[#eee8da]",
                  !interactive && "pointer-events-none",
                )}
                onClick={() => setConfirmingDelete(false)}
              >
                cancel
              </button>
              <button
                type="button"
                aria-label={`Confirm ${deleteLabel}`}
                disabled={!interactive}
                className={cn(
                  "flex h-6 items-center justify-center rounded-[4px] border border-[#d7cfbc] bg-[#5f2018] px-1.5 text-[11px] leading-none text-[#fdfcf8] hover:bg-[#5f2018]/90",
                  !interactive && "pointer-events-none",
                )}
                onClick={onDelete}
              >
                delete
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                aria-label={noteLabel}
                disabled={!interactive}
                className={cn(
                  "flex size-6 items-center justify-center rounded-[4px] border border-[#d7cfbc] text-[#817a69] hover:bg-[#eee8da]",
                  !interactive && "pointer-events-none",
                )}
                onClick={onEditNote}
              >
                <Pencil className="size-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={deleteLabel}
                disabled={!interactive}
                className={cn(
                  "flex size-6 items-center justify-center rounded-[4px] border border-[#d7cfbc] text-[#817a69] hover:bg-[#eee8da]",
                  !interactive && "pointer-events-none",
                )}
                onClick={() => setConfirmingDelete(true)}
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
