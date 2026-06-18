import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({ db: {} }));

import { createCaller } from "@/server/api/root";

const makeCaller = () => {
  const exerciseFindUnique = vi.fn().mockResolvedValue(null);
  const userExerciseFindFirst = vi.fn().mockResolvedValue(null);
  const userExerciseUpsert = vi
    .fn()
    .mockImplementation(
      async ({
        where,
      }: {
        where: { userId_name: { userId: string; name: string } };
      }) => ({
        id: where.userId_name.name.length,
        name: where.userId_name.name,
      }),
    );
  const userExerciseUpdate = vi.fn();

  const workoutCreate = vi.fn().mockResolvedValue({ id: 101 });
  const workoutFindMany = vi.fn().mockResolvedValue([]);
  const workoutExerciseCreate = vi.fn().mockResolvedValue({ id: 202 });
  const workoutExerciseSetCreateMany = vi.fn().mockResolvedValue({});

  const transaction = vi
    .fn()
    .mockImplementation(async (cb: (tx: any) => Promise<unknown>) =>
      cb({
        workout: { create: workoutCreate },
        workoutExercise: { create: workoutExerciseCreate },
        workoutExerciseSet: { createMany: workoutExerciseSetCreateMany },
      }),
    );

  const caller = createCaller(async () => ({
    db: {
      exercise: { findUnique: exerciseFindUnique },
      userExercise: {
        findFirst: userExerciseFindFirst,
        upsert: userExerciseUpsert,
        update: userExerciseUpdate,
      },
      workout: { findMany: workoutFindMany },
      $transaction: transaction,
    } as any,
    session: { userId: "user_123" },
    headers: new Headers(),
  }));

  return {
    caller,
    spies: {
      exerciseFindUnique,
      userExerciseFindFirst,
      userExerciseUpsert,
      userExerciseUpdate,
      workoutCreate,
      workoutFindMany,
      workoutExerciseCreate,
      workoutExerciseSetCreateMany,
      transaction,
    },
  };
};

describe("workout.saveWorkout", () => {
  it("persists only completed sets", async () => {
    const { caller, spies } = makeCaller();

    await caller.workout.saveWorkout({
      name: "Session",
      startedAt: new Date(),
      completedAt: new Date(),
      exercises: [
        {
          name: "Bench",
          order: 0,
          notes: "",
          sets: [
            {
              order: 0,
              weight: 95,
              reps: 5,
              modifier: null,
              weightModifier: null,
              completed: false,
            },
            {
              order: 1,
              weight: 135,
              reps: 8,
              modifier: null,
              weightModifier: null,
              completed: true,
            },
          ],
        },
      ],
      notes: "",
    });

    expect(spies.workoutExerciseCreate).toHaveBeenCalledTimes(1);
    expect(spies.workoutExerciseSetCreateMany).toHaveBeenCalledTimes(1);
    expect(spies.workoutExerciseSetCreateMany).toHaveBeenCalledWith({
      data: [
        {
          workoutExerciseId: 202,
          order: 1,
          weight: 135,
          reps: 8,
          modifier: null,
          weightModifier: null,
          completed: true,
        },
      ],
    });
  });

  it("skips exercises with no completed sets", async () => {
    const { caller, spies } = makeCaller();

    await caller.workout.saveWorkout({
      name: "Session",
      startedAt: new Date(),
      completedAt: new Date(),
      exercises: [
        {
          name: "Squat",
          order: 0,
          notes: "",
          sets: [
            {
              order: 0,
              weight: 135,
              reps: 5,
              modifier: null,
              weightModifier: null,
              completed: false,
            },
          ],
        },
      ],
      notes: "",
    });

    expect(spies.workoutExerciseCreate).not.toHaveBeenCalled();
    expect(spies.workoutExerciseSetCreateMany).not.toHaveBeenCalled();
    expect(spies.workoutCreate).toHaveBeenCalledTimes(1);
  });

  it("persists exercise notes, set notes, rest, and rir when present", async () => {
    const { caller, spies } = makeCaller();

    await caller.workout.saveWorkout({
      name: "Session",
      startedAt: new Date(),
      completedAt: new Date(),
      exercises: [
        {
          name: "Pull Up",
          order: 0,
          exerciseNotes: "Hold dumbbell in thighs",
          exerciseNotesSnapshot: "Old machine setup",
          notes: "Feeling weak today",
          sets: [
            {
              order: 0,
              weight: 0,
              reps: 15,
              modifier: "warmup",
              weightModifier: "bodyweight",
              completed: true,
              notes: "Foot assist",
              rir: 2,
            },
            {
              order: 1,
              weight: 20,
              reps: 13,
              modifier: null,
              weightModifier: null,
              completed: true,
              restBefore: "short",
              notes: "solid first set",
              rir: 1,
            },
          ],
        },
      ],
      notes: "Pull day felt low energy",
    });

    expect(spies.userExerciseUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_name: { userId: "user_123", name: "Pull Up" } },
        update: { notes: "Hold dumbbell in thighs" },
        create: {
          userId: "user_123",
          name: "Pull Up",
          exerciseId: null,
          notes: "Hold dumbbell in thighs",
        },
      }),
    );
    expect(spies.workoutExerciseCreate).toHaveBeenCalledWith({
      data: {
        workoutSessionId: 101,
        userExerciseId: "Pull Up".length,
        order: 0,
        notes: "Feeling weak today",
        exerciseNotesSnapshot: "Old machine setup",
      },
    });
    expect(spies.workoutExerciseSetCreateMany).toHaveBeenCalledWith({
      data: [
        {
          workoutExerciseId: 202,
          order: 0,
          weight: 0,
          reps: 15,
          modifier: "warmup",
          weightModifier: "bodyweight",
          notes: "Foot assist",
          rir: 2,
          completed: true,
        },
        {
          workoutExerciseId: 202,
          order: 1,
          weight: 20,
          reps: 13,
          modifier: null,
          weightModifier: null,
          restBefore: "short",
          notes: "solid first set",
          rir: 1,
          completed: true,
        },
      ],
    });
  });
});

