export type TimeEditTarget =
  | "start-date"
  | "start-time"
  | "end-date"
  | "end-time"
  | "end-duration"
  | "finish-end-date"
  | "finish-end-time"
  | "finish-duration";

export type ClockTimeEditTarget = Exclude<
  TimeEditTarget,
  "end-duration" | "finish-duration"
>;

export type DurationEditTarget = Extract<
  TimeEditTarget,
  "end-duration" | "finish-duration"
>;

export function formatWorkoutStartDate(date: Date) {
  return date
    .toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    .toLowerCase();
}

export function formatTitleDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatElapsedClock(startedAt: Date, endedAt: Date) {
  const seconds = Math.max(
    0,
    Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000),
  );
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}`;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function formatAdjustDateTime(date: Date, now: Date) {
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const time = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  if (sameDay) return `Today, ${time}`;
  const day = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return `${day}, ${time}`;
}

export function defaultCompletedAtForStartTime(startTime: number) {
  const startDate = new Date(startTime);
  const now = new Date();
  const completedAt = mergeTimePart(startDate, now);
  const minimumCompletedAt = startTime + 60_000;
  return new Date(Math.max(minimumCompletedAt, completedAt.getTime()));
}

export function completedAtForDuration(
  startTime: number,
  durationMinutes: number,
) {
  const safeMinutes = Math.max(1, Math.trunc(durationMinutes));
  return new Date(startTime + safeMinutes * 60_000);
}

export function durationMinutesBetween(startTime: number, completedAt: Date) {
  return Math.max(1, Math.round((completedAt.getTime() - startTime) / 60_000));
}

export function isDurationEditTarget(
  target: TimeEditTarget | null,
): target is DurationEditTarget {
  return target === "end-duration" || target === "finish-duration";
}

export function mergeDatePart(startDate: Date, selectedDate: Date) {
  const nextDate = new Date(startDate);
  nextDate.setFullYear(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    selectedDate.getDate(),
  );
  return nextDate;
}

export function mergeTimePart(startDate: Date, selectedDate: Date) {
  const nextDate = new Date(startDate);
  nextDate.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
  return nextDate;
}
