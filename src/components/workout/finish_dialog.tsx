"use client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import type {
  CompletedExercise,
  CompletedSet,
  CompletedWorkout,
} from "@/lib/schemas/workout-schema";

export function FinishDialog({
  open,
  isSaving,
  workout,
  onOpenChange,
  onBack,
  onSave,
}: {
  open: boolean;
  isSaving: boolean;
  workout: CompletedWorkout | null;
  onOpenChange: (open: boolean) => void;
  onBack: () => void;
  onSave: () => void;
}) {
  const summary = workout ? getWorkoutPreviewSummary(workout) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[84dvh] w-[calc(100vw-20px)] max-w-[390px] gap-2 overflow-hidden rounded-[4px] border-[#d7cfbc] bg-[#fdfcf8] p-3 font-mono text-[#17150f] shadow-none sm:max-w-[390px]"
        onOpenAutoFocus={(e) => e.preventDefault()}
        data-testid="finish-workout-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-baseline gap-x-2 text-left text-[18px] leading-6">
            <span>{workout?.name ?? "Workout"}</span>
            {summary ? (
              <span className="text-[11px] font-normal leading-4 text-[#716b5d]">
                {formatCount(summary.exerciseCount, "exercise")} ·{" "}
                {formatCount(summary.workingSetCount, "set")}
              </span>
            ) : null}
          </DialogTitle>
          <DialogDescription className="text-left font-mono text-[12px] leading-4 text-[#716b5d]">
            {workout ? formatWorkoutTimeRange(workout) : "Review workout"}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto py-1 text-[13px] leading-5">
          {workout ? <WorkoutPreview workout={workout} /> : null}
        </div>

        <div className="grid grid-cols-[auto_1fr] gap-1 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            disabled={isSaving}
            className="h-8 rounded-[4px] border-[#d7cfbc] bg-[#fdfcf8] px-3 font-mono text-[12px] font-normal text-[#373226] shadow-none"
            data-testid="back-from-finish-workout"
          >
            go back
          </Button>
          <Button
            type="button"
            onClick={onSave}
            disabled={isSaving || !workout}
            className="h-8 rounded-[4px] bg-[#373226] font-mono text-[12px] font-normal text-[#fdfcf8] shadow-none hover:bg-[#373226]/90"
            data-testid="save-finished-workout"
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            save workout
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WorkoutPreview({ workout }: { workout: CompletedWorkout }) {
  const exercises = getPreviewExercises(workout);

  if (exercises.length === 0) {
    return <p className="text-[#716b5d]">No exercises logged.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {exercises.map((exercise) => (
        <ExercisePreview
          key={`${exercise.order}-${exercise.name}`}
          exercise={exercise}
        />
      ))}
    </div>
  );
}

function ExercisePreview({ exercise }: { exercise: CompletedExercise }) {
  const completedSets = exercise.sets.filter(
    (set) => set.weight != null && set.reps != null,
  );
  const workingSetCount = countWorkingSets(exercise);
  const warmupLine = formatSetLine(
    completedSets.filter((set) => set.modifier === "warmup"),
  );
  const workingLine = formatSetLine(
    completedSets.filter((set) => set.modifier !== "warmup"),
  );

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-2 font-semibold text-[#17150f]">
        <span>{exercise.name}</span>
        <span className="text-[11px] font-normal leading-4 text-[#716b5d]">
          {formatCount(workingSetCount, "set")}
        </span>
      </div>
      {warmupLine ? (
        <div className="text-[#716b5d]">
          <span className="text-[11px]">warm-up</span>{" "}
          <span>{warmupLine}</span>
        </div>
      ) : null}
      {workingLine ? <div>{workingLine}</div> : null}
    </div>
  );
}

function getWorkoutPreviewSummary(workout: CompletedWorkout) {
  const exercises = getPreviewExercises(workout);

  return {
    exerciseCount: exercises.length,
    workingSetCount: exercises.reduce(
      (total, exercise) => total + countWorkingSets(exercise),
      0,
    ),
  };
}

function getPreviewExercises(workout: CompletedWorkout) {
  return workout.exercises.filter((exercise) =>
    exercise.sets.some((set) => set.weight != null && set.reps != null),
  );
}

function countWorkingSets(exercise: CompletedExercise) {
  let count = 0;

  for (const set of exercise.sets) {
    if (set.modifier === "warmup" || set.weight == null || set.reps == null) {
      continue;
    }

    if (count === 0 || set.restBefore !== "short") {
      count += 1;
    }
  }

  return count;
}

function formatCount(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function formatSetLine(sets: CompletedSet[]) {
  const parts: string[] = [];
  let previousWeightKey: string | null = null;

  for (const set of sets) {
    if (set.weight == null || set.reps == null) continue;

    const weight = formatWeight(set);
    const weightKey = `${set.weightModifier ?? "standard"}:${set.weight}`;
    const sameWeight = previousWeightKey === weightKey;

    if (parts.length === 0) {
      parts.push(`${weight}×${set.reps}`);
    } else if (set.restBefore === "short") {
      parts[parts.length - 1] += sameWeight
        ? `+${set.reps}`
        : `+${weight}×${set.reps}`;
    } else {
      parts.push(sameWeight ? `${set.reps}` : `${weight}×${set.reps}`);
    }

    previousWeightKey = weightKey;
  }

  return parts.join(",");
}

function formatWeight(set: CompletedSet) {
  if (set.weightModifier === "bodyweight") {
    if (set.weight == null || Math.abs(set.weight) < 1e-6) return "BW";

    const sign = set.weight > 0 ? "+" : "-";
    return `BW${sign}${formatNumber(Math.abs(set.weight))}lb`;
  }

  return `${formatNumber(set.weight ?? 0)}lb`;
}

function formatNumber(value: number) {
  const rounded = Number(value.toFixed(2));
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function formatWorkoutTimeRange(workout: CompletedWorkout) {
  return `${formatDate(workout.startedAt)} ${formatTime(
    workout.startedAt,
  )} - ${formatTime(workout.completedAt)} (${formatDuration(
    workout.startedAt,
    workout.completedAt,
  )})`;
}

function formatDate(date: Date) {
  return date
    .toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    .toLowerCase();
}

function formatTime(date: Date) {
  return date
    .toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    })
    .toLowerCase()
    .replace(/\s/g, "");
}

function formatDuration(startedAt: Date, completedAt: Date) {
  const minutes = Math.max(
    1,
    Math.round((completedAt.getTime() - startedAt.getTime()) / 60_000),
  );
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes === 0
    ? `${hours}h`
    : `${hours}h ${remainingMinutes}m`;
}
