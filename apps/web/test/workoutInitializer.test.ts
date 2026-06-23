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

  it("uses the existing exercise name when the request differs only by case", async () => {
    const { prisma, mocks } = createPrismaMock();
    mocks.userExercise.findMany.mockResolvedValue([
      { id: 7, name: "Pull-ups", notes: null },
    ]);
    mocks.workoutExercise.findMany.mockResolvedValue([]);

    const result = await buildInitialExercisesForNames({
      prisma,
      userId: "user-1",
      exerciseNames: ["pull-ups"],
    });

    expect(result).toEqual([
      {
        userExerciseId: 7,
        name: "Pull-ups",
        sets: DEFAULT_SETS,
        notes: null,
        plateStartingWeight: null,
        plateLoadMode: null,
      },
    ]);
  });

  it("reuses sets from the most recent workout when available", async () => {
    const { prisma, mocks } = createPrismaMock();
    mocks.userExercise.findMany.mockResolvedValue([
      { id: 1, name: "Bench Press", notes: null },
    ]);
    mocks.workoutExercise.findMany.mockResolvedValue([
      {
        userExerciseId: 1,
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
        plateStartingWeight: null,
        plateLoadMode: null,
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

  it("fetches histories for multiple exercises in one query and caps each history", async () => {
    const { prisma, mocks } = createPrismaMock();
    mocks.userExercise.findMany.mockResolvedValue([
      { id: 1, name: "Bench Press", notes: null },
      { id: 2, name: "Pull Up", notes: null },
    ]);
    mocks.workoutExercise.findMany.mockResolvedValue([
      ...Array.from({ length: 7 }, (_, index) => ({
        userExerciseId: 1,
        sets: [
          {
            weight: 135 + index,
            reps: 8,
            modifier: null,
            weightModifier: null,
            completed: true,
          },
        ],
        notes: `Bench note ${index}`,
        exerciseNotesSnapshot: null,
        workout: {
          completedAt: new Date(`2026-06-${16 - index}T12:00:00Z`),
          notes: null,
        },
      })),
      {
        userExerciseId: 2,
        sets: [
          {
            weight: 0,
            reps: 10,
            modifier: null,
            weightModifier: "bodyweight",
            completed: true,
          },
        ],
        notes: "Pull note",
        exerciseNotesSnapshot: null,
        workout: {
          completedAt: new Date("2026-06-14T12:00:00Z"),
          notes: null,
        },
      },
    ]);

    const result = await buildInitialExercisesForNames({
      prisma,
      userId: "user-2",
      exerciseNames: ["Bench Press", "Pull Up"],
    });

    expect(mocks.workoutExercise.findMany).toHaveBeenCalledTimes(1);
    expect(mocks.workoutExercise.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userExerciseId: { in: [1, 2] },
        }),
        take: 12,
      }),
    );
    expect(result).toHaveLength(2);
    expect(result[0]?.history).toHaveLength(6);
    expect(result[1]?.history).toHaveLength(1);
    expect(result[0]?.sets).toEqual([{ weight: 135, reps: 8 }]);
    expect(result[1]?.sets).toEqual([
      { weight: 0, reps: 10, weightModifier: "bodyweight" },
    ]);
  });

  it("includes set notes, rest, rir, and exercise notes from history", async () => {
    const { prisma, mocks } = createPrismaMock();
    mocks.userExercise.findMany.mockResolvedValue([
      { id: 2, name: "Pull Up", notes: "Hold dumbbell in thighs" },
    ]);
    mocks.workoutExercise.findMany.mockResolvedValue([
      {
        userExerciseId: 2,
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
        plateStartingWeight: null,
        plateLoadMode: null,
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
        userExerciseId: 5,
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
        plateStartingWeight: null,
        plateLoadMode: null,
      },
    ]);
  });
});

