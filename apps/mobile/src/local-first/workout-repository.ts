import type { Database, Row } from "@tursodatabase/sync-react-native";
import {
  CompletedWorkoutSchema,
  summarizeWorkingSets,
  type CompletedExercise,
  type CompletedWorkout,
  type PreviousExerciseData,
} from "@lift-prog/workout-core";

import type {
  LocalExerciseListItem,
  LocalId,
  LocalPreparedWorkout,
  LocalRecentWorkout,
  LocalWorkoutDataClient,
  LocalWorkoutDetails,
  ProductionExport,
  StoredUserExercise,
  StoredWorkoutAggregate,
} from "./model";
import { withLocalTransaction } from "./transaction";
import {
  LOCAL_DATABASE_VERSION,
  StoredUserExerciseSchema,
  StoredWorkoutAggregateSchema,
} from "./model";

const IMPORT_COMPLETE_KEY = "production-import-v1-complete";
const ACCOUNT_ID_KEY = "bound-account-id";
const ACCOUNT_DELETION_REQUESTED_KEY = "account-deletion-requested";

function importCompleteKey(accountId?: string) {
  return accountId
    ? `${IMPORT_COMPLETE_KEY}:${accountId}`
    : IMPORT_COMPLETE_KEY;
}

function createLocalId() {
  const runtimeCrypto = globalThis.crypto as
    | { randomUUID?: () => string }
    | undefined;
  if (runtimeCrypto?.randomUUID) return runtimeCrypto.randomUUID();

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (token) => {
    const random = Math.floor(Math.random() * 16);
    const value = token === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function readString(row: Row, key: string) {
  const value = row[key];
  return typeof value === "string" ? value : null;
}

function readNumber(row: Row, key: string) {
  const value = row[key];
  return typeof value === "number" ? value : null;
}

function parseWorkoutRow(row: Row): StoredWorkoutAggregate {
  const aggregateJson = readString(row, "aggregate_json");
  const id = readString(row, "id");
  const updatedAt = readString(row, "updated_at");
  if (!aggregateJson || !id || !updatedAt) {
    throw new Error("Local workout row is missing required fields.");
  }

  return StoredWorkoutAggregateSchema.parse({
    ...JSON.parse(aggregateJson),
    id,
    legacyServerId: readNumber(row, "legacy_server_id"),
    schemaVersion: readNumber(row, "schema_version"),
    updatedAt,
  });
}

function parseUserExerciseRow(row: Row): StoredUserExercise {
  const rawPlateLoadMode = readString(row, "plate_load_mode");
  const plateLoadMode =
    rawPlateLoadMode === "equal-sides" || rawPlateLoadMode === "total"
      ? rawPlateLoadMode
      : null;

  return StoredUserExerciseSchema.parse({
    id: readString(row, "id"),
    legacyServerId: readNumber(row, "legacy_server_id"),
    catalogExerciseId: readString(row, "catalog_exercise_id"),
    name: readString(row, "name"),
    notes: readString(row, "notes"),
    plateStartingWeight: readNumber(row, "plate_starting_weight"),
    plateLoadMode,
    restWarmupSeconds: readNumber(row, "rest_warmup_seconds"),
    restWorkingSeconds: readNumber(row, "rest_working_seconds"),
    createdAt: readString(row, "created_at"),
    updatedAt: readString(row, "updated_at"),
  });
}

function formatCompactDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "numeric",
    day: "numeric",
  }).format(date);
}

function formatRelativeDate(date: Date, now = new Date()) {
  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.max(
    0,
    Math.round(
      (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
        new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
        ).getTime()) /
        dayMs,
    ),
  );
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  if (days < 730) return `${Math.round(days / 30)} months ago`;
  return `${Math.round(days / 365)} years ago`;
}

