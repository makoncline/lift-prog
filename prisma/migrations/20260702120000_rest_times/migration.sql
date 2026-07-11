ALTER TABLE "UserExercise" ADD COLUMN "restWarmupSeconds" INTEGER;
ALTER TABLE "UserExercise" ADD COLUMN "restWorkingSeconds" INTEGER;

ALTER TABLE "Workout" ADD COLUMN "restWarmupSeconds" INTEGER;
ALTER TABLE "Workout" ADD COLUMN "restWorkingSeconds" INTEGER;

ALTER TABLE "WorkoutExercise" ADD COLUMN "restWarmupSeconds" INTEGER;
ALTER TABLE "WorkoutExercise" ADD COLUMN "restWorkingSeconds" INTEGER;

ALTER TABLE "WorkoutExerciseSet" ADD COLUMN "restSeconds" INTEGER;
