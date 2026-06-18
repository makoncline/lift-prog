PRAGMA foreign_keys=OFF;

-- CreateTable
CREATE TABLE "UserExercise" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" TEXT NOT NULL,
    "exerciseId" INTEGER,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserExercise_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Backfill one user-owned exercise for every current user/catalog exercise.
-- The app only has one active user today; this preserves all current exercise
-- names and moves legacy Exercise.notes into UserExercise.notes.
INSERT INTO "UserExercise" (
    "userId",
    "exerciseId",
    "name",
    "notes",
    "createdAt",
    "updatedAt"
)
SELECT
    "User"."id",
    "Exercise"."id",
    "Exercise"."name",
    "Exercise"."notes",
    "Exercise"."createdAt",
    "Exercise"."updatedAt"
FROM "User"
CROSS JOIN "Exercise";

-- CreateIndex
CREATE UNIQUE INDEX "UserExercise_userId_name_key" ON "UserExercise"("userId", "name");

-- CreateIndex
CREATE INDEX "UserExercise_exerciseId_idx" ON "UserExercise"("exerciseId");

-- CreateIndex
CREATE INDEX "UserExercise_userId_idx" ON "UserExercise"("userId");

-- Rebuild WorkoutExercise so historical rows point at the user-owned exercise.
CREATE TABLE "new_WorkoutExercise" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workoutSessionId" INTEGER NOT NULL,
    "userExerciseId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "notes" TEXT,
    "exerciseNotesSnapshot" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkoutExercise_workoutSessionId_fkey" FOREIGN KEY ("workoutSessionId") REFERENCES "Workout" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkoutExercise_userExerciseId_fkey" FOREIGN KEY ("userExerciseId") REFERENCES "UserExercise" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_WorkoutExercise" (
    "id",
    "workoutSessionId",
    "userExerciseId",
    "order",
    "notes",
    "exerciseNotesSnapshot",
    "createdAt",
    "updatedAt"
)
SELECT
    "WorkoutExercise"."id",
    "WorkoutExercise"."workoutSessionId",
    "UserExercise"."id",
    "WorkoutExercise"."order",
    "WorkoutExercise"."notes",
    "WorkoutExercise"."exerciseNotesSnapshot",
    "WorkoutExercise"."createdAt",
    "WorkoutExercise"."updatedAt"
FROM "WorkoutExercise"
INNER JOIN "Workout" ON "Workout"."id" = "WorkoutExercise"."workoutSessionId"
INNER JOIN "UserExercise" ON
    "UserExercise"."userId" = "Workout"."userId"
    AND "UserExercise"."exerciseId" = "WorkoutExercise"."exerciseId";

DROP TABLE "WorkoutExercise";
ALTER TABLE "new_WorkoutExercise" RENAME TO "WorkoutExercise";

-- CreateIndex
CREATE INDEX "WorkoutExercise_workoutSessionId_idx" ON "WorkoutExercise"("workoutSessionId");

-- CreateIndex
CREATE INDEX "WorkoutExercise_userExerciseId_idx" ON "WorkoutExercise"("userExerciseId");

-- Rebuild Exercise as a catalog-only table.
CREATE TABLE "new_Exercise" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "mediaUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "new_Exercise" (
    "id",
    "name",
    "description",
    "mediaUrl",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "name",
    NULL,
    NULL,
    "createdAt",
    "updatedAt"
FROM "Exercise";

DROP TABLE "Exercise";
ALTER TABLE "new_Exercise" RENAME TO "Exercise";

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_name_key" ON "Exercise"("name");

PRAGMA foreign_keys=ON;
