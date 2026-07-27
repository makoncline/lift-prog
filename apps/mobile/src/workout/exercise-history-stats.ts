import { estimate1RM, type WorkoutExercise } from "@lift-prog/workout-core";

import { formatNumber } from "./format";

type ExerciseHistoryEntry = NonNullable<WorkoutExercise["history"]>[number];

export type HistoryChartPoint = {
  xValue: number;
  value: number;
  displayValue: string;
  dateLabel: string;
};

type ParsedHistoryStats = {
  e1rm: number | null;
  bestSetVolume: number | null;
  volume: number | null;
  maxConsecutiveReps: number | null;
};

export type ExerciseDetailsChart = {
  key: string;
  title: string;
  points: HistoryChartPoint[];
};

export type ExerciseDetailsRecord = {
  label: string;
  value: string;
  detail?: string;
};

export function getChartPositions(
  points: HistoryChartPoint[],
  width: number,
  height: number,
) {
  if (points.length === 0) return [];
  const xValues = points.map((point) => point.xValue);
  const yValues = points.map((point) => point.value);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const xSpan = maxX - minX || 1;
  const ySpan = maxY - minY || 1;
  const xPadding = 20;
  const yPadding = 44;

  return points.map((point) => ({
    x: xPadding + ((point.xValue - minX) / xSpan) * (width - xPadding * 2),
    y: yPadding + (1 - (point.value - minY) / ySpan) * (height - yPadding - 8),
  }));
}

export function buildExerciseDetailsCharts(
  history: WorkoutExercise["history"],
): {
  chartCount: number;
  charts: ExerciseDetailsChart[];
} {
  if (!history || history.length === 0) {
    return { chartCount: 0, charts: [] };
  }

  const recentChronological = history
    .slice(0, 5)
    .map((entry) => ({ entry, stats: getHistoryWorkoutStats(entry) }))
    .reverse();
  const xValues = getHistoryChartXValues(
    recentChronological.map(({ entry }) => entry),
  );
  let currentPr: number | null = null;

  const e1rmPoints: HistoryChartPoint[] = [];
  const bestSetVolumePoints: HistoryChartPoint[] = [];
  const totalVolumePoints: HistoryChartPoint[] = [];
  const prPoints: HistoryChartPoint[] = [];
  const maxRepPoints: HistoryChartPoint[] = [];

  recentChronological.forEach(({ entry, stats }, index) => {
    const xValue = xValues[index] ?? index;
    if (stats.e1rm != null) {
      e1rmPoints.push(toHistoryChartPoint(stats.e1rm, xValue, entry.date));
      currentPr =
        currentPr == null ? stats.e1rm : Math.max(currentPr, stats.e1rm);
    }
    if (currentPr != null) {
      prPoints.push(toHistoryChartPoint(currentPr, xValue, entry.date));
    }
    if (stats.bestSetVolume != null) {
      bestSetVolumePoints.push(
        toHistoryChartPoint(stats.bestSetVolume, xValue, entry.date),
      );
    }
    if (stats.volume != null) {
      totalVolumePoints.push(
        toHistoryChartPoint(stats.volume, xValue, entry.date),
      );
    }
    if (stats.maxConsecutiveReps != null) {
      maxRepPoints.push(
        toHistoryChartPoint(
          stats.maxConsecutiveReps,
          xValue,
          entry.date,
          "reps",
        ),
      );
    }
  });

  return {
    chartCount: recentChronological.length,
    charts: [
      {
        key: "best-set-e1rm",
        title: "best set (est 1rm)",
        points: e1rmPoints,
      },
      {
        key: "best-set-volume",
        title: "best set (max volume)",
        points: bestSetVolumePoints,
      },
      {
        key: "total-volume",
        title: "total volume",
        points: totalVolumePoints,
      },
      {
        key: "pr-progression-e1rm",
        title: "PR progression (1rm)",
        points: prPoints,
      },
      {
        key: "max-consecutive-reps",
        title: "max consecutive reps",
        points: maxRepPoints,
      },
    ],
  };
}

