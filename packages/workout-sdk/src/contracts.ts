import { CompletedWorkoutSchema } from "@lift-prog/workout-core";
import { z } from "zod";

const setModifierSchema = z.enum(["warmup"]);
const weightModifierSchema = z.enum(["bodyweight"]);

export const PreviousExerciseSetSchema = z.object({
  weight: z.number().nullable(),
  reps: z.number().nullable(),
  isWarmup: z.boolean().optional(),
  modifier: setModifierSchema.optional(),
  weightModifier: weightModifierSchema.optional(),
});

export const PreviousExerciseDataSchema = z.object({
  name: z.string(),
  sets: z.array(PreviousExerciseSetSchema),
  notes: z.string().nullable().optional(),
});

export const PrepareInitialWorkoutInputSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("exerciseList"),
    exerciseNames: z.array(z.string().min(1)).min(1),
    workoutName: z.string().optional(),
  }),
  z.object({
    mode: z.literal("workoutReference"),
    workoutId: z.number(),
  }),
]);

export const PrepareInitialWorkoutResultSchema = z.object({
  workoutName: z.string(),
  exercises: z.array(PreviousExerciseDataSchema),
});

export const ListRecentWorkoutsInputSchema = z.object({
  limit: z.number().min(1).max(50).optional().default(10),
});

export const RecentWorkoutSummarySchema = z.object({
  id: z.number(),
  name: z.string(),
  completedAt: z.coerce.date(),
  startedAt: z.coerce.date(),
  exerciseSummaries: z.array(z.string()),
});

export const ListRecentWorkoutsResultSchema = z.array(RecentWorkoutSummarySchema);

export const SaveWorkoutInputSchema = CompletedWorkoutSchema;

export const SaveWorkoutResultSchema = z.object({
  success: z.boolean(),
  workoutId: z.number(),
});

export type PreviousExerciseDataDto = z.infer<typeof PreviousExerciseDataSchema>;
export type PrepareInitialWorkoutInput = z.infer<
  typeof PrepareInitialWorkoutInputSchema
>;
export type PrepareInitialWorkoutResult = z.infer<
  typeof PrepareInitialWorkoutResultSchema
>;
export type ListRecentWorkoutsInput = z.infer<
  typeof ListRecentWorkoutsInputSchema
>;
export type RecentWorkoutSummary = z.infer<typeof RecentWorkoutSummarySchema>;
export type SaveWorkoutInput = z.infer<typeof SaveWorkoutInputSchema>;
export type SaveWorkoutResult = z.infer<typeof SaveWorkoutResultSchema>;
