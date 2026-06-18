"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { P } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronUp,
  Dumbbell,
  LogIn,
  Pencil,
  Play,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { api } from "@/trpc/react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

// Import the shared constant
import { LOCAL_STORAGE_WORKOUT_KEY } from "@/lib/constants";

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
const localDevMode = process.env.NODE_ENV === "development";
const INITIAL_WORKOUT_HISTORY_LIMIT = 6;
const WORKOUT_HISTORY_LIMIT_INCREMENT = 6;
const MAX_WORKOUT_HISTORY_LIMIT = 50;

const formatWorkoutDate = (date: Date): string => {
  return `${date.getMonth() + 1}/${date.getDate()}`;
};

const calculateDuration = (startDate: Date, endDate: Date): number => {
  const durationMs = endDate.getTime() - startDate.getTime();
  return Math.round(durationMs / (1000 * 60));
};

const splitExerciseSummary = (
  summary: string,
): { exerciseName: string; sets: string } => {
  const separator = " - ";
  const index = summary.indexOf(separator);
  if (index === -1) return { exerciseName: summary, sets: "" };
  return {
    exerciseName: summary.slice(0, index),
    sets: summary.slice(index + separator.length),
  };
};

const sampleWorkouts = [
  {
    id: -1,
    name: "Pull",
    completedAt: new Date("2026-06-10T18:30:00"),
    startedAt: new Date("2026-06-10T17:42:00"),
    exerciseSummaries: [
      "Pull-ups - BWx15,20lbx13,8",
      "Cable Row - 110lbx12,12,10",
      "Lat Pulldown - 120lbx11,10,10",
      "Curl - 30lbx13,12",
    ],
  },
  {
    id: -2,
    name: "Push",
    completedAt: new Date("2026-06-08T17:50:00"),
    startedAt: new Date("2026-06-08T17:05:00"),
    exerciseSummaries: [
      "Bench - 185lbx8,8,7",
      "Dips - BWx12,10,8",
      "Press - 95lbx10,8,8",
    ],
  },
];

