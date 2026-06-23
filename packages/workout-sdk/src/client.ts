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
  ListExercisesResultSchema,
  GetWorkoutDetailsInputSchema,
  GetWorkoutDetailsResultSchema,
  PrepareInitialWorkoutInputSchema,
  PrepareInitialWorkoutResultSchema,
  SaveWorkoutInputSchema,
  SaveWorkoutResultSchema,
  UpdateWorkoutInputSchema,
  type ListRecentWorkoutsInput,
  type DeleteWorkoutInput,
  type DeleteWorkoutResult,
  type ExerciseListItem,
  type GetWorkoutDetailsInput,
  type GetWorkoutDetailsResult,
  type PrepareInitialWorkoutInput,
  type PrepareInitialWorkoutResult,
  type RecentWorkoutSummary,
  type SaveWorkoutInput,
  type SaveWorkoutResult,
  type UpdateWorkoutInput,
} from "./contracts";

type HeadersShape = Record<string, string>;

export type WorkoutApiClientOptions = {
  baseUrl: string;
  getToken?: () => Promise<string | null>;
  getHeaders?: () => Promise<HeadersShape>;
};

const buildHeaders = async ({
  getHeaders,
  getToken,
}: Pick<WorkoutApiClientOptions, "getHeaders" | "getToken">) => {
  const headers = (await getHeaders?.()) ?? {};
  const token = await getToken?.();

  return {
    ...headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    "x-trpc-source": "expo-mobile",
  } satisfies HeadersShape;
};

export const createWorkoutApiClient = ({
  baseUrl,
  getToken,
  getHeaders,
}: WorkoutApiClientOptions) => {
  const client = createTRPCUntypedClient({
    links: [
      httpBatchLink({
        transformer: SuperJSON,
        url: new URL("/api/trpc", baseUrl).toString(),
        headers: async () => buildHeaders({ getHeaders, getToken }),
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

    async saveWorkout(input: SaveWorkoutInput): Promise<SaveWorkoutResult> {
      const parsedInput = SaveWorkoutInputSchema.parse(input);
      const result = await client.mutation("workout.saveWorkout", parsedInput);
      return SaveWorkoutResultSchema.parse(result);
    },

    async getWorkoutDetails(
      input: GetWorkoutDetailsInput,
    ): Promise<GetWorkoutDetailsResult> {
      const parsedInput = GetWorkoutDetailsInputSchema.parse(input);
      const result = await client.query("workout.getWorkoutDetails", parsedInput);
      return GetWorkoutDetailsResultSchema.parse(result);
    },

    async updateWorkout(input: UpdateWorkoutInput): Promise<SaveWorkoutResult> {
      const parsedInput = UpdateWorkoutInputSchema.parse(input);
      const result = await client.mutation("workout.updateWorkout", parsedInput);
      return SaveWorkoutResultSchema.parse(result);
    },

    async deleteWorkout(
      input: DeleteWorkoutInput,
    ): Promise<DeleteWorkoutResult> {
      const parsedInput = DeleteWorkoutInputSchema.parse(input);
      const result = await client.mutation("workout.deleteWorkout", parsedInput);
      return DeleteWorkoutResultSchema.parse(result);
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
