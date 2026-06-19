import {
  buildAddedWeightRepRows,
  calculatePlatePlan,
} from "@/lib/weight-helper";

describe("weight helper plate plans", () => {
  it("loads equal sides from a 45lb bar", () => {
    expect(calculatePlatePlan(100, 45, "equal-sides")).toEqual({
      mode: "equal-sides",
      targetWeight: 100,
      startingWeight: 45,
      loadWeight: 27.5,
      title: "27.5lb each side",
      plates: [
        { weight: 25, count: 1 },
        { weight: 2.5, count: 1 },
      ],
      error: null,
    });
  });

  it("loads total added weight from a 45lb start", () => {
    expect(calculatePlatePlan(100, 45, "total")).toEqual({
      mode: "total",
      targetWeight: 100,
      startingWeight: 45,
      loadWeight: 55,
      title: "55lb added",
      plates: [
        { weight: 45, count: 1 },
        { weight: 10, count: 1 },
      ],
      error: null,
    });
  });

  it("keeps no starting weight as a valid zero-start plan", () => {
    expect(calculatePlatePlan(100, 0, "equal-sides")).toEqual({
      mode: "equal-sides",
      targetWeight: 100,
      startingWeight: 0,
      loadWeight: 50,
      title: "50lb each side",
      plates: [
        { weight: 45, count: 1 },
        { weight: 5, count: 1 },
      ],
      error: null,
    });
  });

  it("rejects equal-side targets that cannot split into available plates", () => {
    expect(calculatePlatePlan(102.5, 45, "equal-sides")).toEqual({
      mode: "equal-sides",
      targetWeight: 102.5,
      startingWeight: 45,
      loadWeight: 28.75,
      title: "28.75lb each side",
      plates: [],
      error: "2.5lb plates need 5lb total jumps",
    });
  });
});

describe("weight helper added-weight rows", () => {
  it("returns the nearest under and over suggestions around the current 1RM", () => {
    const currentOneRepMax = 144;
    const rows = buildAddedWeightRepRows(
      100,
      currentOneRepMax,
      5,
      "equal-sides",
    );

    expect(
      rows.map(({ label, targetWeight, targetReps }) => ({
        label,
        targetWeight,
        targetReps,
      })),
    ).toEqual([
      { label: "under", targetWeight: 110, targetReps: 9 },
      { label: "over", targetWeight: 110, targetReps: 10 },
    ]);
    expect(rows[0]?.targetOneRepMax).toBeLessThanOrEqual(currentOneRepMax);
    expect(rows[1]?.targetOneRepMax).toBeGreaterThan(currentOneRepMax);
  });
});
