"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser, SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { workoutTemplates } from "@/data/workout-templates";
import { H2, H3, P } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Dumbbell, History, Trash2, LogIn } from "lucide-react";
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

// Define a type for the data returned by listRecent query
// Note: Prisma dates are Date objects, need formatting for display
interface RecentWorkoutItem {
  id: number;
  name: string;
  completedAt: Date | null;
  startedAt: Date;
}

// Helper function to format date and time
const formatDateTime = (date: Date): { dateStr: string; timeStr: string } => {
  // Format date as MM/DD/YY
  const dateStr = `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${String(date.getFullYear()).slice(2)}`;

  // Format time as h:MMam/pm
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const period = hours >= 12 ? "pm" : "am";
  const displayHours = hours % 12 || 12; // Convert 0 to 12 for 12am

  const timeStr = `${displayHours}:${minutes}${period}`;

  return { dateStr, timeStr };
};

// Calculate workout duration in minutes
const calculateDuration = (startDate: Date, endDate: Date): number => {
  const durationMs = endDate.getTime() - startDate.getTime();
  return Math.round(durationMs / (1000 * 60)); // Convert ms to minutes
};

function AuthenticatedHomePage() {
  const router = useRouter();
  const [deleteWorkoutId, setDeleteWorkoutId] = useState<number | null>(null);
  const [hasInProgress, setHasInProgress] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setHasInProgress(localStorage.getItem(LOCAL_STORAGE_WORKOUT_KEY) != null);
    }
  }, []);

  const utils = api.useUtils();

  // Fetch recent workouts using tRPC query hook
  const recentWorkoutsQuery = api.workout.listRecent.useQuery(
    { limit: 6 }, // Fetch up to 6 recent workouts
    {
      // Optional: configure query behavior (e.g., refetching)
      // refetchOnWindowFocus: false,
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

  const handleSelectTemplate = (templateId: string) => {
    router.push(`/workout?templateId=${templateId}`);
  };

  const handleSelectRecent = (workoutId: number) => {
    // Navigate to workout page, initializing based on the selected workout ID
    router.push(`/workout?basedOn=${workoutId}`);
  };

  return (
    <>
      {hasInProgress && (
        <div className="container mx-auto mb-4 flex max-w-2xl items-center justify-between rounded bg-yellow-100 p-4">
          <p>You have a workout in progress.</p>
          <Button variant="outline" onClick={() => router.push("/workout")}>
            Resume Workout
          </Button>
        </div>
      )}
      <div className="container mx-auto max-w-2xl py-8">
        <div className="mb-8 flex items-center gap-3">
          <Dumbbell className="h-8 w-8" />
          <H2>Start a Workout</H2>
        </div>

        {/* Section 1: Continue Previous Workout */}
        <section className="mb-12">
          <div className="mb-4 flex items-center justify-between border-b pb-2">
            <H3>Progress from Previous Workout</H3>
            <History className="text-muted-foreground h-5 w-5" />
          </div>

          {recentWorkoutsQuery.isLoading ? (
            <P>Loading recent workouts...</P>
          ) : recentWorkoutsQuery.isError ? (
            <P className="text-destructive">
              Error loading recent workouts: {recentWorkoutsQuery.error.message}
            </P>
          ) : recentWorkoutsQuery.data &&
            recentWorkoutsQuery.data.length > 0 ? (
            <div className="space-y-3">
              {recentWorkoutsQuery.data.map((workout) => (
                <Card key={workout.id} className="w-full gap-0">
                  <CardHeader className="">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        {workout.completedAt && (
                          <p className="text-muted-foreground text-sm font-medium">
                            {
                              formatDateTime(new Date(workout.completedAt))
                                .dateStr
                            }{" "}
                            @{" "}
                            {
                              formatDateTime(new Date(workout.completedAt))
                                .timeStr
                            }
                          </p>
                        )}
                        <CardTitle>{workout.name}</CardTitle>
                        <p className="text-muted-foreground text-sm">
                          {workout.completedAt
                            ? `${calculateDuration(new Date(workout.startedAt), new Date(workout.completedAt))} mins`
                            : "In progress"}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteWorkoutId(workout.id)}
                        className="text-destructive hover:bg-destructive/10 gap-1 text-xs"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </CardHeader>
                  <CardFooter className="">
                    <Button
                      size="sm"
                      onClick={() => handleSelectRecent(workout.id)}
                      className="w-full"
                    >
                      Progress
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <P>No recent completed workouts found.</P>
          )}
        </section>

        {/* Section 2: Start from Template */}
        <section>
          <H3 className="mb-4 border-b pb-2">Start from a Template</H3>
          <div className="space-y-3">
            {workoutTemplates.map((template) => (
              <Card key={template.id} className="w-full gap-2">
                <CardHeader className="">
                  <CardTitle>{template.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-muted-foreground list-disc pl-5 text-sm">
                    {template.exercises.map((ex) => (
                      <li key={ex.name}>{ex.name}</li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter className="">
                  <Button
                    onClick={() => handleSelectTemplate(template.id)}
                    className="w-full"
                    size="sm"
                  >
                    Start {template.name}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
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
    <div className="container mx-auto max-w-2xl py-8">
      <div className="flex flex-col items-center justify-center space-y-6 text-center">
        <div className="flex items-center gap-3">
          <Dumbbell className="h-12 w-12" />
          <H2>Lift Prog</H2>
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

        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-lg">Features</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-muted-foreground space-y-2 text-sm">
              <li>• Track sets, reps, and weights</li>
              <li>• Progressive overload calculations</li>
              <li>• Workout templates</li>
              <li>• Rest timer</li>
              <li>• Plate calculator</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function HomePage() {
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
