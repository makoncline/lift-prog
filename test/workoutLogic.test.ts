import {
  nextProgression,
  estimateSet,
  initialiseExercises,
  workoutReducer,
} from "@/lib/workoutLogic";
import type { Workout } from "@/lib/workoutLogic";

describe("progression helpers", () => {
  it("cycles 12→8 and bumps weight", () => {
    const { weight, reps } = nextProgression(185, 12);
    expect(reps).toBe(8);
    expect(weight).toBeGreaterThan(185);
  });

  it("warm-up cascade uses previous snapshot", () => {
    const ex = initialiseExercises([
      { name: "Bench", sets: [{ weight: 45, reps: 15, isWarmup: true }] },
    ])[0];
    const est = estimateSet(ex.sets, 0, ex);
    expect(est.weight).toBe(45);
    expect(est.reps).toBe(15);
  });
});

describe("initialiseExercises previous summary", () => {
  it("groups repeated weights into shorthand", () => {
    const exercise = initialiseExercises([
      {
        name: "Bench Press",
        sets: [
          { weight: 100, reps: 8 },
          { weight: 100, reps: 6 },
          { weight: 90, reps: 6 },
        ],
        notes: "Paused reps last set",
      },
    ])[0];

    expect(exercise.previousSummary).toBe(
      "Bench Press - 100lbx8,x6,90lbx6",
    );
    expect(exercise.previousNotes).toBe("Paused reps last set");
  });

  it("uses colon format when all weights match", () => {
    const exercise = initialiseExercises([
      {
        name: "Overhead Press",
        sets: [
          { weight: 100, reps: 8 },
          { weight: 100, reps: 8 },
          { weight: 100, reps: 6 },
        ],
      },
    ])[0];

    expect(exercise.previousSummary).toBe(
      "Overhead Press - 100lb:x8,x8,x6",
    );
  });

  it("handles weight changes that return to a previous load", () => {
    const exercise = initialiseExercises([
      {
        name: "Row",
        sets: [
          { weight: 100, reps: 8 },
          { weight: 90, reps: 6 },
          { weight: 100, reps: 6 },
        ],
      },
    ])[0];

    expect(exercise.previousSummary).toBe(
      "Row - 100lbx8,90lbx6,100lbx6",
    );
  });

  it("omits summary when only warmups are present", () => {
    const exercise = initialiseExercises([
      {
        name: "Bike",
        sets: [
          { weight: null, reps: 20, isWarmup: true },
        ],
      },
    ])[0];

    expect(exercise.previousSummary).toBeUndefined();
    expect(exercise.previousNotes).toBeUndefined();
  });
});

describe("PLUS_MINUS reducer", () => {
  const baseState = (): Workout => ({
    currentExerciseIndex: 0,
    exercises: initialiseExercises([
      { name: "Bench", sets: [{ weight: null, reps: 5 }] },
    ]),
    activeField: { exerciseIndex: 0, setIndex: 0, field: "reps" },
    inputValue: "5",
    isFirstInteraction: false,
    notes: [],
    startTime: 0,
    name: "Workout",
    isInProgress: true,
  });

  it("increments and decrements reps", () => {
    const state = baseState();
    const inc = workoutReducer(state, { type: "PLUS_MINUS", sign: 1 });
    expect(inc.inputValue).toBe("6");
    expect(inc.exercises[0].sets[0].reps).toBe(6);

    const dec = workoutReducer(inc, { type: "PLUS_MINUS", sign: -1 });
    expect(dec.inputValue).toBe("5");
    expect(dec.exercises[0].sets[0].reps).toBe(5);
  });

  it("does not decrement reps below zero", () => {
    const state: Workout = {
      ...baseState(),
      inputValue: "0",
      exercises: initialiseExercises([
        { name: "Bench", sets: [{ weight: null, reps: 0 }] },
      ]),
    };
    const dec = workoutReducer(state, { type: "PLUS_MINUS", sign: -1 });
    expect(dec.inputValue).toBe("0");
    expect(dec.exercises[0].sets[0].reps).toBe(0);
  });
});
