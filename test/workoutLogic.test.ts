import {
  nextProgression,
  estimateSet,
  initialiseExercises,
} from "@/lib/workoutLogic";

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
