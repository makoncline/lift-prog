"use client";

import { PreviousWorkoutExercise } from "@/components/workout-reference/previous-workout-exercise";
import type { CurrentExerciseSet } from "@/components/workout-reference/workout_reference_types";
import {
  buildReferenceHistory,
  normalizeCurrentSetOrder,
  workoutSetToCurrentSet,
} from "@/components/workout/workout_reference_adapters";
import type { Workout } from "@/lib/workoutLogic";

type WorkoutExerciseListProps = {
  exercises: Workout["exercises"];
  onWorkoutExerciseNoteChange: (exerciseIndex: number, note: string) => void;
  onCurrentSetsChange: (
    exerciseIndex: number,
    sets: CurrentExerciseSet[],
  ) => void;
};

export function WorkoutExerciseList({
  exercises,
  onWorkoutExerciseNoteChange,
  onCurrentSetsChange,
}: WorkoutExerciseListProps) {
  return (
    <div className="flex flex-col gap-4">
      {exercises.map((exercise, exerciseIndex) => (
        <section key={`${exercise.name}-${exerciseIndex}`}>
          <WorkoutExerciseReference
            exercise={exercise}
            exerciseIndex={exerciseIndex}
            onWorkoutExerciseNoteChange={onWorkoutExerciseNoteChange}
            onCurrentSetsChange={onCurrentSetsChange}
          />
        </section>
      ))}
    </div>
  );
}

function WorkoutExerciseReference({
  exercise,
  exerciseIndex,
  onWorkoutExerciseNoteChange,
  onCurrentSetsChange,
}: {
  exercise: Workout["exercises"][number];
  exerciseIndex: number;
  onWorkoutExerciseNoteChange: (exerciseIndex: number, note: string) => void;
  onCurrentSetsChange: (
    exerciseIndex: number,
    sets: CurrentExerciseSet[],
  ) => void;
}) {
  return (
    <PreviousWorkoutExercise
      exerciseName={exercise.name}
      exerciseNote={exercise.exerciseNotes ?? ""}
      history={buildReferenceHistory(exercise)}
      shellClassName="min-h-0 max-w-none bg-transparent p-0"
      workoutExerciseNote={exercise.notes[0]?.text ?? ""}
      onWorkoutExerciseNoteChange={(note) =>
        onWorkoutExerciseNoteChange(exerciseIndex, note)
      }
      initialCurrentSets={normalizeCurrentSetOrder(
        exercise.sets.map((set, setIndex) =>
          workoutSetToCurrentSet(set, exercise, exerciseIndex, setIndex),
        ),
      )}
      onCurrentSetsChange={(sets) => onCurrentSetsChange(exerciseIndex, sets)}
    />
  );
}