export function buildExerciseDetailsRecords(
  history: WorkoutExercise["history"],
): ExerciseDetailsRecord[] {
  if (!history || history.length === 0) return [];

  const entries = history.map((entry) => ({
    entry,
    stats: getHistoryWorkoutStats(entry),
  }));
  const records: ExerciseDetailsRecord[] = [];

  const bestE1rm = getBestHistoryMetric(entries, (item) => item.stats.e1rm);
  if (bestE1rm) {
    records.push({
      label: "best set (est 1rm)",
      value: `${formatNumber(bestE1rm.value)}lb`,
      detail: `${bestE1rm.entry.relation} . ${bestE1rm.entry.date}`,
    });
  }

  const bestSetVolume = getBestHistoryMetric(
    entries,
    (item) => item.stats.bestSetVolume,
  );
  if (bestSetVolume) {
    records.push({
      label: "best set (max volume)",
      value: `${formatNumber(bestSetVolume.value)}lb`,
      detail: `${bestSetVolume.entry.relation} . ${bestSetVolume.entry.date}`,
    });
  }

  const bestTotalVolume = getBestHistoryMetric(
    entries,
    (item) => item.stats.volume,
  );
  if (bestTotalVolume) {
    records.push({
      label: "total volume",
      value: `${formatNumber(bestTotalVolume.value)}lb`,
      detail: `${bestTotalVolume.entry.relation} . ${bestTotalVolume.entry.date}`,
    });
  }

  const maxReps = getBestHistoryMetric(
    entries,
    (item) => item.stats.maxConsecutiveReps,
  );
  if (maxReps) {
    records.push({
      label: "max consecutive reps",
      value: formatNumber(maxReps.value),
      detail: `${maxReps.entry.relation} . ${maxReps.entry.date}`,
    });
  }

  return records;
}

function getBestHistoryMetric<T extends { entry: ExerciseHistoryEntry }>(
  entries: T[],
  selector: (entry: T) => number | null,
) {
  return entries.reduce<{
    entry: ExerciseHistoryEntry;
    value: number;
  } | null>((best, item) => {
    const value = selector(item);
    if (value == null || !Number.isFinite(value)) return best;
    if (!best || value > best.value) {
      return { entry: item.entry, value };
    }
    return best;
  }, null);
}

function toHistoryChartPoint(
  value: number,
  xValue: number,
  dateLabel: string,
  unit: "lb" | "reps" = "lb",
): HistoryChartPoint {
  return {
    dateLabel,
    xValue,
    value,
    displayValue:
      unit === "lb" ? `${formatNumber(value)}lb` : formatNumber(value),
  };
}

function getHistoryChartXValues(
  history: NonNullable<WorkoutExercise["history"]>,
) {
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

function getHistoryWorkoutStats(
  entry: ExerciseHistoryEntry,
): ParsedHistoryStats {
  let bestE1rm: number | null = null;
  let bestSetVolume: number | null = null;
  let maxConsecutiveReps: number | null = null;
  let volume = 0;

  for (const set of entry.sets) {
    if (set.modifier === "warmup") continue;

    const weight = getHistorySetLoad(entry, set);
    const reps = Number(set.reps);
    if (weight == null || !Number.isFinite(reps) || reps <= 0) continue;

    maxConsecutiveReps =
      maxConsecutiveReps == null ? reps : Math.max(maxConsecutiveReps, reps);

    if (weight > 0) {
      const setVolume = weight * reps;
      volume += setVolume;
      bestSetVolume =
        bestSetVolume == null ? setVolume : Math.max(bestSetVolume, setVolume);
    }

    const e1rm = weight > 0 ? estimate1RM(weight, reps) : null;
    if (e1rm != null && (bestE1rm == null || e1rm > bestE1rm)) {
      bestE1rm = e1rm;
    }
  }

  return {
    e1rm: bestE1rm,
    bestSetVolume,
    volume: volume > 0 ? volume : null,
    maxConsecutiveReps,
  };
}

export function getHistorySetLoad(
  entry: ExerciseHistoryEntry,
  set: ExerciseHistoryEntry["sets"][number],
) {
  if (set.weightModifier === "bodyweight") {
    const offset = set.weight ?? 0;
    return entry.bodyWeightLb == null ? offset : entry.bodyWeightLb + offset;
  }
  return set.weight;
}
