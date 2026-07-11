export type HealthAuthorizationResult = {
  available: boolean;
  authorized?: boolean;
  canWriteWorkouts: boolean;
};

export type LatestBodyWeight = {
  valueLb: number;
  date: string;
} | null;

export type WatchWorkoutItemSnapshot = {
  exerciseName: string;
  setId?: string | null;
  setLabel: string;
  setText: string;
  setWeight?: number | null;
  setReps?: number | null;
  setWeightModifier?: "bodyweight" | null;
  setCompleted?: boolean;
};

export type WatchWorkoutSnapshot = {
  workoutName: string;
  exerciseName: string;
  setId?: string | null;
  setLabel: string;
  setText: string;
  setWeight?: number | null;
  setReps?: number | null;
  setWeightModifier?: "bodyweight" | null;
  setCompleted?: boolean;
  restText: string;
  restTimerRunning?: boolean;
  restTimerRemainingSeconds?: number | null;
  restTimerDurationSeconds?: number;
  restTimerEndsAt?: string | null;
  previousSet?: WatchWorkoutItemSnapshot | null;
  nextSet?: WatchWorkoutItemSnapshot | null;
  previousExercise?: WatchWorkoutItemSnapshot | null;
  nextExercise?: WatchWorkoutItemSnapshot | null;
  isActive: boolean;
  updatedAt: string;
};

export type WatchWorkoutCommand =
  | {
      type: "requestSnapshot";
      setId?: string | null;
    }
  | {
      type: "setSetValue";
      setId?: string | null;
      field: "weight" | "reps";
      value: number | null;
    }
  | {
      type: "toggleSetCompleted";
      setId?: string | null;
    }
  | {
      type: "navigateSet";
      setId?: string | null;
      direction: "previous" | "next";
    }
  | {
      type: "navigateExercise";
      direction: "previous" | "next";
    }
  | {
      type: "startRestTimer";
    }
  | {
      type: "resetRestTimer";
    }
  | {
      type: "stopRestTimer";
    };

export type WatchWorkoutSnapshotResult = {
  sent: boolean;
  reachable?: boolean;
  message?: string | null;
};

export type LiftHealthEvents = {
  onUnfinishedWorkoutReminder: () => void;
  onWatchWorkoutCommand: (command: WatchWorkoutCommand) => void;
};

export type FinishStrengthWorkoutResult = {
  saved: boolean;
  live: boolean;
  workoutId?: string;
  message?: string | null;
};

export type TimerNotificationResult = {
  scheduled: boolean;
  identifier?: string;
  seconds?: number;
  message?: string | null;
};

export type CancelTimerNotificationResult = {
  cancelled: boolean;
};

export type RestTimerLiveActivityResult = {
  active: boolean;
  available: boolean;
  activityId?: string;
  message?: string | null;
};

export type EndRestTimerLiveActivityResult = {
  ended: boolean;
  available: boolean;
};

export type UnfinishedWorkoutNotificationResult = TimerNotificationResult;

export type CancelUnfinishedWorkoutNotificationResult =
  CancelTimerNotificationResult;
