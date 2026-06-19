import { estimate1RM } from "@lift-prog/workout-core";

export const PLATES = [45, 35, 25, 10, 5, 2.5] as const;

export type PlateWeight = (typeof PLATES)[number];
export type PlateMode = "equal-sides" | "total";

export type PlateCount = {
  weight: PlateWeight;
  count: number;
};

export type AddedWeightRepRow = {
  key: string;
  targetWeight: number;
  targetReps: number;
  targetOneRepMax: number;
  percentChange: number;
  label: "exact" | "under" | "over";
};

export type PlatePlan = {
  mode: PlateMode;
  targetWeight: number;
  startingWeight: number;
  loadWeight: number;
  title: string;
  plates: PlateCount[];
  error: string | null;
};

export function buildAddedWeightRepRows(
  currentWeight: number,
  currentOneRepMax: number,
  addedWeight: number,
  mode: PlateMode,
): AddedWeightRepRow[] {
  const targetWeight =
    currentWeight + (mode === "equal-sides" ? addedWeight * 2 : addedWeight);
  const candidates = Array.from({ length: 36 }, (_, index) => index + 1).map(
    (targetReps) => {
      const targetOneRepMax = estimate1RM(targetWeight, targetReps);
      const percentChange =
        ((targetOneRepMax - currentOneRepMax) / currentOneRepMax) * 100;

      return {
        key: `${mode}-${addedWeight}-${targetWeight}-${targetReps}`,
        targetWeight,
        targetReps,
        targetOneRepMax,
        percentChange,
      };
    },
  );
  const under = candidates
    .filter((candidate) => candidate.percentChange <= 0)
    .sort((a, b) => b.percentChange - a.percentChange)[0];
  const over = candidates
    .filter((candidate) => candidate.percentChange > 0)
    .sort((a, b) => a.percentChange - b.percentChange)[0];

  return [
    under
      ? {
          ...under,
          label: under.percentChange === 0 ? "exact" : "under",
        }
      : null,
    over ? { ...over, label: "over" } : null,
  ].filter((row): row is AddedWeightRepRow => row !== null);
}

export function calculatePlatePlan(
  targetWeight: number,
  startingWeight: number,
  mode: PlateMode,
): PlatePlan {
  const addedWeight = targetWeight - startingWeight;
  const loadWeight = mode === "equal-sides" ? addedWeight / 2 : addedWeight;

  if (addedWeight < 0) {
    return {
      mode,
      targetWeight,
      startingWeight,
      loadWeight,
      title: `${formatNumber(targetWeight)}lb`,
      plates: [],
      error: `below ${formatPlateWeight(startingWeight)}lb start`,
    };
  }

  const plates = calculateLeastPlates(loadWeight);
  const loadedWeight = plates.reduce(
    (sum, plate) => sum + plate.weight * plate.count,
    0,
  );

  if (Math.abs(loadedWeight - loadWeight) > 0.01) {
    return {
      mode,
      targetWeight,
      startingWeight,
      loadWeight,
      title:
        mode === "equal-sides"
          ? `${formatPlateWeight(loadWeight)}lb each side`
          : `${formatPlateWeight(loadWeight)}lb added`,
      plates: [],
      error:
        mode === "equal-sides"
          ? "2.5lb plates need 5lb total jumps"
          : "total load needs 2.5lb jumps",
    };
  }

  return {
    mode,
    targetWeight,
    startingWeight,
    loadWeight,
    title:
      mode === "equal-sides"
        ? `${formatPlateWeight(loadWeight)}lb each side`
        : `${formatPlateWeight(loadWeight)}lb added`,
    plates,
    error: null,
  };
}

export function calculateLeastPlates(targetWeight: number): PlateCount[] {
  let remaining = targetWeight;
  const plates: PlateCount[] = [];

  for (const plate of PLATES) {
    const count = Math.floor((remaining + 0.001) / plate);
    if (count > 0) {
      plates.push({ weight: plate, count });
      remaining = Number((remaining - plate * count).toFixed(2));
    }
  }

  return plates;
}

export function formatPlateWeight(value: number) {
  const rounded = Number(value.toFixed(2));
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function formatNumber(value: number) {
  const rounded = Number(value.toFixed(1));
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}
