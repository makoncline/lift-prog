"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getWorkoutTemplateById } from "@/data/workout-templates";
import { WorkoutComponent } from "@/components/workout/workout";
import { H2, P } from "@/components/ui/typography";
import { api } from "@/trpc/react"; // Import tRPC api
import { Loader2 } from "lucide-react"; // Import loader icon
// Using direct string literal until module import is resolved
import { LOCAL_STORAGE_WORKOUT_KEY } from "@/lib/constants";

// Component to handle loading logic based on query params
function WorkoutInitializer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get("templateId");
  const basedOnWorkoutIdStr = searchParams.get("basedOn");
  const basedOnWorkoutId = basedOnWorkoutIdStr
    ? parseInt(basedOnWorkoutIdStr, 10)
    : null;

  // Track active states
  const [hasInProgressStorage, setHasInProgressStorage] = useState<
    boolean | null
  >(null);
  const [storageCheckComplete, setStorageCheckComplete] = useState(false);

  // Track if parameters exist but should be maintained for this render
  const [keepParams, setKeepParams] = useState(true);

  // Ref to track if we've saved to localStorage
  const hasInitializedRef = useRef(false);

  // A function we'll pass to WorkoutComponent to signal when
  // its initial state has been saved to localStorage
  const onInitialSave = () => {
    // Mark that state is now initialized
    hasInitializedRef.current = true;

    // Allow URL clearing on next check
    setKeepParams(false);
  };

  // Clear URL params after initialization is complete
  useEffect(() => {
    // Only clear if:
    // 1. We have params (templateId or basedOnWorkoutId)
    // 2. We're not keeping params anymore
    // 3. hasInitializedRef is true (meaning WorkoutComponent saved state)
    if (
      (templateId || basedOnWorkoutId) &&
      !keepParams &&
      hasInitializedRef.current
    ) {
      // Use setTimeout to avoid navigation during rendering
      setTimeout(() => {
        router.replace("/workout");
      }, 300); // Increased from 100ms to 300ms to ensure localStorage save completes
    }
  }, [templateId, basedOnWorkoutId, keepParams, router]);

  // Clear any in-progress workout if we're starting fresh with params
  useEffect(() => {
    // If we have templateId or basedOnWorkoutId, we're starting a new workout
    // Clear any existing workout from localStorage
    if ((templateId || basedOnWorkoutId) && typeof window !== "undefined") {
      localStorage.removeItem(LOCAL_STORAGE_WORKOUT_KEY);
      setHasInProgressStorage(false);
    }
  }, [templateId, basedOnWorkoutId]);

  // Check localStorage for existing workout
  useEffect(() => {
    // Only check localStorage if we're NOT starting with params
    if (!templateId && !basedOnWorkoutId && typeof window !== "undefined") {
      const storedItem = localStorage.getItem(LOCAL_STORAGE_WORKOUT_KEY);
      const itemExists = storedItem != null;

      setHasInProgressStorage(itemExists);
    }

    setStorageCheckComplete(true);
  }, [templateId, basedOnWorkoutId]);

  // Fetch details if starting based on a previous workout
  const workoutDetailsQuery = api.workout.getWorkoutDetails.useQuery(
    { workoutId: basedOnWorkoutId! },
    {
      enabled: !!basedOnWorkoutId,
      staleTime: Infinity,
      refetchOnWindowFocus: false,
    },
  );

  // --- Render Logic --- //

  // Case 1: Start based on previous workout (Highest priority if ID is present)
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
      return (
        <WorkoutComponent
          workoutName={workoutDetailsQuery.data.workoutName}
          exercises={workoutDetailsQuery.data.exercises}
          onInitialSave={onInitialSave}
        />
      );
    }
    return <ErrorState message="Failed to load workout details." />;
  }

  // Case 2: Start based on template (Second priority if ID is present)
  if (templateId) {
    const template = getWorkoutTemplateById(templateId);
    if (template) {
      return (
        <WorkoutComponent
          workoutName={template.name}
          exercises={template.exercises}
          onInitialSave={onInitialSave}
        />
      );
    } else {
      return <ErrorState message="Workout template not found." />;
    }
  }

  // Case 3: No specific instructions (templateId or basedOnWorkoutId)
  // We must wait for the storage check to complete before deciding further.
  if (!storageCheckComplete) {
    return <LoadingState message="Checking for in-progress workout..." />;
  }

  // Case 4: Storage check is complete, no specific IDs were provided.
  // Now decide based on whether storage item exists.
  if (hasInProgressStorage === true) {
    return (
      <div className="container mx-auto max-w-md p-2">
        <WorkoutComponent autoRestore />
      </div>
    );
  } else if (hasInProgressStorage === false) {
    return (
      <ErrorState message="No workout template, previous workout specified, or in-progress workout found." />
    );
  } else {
    return <LoadingState message="Verifying workout status..." />;
  }
}

export default function WorkoutPage() {
  // Add useEffect for viewport meta tag
  useEffect(() => {
    // Create or update the viewport meta tag
    let metaViewport = document.querySelector('meta[name="viewport"]');

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
      // Optional cleanup if needed
    };
  }, []);

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
