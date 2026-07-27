import {
  CompletedWorkoutSchema,
  type CompletedWorkout,
  type PlateLoadMode,
  type PreviousExerciseData,
} from "@lift-prog/workout-core";
import { z } from "zod";

export type LocalId = string;

export const LOCAL_DATABASE_VERSION = 1;

export const StoredUserExerciseSchema = z.object({
  id: z.string().min(1),
  legacyServerId: z.number().int().positive().nullable(),
  catalogExerciseId: z.string().nullable(),
  name: z.string().min(1),
  notes: z.string().nullable(),
  plateStartingWeight: z.number().nonnegative().nullable(),
  plateLoadMode: z.enum(["equal-sides", "total"]).nullable(),
  restWarmupSeconds: z.number().int().positive().nullable(),
  restWorkingSeconds: z.number().int().positive().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type StoredUserExercise = z.infer<typeof StoredUserExerciseSchema>;

export const StoredWorkoutAggregateSchema = CompletedWorkoutSchema.extend({
  id: z.string().min(1),
  legacyServerId: z.number().int().positive().nullable(),
  schemaVersion: z.number().int().positive(),
  updatedAt: z.coerce.date(),
});

export type StoredWorkoutAggregate = z.infer<
  typeof StoredWorkoutAggregateSchema
>;

export type LocalRecentWorkout = {
  id: LocalId;
  name: string;
  completedAt: Date;
  startedAt: Date;
  bodyWeightLb?: number | null;
  exerciseSummaries: string[];
};

export type LocalExerciseListItem = {
  id: LocalId;
  name: string;
  notes: string | null;
  exerciseId: string | null;
  plateStartingWeight: number | null;
  plateLoadMode: PlateLoadMode | null;
};

export type LocalPreparedWorkout = {
  workoutName: string;
  bodyWeightLb?: number | null;
  restTimes?: CompletedWorkout["restTimes"];
  exercises: PreviousExerciseData[];
};

export type LocalWorkoutDetails = LocalPreparedWorkout & {
  startedAt: Date;
  completedAt: Date | null;
  notes?: string | null;
};

export type LocalWorkoutDataClient = {
  listRecent(input?: { limit?: number }): Promise<LocalRecentWorkout[]>;
  prepareInitialWorkout(
    input:
      | {
          mode: "exerciseList";
          exerciseNames: string[];
          workoutName?: string;
        }
      | { mode: "workoutReference"; workoutId: LocalId },
  ): Promise<LocalPreparedWorkout>;
  listExercises(): Promise<LocalExerciseListItem[]>;
  updateExerciseNote(input: {
    id?: LocalId;
    name?: string;
    note: string;
  }): Promise<{ count: number }>;
  updateExercisePlateDefaults(input: {
    id?: LocalId;
    name?: string;
    plateStartingWeight: number | null;
    plateLoadMode: PlateLoadMode;
  }): Promise<{ count: number }>;
  saveWorkout(input: CompletedWorkout): Promise<{
    success: true;
    workoutId: LocalId;
  }>;
  getWorkoutDetails(input: {
    workoutId: LocalId;
  }): Promise<LocalWorkoutDetails>;
  updateWorkout(input: {
    workoutId: LocalId;
    workout: CompletedWorkout;
  }): Promise<{ success: true; workoutId: LocalId }>;
  deleteWorkout(input: { workoutId: LocalId }): Promise<{ success: true }>;
  isAccountDeletionRequested(): Promise<boolean>;
  requestAccountDeletion(): Promise<void>;
  cancelAccountDeletionRequest(): Promise<void>;
  deleteCurrentUser(): Promise<{ success: true }>;
};
