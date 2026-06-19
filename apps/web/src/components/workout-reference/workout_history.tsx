"use client";

import type { ReactNode } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { estimate1RM } from "@lift-prog/workout-core";

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
  const stats = useMemo(() => buildHistoryStats(history), [history]);
  const initialIndex = stats ? 1 : 0;
  const itemCount = history.length + (stats ? 1 : 0);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [activeHeight, setActiveHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    setActiveIndex(initialIndex);
    const scrollNode = viewportRef.current;
    if (!scrollNode) return;
    scrollNode.scrollLeft = scrollNode.clientWidth * initialIndex;
  }, [initialIndex, history]);

  useLayoutEffect(() => {
    const activeItem = itemRefs.current[activeIndex];
    if (!activeItem) return;
    setActiveHeight(Math.ceil(activeItem.getBoundingClientRect().height));
  }, [activeIndex, history, stats]);

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
          itemCount - 1,
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
      {stats ? (
        <HistoryStatsItem
          stats={stats}
          refCallback={(node) => {
            itemRefs.current[0] = node;
          }}
        />
      ) : null}
      {history.map((item, index) => (
        <HistoryItem
          key={`${item.relation}-${item.date}`}
          item={item}
          refCallback={(node) => {
            itemRefs.current[index + (stats ? 1 : 0)] = node;
          }}
        />
      ))}
    </div>
  );
}

type HistoryStats = {
  count: number;
  primaryLabel: string;
  primaryTrend: string;
  volumeTrend: string;
  bestSet: string;
  frequency: string;
  sparkline: number[];
};

function HistoryStatsItem({
  stats,
  refCallback,
}: {
  stats: HistoryStats;
  refCallback?: (node: HTMLElement | null) => void;
}) {
  return (
    <article
      ref={refCallback}
      className="flex min-w-full snap-start flex-col gap-1 pr-1 text-[12px] leading-4"
    >
      <p className="text-[12px] leading-4 text-[#716b5d]">
        stats · {stats.count} workouts
      </p>
      <MiniSparkline values={stats.sparkline} />
      <div className="grid gap-0.5">
        <StatsLine label={stats.primaryLabel} value={stats.primaryTrend} />
        <StatsLine label="best" value={stats.bestSet} />
        <StatsLine label="volume" value={stats.volumeTrend} />
        <StatsLine label="seen" value={stats.frequency} />
      </div>
    </article>
  );
}

function StatsLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[4.5rem_1fr] gap-1">
      <span className="text-[#8a8373]">{label}</span>
      <span className="text-[#17150f]">{value}</span>
    </div>
  );
}