function restTimesFromColumns(value: {
  restWarmupSeconds: number | null;
  restWorkingSeconds: number | null;
}) {
  if (value.restWarmupSeconds == null && value.restWorkingSeconds == null) {
    return undefined;
  }

  return {
    warmupSeconds: value.restWarmupSeconds,
    workingSeconds: value.restWorkingSeconds,
  };
}

function storedUserExerciseRestTimes(exercise: StoredUserExercise) {
  return restTimesFromColumns(exercise);
}

function setsForPrevious(exercise: CompletedExercise) {
  return exercise.sets.map((set) => ({
    weight: set.weight,
    reps: set.reps,
    modifier: set.modifier ?? undefined,
    weightModifier: set.weightModifier ?? undefined,
    restBefore: set.restBefore ?? undefined,
    restSeconds: set.restSeconds ?? undefined,
    notes: set.notes ?? null,
    rir: set.rir ?? null,
  }));
}

function findExercise(
  workout: StoredWorkoutAggregate,
  userExerciseId: string,
  name: string,
) {
  return (
    workout.exercises.find(
      (exercise) => exercise.userExerciseId === userExerciseId,
    ) ??
    workout.exercises.find(
      (exercise) =>
        exercise.name.trim().toLowerCase() === name.trim().toLowerCase(),
    )
  );
}

function buildHistory(
  workouts: StoredWorkoutAggregate[],
  userExercise: StoredUserExercise,
  options?: { excludeWorkoutId?: string },
): NonNullable<PreviousExerciseData["history"]> {
  const occurrences = workouts
    .filter((workout) => workout.id !== options?.excludeWorkoutId)
    .flatMap((workout) => {
      const exercise = findExercise(
        workout,
        userExercise.id,
        userExercise.name,
      );
      return exercise ? [{ workout, exercise }] : [];
    });

  return occurrences.slice(0, 12).map(({ workout, exercise }, index) => ({
    relation: index === 0 ? "last time" : `${index + 1} times ago`,
    relativeDate: formatRelativeDate(workout.completedAt),
    date: formatCompactDate(workout.completedAt),
    bodyWeightLb: workout.bodyWeightLb ?? null,
    workoutNote: workout.notes ?? null,
    workoutExerciseNote: exercise.notes ?? null,
    exerciseNotesSnapshot: exercise.exerciseNotesSnapshot ?? null,
    sets: setsForPrevious(exercise),
  }));
}

function buildPreparedExercise({
  selectedExercise,
  userExercise,
  workouts,
  excludeSelectedFromHistory,
}: {
  selectedExercise: CompletedExercise | null;
  userExercise: StoredUserExercise;
  workouts: StoredWorkoutAggregate[];
  excludeSelectedFromHistory?: string;
}): PreviousExerciseData {
  const latestExercise =
    selectedExercise ??
    workouts
      .map((workout) =>
        findExercise(workout, userExercise.id, userExercise.name),
      )
      .find((exercise): exercise is CompletedExercise => Boolean(exercise)) ??
    null;

  return {
    userExerciseId: userExercise.id,
    name: userExercise.name,
    exerciseNotes: userExercise.notes,
    notes: latestExercise?.notes ?? null,
    exerciseNotesSnapshot: latestExercise?.exerciseNotesSnapshot ?? null,
    plateStartingWeight: userExercise.plateStartingWeight,
    plateLoadMode: userExercise.plateLoadMode,
    restTimes:
      latestExercise?.restTimes ?? storedUserExerciseRestTimes(userExercise),
    sets: latestExercise ? setsForPrevious(latestExercise) : [],
    history: buildHistory(workouts, userExercise, {
      excludeWorkoutId: excludeSelectedFromHistory,
    }),
  };
}

async function loadUserExercises(database: Database) {
  const rows = await database.all(`
    SELECT * FROM user_exercises
    WHERE deleted_at IS NULL
    ORDER BY name COLLATE NOCASE ASC
  `);
  return rows.map(parseUserExerciseRow);
}