describe("workout.listRecent", () => {
  it("uses short-rest plus notation in exercise summaries", async () => {
    const { caller, spies } = makeCaller();
    spies.workoutFindMany.mockResolvedValue([
      {
        id: 1,
        name: "Workout 3/26",
        completedAt: new Date("2026-03-26T12:45:00"),
        startedAt: new Date("2026-03-26T12:00:00"),
        workoutExercises: [
          {
            userExercise: { name: "Pull-ups" },
            sets: [
              {
                weight: 0,
                reps: 10,
                modifier: null,
                weightModifier: "bodyweight",
                restBefore: null,
              },
              {
                weight: 0,
                reps: 10,
                modifier: null,
                weightModifier: "bodyweight",
                restBefore: null,
              },
              {
                weight: 0,
                reps: 9,
                modifier: null,
                weightModifier: "bodyweight",
                restBefore: null,
              },
              {
                weight: 0,
                reps: 1,
                modifier: null,
                weightModifier: "bodyweight",
                restBefore: "short",
              },
              {
                weight: 0,
                reps: 4,
                modifier: null,
                weightModifier: "bodyweight",
                restBefore: "short",
              },
            ],
          },
          {
            userExercise: { name: "Tricep overhead" },
            sets: [
              {
                weight: 40,
                reps: 15,
                modifier: null,
                weightModifier: null,
                restBefore: null,
              },
              {
                weight: 40,
                reps: 12,
                modifier: null,
                weightModifier: null,
                restBefore: null,
              },
              {
                weight: 40,
                reps: 8,
                modifier: null,
                weightModifier: null,
                restBefore: null,
              },
              {
                weight: 40,
                reps: 4,
                modifier: null,
                weightModifier: null,
                restBefore: "short",
              },
            ],
          },
        ],
      },
    ]);

    const workouts = await caller.workout.listRecent({ limit: 1 });

    expect(spies.workoutFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          workoutExercises: expect.objectContaining({
            select: expect.objectContaining({
              sets: expect.objectContaining({
                select: expect.objectContaining({ restBefore: true }),
              }),
            }),
          }),
        }),
      }),
    );
    expect(workouts[0]?.exerciseSummaries).toEqual([
      "Pull-ups - BW:x10,x10,x9+1+4",
      "Tricep overhead - 40lb:x15,x12,x8+4",
    ]);
  });
});
