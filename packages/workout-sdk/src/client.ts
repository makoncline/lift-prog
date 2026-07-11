import {
  TRPCClientError,
  createTRPCUntypedClient,
  httpBatchLink,
} from "@trpc/client";
import SuperJSON from "superjson";

import {
  ListRecentWorkoutsInputSchema,
  ListRecentWorkoutsResultSchema,
  DeleteWorkoutInputSchema,
  DeleteWorkoutResultSchema,
  DeleteCurrentUserResultSchema,
  ExportCurrentUserDataResultSchema,
  ListExercisesResultSchema,
  ExerciseUpdateResultSchema,
  GetWorkoutDetailsInputSchema,
  GetWorkoutDetailsResultSchema,
  PrepareInitialWorkoutInputSchema,
  PrepareInitialWorkoutResultSchema,
  SaveWorkoutInputSchema,
  SaveWorkoutResultSchema,
  UpdateExerciseNoteInputSchema,
  UpdateExercisePlateDefaultsInputSchema,
  UpdateWorkoutInputSchema,
  type ListRecentWorkoutsInput,
  type DeleteWorkoutInput,
  type DeleteWorkoutResult,
  type DeleteCurrentUserResult,
  type ExportCurrentUserDataResult,
  type ExerciseListItem,
  type ExerciseUpdateResult,
  type GetWorkoutDetailsInput,
  type GetWorkoutDetailsResult,
  type PrepareInitialWorkoutInput,
  type PrepareInitialWorkoutResult,
  type RecentWorkoutSummary,
  type SaveWorkoutInput,
  type SaveWorkoutResult,
  type UpdateExerciseNoteInput,
  type UpdateExercisePlateDefaultsInput,
  type UpdateWorkoutInput,
} from "./contracts";

type HeadersShape = Record<string, string>;

export type WorkoutApiClientOptions = {
  baseUrl: string;
  getHeaders?: () => Promise<HeadersShape>;
};

const buildHeaders = async ({
  getHeaders,
}: Pick<WorkoutApiClientOptions, "getHeaders">) => {
  const headers = (await getHeaders?.()) ?? {};

  return {
    ...headers,
    "x-trpc-source": "expo-mobile",
  } satisfies HeadersShape;
};

export const createWorkoutApiClient = ({
  baseUrl,
  getHeaders,
}: WorkoutApiClientOptions) => {
  const client = createTRPCUntypedClient({
    links: [
      httpBatchLink({
        transformer: SuperJSON,
        url: new URL("/api/trpc", baseUrl).toString(),
        headers: async () => buildHeaders({ getHeaders }),
      }),
    ],
  });

  return {
    async listRecent(
      input?: ListRecentWorkoutsInput,
    ): Promise<RecentWorkoutSummary[]> {
      const parsedInput = ListRecentWorkoutsInputSchema.parse(input ?? {});
      const result = await client.query("workout.listRecent", parsedInput);
      return ListRecentWorkoutsResultSchema.parse(result);
    },

    async prepareInitialWorkout(
      input: PrepareInitialWorkoutInput,
    ): Promise<PrepareInitialWorkoutResult> {
      const parsedInput = PrepareInitialWorkoutInputSchema.parse(input);
      const result = await client.query(
        "workout.prepareInitialWorkout",
        parsedInput,
      );
      return PrepareInitialWorkoutResultSchema.parse(result);
    },

    async listExercises(): Promise<ExerciseListItem[]> {
      const result = await client.query("exercise.list");
      return ListExercisesResultSchema.parse(result);
    },

    async updateExerciseNote(
      input: UpdateExerciseNoteInput,
    ): Promise<ExerciseUpdateResult> {
      const parsedInput = UpdateExerciseNoteInputSchema.parse(input);
      const result = await client.mutation("exercise.updateNote", parsedInput);
      return ExerciseUpdateResultSchema.parse(result);
    },

    async updateExercisePlateDefaults(
      input: UpdateExercisePlateDefaultsInput,
    ): Promise<ExerciseUpdateResult> {
      const parsedInput = UpdateExercisePlateDefaultsInputSchema.parse(input);
      const result = await client.mutation(
        "exercise.updatePlateDefaults",
        parsedInput,
      );
      return ExerciseUpdateResultSchema.parse(result);
    },

    async saveWorkout(input: SaveWorkoutInput): Promise<SaveWorkoutResult> {
      const parsedInput = SaveWorkoutInputSchema.parse(input);
      const result = await client.mutation("workout.saveWorkout", parsedInput);
      return SaveWorkoutResultSchema.parse(result);
    },

    async getWorkoutDetails(
      input: GetWorkoutDetailsInput,
    ): Promise<GetWorkoutDetailsResult> {
      const parsedInput = GetWorkoutDetailsInputSchema.parse(input);
      const result = await client.query(
        "workout.getWorkoutDetails",
        parsedInput,
      );
      return GetWorkoutDetailsResultSchema.parse(result);
    },

    async updateWorkout(input: UpdateWorkoutInput): Promise<SaveWorkoutResult> {
      const parsedInput = UpdateWorkoutInputSchema.parse(input);
      const result = await client.mutation(
        "workout.updateWorkout",
        parsedInput,
      );
      return SaveWorkoutResultSchema.parse(result);
    },

    async deleteWorkout(
      input: DeleteWorkoutInput,
    ): Promise<DeleteWorkoutResult> {
      const parsedInput = DeleteWorkoutInputSchema.parse(input);
      const result = await client.mutation(
        "workout.deleteWorkout",
        parsedInput,
      );
      return DeleteWorkoutResultSchema.parse(result);
    },

    async deleteCurrentUser(): Promise<DeleteCurrentUserResult> {
      const result = await client.mutation("user.deleteCurrent");
      return DeleteCurrentUserResultSchema.parse(result);
    },

    async exportCurrentUserData(): Promise<ExportCurrentUserDataResult> {
      const result = await client.query("workout.exportCurrentUserData");
      return ExportCurrentUserDataResultSchema.parse(result);
    },
  };
};

export const getWorkoutApiErrorMessage = (error: unknown) => {
  if (error instanceof TRPCClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong while talking to the workout backend.";
};
