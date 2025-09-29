import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  buildInitialExercisesForNames,
  buildInitialExercisesFromWorkout,
} from "@/server/services/workout-initializer";

const DEFAULT_SETS = [
  { weight: null, reps: 20, modifier: "warmup" },
  { weight: null, reps: 8 },
  { weight: null, reps: 8 },
  { weight: null, reps: 8 },
];

type PrismaMocks = {
  exercise: { findMany: ReturnType<typeof vi.fn> };
  workoutExercise: { findFirst: ReturnType<typeof vi.fn> };
  workout: { findFirst: ReturnType<typeof vi.fn> };
};

const createPrismaMock = (): { prisma: PrismaClient; mocks: PrismaMocks } => {
  const mocks: PrismaMocks = {
    exercise: { findMany: vi.fn() },
    workoutExercise: { findFirst: vi.fn() },
    workout: { findFirst: vi.fn() },
  };

  return {
    prisma: mocks as unknown as PrismaClient,
    mocks,
  };
};

describe("buildInitialExercisesForNames", () => {
  it("provides default sets when exercise history is missing", async () => {
    const { prisma, mocks } = createPrismaMock();
    mocks.exercise.findMany.mockResolvedValue([]);

    const result = await buildInitialExercisesForNames({
      prisma,
      userId: "user-1",
      exerciseNames: ["Push Up"],
    });

    expect(result).toEqual([
      {
        name: "Push Up",
        sets: DEFAULT_SETS,
        notes: null,
      },
    ]);
    expect(mocks.workoutExercise.findFirst).not.toHaveBeenCalled();
  });

  it("reuses sets from the most recent workout when available", async () => {
    const { prisma, mocks } = createPrismaMock();
    mocks.exercise.findMany.mockResolvedValue([
      { id: 1, name: "Bench Press" },
    ]);
    mocks.workoutExercise.findFirst.mockResolvedValue({
      sets: [
        {
          weight: 45,
          reps: 12,
          modifier: "warmup",
          weightModifier: null,
          completed: true,
        },
        {
          weight: 135,
          reps: 8,
          modifier: null,
          weightModifier: null,
          completed: true,
        },
        {
          weight: 155,
          reps: 6,
          modifier: null,
          weightModifier: "bodyweight",
          completed: true,
        },
      ],
      notes: "Felt strong",
    });

    const result = await buildInitialExercisesForNames({
      prisma,
      userId: "user-2",
      exerciseNames: ["Bench Press"],
    });

    expect(result).toEqual([
      {
        name: "Bench Press",
        sets: [
          { weight: 45, reps: 12, modifier: "warmup" },
          { weight: 135, reps: 8 },
          { weight: 155, reps: 6, weightModifier: "bodyweight" },
        ],
        notes: "Felt strong",
      },
    ]);
  });

  it("falls back to defaults if no sets were completed last time", async () => {
    const { prisma, mocks } = createPrismaMock();
    mocks.exercise.findMany.mockResolvedValue([
      { id: 5, name: "Squat" },
    ]);
    mocks.workoutExercise.findFirst.mockResolvedValue({
      sets: [
        {
          weight: 135,
          reps: 5,
          modifier: null,
          weightModifier: null,
          completed: false,
        },
      ],
    });

    const result = await buildInitialExercisesForNames({
      prisma,
      userId: "user-4",
      exerciseNames: ["Squat"],
    });

    expect(result).toEqual([
      {
        name: "Squat",
        sets: DEFAULT_SETS,
        notes: null,
      },
    ]);
  });
});

describe("buildInitialExercisesFromWorkout", () => {
  it("returns exercises in workout order using the latest history for each", async () => {
    const { prisma, mocks } = createPrismaMock();

  mocks.workout.findFirst.mockResolvedValue({
    id: 10,
    name: "Upper Body",
    workoutExercises: [
      {
        exercise: { name: "Bench Press" },
        sets: [
          {
            weight: 135,
            reps: 8,
            modifier: null,
            weightModifier: null,
          },
        ],
        notes: "Wide grip",
      },
      {
        exercise: { name: "Pull Up" },
        sets: [
          {
            weight: -10,
            reps: 8,
            modifier: null,
            weightModifier: "bodyweight",
          },
        ],
        notes: null,
      },
    ],
  });

  mocks.exercise.findMany.mockResolvedValue([
    { id: 1, name: "Bench Press" },
    { id: 2, name: "Pull Up" },
  ]);

  mocks.workoutExercise.findFirst.mockImplementation(async (args) => {
    switch (args.where?.exerciseId) {
      case 1:
        return {
          sets: [
            {
              weight: 135,
              reps: 8,
              modifier: null,
              weightModifier: null,
              completed: true,
            },
          ],
          notes: "Wide grip",
        };
      case 2:
        return {
          sets: [
            {
              weight: -10,
              reps: 8,
              modifier: null,
              weightModifier: "bodyweight",
              completed: true,
            },
          ],
          notes: null,
        };
      default:
        return null;
    }
  });

    const result = await buildInitialExercisesFromWorkout({
      prisma,
      userId: "user-3",
      workoutId: 10,
    });

    expect(result.workoutName).toBe("Upper Body");
    expect(result.exercises).toEqual([
      {
        name: "Bench Press",
        sets: [{ weight: 135, reps: 8 }],
        notes: "Wide grip",
      },
      {
        name: "Pull Up",
        sets: [{ weight: -10, reps: 8, weightModifier: "bodyweight" }],
        notes: null,
      },
    ]);
  });
});
