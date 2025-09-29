export type SummaryInputSet = {
  weight: number | null;
  reps: number | null;
  modifier?: "warmup";
  weightModifier?: "bodyweight";
};

const formatWeightNumber = (weight: number): string => {
  const rounded = Number(weight.toFixed(2));
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
};

const formatWeightLabel = (
  weight: number | null,
  weightModifier?: "bodyweight",
): string | null => {
  if (weightModifier === "bodyweight") {
    if (weight == null || Math.abs(weight) < 1e-6) return "BW";
    const formatted = formatWeightNumber(Math.abs(weight));
    const sign = weight > 0 ? "+" : "-";
    return `BW${sign}${formatted}lb`;
  }

  if (weight == null) return null;
  return `${formatWeightNumber(weight)}lb`;
};

const weightKey = (
  weight: number,
  weightModifier?: "bodyweight",
): string => `${weightModifier ?? "std"}:${weight}`;

export const summarizeWorkingSets = (
  exerciseName: string,
  sets: SummaryInputSet[],
): string | undefined => {
  const workingSets = sets.filter((set) => set.modifier !== "warmup");

  const sanitized = workingSets
    .map((set) => {
      if (set.weight == null || set.reps == null) return null;
      const label = formatWeightLabel(set.weight, set.weightModifier);
      if (!label) return null;
      return {
        weight: set.weight,
        reps: set.reps,
        weightModifier: set.weightModifier,
        label,
        key: weightKey(set.weight, set.weightModifier),
      };
    })
    .filter((value): value is {
      weight: number;
      reps: number;
      weightModifier?: "bodyweight";
      label: string;
      key: string;
    } => value !== null);

  if (sanitized.length === 0) return undefined;

  const first = sanitized[0]!;
  const allSameWeight = sanitized.every((set) => set.key === first.key);

  if (allSameWeight) {
    const repsParts = sanitized.map((set) => `x${set.reps}`);
    return `${exerciseName} - ${first.label}:${repsParts.join(",")}`;
  }

  const parts: string[] = [];
  let prevKey: string | null = null;
  for (const set of sanitized) {
    if (prevKey === set.key && parts.length > 0) {
      parts.push(`x${set.reps}`);
    } else {
      parts.push(`${set.label}x${set.reps}`);
    }
    prevKey = set.key;
  }

  return `${exerciseName} - ${parts.join(",")}`;
};
