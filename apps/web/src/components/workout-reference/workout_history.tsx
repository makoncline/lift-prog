"use client";

import type { ReactNode } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type {
  ExerciseSet,
  PreviousExercise,
} from "@/components/workout-reference/workout_reference_types";
import {
  getTimelineNoteMarker,
  NoteBadge,
  SetNote,
  TimelineFootnoteMarker,
  TimelineFootnoteRef,
} from "@/components/workout-reference/timeline_notes";

export function HistoryDisclosure({
  expanded,
  children,
}: {
  expanded: boolean;
  children: ReactNode;
}) {
  if (!expanded) return null;
  return (
    <section className="relative mt-1 rounded-[4px] border border-[#ebe4d6] px-1 py-1 text-[#696457]">
      <div className="relative overflow-hidden">{children}</div>
    </section>
  );
}

export function HistoryViewport({ history }: { history: PreviousExercise[] }) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLElement | null>>([]);
  const scrollEndTimeoutRef = useRef<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeHeight, setActiveHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const activeItem = itemRefs.current[activeIndex];
    if (!activeItem) return;
    setActiveHeight(Math.ceil(activeItem.getBoundingClientRect().height));
  }, [activeIndex, history]);

  useEffect(() => {
    return () => {
      if (scrollEndTimeoutRef.current !== null) {
        window.clearTimeout(scrollEndTimeoutRef.current);
      }
    };
  }, []);

  function handleScroll() {
    const scrollNode = viewportRef.current;
    if (!scrollNode) return;

    if (scrollEndTimeoutRef.current !== null) {
      window.clearTimeout(scrollEndTimeoutRef.current);
    }

    scrollEndTimeoutRef.current = window.setTimeout(() => {
      scrollEndTimeoutRef.current = null;
      const width = scrollNode.clientWidth;
      if (!width) return;
      setActiveIndex(
        Math.min(
          history.length - 1,
          Math.max(0, Math.round(scrollNode.scrollLeft / width)),
        ),
      );
    }, 80);
  }

  return (
    <div
      ref={viewportRef}
      className="flex snap-x snap-mandatory items-start overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label="Previous workouts"
      style={activeHeight == null ? undefined : { height: activeHeight }}
      onScroll={handleScroll}
    >
      {history.map((item, index) => (
        <HistoryItem
          key={`${item.relation}-${item.date}`}
          item={item}
          refCallback={(node) => {
            itemRefs.current[index] = node;
          }}
        />
      ))}
    </div>
  );
}

function HistoryItem({
  item,
  refCallback,
}: {
  item: PreviousExercise;
  refCallback?: (node: HTMLElement | null) => void;
}) {
  return (
    <article
      ref={refCallback}
      className="flex min-w-full snap-start flex-col gap-1.5 pr-1 text-[13px] leading-4"
    >
      <div className="flex flex-col gap-0.5">
        <HistoryMeta item={item} />
        <HistoryNotes item={item} />
      </div>

      <HistorySetList item={item} />
    </article>
  );
}

function HistoryMeta({ item }: { item: PreviousExercise }) {
  const parts = [item.relation, item.relativeDate, item.date].filter(Boolean);

  return (
    <p className="text-[12px] leading-4 text-[#716b5d]">
      {parts.join(" · ")}
    </p>
  );
}

function HistoryNotes({ item }: { item: PreviousExercise }) {
  return (
    <div className="flex flex-col gap-0.5">
      {item.exerciseNoteChanged ? (
        <details className="group text-[11px] leading-4 text-[#827a68]">
          <summary className="cursor-pointer list-none">note changed</summary>
          <div className="mt-0.5">
            <NoteBadge>{item.historicalExerciseNote}</NoteBadge>
          </div>
        </details>
      ) : null}

      {item.workoutNote ? (
        <NoteBadge tone="muted">{item.workoutNote}</NoteBadge>
      ) : null}

      {item.workoutExerciseNote ? (
        <NoteBadge>{item.workoutExerciseNote}</NoteBadge>
      ) : null}
    </div>
  );
}

function HistorySetList({ item }: { item: PreviousExercise }) {
  return (
    <div className="flex flex-col gap-1.5">
      {item.warmups.length > 0 ? (
        <ReadOnlyTimelineSetGroup heading="warm-up" sets={item.warmups} />
      ) : null}
      {item.workingSets.length > 0 ? (
        <ReadOnlyTimelineSetGroup
          heading="working sets"
          sets={item.workingSets}
        />
      ) : null}
    </div>
  );
}

function ReadOnlyTimelineSetGroup({
  heading,
  sets,
}: {
  heading: string;
  sets: ExerciseSet[];
}) {
  return (
    <div className="flex flex-col gap-px">
      <HistoryTimelineSetHeading>{heading}</HistoryTimelineSetHeading>
      <ReadOnlyTimelineSetLine sets={sets} />
    </div>
  );
}

function HistoryTimelineSetHeading({ children }: { children: ReactNode }) {
  return (
    <div className="text-[10px] leading-3 text-[#8a8373] lowercase">
      {children}
    </div>
  );
}

function ReadOnlyTimelineSetLine({ sets }: { sets: ExerciseSet[] }) {
  if (sets.length === 0) return null;

  return (
    <div className="relative w-full pb-1">
      <div className="flex flex-wrap items-baseline gap-x-0 gap-y-0.5">
        {sets.map((set, index) => {
          const previousSet = sets[index - 1];
          const showWeight = index === 0 || previousSet?.weight !== set.weight;

          return (
            <span key={`${set.weight}-${index}`} className="inline-flex">
              {index > 0 ? (
                <span>{isShortBreak(set.restBefore) ? "+" : ","}</span>
              ) : null}
              {showWeight ? (
                <span>{formatCompactHistoryWeight(set.weight)}×</span>
              ) : null}
              <span>
                {formatRepParts(set.reps)}
                {set.note ? (
                  <TimelineFootnoteRef>
                    {getTimelineNoteMarker(sets, index)}
                  </TimelineFootnoteRef>
                ) : null}
              </span>
            </span>
          );
        })}
      </div>
      <ReadOnlyTimelineSetNoteLane sets={sets} />
    </div>
  );
}

function ReadOnlyTimelineSetNoteLane({ sets }: { sets: ExerciseSet[] }) {
  if (!sets.some((set) => set.note)) return null;

  return (
    <div className="relative z-10 mt-px flex w-full flex-col gap-0.5 text-[11px]">
      {sets.map((set, index) =>
        set.note ? (
          <SetNote
            key={`${set.weight}-${index}-timeline-note`}
            refCallback={() => undefined}
            marker={
              <TimelineFootnoteMarker>
                {getTimelineNoteMarker(sets, index)}
              </TimelineFootnoteMarker>
            }
            fullWidth
          >
            {set.note}
          </SetNote>
        ) : null,
      )}
    </div>
  );
}

function formatRepParts(reps: Array<number | string>) {
  return reps.join("+");
}

function formatCompactHistoryWeight(weight: string) {
  return weight.replace(/\s+lb\b/g, "lb");
}

function isShortBreak(restBefore: string | undefined) {
  return restBefore === "short";
}
