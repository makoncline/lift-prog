import type { WorkoutExercise, WorkoutSet } from "@lift-prog/workout-core";

import { getSetDisplayValues } from "./format";

type SetValueUpdates = {
  weight?: number | null;
  reps?: number | null;
  weightModifier?: WorkoutSet["weightModifier"];
};

export function materializeEditedExerciseSets(
  exercise: WorkoutExercise,
  editedSetIndex: number,
  updates: SetValueUpdates,
) {
  const editedSet = exercise.sets[editedSetIndex];
  const editedDisplay = editedSet
    ? getSetDisplayValues(exercise, editedSet, editedSetIndex)
    : null;
  const shouldCascadeWeight =
    editedSet?.modifier !== "warmup" &&
    editedSet?.restBefore !== "short" &&
    "weight" in updates;
  const propagatedWeightModifier =
    "weightModifier" in updates
      ? updates.weightModifier
      : editedDisplay?.weightModifier;
  let cascadeWeight = shouldCascadeWeight;

  return exercise.sets.map((set, setIndex) => {
    const displayed = getSetDisplayValues(exercise, set, setIndex);
    const isEditedSet = setIndex === editedSetIndex;
    const isFollowingWorkingSet =
      setIndex > editedSetIndex && set.modifier !== "warmup";

    if (
      cascadeWeight &&
      isFollowingWorkingSet &&
      set.restBefore !== "short" &&
      (displayed.weight !== editedDisplay?.weight ||
        displayed.weightModifier !== editedDisplay?.weightModifier)
    ) {
      cascadeWeight = false;
    }

    const hasCascadedWeightUpdate =
      cascadeWeight &&
      isFollowingWorkingSet &&
      displayed.weight === editedDisplay?.weight &&
      displayed.weightModifier === editedDisplay?.weightModifier;
    const hasWeightUpdate =
      (isEditedSet && "weight" in updates) || hasCascadedWeightUpdate;
    const hasWeightModifierUpdate =
      (isEditedSet && "weightModifier" in updates) || hasCascadedWeightUpdate;
    const hasRepsUpdate = isEditedSet && "reps" in updates;
    const nextWeight = hasWeightUpdate ? updates.weight! : displayed.weight;
    const nextReps = hasRepsUpdate ? updates.reps! : displayed.reps;
    const nextWeightModifier = hasWeightModifierUpdate
      ? propagatedWeightModifier
      : displayed.weightModifier;

    return {
      ...set,
      weight: nextWeight,
      reps: nextReps,
      weightModifier: nextWeightModifier,
      weightExplicit:
        set.weightExplicit || nextWeight !== null || hasWeightUpdate,
      repsExplicit: set.repsExplicit || nextReps !== null || hasRepsUpdate,
      completed: set.completed,
    };
  });
}
