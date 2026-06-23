import LiftHealthModule from "./LiftHealthModule";

export type {
  CancelStrengthWorkoutResult,
  FinishStrengthWorkoutResult,
  HealthAuthorizationResult,
  LatestBodyWeight,
  StartStrengthWorkoutResult,
  TimerNotificationResult,
} from "./LiftHealth.types";

export function isHealthAvailable() {
  return LiftHealthModule.isHealthAvailable();
}

export function requestHealthAuthorization() {
  return LiftHealthModule.requestHealthAuthorization();
}

export function getLatestBodyWeight() {
  return LiftHealthModule.getLatestBodyWeight();
}

export function startStrengthWorkout(startedAtMs?: number | null) {
  return LiftHealthModule.startStrengthWorkout(startedAtMs);
}

export function finishStrengthWorkout(startedAtMs: number, endedAtMs: number) {
  return LiftHealthModule.finishStrengthWorkout(startedAtMs, endedAtMs);
}

export function cancelStrengthWorkout() {
  return LiftHealthModule.cancelStrengthWorkout();
}

export function scheduleWorkoutTimerNotification(seconds: number) {
  return LiftHealthModule.scheduleWorkoutTimerNotification(seconds);
}
