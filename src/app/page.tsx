"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { Dumbbell, History, Trash2 } from "lucide-react"; // Added Trash2 icon
import { api } from "@/trpc/react"; // Import tRPC api client
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

export default function HomePage() {
  // Renamed component
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
          <H2>Start a New Workout</H2>
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {recentWorkoutsQuery.data.map((workout) => (
                <Card key={workout.id}>
                  <CardHeader className="pb-2">
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
                        size="icon"
                        onClick={() => setDeleteWorkoutId(workout.id)}
                        className="text-destructive hover:bg-destructive/10 h-8 w-8"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardFooter className="pt-2">
                    <Button
                      variant="outline"
                      onClick={() => handleSelectRecent(workout.id)}
                      className="w-full"
                    >
                      Start Based on This
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {workoutTemplates.map((template) => (
              <Card key={template.id}>
                <CardHeader>
                  <CardTitle>{template.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-muted-foreground list-disc pl-5 text-sm">
                    {template.exercises.slice(0, 3).map((ex) => (
                      <li key={ex.name}>{ex.name}</li>
                    ))}
                    {template.exercises.length > 3 && <li>...and more</li>}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    onClick={() => handleSelectTemplate(template.id)}
                    className="w-full"
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
              <AlertDialogAction
                onClick={handleDeleteWorkout}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
}
