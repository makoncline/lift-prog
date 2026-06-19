"use client";

import { PreviousWorkoutExercise } from "@/components/workout-reference/previous-workout-exercise";
import type {
  CurrentExerciseSet,
  SetChangeOptions,
} from "@/components/workout-reference/workout_reference_types";
import {
  buildReferenceHistory,
  normalizeCurrentSetOrder,
  workoutSetToCurrentSet,
} from "@/components/workout/workout_reference_adapters";
import type { Workout } from "@lift-prog/workout-core";

type WorkoutExerciseListProps = {
  exercises: Workout["exercises"];
  onExerciseNoteChange: (exerciseIndex: number, note: string) => void;
  onWorkoutExerciseNoteChange: (exerciseIndex: number, note: string) => void;
  onCurrentSetsChange: (
    exerciseIndex: number,
    sets: CurrentExerciseSet[],
    options?: SetChangeOptions,
  ) => void;
  onCommitPendingHistory: () => void;
};

export function WorkoutExerciseList({
  exercises,
  onExerciseNoteChange,
  onWorkoutExerciseNoteChange,
  onCurrentSetsChange,
  onCommitPendingHistory,
}: WorkoutExerciseListProps) {
  return (
    <div className="flex flex-col gap-4">
      {exercises.map((exercise, exerciseIndex) => (
        <section key={`${exercise.name}-${exerciseIndex}`}>
          <WorkoutExerciseReference
            exercise={exercise}
            exerciseIndex={exerciseIndex}
            onExerciseNoteChange={onExerciseNoteChange}
            onWorkoutExerciseNoteChange={onWorkoutExerciseNoteChange}
            onCurrentSetsChange={onCurrentSetsChange}
            onCommitPendingHistory={onCommitPendingHistory}
          />
        </section>
      ))}
    </div>
  );
}

function WorkoutExerciseReference({
  exercise,
  exerciseIndex,
  onExerciseNoteChange,
  onWorkoutExerciseNoteChange,
  onCurrentSetsChange,
  onCommitPendingHistory,
}: {
  exercise: Workout["exercises"][number];
  exerciseIndex: number;
  onExerciseNoteChange: (exerciseIndex: number, note: string) => void;
  onWorkoutExerciseNoteChange: (exerciseIndex: number, note: string) => void;
  onCurrentSetsChange: (
    exerciseIndex: number,
    sets: CurrentExerciseSet[],
    options?: SetChangeOptions,
  ) => void;
  onCommitPendingHistory: () => void;
}) {
  return (
    <PreviousWorkoutExercise
      exerciseName={exercise.name}
      exerciseNote={exercise.exerciseNotes ?? ""}
      history={buildReferenceHistory(exercise)}
      shellClassName="min-h-0 max-w-none bg-transparent p-0"
      workoutExerciseNote={exercise.notes[0]?.text ?? ""}
      onExerciseNoteChange={(note) => onExerciseNoteChange(exerciseIndex, note)}
      onWorkoutExerciseNoteChange={(note) =>
        onWorkoutExerciseNoteChange(exerciseIndex, note)
      }
      initialCurrentSets={normalizeCurrentSetOrder(
        exercise.sets.map((set, setIndex) =>
          workoutSetToCurrentSet(set, exercise, exerciseIndex, setIndex),
        ),
      )}
      onCurrentSetsChange={(sets, options) =>
        onCurrentSetsChange(exerciseIndex, sets, options)
      }
      onCommitPendingHistory={onCommitPendingHistory}
    />
  );
}
