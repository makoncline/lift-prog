// Core calculation logic for the progression calculator

import { estimate1RM, roundToStep, WEIGHT_STEP } from "@/lib/workoutLogic"; // Assuming workoutLogic is the correct path
import type { ProgressionFormData } from "@/lib/schemas/progression-schema";

// Result type for the main calculation function
export interface CalculatedProgressionResult {
  estimated1RM: number | null;
  newEstimated1RM: number | null;
  percentChange: number | null;
  nextWeight: number | null;
  nextReps: number | null;
}

// Result type for the projection table data
export interface ProjectionData {
  reps: number;
  estimated1RM: number | null;
}

/**
 * Calculates the target weight for a given estimated 1RM and target reps.
 * Uses the inverse of the Brzycki formula.
 */
export function calculateNextWeight(
  newEstimated1RM: number,
  targetReps: number,
): number {
  // Inverse Brzycki: Weight = Estimated1RM / (36 / (37 - Reps))
  // Simplified: Weight = Estimated1RM * (37 - Reps) / 36
  if (targetReps >= 37) {
    // Avoid division by zero or negative denominator
    // In practice, reps shouldn't get this high for 1RM estimation formulas
    return 0; // Or handle as an error/invalid input case
  }
  const calculatedWeight = (newEstimated1RM * (37 - targetReps)) / 36;
  return roundToStep(calculatedWeight, WEIGHT_STEP);
}

/**
 * Performs the main progression calculation based on form data.
 */
export function calculateProgression(
  data: ProgressionFormData,
): CalculatedProgressionResult {
  const { prevWeight, prevReps, targetReps, target1RMIncrement } = data;

  let estimated1RM: number | null = null;
  if (
    prevWeight !== null &&
    prevWeight !== undefined &&
    prevReps !== null &&
    prevReps !== undefined
  ) {
    if (prevReps < 37) {
      // Check validity for Brzycki
      estimated1RM = estimate1RM(prevWeight, prevReps);
    } // else: cannot estimate 1RM if reps are too high
  } // else: cannot estimate if weight or reps are missing

  let newEstimated1RM: number | null = null;
  if (estimated1RM !== null) {
    newEstimated1RM = estimated1RM + target1RMIncrement;
  }

  let percentChange: number | null = null;
  if (estimated1RM !== null && newEstimated1RM !== null && estimated1RM !== 0) {
    percentChange = ((newEstimated1RM - estimated1RM) / estimated1RM) * 100;
  }

  let nextWeight: number | null = null;
  const finalTargetReps = targetReps ?? data.minReps; // Use minReps if targetReps isn't set
  if (newEstimated1RM !== null) {
    nextWeight = calculateNextWeight(newEstimated1RM, finalTargetReps);
  }

  return {
    estimated1RM,
    newEstimated1RM,
    percentChange,
    nextWeight,
    nextReps: finalTargetReps,
  };
}

/**
 * Calculates the estimated 1RM for a range of reps at a given weight.
 */
export function calculateProjectionData(
  weight: number | null,
  minReps: number,
  maxReps: number,
): ProjectionData[] {
  const projection: ProjectionData[] = [];
  if (weight === null || weight === undefined) {
    return [];
  }

  for (let reps = minReps; reps <= maxReps; reps++) {
    if (reps >= 37) continue; // Skip invalid reps for estimation
    const estimated = estimate1RM(weight, reps);
    projection.push({ reps, estimated1RM: estimated });
  }

  return projection;
}
