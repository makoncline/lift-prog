"use client";

import { useParams } from "next/navigation";
import { WorkoutComponent } from "@/components/workout/workout";
import { P } from "@/components/ui/typography";
import { api } from "@/trpc/react";

export default function EditWorkoutPage() {
  const params = useParams<{ workoutId: string }>();
  const workoutId = Number(params.workoutId);
  const validWorkoutId = Number.isInteger(workoutId) && workoutId > 0;

  const workoutQuery = api.workout.getWorkoutDetails.useQuery(
    { workoutId },
    { enabled: validWorkoutId },
  );

  if (!validWorkoutId) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col p-3 font-mono">
        <P className="text-sm text-[#716b5d]">invalid workout id</P>
      </main>
    );
  }

  if (workoutQuery.isLoading) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col p-3 font-mono">
        <P className="text-sm text-[#716b5d]">loading workout...</P>
      </main>
    );
  }

  if (workoutQuery.isError || !workoutQuery.data) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-col p-3 font-mono">
        <P className="text-sm text-[#716b5d]">
          unable to load workout {workoutId}
        </P>
      </main>
    );
  }

  const workout = workoutQuery.data;

  return (
    <WorkoutComponent
      workoutId={workoutId}
      workoutName={workout.workoutName}
      exercises={workout.exercises}
      startTime={new Date(workout.startedAt).getTime()}
      completedAt={
        workout.completedAt ? new Date(workout.completedAt) : undefined
      }
      workoutNote={workout.notes ?? ""}
      contextLabel={`editing past workout #${workoutId}`}
      persistDraft={false}
    />
  );
}
