export type SummaryInputSet = {
  weight: number | null;
  reps: number | null;
  modifier?: "warmup";
  weightModifier?: "bodyweight";
  restBefore?: "short" | "standard" | null;
};

type SanitizedSet = {
  weight: number;
  reps: number;
  weightModifier?: "bodyweight";
  restBefore?: "short" | "standard" | null;
  label: string;
  key: string;
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

const weightKey = (weight: number, weightModifier?: "bodyweight"): string =>
  `${weightModifier ?? "std"}:${weight}`;

export const summarizeSetEntries = (
  sets: SummaryInputSet[],
): string | undefined => {
  const sanitized: SanitizedSet[] = [];
  for (const set of sets) {
    if (set.weight == null || set.reps == null) continue;
    const label = formatWeightLabel(set.weight, set.weightModifier);
    if (!label) continue;
    sanitized.push({
      weight: set.weight,
      reps: set.reps,
      weightModifier: set.weightModifier,
      restBefore: set.restBefore,
      label,
      key: weightKey(set.weight, set.weightModifier),
    });
  }

  if (sanitized.length === 0) return undefined;

  const first = sanitized[0]!;
  const allSameWeight = sanitized.every((set) => set.key === first.key);

  if (allSameWeight) {
    const repsParts: string[] = [];
    for (const set of sanitized) {
      if (set.restBefore === "short" && repsParts.length > 0) {
        repsParts[repsParts.length - 1] += `+${set.reps}`;
      } else {
        repsParts.push(`${set.reps}`);
      }
    }
    return `${first.label}x${repsParts.join(",")}`;
  }

  const parts: string[] = [];
  let prevKey: string | null = null;
  for (const set of sanitized) {
    if (set.restBefore === "short" && parts.length > 0) {
      parts[parts.length - 1] +=
        prevKey === set.key ? `+${set.reps}` : `+${set.label}x${set.reps}`;
    } else if (prevKey === set.key && parts.length > 0) {
      parts.push(`${set.reps}`);
    } else {
      parts.push(`${set.label}x${set.reps}`);
    }
    prevKey = set.key;
  }

  return parts.join(",");
};

export const summarizeWorkingSets = (
  exerciseName: string,
  sets: SummaryInputSet[],
): string | undefined => {
  const summary = summarizeSetEntries(
    sets.filter((set) => set.modifier !== "warmup"),
  );

  return summary ? `${exerciseName} - ${summary}` : undefined;
};
