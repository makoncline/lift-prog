"use client";

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { WorkoutProvider } from "@/lib/workout-core/contexts/WorkoutContext";
import { WorkoutComponent } from "@/lib/workout-core/components/Workout";
import { H2, P } from "@/components/ui/typography";
import { Loader2 } from "lucide-react";
import { api } from "@/trpc/react";
import { initialiseExercises } from "@/lib/workoutLogic";

interface EditWorkoutPageProps {
  params: {
    id: string;
  };
}

function WorkoutEditor({ workoutId }: { workoutId: number }) {
  // Fetch the workout details for editing
  const workoutDetailsQuery = api.workout.getWorkoutDetails.useQuery(
    { workoutId },
    {
      staleTime: Infinity,
      refetchOnWindowFocus: false,
    },
  );

  if (workoutDetailsQuery.isLoading) {
    return <LoadingState message="Loading workout data..." />;
  }

  if (workoutDetailsQuery.isError) {
    return (
      <ErrorState
        message={`Error loading workout: ${workoutDetailsQuery.error.message}`}
      />
    );
  }

  if (!workoutDetailsQuery.data) {
    return notFound();
  }

  const { workoutName, exercises } = workoutDetailsQuery.data;

  // Create an initial state for the workout in edit mode
  const initialWorkout = {
    currentExerciseIndex: 0,
    exercises: initialiseExercises(exercises),
    activeField: { exerciseIndex: null, setIndex: null, field: null },
    inputValue: "",
    isFirstInteraction: true,
    notes: [],
  };

  return (
    <WorkoutProvider
      mode="edit"
      workoutName={`Edit: ${workoutName}`}
      initialWorkout={initialWorkout}
    >
      <WorkoutComponent workoutName={`Edit: ${workoutName}`} />
    </WorkoutProvider>
  );
}

export default function EditWorkoutPage({ params }: EditWorkoutPageProps) {
  const workoutId = parseInt(params.id, 10);

  if (isNaN(workoutId)) {
    return <ErrorState message="Invalid workout ID" />;
  }

  return (
    <div className="container mx-auto max-w-md p-2">
      <Suspense fallback={<LoadingState />}>
        <WorkoutEditor workoutId={workoutId} />
      </Suspense>
    </div>
  );
}

// --- Helper Components for Loading/Error States --- //

function LoadingState({
  message = "Loading Workout...",
}: {
  message?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center space-y-2 pt-10">
      <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      <H2>{message}</H2>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center pt-10">
      <P className="text-destructive">{message}</P>
    </div>
  );
}
