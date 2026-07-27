import type {
  CompletedExercise,
  CompletedSet,
  RestTimes,
  WorkoutExercise,
  WorkoutSet,
} from "@lift-prog/workout-core";

import {
  applyDefaultRestBoundaries,
  getRestTimerSecondsAfterSet,
} from "../../mobile/src/workout/rest";
import { materializeEditedExerciseSets } from "../../mobile/src/workout/set-edit";
import {
  buildCompletedExercisePreviewLines,
  formatRestChoiceLabel,
} from "../../mobile/src/workout/format";

const restTimes: RestTimes = {
  warmupSeconds: 180,
  workingSeconds: 180,
};

function set(
  weight: number,
  reps: number,
  overrides: Partial<WorkoutSet> = {},
): WorkoutSet {
  return {
    weight,
    reps,
    completed: false,
    weightExplicit: true,
    repsExplicit: true,
    prevWeight: weight,
    prevReps: reps,
    ...overrides,
  };
}

function exercise(sets: WorkoutSet[]): WorkoutExercise {
  return {
    name: "Test exercise",
    notes: [],
    previousSets: [],
    sets,
  };
}

function completedSet(
  weight: number,
  reps: number,
  modifier: "warmup" | null = null,
): CompletedSet {
  return {
    order: 1,
    weight,
    reps,
    modifier,
    weightModifier: null,
    completed: true,
  };
}

function completedExercise(sets: CompletedSet[]): CompletedExercise {
  return {
    name: "Test exercise",
    order: 1,
    sets,
  };
}

describe("mobile workout set editing", () => {
  it("propagates the first working-set load through matching later sets only", () => {
    const original = exercise([
      set(45, 12, { modifier: "warmup" }),
      set(90, 10),
      set(90, 3, { restBefore: "short" }),
      set(90, 8, { restBefore: "standard" }),
      set(80, 12, { restBefore: "standard" }),
      set(90, 6, { restBefore: "standard" }),
    ]);

    const updated = materializeEditedExerciseSets(original, 1, { weight: 95 });

    expect(updated.map(({ weight }) => weight)).toEqual([
      45, 95, 95, 95, 80, 90,
    ]);
    expect(updated.map(({ reps }) => reps)).toEqual([12, 10, 3, 8, 12, 6]);
  });

  it("keeps reps independent between working sets", () => {
    const original = exercise([set(90, 10), set(90, 8)]);

    const updated = materializeEditedExerciseSets(original, 0, { reps: 12 });

    expect(updated.map(({ reps }) => reps)).toEqual([12, 8]);
  });

  it("preserves a bodyweight load mode while propagating its offset", () => {
    const original = exercise([
      set(25, 10, { weightModifier: "bodyweight" }),
      set(25, 8, { weightModifier: "bodyweight" }),
    ]);

    const updated = materializeEditedExerciseSets(original, 0, { weight: 30 });

    expect(updated.map(({ weight }) => weight)).toEqual([30, 30]);
    expect(updated.map(({ weightModifier }) => weightModifier)).toEqual([
      "bodyweight",
      "bodyweight",
    ]);
  });
});

describe("mobile workout rest behavior", () => {
  it("labels a short stored rest as a pause", () => {
    expect(formatRestChoiceLabel("short")).toBe("pause");
    expect(formatRestChoiceLabel("standard")).toBe("standard");
  });

  it("uses short warm-up rests and three-minute working boundaries", () => {
    const normalized = applyDefaultRestBoundaries(
      exercise([
        set(45, 12, { modifier: "warmup" }),
        set(65, 8, { modifier: "warmup" }),
        set(90, 10),
        set(90, 8),
      ]),
      restTimes,
    );

    expect(
      normalized.sets.map(({ restBefore, restSeconds }) => ({
        restBefore,
        restSeconds,
      })),
    ).toEqual([
      { restBefore: undefined, restSeconds: undefined },
      { restBefore: "short", restSeconds: null },
      { restBefore: "standard", restSeconds: 180 },
      { restBefore: "standard", restSeconds: 180 },
    ]);
    expect(getRestTimerSecondsAfterSet(normalized, 0, restTimes)).toBeNull();
    expect(getRestTimerSecondsAfterSet(normalized, 1, restTimes)).toBe(180);
    expect(getRestTimerSecondsAfterSet(normalized, 2, restTimes)).toBe(180);
    expect(getRestTimerSecondsAfterSet(normalized, 3, restTimes)).toBe(180);
  });

  it("uses the boundary after a compound short-rest set", () => {
    const compound = exercise([
      set(90, 10),
      set(90, 3, { restBefore: "short" }),
      set(90, 8, { restBefore: "standard", restSeconds: 180 }),
    ]);

    expect(getRestTimerSecondsAfterSet(compound, 0, restTimes)).toBe(180);
  });
});

describe("mobile finish preview", () => {
  it("labels warm-ups and omits an empty warm-up line", () => {
    expect(
      buildCompletedExercisePreviewLines(
        completedExercise([
          completedSet(45, 12, "warmup"),
          completedSet(90, 10),
          completedSet(90, 8),
        ]),
      ),
    ).toEqual(["W 45lbx12", "90lbx10,8"]);

    expect(
      buildCompletedExercisePreviewLines(
        completedExercise([completedSet(35, 12), completedSet(35, 8)]),
      ),
    ).toEqual(["35lbx12,8"]);
  });
});
