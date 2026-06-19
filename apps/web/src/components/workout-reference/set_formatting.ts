import { formatEditorNumber } from "@/components/workout-reference/set_editor_keyboard";
import type {
  CurrentExerciseSet,
  RestType,
} from "@/components/workout-reference/workout_reference_types";

export function formatCurrentWeight(set: CurrentExerciseSet) {
  if (set.weightMode === "bodyweight") {
    const amount = Number.parseFloat(set.weightAmount || "0");
    if (!amount) return "BW";
    return `BW${set.weightSign === 1 ? "+" : "-"}${formatEditorNumber(amount)} lb`;
  }

  return set.weightAmount ? `${set.weightAmount} lb` : "-";
}

export function formatCompactCurrentWeight(set: CurrentExerciseSet) {
  return formatCurrentWeight(set).replaceAll(" lb", "lb");
}

export function formatCurrentReps(set: CurrentExerciseSet) {
  return set.reps || "-";
}

export function isCompoundRest(
  restTypeId: string | undefined,
  restTypes: RestType[],
) {
  const restType = restTypes.find((item) => item.id === restTypeId);
  return restType?.kind === "short";
}

export function currentSetNumber(
  sets: CurrentExerciseSet[],
  index: number,
  restTypes: RestType[],
) {
  const set = sets[index];
  if (!set) return 0;

  return sets.slice(0, index + 1).reduce((count, item, itemIndex) => {
    if (item.kind !== set.kind) return count;

    const previousItem = sets[itemIndex - 1];
    const continuesPreviousSet =
      previousItem?.kind === item.kind &&
      isCompoundRest(item.restBefore, restTypes);

    return continuesPreviousSet ? count : count + 1;
  }, 0);
}

export function getCurrentSetLabel(
  sets: CurrentExerciseSet[],
  setId: string,
  restTypes: RestType[],
) {
  const index = sets.findIndex((set) => set.id === setId);
  const set = sets[index];
  if (!set) return "";

  const setNumber = currentSetNumber(sets, index, restTypes);
  return set.kind === "warmup"
    ? `warm-up set ${setNumber}`
    : `set ${setNumber}`;
}
