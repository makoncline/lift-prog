import { z } from "zod";
import { Modifier, RestType, WeightModifier } from "@prisma/client";

export const CompletedSetSchema = z.object({
  order: z.number(),
  weight: z.number().nullable(),
  reps: z.number().nullable(),
  modifier: z.nativeEnum(Modifier).nullable(),
  weightModifier: z.nativeEnum(WeightModifier).nullable(),
  restBefore: z.nativeEnum(RestType).nullable().optional(),
  notes: z.string().optional(),
  rir: z.number().int().min(0).max(10).nullable().optional(),
  completed: z.boolean(),
});

export const CompletedExerciseSchema = z.object({
  name: z.string(),
  order: z.number(),
  exerciseNotes: z.string().optional(),
  notes: z.string().optional(),
  exerciseNotesSnapshot: z.string().optional(),
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