async function loadWorkouts(database: Database) {
  const rows = await database.all(`
    SELECT * FROM workouts
    WHERE deleted_at IS NULL AND completed_at IS NOT NULL
    ORDER BY completed_at DESC
  `);
  return rows.map(parseWorkoutRow);
}

async function loadWorkout(database: Database, id: LocalId) {
  const row = await database.get(
    `SELECT * FROM workouts WHERE id = ? AND deleted_at IS NULL`,
    id,
  );
  if (!row) throw new Error("Workout not found.");
  return parseWorkoutRow(row);
}

async function loadUserExerciseByTarget(
  database: Database,
  target: { id?: LocalId; name?: string },
) {
  const row = target.id
    ? await database.get(
        `SELECT * FROM user_exercises WHERE id = ? AND deleted_at IS NULL`,
        target.id,
      )
    : target.name
      ? await database.get(
          `SELECT * FROM user_exercises WHERE name = ? COLLATE NOCASE AND deleted_at IS NULL`,
          target.name.trim(),
        )
      : undefined;
  return row ? parseUserExerciseRow(row) : null;
}

async function ensureUserExercise(
  database: Database,
  exercise: Pick<
    CompletedExercise,
    "userExerciseId" | "name" | "exerciseNotes" | "restTimes"
  >,
) {
  const existing = await loadUserExerciseByTarget(database, {
    id:
      typeof exercise.userExerciseId === "string"
        ? exercise.userExerciseId
        : undefined,
    name: exercise.name,
  });
  const now = new Date().toISOString();

  if (existing) {
    return existing.id;
  }

  const id = createLocalId();
  await database.run(
    `INSERT INTO user_exercises (
       id, legacy_server_id, catalog_exercise_id, name, notes,
       plate_starting_weight, plate_load_mode,
       rest_warmup_seconds, rest_working_seconds,
       created_at, updated_at, deleted_at
     ) VALUES (?, NULL, NULL, ?, ?, NULL, NULL, ?, ?, ?, ?, NULL)`,
    id,
    exercise.name.trim(),
    exercise.exerciseNotes ?? null,
    exercise.restTimes?.warmupSeconds ?? null,
    exercise.restTimes?.workingSeconds ?? null,
    now,
    now,
  );
  return id;
}

async function persistWorkout(
  database: Database,
  workout: CompletedWorkout,
  options?: { id?: LocalId; legacyServerId?: number | null; updatedAt?: Date },
) {
  const id = options?.id ?? workout.clientId ?? createLocalId();
  const updatedAt = options?.updatedAt ?? new Date();

  const exercises: CompletedExercise[] = [];
  for (const exercise of workout.exercises) {
    const userExerciseId = await ensureUserExercise(database, exercise);
    exercises.push({ ...exercise, userExerciseId });
  }

  const normalized = CompletedWorkoutSchema.parse({ ...workout, exercises });
  await database.run(
    `INSERT INTO workouts (
       id, legacy_server_id, name, started_at, completed_at, body_weight_lb,
       aggregate_json, schema_version, updated_at, deleted_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
     ON CONFLICT(id) DO UPDATE SET
       legacy_server_id = excluded.legacy_server_id,
       name = excluded.name,
       started_at = excluded.started_at,
       completed_at = excluded.completed_at,
       body_weight_lb = excluded.body_weight_lb,
       aggregate_json = excluded.aggregate_json,
       schema_version = excluded.schema_version,
       updated_at = excluded.updated_at,
       deleted_at = NULL`,
    id,
    options?.legacyServerId ?? null,
    normalized.name,
    normalized.startedAt.toISOString(),
    normalized.completedAt.toISOString(),
    normalized.bodyWeightLb ?? null,
    JSON.stringify(normalized),
    LOCAL_DATABASE_VERSION,
    updatedAt.toISOString(),
  );

  return id;
}

