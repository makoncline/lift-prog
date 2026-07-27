export type LocalFirstMigration = {
  version: number;
  statements: readonly string[];
};

export const LOCAL_FIRST_MIGRATIONS: readonly LocalFirstMigration[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS app_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS user_exercises (
        id TEXT PRIMARY KEY,
        legacy_server_id INTEGER UNIQUE,
        catalog_exercise_id TEXT,
        name TEXT NOT NULL,
        notes TEXT,
        plate_starting_weight REAL,
        plate_load_mode TEXT,
        rest_warmup_seconds INTEGER,
        rest_working_seconds INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS user_exercises_updated_at_idx
        ON user_exercises(updated_at)`,
      `CREATE TABLE IF NOT EXISTS workouts (
        id TEXT PRIMARY KEY,
        legacy_server_id INTEGER UNIQUE,
        name TEXT NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        body_weight_lb REAL,
        aggregate_json TEXT NOT NULL,
        schema_version INTEGER NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS workouts_completed_at_idx
        ON workouts(completed_at DESC)`,
      `CREATE INDEX IF NOT EXISTS workouts_updated_at_idx
        ON workouts(updated_at)`,
      `CREATE TABLE IF NOT EXISTS active_workout_draft (
        slot TEXT PRIMARY KEY,
        aggregate_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
    ],
  },
  {
    version: 2,
    statements: [
      `CREATE TABLE IF NOT EXISTS quarantined_workout_draft (
        slot TEXT PRIMARY KEY,
        aggregate_json TEXT NOT NULL,
        reason TEXT NOT NULL,
        quarantined_at TEXT NOT NULL
      )`,
    ],
  },
  {
    version: 3,
    statements: [
      `CREATE TABLE IF NOT EXISTS record_tombstones (
        record_type TEXT NOT NULL,
        record_id TEXT NOT NULL,
        deleted_at TEXT NOT NULL,
        PRIMARY KEY (record_type, record_id)
      )`,
    ],
  },
];
