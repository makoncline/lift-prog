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
