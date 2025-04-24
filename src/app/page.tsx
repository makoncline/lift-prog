"use client";

import { useState } from "react";
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

// Define a type for the data returned by listRecent query
// Note: Prisma dates are Date objects, need formatting for display
interface RecentWorkoutItem {
  id: number;
  name: string;
  completedAt: Date | null; // completedAt can be null theoretically, though query filters
}

export default function HomePage() {
  // Renamed component
  const router = useRouter();
  const [deleteWorkoutId, setDeleteWorkoutId] = useState<number | null>(null);
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
        ) : recentWorkoutsQuery.data && recentWorkoutsQuery.data.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {recentWorkoutsQuery.data.map((workout: RecentWorkoutItem) => (
              <Card key={workout.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{workout.name}</CardTitle>
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
                <CardContent>
                  <P className="text-muted-foreground text-sm">
                    Completed on:{" "}
                    {workout.completedAt
                      ? new Date(workout.completedAt).toLocaleDateString()
                      : "N/A"}
                  </P>
                  {/* TODO: Maybe show exercise count later */}
                </CardContent>
                <CardFooter>
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
  );
}