function workoutToRecent(workout: StoredWorkoutAggregate): LocalRecentWorkout {
  return {
    id: workout.id,
    name: workout.name,
    startedAt: workout.startedAt,
    completedAt: workout.completedAt,
    bodyWeightLb: workout.bodyWeightLb ?? null,
    exerciseSummaries: workout.exercises
      .map((exercise) =>
        summarizeWorkingSets(
          exercise.name,
          exercise.sets.map((set) => ({
            weight: set.weight,
            reps: set.reps,
            modifier: set.modifier ?? undefined,
            weightModifier: set.weightModifier ?? undefined,
            restBefore: set.restBefore ?? undefined,
          })),
        ),
      )
      .filter((summary): summary is string => Boolean(summary)),
  };
}

export function createLocalWorkoutDataClient(
  database: Database,
): LocalWorkoutDataClient {
  return {
    async listRecent(input) {
      const workouts = await loadWorkouts(database);
      return workouts.slice(0, input?.limit ?? 10).map(workoutToRecent);
    },

    async prepareInitialWorkout(input) {
      const [workouts, userExercises] = await Promise.all([
        loadWorkouts(database),
        loadUserExercises(database),
      ]);
      const latestBodyWeight =
        workouts.find((workout) => workout.bodyWeightLb != null)
          ?.bodyWeightLb ?? null;

      if (input.mode === "workoutReference") {
        const selected = await loadWorkout(database, input.workoutId);
        const exercises = selected.exercises.flatMap((exercise) => {
          const userExercise = userExercises.find(
            (candidate) =>
              candidate.id === exercise.userExerciseId ||
              candidate.name.toLowerCase() === exercise.name.toLowerCase(),
          );
          return userExercise
            ? [
                buildPreparedExercise({
                  selectedExercise: exercise,
                  userExercise,
                  workouts,
                }),
              ]
            : [];
        });

        return {
          workoutName: selected.name,
          bodyWeightLb: latestBodyWeight ?? selected.bodyWeightLb ?? null,
          restTimes: selected.restTimes,
          exercises,
        };
      }

      const exercises: PreviousExerciseData[] = [];
      for (const name of input.exerciseNames) {
        let userExercise = userExercises.find(
          (candidate) => candidate.name.toLowerCase() === name.toLowerCase(),
        );
        if (!userExercise) {
          const id = await ensureUserExercise(database, { name });
          userExercise = (await loadUserExerciseByTarget(database, { id }))!;
        }
        exercises.push(
          buildPreparedExercise({
            selectedExercise: null,
            userExercise,
            workouts,
          }),
        );
      }

      return {
        workoutName: input.workoutName ?? "Workout",
        bodyWeightLb: latestBodyWeight,
        restTimes: workouts[0]?.restTimes,
        exercises,
      };
    },

    async listExercises(): Promise<LocalExerciseListItem[]> {
      return (await loadUserExercises(database)).map((exercise) => ({
        id: exercise.id,
        name: exercise.name,
        notes: exercise.notes,
        exerciseId: exercise.catalogExerciseId,
        plateStartingWeight: exercise.plateStartingWeight,
        plateLoadMode: exercise.plateLoadMode,
      }));
    },

    async updateExerciseNote(input) {
      const exercise = await loadUserExerciseByTarget(database, input);
      if (!exercise) return { count: 0 };
      await database.run(
        `UPDATE user_exercises SET notes = ?, updated_at = ? WHERE id = ?`,
        input.note.trim() || null,
        new Date().toISOString(),
        exercise.id,
      );
      return { count: 1 };
    },

    async updateExercisePlateDefaults(input) {
      const exercise = await loadUserExerciseByTarget(database, input);
      if (!exercise) return { count: 0 };
      await database.run(
        `UPDATE user_exercises
         SET plate_starting_weight = ?, plate_load_mode = ?, updated_at = ?
         WHERE id = ?`,
        input.plateStartingWeight,
        input.plateLoadMode,
        new Date().toISOString(),
        exercise.id,
      );
      return { count: 1 };
    },

    async saveWorkout(input) {
      const workoutId = await withLocalTransaction(database, () =>
        persistWorkout(database, input, {
          id: input.clientId,
        }),
      );
      return { success: true, workoutId };
    },

    async getWorkoutDetails(input): Promise<LocalWorkoutDetails> {
      const [selected, workouts, userExercises] = await Promise.all([
        loadWorkout(database, input.workoutId),
        loadWorkouts(database),
        loadUserExercises(database),
      ]);
      return {
        workoutName: selected.name,
        bodyWeightLb: selected.bodyWeightLb ?? null,
        restTimes: selected.restTimes,
        startedAt: selected.startedAt,
        completedAt: selected.completedAt,
        notes: selected.notes ?? null,
        exercises: selected.exercises.flatMap((exercise) => {
          const userExercise = userExercises.find(
            (candidate) =>
              candidate.id === exercise.userExerciseId ||
              candidate.name.toLowerCase() === exercise.name.toLowerCase(),
          );
          return userExercise
            ? [
                buildPreparedExercise({
                  selectedExercise: exercise,
                  userExercise,
                  workouts,
                  excludeSelectedFromHistory: selected.id,
                }),
              ]
            : [];
        }),
      };
    },

    async updateWorkout(input) {
      const existing = await loadWorkout(database, input.workoutId);
      await withLocalTransaction(database, () =>
        persistWorkout(database, input.workout, {
          id: input.workoutId,
          legacyServerId: existing.legacyServerId,
        }),
      );
      return { success: true, workoutId: input.workoutId };
    },

    async deleteWorkout(input) {
      await database.run(
        `UPDATE workouts SET deleted_at = ?, updated_at = ? WHERE id = ?`,
        new Date().toISOString(),
        new Date().toISOString(),
        input.workoutId,
      );
      return { success: true };
    },

    async isAccountDeletionRequested() {
      const row = await database.get(
        `SELECT value FROM app_metadata WHERE key = ?`,
        ACCOUNT_DELETION_REQUESTED_KEY,
      );
      return readString(row ?? {}, "value") === "true";
    },

    async requestAccountDeletion() {
      await database.run(
        `INSERT INTO app_metadata (key, value, updated_at)
         VALUES (?, 'true', ?)
         ON CONFLICT(key) DO UPDATE SET value = 'true', updated_at = excluded.updated_at`,
        ACCOUNT_DELETION_REQUESTED_KEY,
        new Date().toISOString(),
      );
    },

    async cancelAccountDeletionRequest() {
      await database.run(
        `DELETE FROM app_metadata WHERE key = ?`,
        ACCOUNT_DELETION_REQUESTED_KEY,
      );
    },

    async deleteCurrentUser() {
      await withLocalTransaction(database, async () => {
        await database.run(`DELETE FROM workouts`);
        await database.run(`DELETE FROM user_exercises`);
        await database.run(`DELETE FROM active_workout_draft`);
        await database.run(`DELETE FROM app_metadata`);
      });
      return { success: true };
    },
  };
}

