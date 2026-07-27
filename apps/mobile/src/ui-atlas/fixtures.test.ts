import { describe, expect, it } from "vitest";

import {
  atlasRecentWorkouts,
  createAtlasDraftWorkout,
  createAtlasWorkoutClient,
} from "./fixtures";
import {
  getMobileWorkoutInitialState,
  UI_ATLAS_SCENARIO_BY_NUMBER,
} from "./scenario";

describe("mobile UI atlas fixtures", () => {
  it("provides stable workout history without a database", async () => {
    const client = createAtlasWorkoutClient();

    const workouts = await client.listRecent({ limit: 3 });

    expect(workouts).toEqual(atlasRecentWorkouts.slice(0, 3));
    expect(workouts[0]?.exerciseSummaries).toContain(
      "Pull-ups - 25lb x 11, 25lb x 8, 25lb x 3",
    );
  });

  it("creates isolated mutable clients", async () => {
    const first = createAtlasWorkoutClient();
    const second = createAtlasWorkoutClient();
    const firstWorkout = (await first.listRecent({ limit: 1 }))[0];

    await first.deleteWorkout({ workoutId: firstWorkout!.id });

    expect((await first.listRecent({ limit: 1 }))[0]?.id).not.toBe(
      firstWorkout?.id,
    );
    expect((await second.listRecent({ limit: 1 }))[0]?.id).toBe(
      firstWorkout?.id,
    );
  });

  it("creates a fresh draft for each fixture state", () => {
    const first = createAtlasDraftWorkout();
    const second = createAtlasDraftWorkout();

    first.exercises[0]!.sets[0]!.reps = 99;

    expect(second.exercises[0]!.sets[0]!.reps).toBe(15);
  });

  it("translates every workout scenario into isolated component state", () => {
    for (const stateNumber of Object.keys(UI_ATLAS_SCENARIO_BY_NUMBER)) {
      expect(getMobileWorkoutInitialState(stateNumber).freezeEffects).toBe(
        true,
      );
    }
  });
});