function AuthenticatedHomePage({
  historyEnabled = true,
}: {
  historyEnabled?: boolean;
}) {
  const router = useRouter();
  const [deleteWorkoutId, setDeleteWorkoutId] = useState<number | null>(null);
  const [hasInProgress, setHasInProgress] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [selectedExercises, setSelectedExercises] = useState<string[]>([]);
  const [visibleWorkoutLimit, setVisibleWorkoutLimit] = useState(
    INITIAL_WORKOUT_HISTORY_LIMIT,
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      setHasInProgress(localStorage.getItem(LOCAL_STORAGE_WORKOUT_KEY) != null);
    }
  }, []);

  const utils = api.useUtils();
  const exercisesQuery = api.exercise.list.useQuery(undefined, {
    staleTime: Infinity,
    enabled: historyEnabled,
  });
  const addExerciseMutation = api.exercise.add.useMutation({
    onSuccess: async () => {
      await utils.exercise.list.invalidate();
    },
    onError: (error) => {
      if (!error.message.includes("already exists")) {
        toast.error(`Error creating exercise: ${error.message}`);
      }
    },
  });

  // Fetch recent workouts using tRPC query hook
  const recentWorkoutsQuery = api.workout.listRecent.useQuery(
    { limit: visibleWorkoutLimit },
    {
      // Optional: configure query behavior (e.g., refetching)
      // refetchOnWindowFocus: false,
      enabled: historyEnabled,
    },
  );

  // Delete workout mutation
  const deleteWorkoutMutation = api.workout.deleteWorkout.useMutation({
    onSuccess: () => {
      toast.success("Workout deleted successfully");
      // Invalidate the listRecent query to refresh the list
      void utils.workout.listRecent.invalidate();
    },
    onError: (error) => {
      toast.error(`Error deleting workout: ${error.message}`);
    },
  });

  const handleDeleteWorkout = () => {
    if (deleteWorkoutId !== null) {
      deleteWorkoutMutation.mutate({ workoutId: deleteWorkoutId });
      setDeleteWorkoutId(null); // Close the dialog
    }
  };

  const handleSelectRecent = (workoutId: number) => {
    if (workoutId < 0) {
      router.push("/workout-reference");
      return;
    }
    router.push(`/workout?basedOn=${workoutId}`);
  };

  const handleEditWorkout = (workoutId: number) => {
    if (workoutId < 0) {
      router.push("/workout-reference");
      return;
    }
    router.push(`/workout/${workoutId}/edit`);
  };

  const addSelectedExercise = (exerciseName: string) => {
    const trimmed = exerciseName.trim();
    if (!trimmed) return;
    setSelectedExercises((current) =>
      current.some((name) => name.toLowerCase() === trimmed.toLowerCase())
        ? current
        : [...current, trimmed],
    );
  };

  const removeSelectedExercise = (index: number) => {
    setSelectedExercises((current) => current.filter((_, i) => i !== index));
  };

  const moveSelectedExercise = (index: number, direction: 1 | -1) => {
    setSelectedExercises((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const moving = next[index];
      const swapped = next[target];
      if (!moving || !swapped) return current;
      next[index] = swapped;
      next[target] = moving;
      return next;
    });
  };

  const startCustomWorkout = () => {
    if (selectedExercises.length === 0) {
      toast.error("Add at least one exercise.");
      return;
    }
    const encoded = encodeURIComponent(JSON.stringify(selectedExercises));
    router.push(`/workout?templateId=custom&customExercises=${encoded}`);
  };

  const addOrCreateExerciseFromSearch = () => {
    const trimmedSearch = exerciseSearch.trim();
    if (!trimmedSearch) return;

    const exact = exercisesQuery.data?.find(
      (exercise) => exercise.name.toLowerCase() === trimmedSearch.toLowerCase(),
    );
    const exerciseName = exact?.name ?? trimmedSearch;
    addSelectedExercise(exerciseName);
    setExerciseSearch("");

    if (!exact) {
      addExerciseMutation.mutate({ name: trimmedSearch });
    }
  };

  const workouts = historyEnabled
    ? (recentWorkoutsQuery.data ?? [])
    : sampleWorkouts;
  const canShowMoreWorkouts =
    historyEnabled &&
    workouts.length >= visibleWorkoutLimit &&
    visibleWorkoutLimit < MAX_WORKOUT_HISTORY_LIMIT;
  const showLoading = historyEnabled && recentWorkoutsQuery.isLoading;
  const showError = historyEnabled && recentWorkoutsQuery.isError;

  return (
    <>
      {hasInProgress && (
        <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-4 pt-4 font-mono text-sm">
          <span className="text-muted-foreground">workout in progress</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/workout")}
          >
            Resume Workout
          </Button>
        </div>
      )}
      <div className="mx-auto max-w-md px-4 py-7 font-mono">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-normal">
            workout history
          </h1>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-sm"
            onClick={() => setShowBuilder((value) => !value)}
          >
            <Plus className="h-4 w-4" />
            workout
          </Button>
        </div>

        {showBuilder ? (
          <section className="mb-7 space-y-2">
            <div className="text-[13px] leading-none text-stone-500">
              new workout
            </div>
            <form
              className="flex gap-1"
              onSubmit={(event) => {
                event.preventDefault();
                addOrCreateExerciseFromSearch();
              }}
            >
              <input
                value={exerciseSearch}
                onChange={(event) => setExerciseSearch(event.target.value)}
                placeholder="search or create exercise"
                className="border-input bg-background h-9 min-w-0 flex-1 rounded-sm border px-2 text-sm"
              />
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="h-9 rounded-sm px-2"
                disabled={!exerciseSearch.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </form>

            {exerciseSearch.trim() && exercisesQuery.data?.length ? (
              <div className="flex max-h-28 flex-col overflow-y-auto text-sm">
                {exercisesQuery.data
                  .filter((exercise) =>
                    exercise.name
                      .toLowerCase()
                      .includes(exerciseSearch.trim().toLowerCase()),
                  )
                  .slice(0, 8)
                  .map((exercise) => (
                    <button
                      key={exercise.id}
                      type="button"
                      className="rounded-sm px-2 py-1 text-left hover:bg-stone-100"
                      onClick={() => {
                        addSelectedExercise(exercise.name);
                        setExerciseSearch("");
                      }}
                    >
                      {exercise.name}
                    </button>
                  ))}
              </div>
            ) : null}

            {selectedExercises.length > 0 ? (
              <div className="space-y-1">
                {selectedExercises.map((exerciseName, index) => (
                  <div
                    key={`${exerciseName}-${index}`}
                    className="flex items-center gap-1 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {exerciseName}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-sm"
                      disabled={index === 0}
                      onClick={() => moveSelectedExercise(index, -1)}
                      aria-label={`Move ${exerciseName} up`}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-sm"
                      disabled={index === selectedExercises.length - 1}
                      onClick={() => moveSelectedExercise(index, 1)}
                      aria-label={`Move ${exerciseName} down`}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-sm text-stone-500"
                      onClick={() => removeSelectedExercise(index)}
                      aria-label={`Remove ${exerciseName}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}

            <Button
              type="button"
              size="sm"
              className="h-8 rounded-sm"
              disabled={selectedExercises.length === 0}
              onClick={startCustomWorkout}
            >
              start workout
            </Button>
          </section>
        ) : null}

        <section>
          {showLoading ? (
            <P className="text-muted-foreground text-sm">loading workouts...</P>
          ) : showError ? (
            <P className="text-destructive text-sm">
              error loading workouts: {recentWorkoutsQuery.error?.message}
            </P>
          ) : workouts.length > 0 ? (
            <div className="space-y-7">
              {workouts.map((workout) => (
                <article key={workout.id} className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[13px] leading-tight text-stone-500">
                        {workout.completedAt
                          ? `${formatWorkoutDate(new Date(workout.completedAt))} · ${calculateDuration(new Date(workout.startedAt), new Date(workout.completedAt))}m`
                          : "in progress"}
                      </div>
                      <div className="truncate text-[24px] leading-tight font-semibold tracking-normal">
                        {workout.name}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1 pt-1">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleSelectRecent(workout.id)}
                        aria-label={`Start from ${workout.name}`}
                        className="h-8 w-8 rounded-sm"
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditWorkout(workout.id)}
                        aria-label={`Edit ${workout.name}`}
                        className="text-muted-foreground h-8 w-8 rounded-sm"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteWorkoutId(workout.id)}
                        aria-label={`Delete ${workout.name}`}
                        className="text-muted-foreground hover:text-destructive h-8 w-8 rounded-sm"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {workout.exerciseSummaries?.length ? (
                    <div className="space-y-1.5">
                      {workout.exerciseSummaries.map((summary, index) => {
                        const { exerciseName, sets } =
                          splitExerciseSummary(summary);
                        return (
                          <div
                            key={`${workout.id}-${index}`}
                            className="grid grid-cols-[minmax(5.5rem,auto)_1fr] gap-x-2 text-[15px] leading-tight"
                          >
                            <span className="truncate text-stone-500">
                              {exerciseName}
                            </span>
                            <span className="min-w-0 text-stone-950">
                              {sets}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </article>
              ))}
              {canShowMoreWorkouts ? (
                <button
                  type="button"
                  className="text-[13px] leading-tight text-stone-500 hover:text-stone-950 disabled:opacity-50"
                  disabled={recentWorkoutsQuery.isFetching}
                  onClick={() =>
                    setVisibleWorkoutLimit((limit) =>
                      Math.min(
                        limit + WORKOUT_HISTORY_LIMIT_INCREMENT,
                        MAX_WORKOUT_HISTORY_LIMIT,
                      ),
                    )
                  }
                >
                  {recentWorkoutsQuery.isFetching ? "loading..." : "show more"}
                </button>
              ) : null}
            </div>
          ) : (
            <P className="text-muted-foreground text-sm">
              no completed workouts yet
            </P>
          )}
        </section>

        {/* Delete Confirmation Dialog */}
        <AlertDialog
          open={deleteWorkoutId !== null}
          onOpenChange={(open) => !open && setDeleteWorkoutId(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Workout</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this workout? This action cannot
                be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteWorkout}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
}

function UnauthenticatedHomePage() {
  return (
    <div className="mx-auto max-w-md px-4 py-8 font-mono">
      <div className="flex flex-col items-center justify-center space-y-6 text-center">
        <div className="flex items-center gap-3">
          <Dumbbell className="h-12 w-12" />
          <h1 className="text-3xl font-semibold tracking-normal">Lift Prog</h1>
        </div>

        <div className="space-y-4">
          <P className="text-muted-foreground">
            Track your workouts, monitor your progress, and reach your fitness
            goals.
          </P>

          <Button asChild size="lg" className="gap-2">
            <SignInButton>
              <span className="flex items-center gap-2">
                <LogIn className="h-4 w-4" />
                Sign In to Get Started
              </span>
            </SignInButton>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  if (!clerkEnabled) {
    return <AuthenticatedHomePage historyEnabled={localDevMode} />;
  }

  return (
    <>
      <SignedIn>
        <AuthenticatedHomePage />
      </SignedIn>
      <SignedOut>
        <UnauthenticatedHomePage />
      </SignedOut>
    </>
  );
}
