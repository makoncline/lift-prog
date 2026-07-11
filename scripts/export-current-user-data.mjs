import { createClient } from "@libsql/client";
import { writeFile } from "node:fs/promises";

const outputPath = process.argv[2];
const userId = process.env.LOCAL_DEV_USER_ID;
const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!outputPath || !userId || !url || !authToken) {
  throw new Error(
    "Usage: export-current-user-data.mjs <output.json> with LOCAL_DEV_USER_ID, TURSO_DATABASE_URL, and TURSO_AUTH_TOKEN set.",
  );
}

const client = createClient({ url, authToken });

const query = async (sql, args = []) => {
  const result = await client.execute({ sql, args });
  return result.rows;
};

const userExercises = await query(
  `SELECT id, exerciseId, name, notes, plateStartingWeight, plateLoadMode,
          restWarmupSeconds, restWorkingSeconds, createdAt, updatedAt
   FROM UserExercise
   WHERE userId = ?
   ORDER BY id ASC`,
  [userId],
);

const workouts = await query(
  `SELECT id, name, startedAt, completedAt, bodyWeightLb, notes,
          restWarmupSeconds, restWorkingSeconds, updatedAt
   FROM Workout
   WHERE userId = ?
   ORDER BY startedAt ASC`,
  [userId],
);

const workoutIds = workouts.map((workout) => Number(workout.id));
const workoutExercises = workoutIds.length
  ? await query(
      `SELECT id, workoutSessionId, userExerciseId, "order", notes,
              exerciseNotesSnapshot, restWarmupSeconds, restWorkingSeconds
       FROM WorkoutExercise
       WHERE workoutSessionId IN (${workoutIds.map(() => "?").join(",")})
       ORDER BY workoutSessionId ASC, "order" ASC`,
      workoutIds,
    )
  : [];

const workoutExerciseIds = workoutExercises.map((exercise) =>
  Number(exercise.id),
);
const sets = workoutExerciseIds.length
  ? await query(
      `SELECT workoutExerciseId, "order", weight, reps, modifier,
              weightModifier, restBefore, restSeconds, notes, rir, completed
       FROM WorkoutExerciseSet
       WHERE workoutExerciseId IN (${workoutExerciseIds
         .map(() => "?")
         .join(",")})
       ORDER BY workoutExerciseId ASC, "order" ASC`,
      workoutExerciseIds,
    )
  : [];

const snapshot = {
  version: 1,
  exportedAt: new Date().toISOString(),
  userExercises: userExercises.map((exercise) => ({
    ...exercise,
    id: Number(exercise.id),
    exerciseId:
      exercise.exerciseId == null ? null : Number(exercise.exerciseId),
  })),
  workouts: workouts.map((workout) => ({
    ...workout,
    id: Number(workout.id),
    exercises: workoutExercises
      .filter(
        (exercise) => Number(exercise.workoutSessionId) === Number(workout.id),
      )
      .map((exercise) => ({
        ...exercise,
        id: Number(exercise.id),
        userExerciseId: Number(exercise.userExerciseId),
        order: Number(exercise.order),
        sets: sets
          .filter(
            (set) => Number(set.workoutExerciseId) === Number(exercise.id),
          )
          .map(({ workoutExerciseId: _, ...set }) => ({
            ...set,
            order: Number(set.order),
            reps: set.reps == null ? null : Number(set.reps),
            restSeconds:
              set.restSeconds == null ? null : Number(set.restSeconds),
            rir: set.rir == null ? null : Number(set.rir),
            completed: Boolean(set.completed),
          })),
      })),
  })),
};

await writeFile(outputPath, JSON.stringify(snapshot), { mode: 0o600 });
console.log(
  `Exported ${snapshot.workouts.length} workouts and ${snapshot.userExercises.length} user exercises to ${outputPath}.`,
);

client.close();