export async function bindOrAssertLocalAccount(
  database: Database,
  accountId: string,
  options?: { bindIfUnbound?: boolean; previousAccountIds?: string[] },
) {
  const row = await database.get(
    `SELECT value FROM app_metadata WHERE key = ?`,
    ACCOUNT_ID_KEY,
  );
  const boundAccountId = readString(row ?? {}, "value");
  const canMigrateBinding =
    boundAccountId != null &&
    options?.previousAccountIds?.includes(boundAccountId) === true;
  if (boundAccountId && boundAccountId !== accountId) {
    if (!canMigrateBinding) {
      throw new Error(
        "This local workout log belongs to a different signed-in account.",
      );
    }

    await database.run(
      `UPDATE app_metadata SET value = ?, updated_at = ? WHERE key = ?`,
      accountId,
      new Date().toISOString(),
      ACCOUNT_ID_KEY,
    );
  }
  if (boundAccountId || !options?.bindIfUnbound) return;

  await database.run(
    `INSERT INTO app_metadata (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO NOTHING`,
    ACCOUNT_ID_KEY,
    accountId,
    new Date().toISOString(),
  );

  const legacyImport = await database.get(
    `SELECT value FROM app_metadata WHERE key = ?`,
    IMPORT_COMPLETE_KEY,
  );
  if (readString(legacyImport ?? {}, "value") === "true") {
    await database.run(
      `INSERT INTO app_metadata (key, value, updated_at)
       VALUES (?, 'true', ?)
       ON CONFLICT(key) DO NOTHING`,
      importCompleteKey(accountId),
      new Date().toISOString(),
    );
  }
}

