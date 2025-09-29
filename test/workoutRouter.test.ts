import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({ db: {} }));

import { createCaller } from "@/server/api/root";

const makeCaller = () => {
  const exerciseUpsert = vi
    .fn()
    .mockImplementation(async ({ where }: { where: { name: string } }) => ({
      id: where.name.length,
      name: where.name,
    }));

  const workoutCreate = vi.fn().mockResolvedValue({ id: 101 });
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
      exercise: { upsert: exerciseUpsert },
      $transaction: transaction,
    } as any,
    session: { userId: "user_123" },
    headers: new Headers(),
  }));

  return {
    caller,
    spies: {
      exerciseUpsert,
      workoutCreate,
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
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
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
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
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
});
