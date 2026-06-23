"use client";

import { useEffect, useState } from "react";
import { PreviousWorkoutExercise } from "@/components/workout-reference/previous-workout-exercise";
import type { PlateSettings } from "@/components/workout-reference/weight_helper_dialog";
import { WorkoutHeader } from "@/components/workout/workout_header";
import type {
  CurrentExerciseSet,
  PreviousExercise,
} from "@/components/workout-reference/workout_reference_types";

const sampleHistory: PreviousExercise[] = [
  {
    relation: "last time",
    relativeDate: "5 days ago",
    date: "6/10",
    workoutNote: "Pull day felt low energy",
    workoutExerciseNote: "Feeling weak today",
    warmups: [{ weight: "BW", reps: [15], note: "Foot assist" }],
    workingSets: [
      { weight: "20 lb", reps: [13], note: "solid first set" },
      { weight: "20 lb", reps: [8], note: "failed clean on final rep" },
    ],
  },
  {
    relation: "2 times ago",
    relativeDate: "11 days ago",
    date: "6/4",
    warmups: [{ weight: "BW", reps: [15], note: "Foot assist" }],
    workingSets: [
      { weight: "20 lb", reps: [13] },
      { weight: "20 lb", reps: [9], note: "better second set" },
    ],
  },
  {
    relation: "3 times ago",
    relativeDate: "38 days ago",
    date: "5/8",
    exerciseNoteChanged: true,
    historicalExerciseNote: "Foot assist 15. Hold dumbbell in thighs.",
    warmups: [{ weight: "BW", reps: [15], note: "Foot assist" }],
    workingSets: [
      { weight: "10 lb", reps: [13] },
      { weight: "10 lb", reps: [10] },
    ],
  },
  {
    relation: "4 times ago",
    relativeDate: "52 days ago",
    date: "4/24",
    workoutExerciseNote: "Used short rest to finish the first set.",
    warmups: [
      { weight: "BW", reps: [12] },
      { weight: "BW", reps: [10] },
    ],
    workingSets: [
      { weight: "20 lb", reps: [6], note: "short rest continuation" },
      { weight: "20 lb", reps: [3], restBefore: "short" },
      { weight: "15 lb", reps: [8], restBefore: "short" },
      { weight: "20 lb", reps: [7], note: "weight came back up" },
    ],
  },
];

const sampleCurrentSets: CurrentExerciseSet[] = [
  {
    id: "mock-warmup-1",
    kind: "warmup",
    weightMode: "bodyweight",
    weightAmount: "",
    weightSign: 1,
    reps: "15",
    note: "Foot assist",
    completed: false,
  },
  {
    id: "mock-working-1",
    kind: "working",
    weightMode: "standard",
    weightAmount: "20",
    weightSign: 1,
    reps: "13",
    restBefore: "default",
    note: "first line note",
    completed: false,
  },
  {
    id: "mock-working-2",
    kind: "working",
    weightMode: "standard",
    weightAmount: "20",
    weightSign: 1,
    reps: "8",
    restBefore: "default",
    completed: false,
  },
  {
    id: "mock-working-3",
    kind: "working",
    weightMode: "standard",
    weightAmount: "20",
    weightSign: 1,
    reps: "8",
    restBefore: "default",
    note: "second line note",
    completed: false,
  },
  {
    id: "mock-working-4",
    kind: "working",
    weightMode: "standard",
    weightAmount: "20",
    weightSign: 1,
    reps: "8",
    restBefore: "default",
    completed: false,
  },
  {
    id: "mock-working-5",
    kind: "working",
    weightMode: "standard",
    weightAmount: "201",
    weightSign: 1,
    reps: "8",
    restBefore: "default",
    note: "heavy jump",
    completed: false,
  },
  {
    id: "mock-working-6",
    kind: "working",
    weightMode: "standard",
    weightAmount: "205",
    weightSign: 1,
    reps: "8",
    restBefore: "default",
    completed: false,
  },
  {
    id: "mock-working-7",
    kind: "working",
    weightMode: "standard",
    weightAmount: "20",
    weightSign: 1,
    reps: "8",
    restBefore: "default",
    note: "back-off set",
    completed: false,
  },
];

function noopSandboxAction() {
  return undefined;
}

export function PreviousWorkoutExerciseSandbox() {
  const [plateSettings, setPlateSettings] = useState<PlateSettings>({
    startingWeight: 0,
    loadMode: "total",
  });

  useEffect(() => {
    let metaViewport = document.querySelector('meta[name="viewport"]');
    const previousViewportContent =
      metaViewport?.getAttribute("content") ?? null;
    const createdViewport = !metaViewport;

    if (!metaViewport) {
      metaViewport = document.createElement("meta");
      metaViewport.setAttribute("name", "viewport");
      document.head.appendChild(metaViewport);
    }

    metaViewport.setAttribute(
      "content",
      "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no",
    );

    return () => {
      if (!metaViewport) return;

      if (createdViewport) {
        metaViewport.remove();
        return;
      }

      if (previousViewportContent === null) {
        metaViewport.removeAttribute("content");
      } else {
        metaViewport.setAttribute("content", previousViewportContent);
      }
    };
  }, []);

  return (
    <div className="select-none">
      <WorkoutBodyWeightSandbox />
      <PreviousWorkoutExercise
        exerciseName="Pull-ups"
        exerciseNote="Hold dumbbell in thighs"
        plateStartingWeight={plateSettings.startingWeight}
        plateLoadMode={plateSettings.loadMode}
        history={sampleHistory}
        initialCurrentSets={sampleCurrentSets}
        onPlateSettingsChange={setPlateSettings}
      />
    </div>
  );
}

function WorkoutBodyWeightSandbox() {
  const [bodyWeightLb, setBodyWeightLb] = useState<number | null>(null);
  const [workoutName, setWorkoutName] = useState("Pull day");
  const [isEditingName, setIsEditingName] = useState(false);
  const startTime = new Date("2026-06-19T09:00:00").getTime();

  return (
    <div className="mx-auto mb-5 w-full max-w-[390px] px-[14px] pt-4">
      <WorkoutHeader
        name={workoutName}
        startTime={startTime}
        completedAt={new Date(startTime + 45 * 60_000)}
        bodyWeightLb={bodyWeightLb}
        showBodyWeight
        editableName={workoutName}
        isEditingName={isEditingName}
        workoutNote=""
        showFinishAction={false}
        canUndo={false}
        canRedo={false}
        onStartTimeChange={noopSandboxAction}
        onBodyWeightChange={setBodyWeightLb}
        onCompletedAtChange={noopSandboxAction}
        onEditableNameChange={setWorkoutName}
        onStartEditingName={() => setIsEditingName(true)}
        onCancelEditingName={() => setIsEditingName(false)}
        onSaveName={() => setIsEditingName(false)}
        onEditWorkoutNote={noopSandboxAction}
        onFinishWorkout={noopSandboxAction}
      />
    </div>
  );
}
