import { z } from "zod";

export const progressionSchema = z
  .object({
    minReps: z
      .number({
        invalid_type_error: "Min reps must be a number.",
        required_error: "Min reps is required.",
      })
      .int("Min reps must be a whole number.")
      .positive("Min reps must be positive.")
      .default(8),
    maxReps: z
      .number({
        invalid_type_error: "Max reps must be a number.",
        required_error: "Max reps is required.",
      })
      .int("Max reps must be a whole number.")
      .positive("Max reps must be positive.")
      .default(12),
    prevWeight: z
      .number({
        invalid_type_error: "Previous weight must be a number.",
      })
      .nullable()
      .optional(),
    prevReps: z
      .number({
        invalid_type_error: "Previous reps must be a number.",
      })
      .int("Previous reps must be a whole number.")
      .positive("Previous reps must be positive.")
      .nullable()
      .optional(),
    targetReps: z
      .number({
        invalid_type_error: "Target reps must be a number.",
        required_error: "Target reps is required.",
      })
      .int("Target reps must be a whole number.")
      .positive("Target reps must be positive.")
      // Default will be set dynamically based on minReps in the component
      .optional(), // Make optional initially, set default later
    target1RMIncrement: z
      .number({
        invalid_type_error: "1RM increment must be a number.",
        required_error: "1RM increment is required.",
      })
      .default(-5),
  })
  .refine((data) => data.maxReps >= data.minReps, {
    message: "Max reps cannot be less than min reps.",
    path: ["maxReps"], // Point error to maxReps field
  })
  .refine(
    (data) => data.targetReps === undefined || data.targetReps >= data.minReps,
    {
      message: "Target reps cannot be less than min reps.",
      path: ["targetReps"],
    },
  )
  .refine(
    (data) => data.targetReps === undefined || data.targetReps <= data.maxReps,
    {
      message: "Target reps cannot be greater than max reps.",
      path: ["targetReps"],
    },
  );

export type ProgressionFormData = z.infer<typeof progressionSchema>;
