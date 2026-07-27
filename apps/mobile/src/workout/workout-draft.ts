import type { Workout } from "@lift-prog/workout-core";

import { openLocalDatabase } from "../local-first/database";
import {
  clearActiveWorkoutDraftRow,
  quarantineActiveWorkoutDraftJson,
  readActiveWorkoutDraftJson,
  writeActiveWorkoutDraftJson,
} from "../local-first/workout-repository";
import { ensureWorkoutSetIds, normalizeBodyWeightLb } from "./workout-session";

export type StoredWorkoutDraft = {
  workout: Workout;
  completedAt: string | null;
  savedAt: number;
};

export type PendingWorkoutDraft = StoredWorkoutDraft;

export async function readActiveWorkoutDraft(): Promise<StoredWorkoutDraft | null> {
  try {
    const database = await openLocalDatabase();
    const raw = await readActiveWorkoutDraftJson(database);
    const draft = parseStoredWorkoutDraft(raw);
    if (raw && !draft) {
      await quarantineActiveWorkoutDraftJson(
        database,
        raw,
        "Stored workout draft could not be parsed by this app version.",
      );
      console.error("quarantined unreadable local workout draft");
    }
    return draft;
  } catch (error) {
    console.error("could not read local workout draft", error);
    return null;
  }
}

export async function writeActiveWorkoutDraft(draft: StoredWorkoutDraft) {
  await writeActiveWorkoutDraftJson(
    await openLocalDatabase(),
    JSON.stringify(draft),
  );
}

export async function clearActiveWorkoutDraft() {
  try {
    await clearActiveWorkoutDraftRow(await openLocalDatabase());
  } catch {
    // Cleanup must not block navigation after a save or discard.
  }
}

export function parseStoredWorkoutDraft(
  raw: string | null,
): StoredWorkoutDraft | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredWorkoutDraft>;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !parsed.workout ||
      !Array.isArray(parsed.workout.exercises) ||
      typeof parsed.savedAt !== "number"
    ) {
      return null;
    }

    const workout = ensureWorkoutSetIds(parsed.workout);
    return {
      workout: {
        ...workout,
        bodyWeightLb: normalizeBodyWeightLb(workout.bodyWeightLb),
      },
      completedAt:
        typeof parsed.completedAt === "string" ? parsed.completedAt : null,
      savedAt: parsed.savedAt,
    };
  } catch {
    return null;
  }
}
