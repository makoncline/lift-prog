import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({ db: {} }));

import { createCaller } from "@/server/api/root";

const makeCaller = () => {
  const userUpsert = vi.fn().mockResolvedValue({ id: "user_123" });
  const exerciseFindUnique = vi.fn().mockResolvedValue(null);
  const txExerciseFindUnique = vi.fn().mockResolvedValue(null);
  const userExerciseFindMany = vi.fn().mockResolvedValue([]);
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
  const txUserExerciseFindMany = vi.fn().mockResolvedValue([]);
  const txUserExerciseFindFirst = vi.fn().mockResolvedValue(null);
  const txUserExerciseUpsert = vi
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
  const txUserExerciseUpdate = vi
    .fn()
    .mockImplementation(
      async ({ where }: { where: { id: number } }) => ({
        id: where.id,
        name: "Existing Exercise",
      }),
    );

  const workoutCreate = vi.fn().mockResolvedValue({ id: 101 });
  const workoutFindMany = vi.fn().mockResolvedValue([]);
  const workoutFindFirst = vi.fn().mockResolvedValue({ id: 101 });
  const workoutUpdate = vi.fn().mockResolvedValue({ id: 101 });
  const workoutExerciseDeleteMany = vi.fn().mockResolvedValue({});
  const workoutExerciseCreate = vi.fn().mockResolvedValue({ id: 202 });
  const workoutExerciseSetCreateMany = vi.fn().mockResolvedValue({});

  const transaction = vi
    .fn()
    .mockImplementation(async (cb: (tx: any) => Promise<unknown>) =>
      cb({
        exercise: { findUnique: txExerciseFindUnique },
        userExercise: {
          findMany: txUserExerciseFindMany,
          findFirst: txUserExerciseFindFirst,
          upsert: txUserExerciseUpsert,
          update: txUserExerciseUpdate,
        },
        workout: { create: workoutCreate, update: workoutUpdate },
        workoutExercise: {
          create: workoutExerciseCreate,
          deleteMany: workoutExerciseDeleteMany,
        },
        workoutExerciseSet: { createMany: workoutExerciseSetCreateMany },
      }),
    );

  const caller = createCaller(async () => ({
    db: {
      user: { upsert: userUpsert },
      exercise: { findUnique: exerciseFindUnique },
      userExercise: {
        findMany: userExerciseFindMany,
        findFirst: userExerciseFindFirst,
        upsert: userExerciseUpsert,
        update: userExerciseUpdate,
      },
      workout: { findMany: workoutFindMany, findFirst: workoutFindFirst },
      $transaction: transaction,
    } as any,
    session: { userId: "user_123" },
    headers: new Headers(),
  }));

  return {
    caller,
    spies: {
      userUpsert,
      exerciseFindUnique,
      txExerciseFindUnique,
      userExerciseFindMany,
      userExerciseFindFirst,
      userExerciseUpsert,
      userExerciseUpdate,
      txUserExerciseFindMany,
      txUserExerciseFindFirst,
      txUserExerciseUpsert,
      txUserExerciseUpdate,
      workoutCreate,
      workoutFindMany,
      workoutFindFirst,
      workoutUpdate,
      workoutExerciseDeleteMany,
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

    expect(spies.txUserExerciseUpsert).toHaveBeenCalledWith(
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

  it("keeps user-exercise writes inside the workout transaction when save fails", async () => {
    const { caller, spies } = makeCaller();
    spies.workoutExerciseSetCreateMany.mockRejectedValueOnce(
      new Error("set insert failed"),
    );

    await expect(
      caller.workout.saveWorkout({
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
      }),
    ).rejects.toThrow("set insert failed");

    expect(spies.txUserExerciseFindMany).toHaveBeenCalledTimes(1);
    expect(spies.txUserExerciseUpsert).toHaveBeenCalledTimes(1);
    expect(spies.userExerciseFindMany).not.toHaveBeenCalled();
    expect(spies.userExerciseUpsert).not.toHaveBeenCalled();
  });

  it("reuses an existing user exercise when the payload differs only by case", async () => {
    const { caller, spies } = makeCaller();
    spies.txUserExerciseFindMany.mockResolvedValue([
      { id: 77, name: "Pull-ups" },
    ]);

    await caller.workout.saveWorkout({
      name: "Session",
      startedAt: new Date(),
      completedAt: new Date(),
      exercises: [
        {
          name: "pull-ups",
          order: 0,
          notes: "",
          sets: [
            {
              order: 0,
              weight: 0,
              reps: 10,
              modifier: null,
              weightModifier: "bodyweight",
              completed: true,
            },
          ],
        },
      ],
      notes: "",
    });

    expect(spies.txUserExerciseUpsert).not.toHaveBeenCalled();
    expect(spies.workoutExerciseCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userExerciseId: 77 }),
      }),
    );
  });
});

describe("workout.updateWorkout", () => {
  it("resolves user exercises inside the update transaction", async () => {
    const { caller, spies } = makeCaller();

    await caller.workout.updateWorkout({
      workoutId: 101,
      workout: {
        name: "Edited Session",
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
                weight: 225,
                reps: 5,
                modifier: null,
                weightModifier: null,
                completed: true,
              },
            ],
          },
        ],
        notes: "",
      },
    });

    expect(spies.workoutFindFirst).toHaveBeenCalledWith({
      where: { id: 101, userId: "user_123" },
      select: { id: true },
    });
    expect(spies.txUserExerciseUpsert).toHaveBeenCalledTimes(1);
    expect(spies.userExerciseUpsert).not.toHaveBeenCalled();
    expect(spies.workoutUpdate).toHaveBeenCalledTimes(1);
    expect(spies.workoutExerciseDeleteMany).toHaveBeenCalledWith({
      where: { workoutSessionId: 101 },
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
      "Pull-ups - BWx10,10,9+1+4",
      "Tricep overhead - 40lbx15,12,8+4",
    ]);
  });
});
