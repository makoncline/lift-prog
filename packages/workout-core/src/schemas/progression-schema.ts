import { z } from "zod";

export const progressionSchema = z
  .object({
    minReps: z
      .number({
        error: (issue) => issue.input === undefined
          ? "Min reps is required."
          : "Min reps must be a number.",
      })
      .int("Min reps must be a whole number.")
      .positive("Min reps must be positive.")
      .default(8),
    maxReps: z
      .number({
        error: (issue) => issue.input === undefined
          ? "Max reps is required."
          : "Max reps must be a number.",
      })
      .int("Max reps must be a whole number.")
      .positive("Max reps must be positive.")
      .default(12),
    prevWeight: z
      .number({
        error: "Previous weight must be a number.",
      })
      .nullable()
      .optional(),
    prevReps: z
      .number({
        error: "Previous reps must be a number.",
      })
      .int("Previous reps must be a whole number.")
      .positive("Previous reps must be positive.")
      .nullable()
      .optional(),
    targetReps: z
      .number({
        error: (issue) => issue.input === undefined
          ? "Target reps is required."
          : "Target reps must be a number.",
      })
      .int("Target reps must be a whole number.")
      .positive("Target reps must be positive.")
      // Default will be set dynamically based on minReps in the component
      .optional(), // Make optional initially, set default later
    target1RMIncrement: z
      .number({
        error: (issue) => issue.input === undefined
          ? "1RM increment is required."
          : "1RM increment must be a number.",
      })
      .default(-5),
  })
  .refine((data) => data.maxReps >= data.minReps, {
    error: "Max reps cannot be less than min reps.",
    path: ["maxReps"], // Point error to maxReps field
  })
  .refine(
    (data) => data.targetReps === undefined || data.targetReps >= data.minReps,
    {
      error: "Target reps cannot be less than min reps.",
      path: ["targetReps"],
    },
  )
  .refine(
    (data) => data.targetReps === undefined || data.targetReps <= data.maxReps,
    {
      error: "Target reps cannot be greater than max reps.",
      path: ["targetReps"],
    },
  );

export type ProgressionFormData = z.infer<typeof progressionSchema>;
