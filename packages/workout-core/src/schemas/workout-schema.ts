import { z } from "zod";

const setModifierSchema = z.enum(["warmup"]);
const weightModifierSchema = z.enum(["bodyweight"]);

export const CompletedSetSchema = z.object({
  order: z.number(),
  weight: z.number().nullable(),
  reps: z.number().nullable(),
  modifier: setModifierSchema.nullable(),
  weightModifier: weightModifierSchema.nullable(),
  completed: z.boolean(),
});

export const CompletedExerciseSchema = z.object({
  name: z.string(),
  order: z.number(),
  notes: z.string().optional(),
  sets: z.array(CompletedSetSchema),
});

export const CompletedWorkoutSchema = z.object({
  name: z.string(),
  notes: z.string().optional(),
  completedAt: z.coerce.date(),
  startedAt: z.coerce.date(),
  exercises: z.array(CompletedExerciseSchema),
});

export type CompletedSet = z.infer<typeof CompletedSetSchema>;
export type CompletedExercise = z.infer<typeof CompletedExerciseSchema>;
export type CompletedWorkout = z.infer<typeof CompletedWorkoutSchema>;
