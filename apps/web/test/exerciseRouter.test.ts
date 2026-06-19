import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({ db: {} }));

import { createCaller } from "@/server/api/root";

const makeCaller = () => {
  const exerciseFindUnique = vi.fn().mockResolvedValue(null);
  const userExerciseFindMany = vi.fn().mockResolvedValue([]);
  const userExerciseUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
  const userExerciseUpsert = vi.fn().mockResolvedValue({ id: 1 });
  const userExerciseCreate = vi.fn().mockResolvedValue({ id: 1 });

  const caller = createCaller(async () => ({
    db: {
      exercise: { findUnique: exerciseFindUnique },
      userExercise: {
        findMany: userExerciseFindMany,
        updateMany: userExerciseUpdateMany,
        upsert: userExerciseUpsert,
        create: userExerciseCreate,
      },
    } as any,
    session: { userId: "user_123" },
    headers: new Headers(),
  }));

  return {
    caller,
    spies: {
      exerciseFindUnique,
      userExerciseFindMany,
      userExerciseUpdateMany,
      userExerciseUpsert,
      userExerciseCreate,
    },
  };
};

describe("exercise.add", () => {
  it("rejects a new exercise when an existing name differs only by case", async () => {
    const { caller, spies } = makeCaller();
    spies.userExerciseFindMany.mockResolvedValue([
      { id: 44, name: "Pull-ups" },
    ]);

    await expect(caller.exercise.add({ name: "pull-ups" })).rejects.toThrow(
      'Exercise named "Pull-ups" already exists.',
    );

    expect(spies.userExerciseCreate).not.toHaveBeenCalled();
  });
});

describe("exercise.updateNote", () => {
  it("updates an existing exercise when name fallback differs only by case", async () => {
    const { caller, spies } = makeCaller();
    spies.userExerciseFindMany.mockResolvedValue([
      { id: 44, name: "Pull-ups" },
    ]);

    await caller.exercise.updateNote({
      name: "pull-ups",
      note: "Hold dumbbell in thighs",
    });

    expect(spies.userExerciseUpdateMany).toHaveBeenCalledWith({
      where: { id: 44, userId: "user_123" },
      data: { notes: "Hold dumbbell in thighs" },
    });
    expect(spies.userExerciseUpsert).not.toHaveBeenCalled();
  });

  it("rejects when name fallback resolves but no row is updated", async () => {
    const { caller, spies } = makeCaller();
    spies.userExerciseFindMany.mockResolvedValue([
      { id: 44, name: "Pull-ups" },
    ]);
    spies.userExerciseUpdateMany.mockResolvedValue({ count: 0 });

    await expect(
      caller.exercise.updateNote({
        name: "pull-ups",
        note: "Hold dumbbell in thighs",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("exercise.updatePlateDefaults", () => {
  it("updates an existing exercise when name fallback differs only by case", async () => {
    const { caller, spies } = makeCaller();
    spies.userExerciseFindMany.mockResolvedValue([
      { id: 44, name: "Pull-ups" },
    ]);

    await caller.exercise.updatePlateDefaults({
      name: "pull-ups",
      plateStartingWeight: 45,
      plateLoadMode: "equal-sides",
    });

    expect(spies.userExerciseUpdateMany).toHaveBeenCalledWith({
      where: { id: 44, userId: "user_123" },
      data: {
        plateStartingWeight: 45,
        plateLoadMode: "equal-sides",
      },
    });
    expect(spies.userExerciseUpsert).not.toHaveBeenCalled();
  });
});
