import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-17T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

type PrismaMocks = {
  userExercise: { findMany: ReturnType<typeof vi.fn> };
  workoutExercise: { findMany: ReturnType<typeof vi.fn> };
  workout: { findFirst: ReturnType<typeof vi.fn> };
};

const createPrismaMock = (): { prisma: PrismaClient; mocks: PrismaMocks } => {
  const mocks: PrismaMocks = {
    userExercise: { findMany: vi.fn() },
    workoutExercise: { findMany: vi.fn() },
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
    mocks.userExercise.findMany.mockResolvedValue([]);

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
    expect(mocks.workoutExercise.findMany).not.toHaveBeenCalled();
  });

  it("reuses sets from the most recent workout when available", async () => {
    const { prisma, mocks } = createPrismaMock();
    mocks.userExercise.findMany.mockResolvedValue([
      { id: 1, name: "Bench Press", notes: null },
    ]);
    mocks.workoutExercise.findMany.mockResolvedValue([
      {
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
        exerciseNotesSnapshot: null,
        workout: { completedAt: new Date("2026-06-10T12:00:00Z"), notes: null },
      },
    ]);

    const result = await buildInitialExercisesForNames({
      prisma,
      userId: "user-2",
      exerciseNames: ["Bench Press"],
    });

    expect(result).toEqual([
      {
        userExerciseId: 1,
        name: "Bench Press",
        sets: [
          { weight: 45, reps: 12, modifier: "warmup" },
          { weight: 135, reps: 8 },
          { weight: 155, reps: 6, weightModifier: "bodyweight" },
        ],
        notes: "Felt strong",
        history: [
          {
            relation: "last time",
            relativeDate: "7 days ago",
            date: "6/10",
            workoutExerciseNote: "Felt strong",
            sets: [
              { weight: 45, reps: 12, modifier: "warmup" },
              { weight: 135, reps: 8 },
              { weight: 155, reps: 6, weightModifier: "bodyweight" },
            ],
          },
        ],
      },
    ]);
  });

  it("includes set notes, rest, rir, and exercise notes from history", async () => {
    const { prisma, mocks } = createPrismaMock();
    mocks.userExercise.findMany.mockResolvedValue([
      { id: 2, name: "Pull Up", notes: "Hold dumbbell in thighs" },
    ]);
    mocks.workoutExercise.findMany.mockResolvedValue([
      {
        sets: [
          {
            weight: 0,
            reps: 15,
            modifier: "warmup",
            weightModifier: "bodyweight",
            restBefore: null,
            notes: "Foot assist",
            rir: 2,
            completed: true,
          },
          {
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
        notes: "Feeling weak today",
        exerciseNotesSnapshot: "Old machine setup",
        workout: {
          completedAt: new Date("2026-06-10T12:00:00Z"),
          notes: "Pull day felt low energy",
        },
      },
    ]);

    const result = await buildInitialExercisesForNames({
      prisma,
      userId: "user-2",
      exerciseNames: ["Pull Up"],
    });

    expect(result).toEqual([
      {
        userExerciseId: 2,
        name: "Pull Up",
        exerciseNotes: "Hold dumbbell in thighs",
        exerciseNotesSnapshot: "Old machine setup",
        sets: [
          {
            weight: 0,
            reps: 15,
            modifier: "warmup",
            weightModifier: "bodyweight",
            notes: "Foot assist",
            rir: 2,
          },
          {
            weight: 20,
            reps: 13,
            restBefore: "short",
            notes: "solid first set",
            rir: 1,
          },
        ],
        notes: "Feeling weak today",
        history: [
          {
            relation: "last time",
            relativeDate: "7 days ago",
            date: "6/10",
            workoutNote: "Pull day felt low energy",
            workoutExerciseNote: "Feeling weak today",
            exerciseNotesSnapshot: "Old machine setup",
            sets: [
              {
                weight: 0,
                reps: 15,
                modifier: "warmup",
                weightModifier: "bodyweight",
                notes: "Foot assist",
                rir: 2,
              },
              {
                weight: 20,
                reps: 13,
                restBefore: "short",
                notes: "solid first set",
                rir: 1,
              },
            ],
          },
        ],
      },
    ]);
  });

  it("falls back to defaults if no sets were completed last time", async () => {
    const { prisma, mocks } = createPrismaMock();
    mocks.userExercise.findMany.mockResolvedValue([
      { id: 5, name: "Squat", notes: null },
    ]);
    mocks.workoutExercise.findMany.mockResolvedValue([
      {
        sets: [
          {
            weight: 135,
            reps: 5,
            modifier: null,
            weightModifier: null,
            completed: false,
          },
        ],
        notes: null,
        exerciseNotesSnapshot: null,
        workout: { completedAt: new Date("2026-06-10T12:00:00Z"), notes: null },
      },
    ]);

    const result = await buildInitialExercisesForNames({
      prisma,
      userId: "user-4",
      exerciseNames: ["Squat"],
    });

    expect(result).toEqual([
      {
        userExerciseId: 5,
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
          userExercise: { id: 1, name: "Bench Press", notes: null },
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
          userExercise: { id: 2, name: "Pull Up", notes: null },
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

    mocks.workoutExercise.findMany.mockImplementation(async (args) => {
      switch (args.where?.userExerciseId) {
        case 1:
          return [
            {
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
              exerciseNotesSnapshot: null,
              workout: {
                completedAt: new Date("2026-06-10T12:00:00Z"),
                notes: null,
              },
            },
          ];
        case 2:
          return [
            {
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
              exerciseNotesSnapshot: null,
              workout: {
                completedAt: new Date("2026-06-10T12:00:00Z"),
                notes: null,
              },
            },
          ];
        default:
          return [];
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
        userExerciseId: 1,
        name: "Bench Press",
        sets: [{ weight: 135, reps: 8 }],
        notes: "Wide grip",
        history: [
          {
            relation: "last time",
            relativeDate: "7 days ago",
            date: "6/10",
            workoutExerciseNote: "Wide grip",
            sets: [{ weight: 135, reps: 8 }],
          },
        ],
      },
      {
        userExerciseId: 2,
        name: "Pull Up",
        sets: [{ weight: -10, reps: 8, weightModifier: "bodyweight" }],
        notes: null,
        history: [
          {
            relation: "last time",
            relativeDate: "7 days ago",
            date: "6/10",
            sets: [{ weight: -10, reps: 8, weightModifier: "bodyweight" }],
          },
        ],
      },
    ]);
  });
});