describe("buildInitialExercisesFromWorkout", () => {
  it("preserves exercise and set notes in edit mode while batching histories", async () => {
    const { prisma, mocks } = createPrismaMock();

    mocks.workout.findFirst.mockResolvedValue({
      id: 10,
      name: "Upper Body",
      startedAt: new Date("2026-06-12T11:00:00Z"),
      completedAt: new Date("2026-06-12T12:00:00Z"),
      notes: "Upper felt good",
      workoutExercises: [
        {
          userExercise: {
            id: 1,
            name: "Bench Press",
            notes: "Use ring marks",
          },
          exerciseNotesSnapshot: "Old bench setup",
          sets: [
            {
              weight: 135,
              reps: 8,
              modifier: null,
              weightModifier: null,
              restBefore: "short",
              notes: "Keep elbows tucked",
              rir: 1,
            },
          ],
          notes: "Wide grip today",
        },
        {
          userExercise: { id: 2, name: "Pull Up", notes: null },
          exerciseNotesSnapshot: null,
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

    mocks.workoutExercise.findMany.mockResolvedValue([
      {
        userExerciseId: 1,
        sets: [
          {
            weight: 135,
            reps: 8,
            modifier: null,
            weightModifier: null,
            notes: "History set note",
            completed: true,
          },
        ],
        notes: "Wide grip history",
        exerciseNotesSnapshot: "Older bench setup",
        workout: {
          completedAt: new Date("2026-06-10T12:00:00Z"),
          notes: "History workout note",
        },
      },
      {
        userExerciseId: 2,
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
    ]);

    const result = await buildInitialExercisesFromWorkout({
      prisma,
      userId: "user-3",
      workoutId: 10,
      options: { preserveInstanceNotes: true },
    });

    expect(mocks.workoutExercise.findMany).toHaveBeenCalledTimes(1);
    expect(mocks.workoutExercise.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userExerciseId: { in: [1, 2] },
        }),
        take: 12,
      }),
    );
    expect(result.workoutName).toBe("Upper Body");
    expect(result.exercises).toEqual([
      {
        userExerciseId: 1,
        name: "Bench Press",
        exerciseNotes: "Use ring marks",
        exerciseNotesSnapshot: "Old bench setup",
        sets: [
          {
            weight: 135,
            reps: 8,
            restBefore: "short",
            notes: "Keep elbows tucked",
            rir: 1,
          },
        ],
        notes: "Wide grip today",
        plateStartingWeight: null,
        plateLoadMode: null,
        history: [
          {
            relation: "last time",
            relativeDate: "7 days ago",
            date: "6/10",
            workoutNote: "History workout note",
            workoutExerciseNote: "Wide grip history",
            exerciseNotesSnapshot: "Older bench setup",
            sets: [{ weight: 135, reps: 8, notes: "History set note" }],
          },
        ],
      },
      {
        userExerciseId: 2,
        name: "Pull Up",
        sets: [{ weight: -10, reps: 8, weightModifier: "bodyweight" }],
        notes: null,
        plateStartingWeight: null,
        plateLoadMode: null,
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

  it("strips current workout-exercise and set notes in copy mode but keeps them in history", async () => {
    const { prisma, mocks } = createPrismaMock();

    mocks.workout.findFirst.mockResolvedValue({
      id: 20,
      name: "Copied Upper",
      startedAt: new Date("2026-06-12T11:00:00Z"),
      completedAt: new Date("2026-06-12T12:00:00Z"),
      notes: "Upper felt good",
      workoutExercises: [
        {
          userExercise: {
            id: 1,
            name: "Bench Press",
            notes: "Use ring marks",
          },
          exerciseNotesSnapshot: "Old bench setup",
          sets: [
            {
              weight: 135,
              reps: 8,
              modifier: null,
              weightModifier: null,
              notes: "Do not copy this set note",
              rir: 1,
            },
          ],
          notes: "Do not copy this exercise note",
        },
      ],
    });
    mocks.workoutExercise.findMany.mockResolvedValue([
      {
        userExerciseId: 1,
        sets: [
          {
            weight: 135,
            reps: 8,
            modifier: null,
            weightModifier: null,
            notes: "History set note",
            completed: true,
          },
        ],
        notes: "History exercise note",
        exerciseNotesSnapshot: "History exercise setup",
        workout: {
          completedAt: new Date("2026-06-10T12:00:00Z"),
          notes: "History workout note",
        },
      },
    ]);

    const result = await buildInitialExercisesFromWorkout({
      prisma,
      userId: "user-3",
      workoutId: 20,
      options: { preserveInstanceNotes: false },
    });

    expect(mocks.workoutExercise.findMany).toHaveBeenCalledTimes(1);
    expect(result.exercises).toEqual([
      {
        userExerciseId: 1,
        name: "Bench Press",
        exerciseNotes: "Use ring marks",
        exerciseNotesSnapshot: "Old bench setup",
        sets: [{ weight: 135, reps: 8, rir: 1 }],
        notes: null,
        plateStartingWeight: null,
        plateLoadMode: null,
        history: [
          {
            relation: "last time",
            relativeDate: "7 days ago",
            date: "6/10",
            workoutNote: "History workout note",
            workoutExerciseNote: "History exercise note",
            exerciseNotesSnapshot: "History exercise setup",
            sets: [{ weight: 135, reps: 8, notes: "History set note" }],
          },
        ],
      },
    ]);
  });
});
