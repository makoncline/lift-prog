import { describe, expect, test } from "vitest";

import { progressionSchema } from "../src/schemas/progression-schema";

describe("progression input", () => {
  test("keeps defaults and rejects invalid ranges from submitted values", () => {
    expect(progressionSchema.parse({})).toEqual({
      minReps: 8,
      maxReps: 12,
      target1RMIncrement: -5,
    });
    expect(progressionSchema.safeParse({ minReps: 12, maxReps: 8 }).success).toBe(false);
    expect(progressionSchema.safeParse({ targetReps: 20 }).success).toBe(false);
    expect(progressionSchema.safeParse({ minReps: "8" }).success).toBe(false);
  });
});
