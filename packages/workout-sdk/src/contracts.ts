import { CompletedWorkoutSchema } from "@lift-prog/workout-core";
import { z } from "zod";

const setModifierSchema = z.enum(["warmup"]);
const weightModifierSchema = z.enum(["bodyweight"]);
const restTypeSchema = z.enum(["standard", "short"]);
const plateLoadModeSchema = z.enum(["equal-sides", "total"]);

export const PreviousExerciseSetSchema = z.object({
  weight: z.number().nullable(),
  reps: z.number().nullable(),
  isWarmup: z.boolean().optional(),
  modifier: setModifierSchema.optional(),
  weightModifier: weightModifierSchema.optional(),
  restBefore: restTypeSchema.optional(),
  notes: z.string().nullable().optional(),
  rir: z.number().int().min(0).max(10).nullable().optional(),
});

export const ExerciseHistoryEntrySchema = z.object({
  relation: z.string(),
  relativeDate: z.string(),
  date: z.string(),
  bodyWeightLb: z.number().nullable().optional(),
  workoutNote: z.string().nullable().optional(),
  workoutExerciseNote: z.string().nullable().optional(),
  exerciseNotesSnapshot: z.string().nullable().optional(),
  sets: z.array(PreviousExerciseSetSchema),
});

export const PreviousExerciseDataSchema = z.object({
  userExerciseId: z.number().optional(),
  name: z.string(),
  sets: z.array(PreviousExerciseSetSchema),
  exerciseNotes: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  exerciseNotesSnapshot: z.string().nullable().optional(),
  plateStartingWeight: z.number().nullable().optional(),
  plateLoadMode: plateLoadModeSchema.nullable().optional(),
  history: z.array(ExerciseHistoryEntrySchema).optional(),
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
  bodyWeightLb: z.number().positive().nullable().optional(),
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
  bodyWeightLb: z.number().positive().nullable().optional(),
  exerciseSummaries: z.array(z.string()),
});

export const ListRecentWorkoutsResultSchema = z.array(
  RecentWorkoutSummarySchema,
);

export const ExerciseListItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  notes: z.string().nullable(),
  exerciseId: z.number().nullable(),
  plateStartingWeight: z.number().nullable(),
  plateLoadMode: plateLoadModeSchema.nullable(),
});

export const ListExercisesResultSchema = z.array(ExerciseListItemSchema);

export const SaveWorkoutInputSchema = CompletedWorkoutSchema;

export const SaveWorkoutResultSchema = z.object({
  success: z.boolean(),
  workoutId: z.number(),
});

export const GetWorkoutDetailsInputSchema = z.object({
  workoutId: z.number(),
});

export const GetWorkoutDetailsResultSchema = PrepareInitialWorkoutResultSchema.extend({
  startedAt: z.coerce.date(),
  completedAt: z.coerce.date().nullable(),
  notes: z.string().nullable().optional(),
});

export const UpdateWorkoutInputSchema = z.object({
  workoutId: z.number(),
  workout: CompletedWorkoutSchema,
});

export const DeleteWorkoutInputSchema = z.object({
  workoutId: z.number(),
});

export const DeleteWorkoutResultSchema = z.object({
  success: z.boolean(),
});

export type PreviousExerciseDataDto = z.infer<
  typeof PreviousExerciseDataSchema
>;
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
export type ExerciseListItem = z.infer<typeof ExerciseListItemSchema>;
export type SaveWorkoutInput = z.infer<typeof SaveWorkoutInputSchema>;
export type SaveWorkoutResult = z.infer<typeof SaveWorkoutResultSchema>;
export type GetWorkoutDetailsInput = z.infer<
  typeof GetWorkoutDetailsInputSchema
>;
export type GetWorkoutDetailsResult = z.infer<
  typeof GetWorkoutDetailsResultSchema
>;
export type UpdateWorkoutInput = z.infer<typeof UpdateWorkoutInputSchema>;
export type DeleteWorkoutInput = z.infer<typeof DeleteWorkoutInputSchema>;
export type DeleteWorkoutResult = z.infer<typeof DeleteWorkoutResultSchema>;