export async function isProductionImportComplete(
  database: Database,
  accountId?: string,
) {
  const row = await database.get(
    `SELECT value FROM app_metadata WHERE key = ?`,
    importCompleteKey(accountId),
  );
  return readString(row ?? {}, "value") === "true";
}

export async function hasLocalWorkoutData(database: Database) {
  const row = await database.get(
    `SELECT
       (SELECT COUNT(*) FROM workouts WHERE deleted_at IS NULL) +
       (SELECT COUNT(*) FROM user_exercises WHERE deleted_at IS NULL) +
       (SELECT COUNT(*) FROM active_workout_draft) AS count`,
  );
  return (readNumber(row ?? {}, "count") ?? 0) > 0;
}

export async function importProductionExport(
  database: Database,
  snapshot: ProductionExport,
  options?: { accountId?: string },
) {
  const now = new Date().toISOString();
  const userExerciseIdMap = new Map<number, string>();

  if (options?.accountId) {
    await bindOrAssertLocalAccount(database, options.accountId, {
      bindIfUnbound: true,
    });
    await database.run(
      `INSERT INTO app_metadata (key, value, updated_at)
       VALUES (?, 'started', ?)
       ON CONFLICT(key) DO UPDATE SET value = 'started', updated_at = excluded.updated_at`,
      `${importCompleteKey(options.accountId)}:status`,
      now,
    );
  }

  try {
    await withLocalTransaction(database, async () => {
      for (const exercise of snapshot.userExercises) {
        const existing = await database.get(
          `SELECT id FROM user_exercises WHERE legacy_server_id = ?`,
          exercise.id,
        );
        const id = readString(existing ?? {}, "id") ?? createLocalId();
        userExerciseIdMap.set(exercise.id, id);
        await database.run(
          `INSERT INTO user_exercises (
           id, legacy_server_id, catalog_exercise_id, name, notes,
           plate_starting_weight, plate_load_mode,
           rest_warmup_seconds, rest_working_seconds,
           created_at, updated_at, deleted_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
         ON CONFLICT(id) DO UPDATE SET
           legacy_server_id = excluded.legacy_server_id,
           catalog_exercise_id = excluded.catalog_exercise_id,
           name = excluded.name,
           notes = excluded.notes,
           plate_starting_weight = excluded.plate_starting_weight,
           plate_load_mode = excluded.plate_load_mode,
           rest_warmup_seconds = excluded.rest_warmup_seconds,
           rest_working_seconds = excluded.rest_working_seconds,
           updated_at = excluded.updated_at,
           deleted_at = NULL`,
          id,
          exercise.id,
          exercise.exerciseId == null ? null : `legacy:${exercise.exerciseId}`,
          exercise.name,
          exercise.notes,
          exercise.plateStartingWeight,
          exercise.plateLoadMode,
          exercise.restWarmupSeconds,
          exercise.restWorkingSeconds,
          exercise.createdAt.toISOString(),
          exercise.updatedAt.toISOString(),
        );
      }

      for (const workout of snapshot.workouts) {
        const existing = await database.get(
          `SELECT id FROM workouts WHERE legacy_server_id = ?`,
          workout.id,
        );
        const id = readString(existing ?? {}, "id") ?? createLocalId();
        const completedWorkout = CompletedWorkoutSchema.parse({
          name: workout.name,
          notes: workout.notes ?? undefined,
          startedAt: workout.startedAt,
          completedAt: workout.completedAt,
          bodyWeightLb: workout.bodyWeightLb,
          restTimes: restTimesFromColumns(workout),
          exercises: workout.exercises.map((exercise) => ({
            userExerciseId: userExerciseIdMap.get(exercise.userExerciseId),
            name:
              snapshot.userExercises.find(
                (candidate) => candidate.id === exercise.userExerciseId,
              )?.name ?? "Exercise",
            order: exercise.order,
            notes: exercise.notes ?? undefined,
            exerciseNotesSnapshot: exercise.exerciseNotesSnapshot ?? undefined,
            restTimes: restTimesFromColumns(exercise),
            sets: exercise.sets.map((set) => ({
              ...set,
              modifier: set.modifier,
              weightModifier: set.weightModifier,
              restBefore: set.restBefore,
              restSeconds: set.restSeconds,
              notes: set.notes ?? undefined,
              rir: set.rir,
            })),
          })),
        });
        await persistWorkout(database, completedWorkout, {
          id,
          legacyServerId: workout.id,
          updatedAt: workout.updatedAt,
        });
      }

      await database.run(
        `INSERT INTO app_metadata (key, value, updated_at)
       VALUES (?, 'true', ?)
       ON CONFLICT(key) DO UPDATE SET value = 'true', updated_at = excluded.updated_at`,
        importCompleteKey(options?.accountId),
        now,
      );

      if (options?.accountId) {
        await database.run(
          `INSERT INTO app_metadata (key, value, updated_at)
         VALUES (?, 'complete', ?)
         ON CONFLICT(key) DO UPDATE SET value = 'complete', updated_at = excluded.updated_at`,
          `${importCompleteKey(options.accountId)}:status`,
          now,
        );
      }
    });
  } catch (error) {
    if (options?.accountId) {
      await database.run(
        `INSERT INTO app_metadata (key, value, updated_at)
         VALUES (?, 'failed', ?)
         ON CONFLICT(key) DO UPDATE SET value = 'failed', updated_at = excluded.updated_at`,
        `${importCompleteKey(options.accountId)}:status`,
        new Date().toISOString(),
      );
    }
    throw error;
  }
}

