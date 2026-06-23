export type HealthAuthorizationResult = {
  available: boolean;
  authorized?: boolean;
  canWriteWorkouts: boolean;
};

export type LatestBodyWeight = {
  valueLb: number;
  date: string;
} | null;

export type StartStrengthWorkoutResult = {
  started: boolean;
  live: boolean;
  message?: string | null;
};

export type FinishStrengthWorkoutResult = {
  saved: boolean;
  live: boolean;
  workoutId?: string;
  message?: string | null;
};

export type CancelStrengthWorkoutResult = {
  cancelled: boolean;
};

export type TimerNotificationResult = {
  scheduled: boolean;
  identifier?: string;
  seconds?: number;
  message?: string | null;
};
