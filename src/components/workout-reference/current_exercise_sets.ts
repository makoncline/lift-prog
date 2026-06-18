import type {
  CurrentExerciseSet,
  CurrentSetKind,
  ExerciseSet,
  PreviousExercise,
  RestType,
  RestTypeId,
  TimedRestType,
  WeightMode,
} from "@/components/workout-reference/workout_reference_types";

export const FALLBACK_REST_TYPE: TimedRestType = {
  id: "default",
  kind: "timed",
  seconds: 180,
  isDefault: true,
};

export const DEFAULT_REST_TYPES: RestType[] = [
  FALLBACK_REST_TYPE,
  { id: "short", kind: "short", label: "short", isDefault: false },
];

export function initialCurrentSets(
  history: PreviousExercise[],
  restTypes: RestType[],
) {
  const latest = history[0];
  if (!latest) return [];

  return normalizeRestBlocks(
    [
      ...latest.warmups.map((set, index) =>
        previousSetToCurrentSet(set, "warmup", index),
      ),
      ...latest.workingSets.map((set, index) =>
        previousSetToCurrentSet(set, "working", latest.warmups.length + index),
      ),
    ],
    restTypes,
  );
}

export function normalizeRestBlocks(
  sets: CurrentExerciseSet[],
  restTypes: RestType[],
) {
  const defaultRestTypeId = getDefaultRestTypeId(restTypes);

  return sets.map((set, index) => {
    const previousSet = sets[index - 1];
    const startsNewSetGroup = !previousSet || previousSet.kind !== set.kind;

    return {
      ...set,
      restBefore: startsNewSetGroup
        ? undefined
        : (getResolvedRestTypeId(set.restBefore, restTypes) ??
          defaultRestTypeId),
    };
  });
}

export function getDefaultRestTypeId(restTypes: RestType[]) {
  return (
    restTypes.find(
      (restType) => restType.kind === "timed" && restType.isDefault,
    )?.id ??
    restTypes.find((restType) => restType.kind === "timed")?.id ??
    FALLBACK_REST_TYPE.id
  );
}

export function getResolvedRestTypeId(
  restTypeId: RestTypeId | undefined,
  restTypes: RestType[],
) {
  if (restTypeId && restTypes.some((restType) => restType.id === restTypeId)) {
    return restTypeId;
  }

  return getDefaultRestTypeId(restTypes);
}

function previousSetToCurrentSet(
  set: ExerciseSet,
  kind: CurrentSetKind,
  index: number,
): CurrentExerciseSet {
  const parsedWeight = parsePreviousWeight(set.weight);

  return {
    id: `${kind}-${index}`,
    kind,
    weightMode: parsedWeight.mode,
    weightAmount: parsedWeight.amount,
    weightSign: parsedWeight.sign,
    reps: String(set.reps[0] ?? ""),
    restBefore: set.restBefore,
    completed: false,
  };
}

function parsePreviousWeight(weight: string): {
  mode: WeightMode;
  amount: string;
  sign: 1 | -1;
} {
  if (weight === "BW") return { mode: "bodyweight", amount: "", sign: 1 };

  const bodyweightMatch = weight.match(/^BW([+-])?(\d+(?:\.\d+)?)?/);
  if (bodyweightMatch) {
    return {
      mode: "bodyweight",
      amount: bodyweightMatch[2] ?? "",
      sign: bodyweightMatch[1] === "-" ? -1 : 1,
    };
  }

  return {
    mode: "standard",
    amount: weight.replace(/[^\d.]/g, ""),
    sign: 1,
  };
}
