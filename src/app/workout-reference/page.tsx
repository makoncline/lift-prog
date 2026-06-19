import { notFound } from "next/navigation";
import { PreviousWorkoutExerciseSandbox } from "@/components/workout-reference/workout_reference_sandbox";

export default function WorkoutReferencePage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return <PreviousWorkoutExerciseSandbox />;
}