export async function readActiveWorkoutDraftJson(database: Database) {
  const row = await database.get(
    `SELECT aggregate_json FROM active_workout_draft WHERE slot = 'current'`,
  );
  return readString(row ?? {}, "aggregate_json");
}

export async function writeActiveWorkoutDraftJson(
  database: Database,
  aggregateJson: string,
) {
  await database.run(
    `INSERT INTO active_workout_draft (slot, aggregate_json, updated_at)
     VALUES ('current', ?, ?)
     ON CONFLICT(slot) DO UPDATE SET
       aggregate_json = excluded.aggregate_json,
       updated_at = excluded.updated_at`,
    aggregateJson,
    new Date().toISOString(),
  );
}

export async function clearActiveWorkoutDraftRow(database: Database) {
  await database.run(`DELETE FROM active_workout_draft WHERE slot = 'current'`);
}

export async function quarantineActiveWorkoutDraftJson(
  database: Database,
  aggregateJson: string,
  reason: string,
) {
  await database.run(
    `INSERT INTO quarantined_workout_draft (
       slot, aggregate_json, reason, quarantined_at
     ) VALUES ('current', ?, ?, ?)
     ON CONFLICT(slot) DO UPDATE SET
       aggregate_json = excluded.aggregate_json,
       reason = excluded.reason,
       quarantined_at = excluded.quarantined_at`,
    aggregateJson,
    reason,
    new Date().toISOString(),
  );
  await clearActiveWorkoutDraftRow(database);
}
