import { useState } from "react";
import type { CompletedWorkout } from "@lift-prog/workout-core";

function formatTime(date: Date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatDate(date: Date) {
  return date.toISOString().split("T")[0]!;
}

function calculateDurationMinutes(startTime: string, endTime: string) {
  if (!startTime || !endTime) return null;

  const [startHours = 0, startMinutes = 0] = startTime.split(":").map(Number);
  const [endHours = 0, endMinutes = 0] = endTime.split(":").map(Number);
  const startTotalMinutes = startHours * 60 + startMinutes;
  const endTotalMinutes = endHours * 60 + endMinutes;
  let durationMinutes = endTotalMinutes - startTotalMinutes;
  if (durationMinutes < 0) durationMinutes += 24 * 60;

  return Math.max(1, durationMinutes);
}

function calculateStartTime(endTime: string, duration: string) {
  if (!duration || !endTime) return null;

  const durationMinutes = parseInt(duration, 10);
  if (Number.isNaN(durationMinutes) || durationMinutes < 1) return null;

  const [endHours = 0, endMinutes = 0] = endTime.split(":").map(Number);
  const endTotalMinutes = endHours * 60 + endMinutes;
  let startTotalMinutes = endTotalMinutes - durationMinutes;
  if (startTotalMinutes < 0) startTotalMinutes += 24 * 60;

  const startHours = Math.floor(startTotalMinutes / 60) % 24;
  const startMinutes = startTotalMinutes % 60;
  return `${String(startHours).padStart(2, "0")}:${String(startMinutes).padStart(2, "0")}`;
}

function getCompletionDate(date: string, endTime: string) {
  let completionDate = new Date();
  if (!date) return completionDate;

  const dateComponents = date.split("-").map((n: string) => parseInt(n, 10));
  const timeComponents = endTime.split(":").map((n: string) => parseInt(n, 10));
  const year = dateComponents[0] ?? completionDate.getFullYear();
  const month = dateComponents[1] ?? 1;
  const day = dateComponents[2] ?? 1;
  const hours = timeComponents[0] ?? 0;
  const minutes = timeComponents[1] ?? 0;

  completionDate = new Date(year, month - 1, day, hours, minutes);
  return completionDate;
}

export function useWorkoutFinishDialog() {
  const [open, setOpen] = useState(false);
  const [finishedWorkout, setFinishedWorkout] =
    useState<CompletedWorkout | null>(null);
  const [date, setDate] = useState("");
  const [startTime, setStartTimeState] = useState("");
  const [endTime, setEndTimeState] = useState("");
  const [duration, setDurationState] = useState("");

  function reset() {
    setOpen(false);
    setFinishedWorkout(null);
    setDate("");
    setStartTimeState("");
    setEndTimeState("");
    setDurationState("");
  }

  function openForWorkout(startTimeMs: number) {
    const now = new Date();
    const workoutStart = new Date(startTimeMs);
    const durationInSeconds = Math.floor((Date.now() - startTimeMs) / 1000);
    const durationInMinutes = Math.max(1, Math.round(durationInSeconds / 60));

    setDate(formatDate(now));
    setEndTimeState(formatTime(now));
    setStartTimeState(formatTime(workoutStart));
    setDurationState(durationInMinutes.toString());
    setOpen(true);
  }

  function setStartTime(nextStartTime: string) {
    setStartTimeState(nextStartTime);
    const nextDuration = calculateDurationMinutes(nextStartTime, endTime);
    if (nextDuration !== null) setDurationState(nextDuration.toString());
  }

  function setEndTime(nextEndTime: string) {
    setEndTimeState(nextEndTime);
    const nextDuration = calculateDurationMinutes(startTime, nextEndTime);
    if (nextDuration !== null) setDurationState(nextDuration.toString());
  }

  function setDuration(nextDuration: string) {
    setDurationState(nextDuration);
    const nextStartTime = calculateStartTime(endTime, nextDuration);
    if (nextStartTime) setStartTimeState(nextStartTime);
  }

  function setEndTimeToNow() {
    const nowTime = formatTime(new Date());
    setEndTimeState(nowTime);
    const nextDuration = calculateDurationMinutes(startTime, nowTime);
    if (nextDuration !== null) setDurationState(nextDuration.toString());
  }

  function getCompletedAt() {
    return getCompletionDate(date, endTime);
  }

  function getDurationInSeconds(fallbackStartTimeMs: number) {
    return duration
      ? parseInt(duration, 10) * 60
      : Math.floor((Date.now() - fallbackStartTimeMs) / 1000);
  }

  function handleOpenChange(nextOpen: boolean, isLocked: boolean) {
    if (!nextOpen && !isLocked) {
      reset();
      return;
    }

    setOpen(nextOpen);
  }

  return {
    open,
    finishedWorkout,
    date,
    startTime,
    endTime,
    duration,
    setDate,
    setStartTime,
    setEndTime,
    setDuration,
    setEndTimeToNow,
    openForWorkout,
    handleOpenChange,
    setFinishedWorkout,
    getCompletedAt,
    getDurationInSeconds,
    reset,
  };
}
