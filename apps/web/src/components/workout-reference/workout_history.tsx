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
import {
  ChartContainer,
  type ChartConfig,
} from "@/components/ui/chart";
import { estimate1RM } from "@lift-prog/workout-core";
import { LabelList, Line, LineChart, XAxis, YAxis } from "recharts";

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
  chartCount: number;
  e1rmPoints: HistoryChartPoint[];
  volumePoints: HistoryChartPoint[];
  bestSet: string;
};

type HistoryChartPoint = {
  label: string;
  xValue: number;
  value: number;
  displayValue: string;
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
      className="flex min-w-full snap-start flex-col gap-1.5 pr-1 text-[12px] leading-4"
    >
      <p className="text-[12px] leading-4 text-[#716b5d]">
        stats · last {stats.chartCount}{" "}
        {stats.chartCount === 1 ? "workout" : "workouts"}
      </p>
      <HistoryTinyChart title="expected 1rm" points={stats.e1rmPoints} />
      <HistoryTinyChart title="volume" points={stats.volumePoints} />
      <div className="grid gap-0.5">
        <StatsLine label="best set" value={stats.bestSet} />
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

const historyChartConfig = {
  value: {
    label: "pounds",
    color: "#a79b83",
  },
} satisfies ChartConfig;

function HistoryTinyChart({
  title,
  points,
}: {
  title: string;
  points: HistoryChartPoint[];
}) {
  return (
    <div className="flex flex-col gap-px">
      <p className="text-[10px] leading-3 text-[#8a8373] lowercase">{title}</p>
      {points.length > 0 ? (
        <ChartContainer
          config={historyChartConfig}
          className="h-12 w-full aspect-auto text-[10px]"
          aria-label={`${title}: ${points
            .map((point) => point.displayValue)
            .join(", ")}`}
        >
          <LineChart
            data={points}
            margin={{ top: 18, right: 14, bottom: 2, left: 14 }}
          >
            <XAxis
              dataKey="xValue"
              type="number"
              hide
              domain={getChartXDomain(points)}
            />
            <YAxis hide domain={getChartDomain(points)} />
            <Line
              dataKey="value"
              type="monotone"
              stroke="var(--color-value)"
              strokeWidth={1.5}
              dot={{
                r: 2.5,
                strokeWidth: 0,
                fill: "var(--color-value)",
              }}
              activeDot={false}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="displayValue"
                position="top"
                offset={4}
                fill="#716b5d"
                fontSize={10}
              />
            </Line>
          </LineChart>
        </ChartContainer>
      ) : (
        <div className="h-12 text-[11px] leading-4 text-[#8a8373]">
          more data soon
        </div>
      )}
    </div>
  );
}

function getChartDomain(points: HistoryChartPoint[]) {
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    const padding = Math.max(1, min * 0.1);
    return [Math.max(0, min - padding), max + padding];
  }

  const padding = (max - min) * 0.2;
  return [Math.max(0, min - padding), max + padding];
}

function getChartXDomain(points: HistoryChartPoint[]) {
  const values = points.map((point) => point.xValue);
  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) return [min - 1, max + 1];

  const padding = Math.max(1, (max - min) * 0.04);
  return [min - padding, max + padding];
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

  const recentChronological = history
    .slice(0, 5)
    .map((item) => ({ item, stats: getWorkoutStats(item) }))
    .reverse();
  const recentChartXValues = getHistoryChartXValues(
    recentChronological.map((entry) => entry.item),
  );
  const allChronological = history
    .map((item) => ({ item, stats: getWorkoutStats(item) }))
    .reverse();
  const e1rmPoints = recentChronological.flatMap((entry, index) =>
    entry.stats.e1rm == null
      ? []
      : [toHistoryChartPoint(entry, index, recentChartXValues, entry.stats.e1rm)],
  );
  const volumePoints = recentChronological.flatMap((entry, index) =>
    entry.stats.volume == null
      ? []
      : [
          toHistoryChartPoint(
            entry,
            index,
            recentChartXValues,
            entry.stats.volume,
          ),
        ],
  );
  const bestEntry = allChronological.reduce<ParsedWorkoutStats | null>(
    (best, entry) => {
      if (!best || entry.stats.bestSetScore > best.bestSetScore) {
        return entry.stats;
      }
      return best;
    },
    null,
  );

  return {
    chartCount: recentChronological.length,
    e1rmPoints,
    volumePoints,
    bestSet: bestEntry?.bestSet ?? "n/a",
  };
}

function toHistoryChartPoint(
  entry: { item: PreviousExercise; stats: ParsedWorkoutStats },
  index: number,
  xValues: number[],
  value: number,
): HistoryChartPoint {
  return {
    label: entry.item.date || entry.item.relation || `${index + 1}`,
    xValue: xValues[index] ?? index,
    value,
    displayValue: `${formatStatNumber(value)}lb`,
  };
}

function getHistoryChartXValues(history: PreviousExercise[]) {
  const daysAgoValues = history.map((item) =>
    parseHistoryRelativeDaysAgo(item.relativeDate),
  );

  if (
    daysAgoValues.every((value): value is number => value != null) &&
    new Set(daysAgoValues).size > 1
  ) {
    const oldestDaysAgo = Math.max(...daysAgoValues);
    return daysAgoValues.map((daysAgo) => oldestDaysAgo - daysAgo);
  }

  return history.map((_, index) => index);
}

function parseHistoryRelativeDaysAgo(relativeDate: string) {
  const normalized = relativeDate.trim().toLowerCase();
  if (normalized === "today") return 0;
  if (normalized === "yesterday") return 1;

  const match = /^(\d+)\s+(day|week|month|year)s?\s+ago$/.exec(normalized);
  if (!match) return null;

  const value = Number(match[1]);
  const unit = match[2];
  if (!Number.isFinite(value)) return null;

  if (unit === "day") return value;
  if (unit === "week") return value * 7;
  if (unit === "month") return value * 30;
  if (unit === "year") return value * 365;
  return null;
}

function getWorkoutStats(item: PreviousExercise): ParsedWorkoutStats {
  let bestSet: string | null = null;
  let bestSetScore = Number.NEGATIVE_INFINITY;
  let bestE1rm: number | null = null;
  let volume = 0;

  for (const set of item.workingSets) {
    const weight = parseHistoryWeight(set.weight, item.bodyWeightLb);
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

function parseHistoryWeight(weight: string, bodyWeightLb?: number | null) {
  const compact = weight.replace(/\s+/g, "");
  if (compact === "BW") return bodyWeightLb ?? 0;

  const bodyweightMatch = /^BW([+-]\d+(?:\.\d+)?)lb?$/i.exec(compact);
  if (bodyweightMatch?.[1]) {
    const offset = Number(bodyweightMatch[1]);
    return bodyWeightLb == null ? offset : bodyWeightLb + offset;
  }

  const numberMatch = /-?\d+(?:\.\d+)?/.exec(compact);
  return numberMatch ? Number(numberMatch[0]) : null;
}

function formatStatNumber(value: number) {
  const rounded = Number(value.toFixed(1));
  return Number.isInteger(rounded)
    ? rounded.toLocaleString()
    : rounded.toLocaleString(undefined, { maximumFractionDigits: 1 });
}
