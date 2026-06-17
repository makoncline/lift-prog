-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN "notes" TEXT;

-- AlterTable
ALTER TABLE "WorkoutExercise" ADD COLUMN "exerciseNotesSnapshot" TEXT;

-- AlterTable
ALTER TABLE "WorkoutExerciseSet" ADD COLUMN "notes" TEXT;
ALTER TABLE "WorkoutExerciseSet" ADD COLUMN "restBefore" TEXT;
ALTER TABLE "WorkoutExerciseSet" ADD COLUMN "rir" INTEGER;
