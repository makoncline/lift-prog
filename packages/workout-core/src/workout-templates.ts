export interface TemplateExerciseSet {
  weight: number | null; // Weight for the set
  reps: number | null; // Reps for the set
  isWarmup?: boolean; // Optional flag for warmup sets
}

export interface TemplateExercise {
  name: string; // Name of the exercise (should match Exercise model name)
  sets: TemplateExerciseSet[];
}

export interface WorkoutTemplate {
  id: string; // Simple ID like 'push' or 'pull'
  name: string; // User-facing name like "Big 7 - Push"
  // This structure now matches the PreviousExerciseData[] expected by Workout.tsx
  exercises: TemplateExercise[];
}

const PUSH_WORKOUT: WorkoutTemplate = {
  id: "push",
  name: "Big 7 - Push",
  exercises: [
    {
      name: "Barbell Squat",
      sets: [
        { weight: null, reps: 30, isWarmup: true },
        { weight: null, reps: 15, isWarmup: true },
        { weight: null, reps: 8 },
        { weight: null, reps: 8 },
        { weight: null, reps: 8 },
      ],
    },
    {
      name: "Barbell Bench Press",
      sets: [
        { weight: null, reps: 20, isWarmup: true },
        { weight: null, reps: 8 },
        { weight: null, reps: 8 },
        { weight: null, reps: 8 },
      ],
    },
    {
      name: "Barbell Shoulder Press",
      sets: [
        { weight: null, reps: 20, isWarmup: true },
        { weight: null, reps: 8 },
        { weight: null, reps: 8 },
        { weight: null, reps: 8 },
      ],
    },
    {
      name: "Dips",
      sets: [
        { weight: null, reps: 8 },
        { weight: null, reps: 8 },
        { weight: null, reps: 8 },
      ],
    },
  ],
};

const PULL_WORKOUT: WorkoutTemplate = {
  id: "pull",
  name: "Big 7 - Pull",
  exercises: [
    {
      name: "Barbell Deadlift",
      sets: [
        { weight: null, reps: 30, isWarmup: true },
        { weight: null, reps: 20, isWarmup: true },
        { weight: null, reps: 8 },
        { weight: null, reps: 8 },
        { weight: null, reps: 8 },
      ],
    },
    {
      name: "Barbell Bent-Over Row",
      sets: [
        { weight: null, reps: 20, isWarmup: true },
        { weight: null, reps: 8 },
        { weight: null, reps: 8 },
        { weight: null, reps: 8 },
      ],
    },
    {
      name: "Wide Pull-up",
      sets: [
        { weight: null, reps: 20, isWarmup: true },
        { weight: null, reps: 8 },
        { weight: null, reps: 8 },
        { weight: null, reps: 8 },
      ],
    },
    {
      name: "Face pull",
      sets: [
        { weight: null, reps: 8 },
        { weight: null, reps: 8 },
        { weight: null, reps: 8 },
      ],
    },
  ],
};

export const workoutTemplates: WorkoutTemplate[] = [PUSH_WORKOUT, PULL_WORKOUT];

export const getWorkoutTemplateById = (
  id: string,
): WorkoutTemplate | undefined => {
  return workoutTemplates.find((template) => template.id === id);
};
