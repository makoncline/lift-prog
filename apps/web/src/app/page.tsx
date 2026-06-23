"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { P } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Dumbbell,
  LogIn,
  Pencil,
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
import { LOCAL_STORAGE_WORKOUT_KEY } from "@lift-prog/workout-core";

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
const localDevMode = process.env.NODE_ENV === "development";
const INITIAL_WORKOUT_HISTORY_LIMIT = 6;
const WORKOUT_HISTORY_LIMIT_INCREMENT = 6;
const MAX_WORKOUT_HISTORY_LIMIT = 50;

const formatWorkoutDate = (date: Date): string => {
  return `${date.getMonth() + 1}/${date.getDate()}`;
};

const relativeDateFormatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: "always",
  style: "long",
});

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfLocalDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const getWholeMonthDifference = (fromDate: Date, toDate: Date) => {
  const direction = fromDate <= toDate ? 1 : -1;
  const earlier = direction === 1 ? fromDate : toDate;
  const later = direction === 1 ? toDate : fromDate;
  let months =
    (later.getFullYear() - earlier.getFullYear()) * 12 +
    later.getMonth() -
    earlier.getMonth();

  if (later.getDate() < earlier.getDate()) months -= 1;

  return direction * Math.max(0, months);
};

const formatRelativeWorkoutDate = (date: Date, now = new Date()) => {
  const dayDifference = Math.round(
    (startOfLocalDay(now).getTime() - startOfLocalDay(date).getTime()) / DAY_MS,
  );
  const absDays = Math.abs(dayDifference);
  const direction = dayDifference > 0 ? -1 : 1;

  if (absDays === 0) return "today";
  if (absDays < 7) {
    return relativeDateFormatter.format(direction * absDays, "day");
  }
  if (absDays < 45) {
    return relativeDateFormatter.format(
      direction * Math.max(1, Math.round(absDays / 7)),
      "week",
    );
  }

  const monthDifference = getWholeMonthDifference(date, now);
  const absMonths = Math.abs(monthDifference);
  const monthDirection = monthDifference > 0 ? -1 : 1;

  if (absMonths < 12) {
    return relativeDateFormatter.format(
      monthDirection * Math.max(1, absMonths),
      "month",
    );
  }

  return relativeDateFormatter.format(
    monthDirection * Math.max(1, Math.floor(absMonths / 12)),
    "year",
  );
};

const calculateDuration = (startDate: Date, endDate: Date): number => {
  const durationMs = endDate.getTime() - startDate.getTime();
  return Math.round(durationMs / (1000 * 60));
};

