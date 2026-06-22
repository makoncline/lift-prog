"use client";

import { Suspense, useState, useEffect, useLayoutEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { WorkoutComponent } from "@/components/workout/workout";
import { ClientErrorBoundary } from "@/components/error-boundary/app_error_boundary";
import { H2, P } from "@/components/ui/typography";
import { api } from "@/trpc/react"; // Import tRPC api
import type { RouterInputs } from "@/trpc/react";
import { Loader2 } from "lucide-react"; // Import loader icon
import {
  getWorkoutTemplateById,
  LOCAL_STORAGE_WORKOUT_KEY,
} from "@lift-prog/workout-core";

// Component to handle loading logic based on query params
function WorkoutInitializer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get("templateId");
  const customExercisesParam = searchParams.get("customExercises");
  const copyFromWorkoutId = parseWorkoutId(searchParams.get("copyFrom"));
  const basedOnWorkoutIdStr = searchParams.get("basedOn");
  const basedOnWorkoutId = parseWorkoutId(basedOnWorkoutIdStr);
  const sourceWorkoutId = copyFromWorkoutId ?? basedOnWorkoutId;
  const hasStartParams = Boolean(templateId) || sourceWorkoutId != null;

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
    // 1. We have start params
    // 2. We're not keeping params anymore
    // 3. hasInitializedRef is true (meaning WorkoutComponent saved state)
    if (hasStartParams && !keepParams && hasInitializedRef.current) {
      // Use setTimeout to avoid navigation during rendering
      setTimeout(() => {
        router.replace("/workout");
      }, 300); // Increased from 100ms to 300ms to ensure localStorage save completes
    }
  }, [hasStartParams, keepParams, router]);

  // Clear any in-progress workout if we're starting fresh with params
  useLayoutEffect(() => {
    // If we have start params, we're starting a new workout.
    // Clear any existing workout from localStorage
    if (hasStartParams && typeof window !== "undefined") {
      localStorage.removeItem(LOCAL_STORAGE_WORKOUT_KEY);
      setHasInProgressStorage(false);
    }
  }, [hasStartParams]);

  // Check localStorage for existing workout
  useEffect(() => {
    // Only check localStorage if we're NOT starting with params
    if (!hasStartParams && typeof window !== "undefined") {
      const storedItem = localStorage.getItem(LOCAL_STORAGE_WORKOUT_KEY);
      const itemExists = storedItem != null;

      setHasInProgressStorage(itemExists);
    }

    setStorageCheckComplete(true);
  }, [hasStartParams]);

  // Fetch details if starting based on a previous workout
  // --- Render Logic --- //

  // Case 1: Start based on previous workout (Highest priority if ID is present)
  if (sourceWorkoutId) {
    return (
      <WorkoutLoader
        input={{ mode: "workoutReference", workoutId: sourceWorkoutId }}
        loadingMessage={
          copyFromWorkoutId ? "Copying workout..." : "Loading previous workout..."
        }
        errorPrefix="Error loading workout details"
        onInitialSave={onInitialSave}
      />
    );
  }

  // Case 2: Start based on template (Second priority if ID is present)
  if (templateId) {
    if (templateId === "custom") {
      if (!customExercisesParam) {
        return <ErrorState message="Select at least one exercise to start." />;
      }
      let exerciseNames: unknown = [];
      try {
        exerciseNames = JSON.parse(decodeURIComponent(customExercisesParam));
      } catch (error) {
        console.error("Failed to parse custom exercises", error);
        return (
          <ErrorState message="Unable to load selected exercises." />
        );
      }

      if (!Array.isArray(exerciseNames) || exerciseNames.length === 0) {
        return <ErrorState message="Select at least one exercise to start." />;
      }

      const normalizedNames = Array.from(
        new Set(
          exerciseNames
            .map((name) =>
              typeof name === "string" ? name.trim() : String(name ?? ""),
            )
            .filter((name) => name.length > 0),
        ),
      );

      if (normalizedNames.length === 0) {
        return <ErrorState message="Select at least one exercise to start." />;
      }

      return (
        <WorkoutLoader
          input={{
            mode: "exerciseList",
            workoutName: "Custom Workout",
            exerciseNames: normalizedNames,
          }}
          loadingMessage="Preparing workout..."
          errorPrefix="Error preparing workout"
          onInitialSave={onInitialSave}
        />
      );
    }

    const template = getWorkoutTemplateById(templateId);
    if (template) {
      return (
        <WorkoutLoader
          input={{
            mode: "exerciseList",
            workoutName: template.name,
            exerciseNames: template.exercises.map((ex) => ex.name),
          }}
          loadingMessage="Preparing workout..."
          errorPrefix="Error preparing workout"
          onInitialSave={onInitialSave}
        />
      );
    }

    return <ErrorState message="Workout template not found." />;
  }

  // Case 3: No specific start instructions
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

type PrepareInitialWorkoutInput = RouterInputs["workout"]["prepareInitialWorkout"];

function parseWorkoutId(value: string | null) {
  if (!value) return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function WorkoutLoader({
  input,
  loadingMessage,
  errorPrefix,
  onInitialSave,
}: {
  input: PrepareInitialWorkoutInput;
  loadingMessage: string;
  errorPrefix: string;
  onInitialSave?: () => void;
}) {
  const prepareWorkoutQuery = api.workout.prepareInitialWorkout.useQuery(input, {
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  if (prepareWorkoutQuery.isLoading) {
    return <LoadingState message={loadingMessage} />;
  }

  if (prepareWorkoutQuery.isError) {
    return (
      <ErrorState
        message={`${errorPrefix}: ${prepareWorkoutQuery.error.message}`}
      />
    );
  }

  const data = prepareWorkoutQuery.data;

  if (!data) {
    return <ErrorState message="Failed to prepare workout." />;
  }

  return (
    <WorkoutComponent
      workoutName={data.workoutName}
      exercises={data.exercises}
      onInitialSave={onInitialSave}
    />
  );
}

export default function WorkoutPage() {
  return (
    <ClientErrorBoundary scope="workout" title="workout crashed">
      <div className="container mx-auto max-w-md p-2">
        <Suspense fallback={<LoadingState />}>
          <WorkoutInitializer />
        </Suspense>
      </div>
    </ClientErrorBoundary>
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