function MiniSparkline({ values }: { values: number[] }) {
  if (values.length < 2) {
    return <div className="h-6 text-[11px] text-[#8a8373]">more data soon</div>;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 160;
  const height = 24;
  const points = values
    .map((value, index) => {
      const x = values.length === 1 ? 0 : (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 4) - 2;
      return `${roundSvgPoint(x)},${roundSvgPoint(y)}`;
    })
    .join(" ");

  return (
    <svg
      aria-hidden="true"
      className="h-6 w-full overflow-visible"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      <polyline
        points={points}
        fill="none"
        stroke="#a79b83"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
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
    <p className="text-[12px] leading-4 text-[#716b5d]">{parts.join(" · ")}</p>
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

type ParsedWorkoutStats = {
  e1rm: number | null;
  volume: number | null;
  bestSet: string | null;
  bestSetScore: number;
};

function buildHistoryStats(history: PreviousExercise[]): HistoryStats | null {
  if (history.length === 0) return null;

  const chronological = history
    .map((item) => ({ item, stats: getWorkoutStats(item) }))
    .reverse();
  const e1rmPoints = chronological
    .map((entry) => entry.stats.e1rm)
    .filter((value): value is number => value != null);
  const volumePoints = chronological
    .map((entry) => entry.stats.volume)
    .filter((value): value is number => value != null);
  const sparkline = e1rmPoints.length >= 2 ? e1rmPoints : volumePoints;
  const bestEntry = chronological.reduce<ParsedWorkoutStats | null>(
    (best, entry) => {
      if (!best || entry.stats.bestSetScore > best.bestSetScore) {
        return entry.stats;
      }
      return best;
    },
    null,
  );

  return {
    count: history.length,
    primaryLabel: e1rmPoints.length >= 2 ? "e1rm" : "load",
    primaryTrend:
      e1rmPoints.length >= 2
        ? formatStatTrend(e1rmPoints, "lb")
        : formatFallbackLoadTrend(chronological),
    volumeTrend:
      volumePoints.length >= 2 ? formatStatTrend(volumePoints, "lb") : "n/a",
    bestSet: bestEntry?.bestSet ?? "n/a",
    frequency: formatFrequency(history),
    sparkline,
  };
}

function getWorkoutStats(item: PreviousExercise): ParsedWorkoutStats {
  let bestSet: string | null = null;
  let bestSetScore = Number.NEGATIVE_INFINITY;
  let bestE1rm: number | null = null;
  let volume = 0;

  for (const set of item.workingSets) {
    const weight = parseHistoryWeight(set.weight);
    const reps = set.reps
      .map((rep) => Number(rep))
      .filter((rep) => Number.isFinite(rep) && rep > 0);
    if (weight == null || reps.length === 0) continue;

    const repTotal = reps.reduce((sum, rep) => sum + rep, 0);
    if (weight > 0) {
      volume += weight * repTotal;
    }

    for (const rep of reps) {
      const e1rm = weight > 0 ? estimate1RM(weight, rep) : null;
      const score = e1rm ?? weight;
      if (e1rm != null && (bestE1rm == null || e1rm > bestE1rm)) {
        bestE1rm = e1rm;
      }
      if (score > bestSetScore) {
        bestSetScore = score;
        bestSet = `${formatStatNumber(weight)}lb×${formatStatNumber(rep)}`;
      }
    }
  }

  return {
    e1rm: bestE1rm,
    volume: volume > 0 ? volume : null,
    bestSet,
    bestSetScore,
  };
}

function parseHistoryWeight(weight: string) {
  const compact = weight.replace(/\s+/g, "");
  if (compact === "BW") return 0;

  const bodyweightMatch = /^BW([+-]\d+(?:\.\d+)?)lb?$/i.exec(compact);
  if (bodyweightMatch?.[1]) return Number(bodyweightMatch[1]);

  const numberMatch = /-?\d+(?:\.\d+)?/.exec(compact);
  return numberMatch ? Number(numberMatch[0]) : null;
}

function formatStatTrend(values: number[], unit: string) {
  const first = values[0]!;
  const latest = values[values.length - 1]!;
  const percent = first === 0 ? 0 : ((latest - first) / Math.abs(first)) * 100;
  return `${formatStatNumber(first)}${unit} -> ${formatStatNumber(
    latest,
  )}${unit} · ${formatSignedPercent(percent)}`;
}

function formatFallbackLoadTrend(
  chronological: Array<{ item: PreviousExercise; stats: ParsedWorkoutStats }>,
) {
  const bestLoads = chronological
    .map((entry) =>
      Math.max(
        ...entry.item.workingSets
          .map((set) => parseHistoryWeight(set.weight))
          .filter((weight): weight is number => weight != null),
      ),
    )
    .filter((weight) => Number.isFinite(weight));

  if (bestLoads.length >= 2) return formatStatTrend(bestLoads, "lb");
  if (bestLoads.length === 1) return `${formatStatNumber(bestLoads[0]!)}lb`;
  return "n/a";
}

function formatFrequency(history: PreviousExercise[]) {
  const oldest = history[history.length - 1];
  if (!oldest?.relativeDate) return `${history.length} times`;
  return `${history.length} times · since ${oldest.relativeDate}`;
}

function formatSignedPercent(value: number) {
  const rounded = Math.round(value);
  if (rounded === 0) return "same";
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

function formatStatNumber(value: number) {
  const rounded = Number(value.toFixed(1));
  return Number.isInteger(rounded)
    ? rounded.toLocaleString()
    : rounded.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function roundSvgPoint(value: number) {
  return Number(value.toFixed(2));
}
