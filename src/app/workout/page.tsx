"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getWorkoutTemplateById } from "@/data/workout-templates";
import WorkoutComponent from "@/components/Workout"; // Use updated component name
import { H2, P } from "@/components/ui/typography";
import { api } from "@/trpc/react"; // Import tRPC api
import { Loader2 } from "lucide-react"; // Import loader icon

// Component to handle loading logic based on query params
function WorkoutInitializer() {
  const searchParams = useSearchParams();
  const templateId = searchParams.get("templateId");
  const basedOnWorkoutIdStr = searchParams.get("basedOn");
  const basedOnWorkoutId = basedOnWorkoutIdStr
    ? parseInt(basedOnWorkoutIdStr, 10)
    : null;

  // Fetch details if starting based on a previous workout
  const workoutDetailsQuery = api.workout.getWorkoutDetails.useQuery(
    { workoutId: basedOnWorkoutId! }, // Pass the ID
    {
      enabled: !!basedOnWorkoutId, // Only run query if basedOnWorkoutId is valid
      staleTime: Infinity, // Data is historical, no need to refetch often
      refetchOnWindowFocus: false,
    },
  );

  // --- Render Logic --- //

  // Case 1: Start based on previous workout
  if (basedOnWorkoutId) {
    if (workoutDetailsQuery.isLoading) {
      return <LoadingState message="Loading previous workout data..." />;
    }
    if (workoutDetailsQuery.isError) {
      return (
        <ErrorState
          message={`Error loading workout details: ${workoutDetailsQuery.error.message}`}
        />
      );
    }
    if (workoutDetailsQuery.data) {
      // Use fetched data
      return (
        <WorkoutComponent
          workoutName={`Continuing: ${workoutDetailsQuery.data.workoutName}`}
          exercises={workoutDetailsQuery.data.exercises}
        />
      );
    }
    // Should not happen if query is enabled and finishes without error/data
    return <ErrorState message="Failed to load workout details." />;
  }

  // Case 2: Start based on template
  if (templateId) {
    const template = getWorkoutTemplateById(templateId);
    if (template) {
      return (
        <WorkoutComponent
          workoutName={template.name}
          exercises={template.exercises}
        />
      );
    } else {
      return <ErrorState message="Workout template not found." />;
    }
  }

  // Case 3: No valid parameters
  return (
    <ErrorState message="No workout template or previous workout specified." />
  );
}

export default function WorkoutPage() {
  return (
    <div className="container mx-auto max-w-md p-2">
      <Suspense fallback={<LoadingState />}>
        <WorkoutInitializer />
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
      {/* Optionally add a button to go back */}
    </div>
  );
}