const formatWorkoutMeta = (startedAt: Date, completedAt: Date) => {
  return `${formatRelativeWorkoutDate(completedAt)} · ${formatWorkoutDate(completedAt)} · ${calculateDuration(startedAt, completedAt)}m`;
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
      placeholderData: (previousData) => previousData,
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
    router.push(`/workout?copyFrom=${workoutId}`);
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
  const showLoading =
    historyEnabled && recentWorkoutsQuery.isLoading && workouts.length === 0;
  const showError =
    historyEnabled && recentWorkoutsQuery.isError && workouts.length === 0;

  return (
    <>
      {hasInProgress && (
        <div className="mx-auto flex w-full max-w-[390px] items-center justify-between gap-3 px-4 pt-4 font-mono text-[16px]">
          <span className="text-[#7a7468]">workout in progress</span>
          <Button
            variant="outline"
            size="sm"
            className="h-10 rounded-[7px] border-[#d7cab8] bg-[#fffefa] px-3 font-mono text-[18px] font-normal text-[#1f1c17] shadow-none"
            onClick={() => router.push("/workout")}
          >
            resume
          </Button>
        </div>
      )}
      <div className="mx-auto w-full max-w-[390px] px-4 py-7 font-mono text-[#1f1c17]">
        <div className="mb-[18px] flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[38px] leading-[40px] font-extrabold tracking-normal">
              Lift Prog
            </h1>
            <div className="mt-2 text-[18px] leading-6 text-[#7a7468]">
              workouts
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-10 min-w-12 rounded-[7px] border-[#d7cab8] bg-[#fffefa] p-0 font-mono text-[20px] font-normal text-[#1f1c17] shadow-none hover:bg-[#eee9df]"
            onClick={() => setShowBuilder((value) => !value)}
            aria-label={
              showBuilder ? "Hide new workout form" : "Add new workout"
            }
            aria-pressed={showBuilder}
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>

        {showBuilder ? (
          <section className="mb-7 space-y-2">
            <div className="text-[18px] leading-6 text-[#7a7468]">
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
                className="h-10 min-w-0 flex-1 rounded-[5px] border border-[#d7cab8] bg-[#fffefa] px-2 font-mono text-[20px] text-[#1f1c17] outline-none placeholder:text-[#7a7468] focus:ring-1 focus:ring-[#383225]"
              />
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="h-10 min-w-12 rounded-[7px] border-[#d7cab8] bg-[#fffefa] px-2 font-mono text-[18px] font-normal text-[#1f1c17] shadow-none"
                disabled={!exerciseSearch.trim()}
              >
                <Plus className="h-5 w-5" />
              </Button>
            </form>

            {exerciseSearch.trim() && exercisesQuery.data?.length ? (
              <div className="flex max-h-28 flex-col overflow-y-auto text-[18px] leading-6">
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
                      className="rounded-[5px] px-2 py-1 text-left hover:bg-[#eee9df]"
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
                    className="flex items-center gap-1 text-[19px] leading-6"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {exerciseName}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-[34px] min-w-[44px] rounded-[7px] border border-[#d7cab8] bg-[#fffefa] text-[#7a7468] shadow-none"
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
                      className="h-[34px] min-w-[44px] rounded-[7px] border border-[#d7cab8] bg-[#fffefa] text-[#7a7468] shadow-none"
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
                      className="h-[34px] min-w-[44px] rounded-[7px] border border-[#d7cab8] bg-[#fffefa] text-[#7a7468] shadow-none"
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
              className="h-10 rounded-[7px] bg-[#383225] px-3 font-mono text-[18px] font-normal text-[#fffefa] shadow-none"
              disabled={selectedExercises.length === 0}
              onClick={startCustomWorkout}
            >
              start workout
            </Button>
          </section>
        ) : null}

        <section>
          {showLoading ? (
            <P className="text-[16px] text-[#7a7468]">loading workouts...</P>
          ) : showError ? (
            <P className="text-[16px] text-[#9f2f2f]">
              error loading workouts: {recentWorkoutsQuery.error?.message}
            </P>
          ) : workouts.length > 0 ? (
            <div className="space-y-6">
              {workouts.map((workout) => (
                <article key={workout.id} className="space-y-[5px] py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[26px] leading-8 font-extrabold tracking-normal">
                        {workout.name}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleSelectRecent(workout.id)}
                        aria-label={`Copy ${workout.name} into a new workout`}
                        className="h-[34px] min-w-[44px] rounded-[7px] border border-[#d7cab8] bg-[#fffefa] text-[#7a7468] shadow-none hover:bg-[#eee9df]"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditWorkout(workout.id)}
                        aria-label={`Edit ${workout.name}`}
                        className="h-[34px] min-w-[44px] rounded-[7px] border border-[#d7cab8] bg-[#fffefa] text-[#7a7468] shadow-none hover:bg-[#eee9df]"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteWorkoutId(workout.id)}
                        aria-label={`Delete ${workout.name}`}
                        className="h-[34px] min-w-[44px] rounded-[7px] border border-[#d7cab8] bg-[#fffefa] text-[#7a7468] shadow-none hover:bg-[#eee9df] hover:text-[#9f2f2f]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-[18px] leading-6 text-[#7a7468]">
                    {workout.completedAt
                      ? formatWorkoutMeta(
                          new Date(workout.startedAt),
                          new Date(workout.completedAt),
                        )
                      : "in progress"}
                  </div>

                  {workout.exerciseSummaries?.length ? (
                    <div className="space-y-1">
                      {workout.exerciseSummaries.map((summary, index) => {
                        const { exerciseName, sets } =
                          splitExerciseSummary(summary);
                        return (
                          <div
                            key={`${workout.id}-${index}`}
                            className="grid grid-cols-[minmax(6rem,auto)_1fr] gap-x-2 text-[18px] leading-[25px]"
                          >
                            <span className="truncate text-[#7a7468]">
                              {exerciseName}
                            </span>
                            <span className="min-w-0 text-[#1f1c17]">
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
                  className="rounded-[7px] border border-[#d7cab8] bg-[#fffefa] px-3 py-2 text-[18px] leading-6 text-[#1f1c17] hover:bg-[#eee9df] disabled:opacity-50"
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
            <P className="text-[16px] text-[#7a7468]">
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
    <div className="mx-auto max-w-[390px] px-4 py-8 font-mono text-[#1f1c17]">
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
