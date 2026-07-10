import LiftHealthModule from "./LiftHealthModule";

import type {
  WatchWorkoutCommand,
  WatchWorkoutSnapshot,
} from "./LiftHealth.types";

export type {
  CancelTimerNotificationResult,
  CancelUnfinishedWorkoutNotificationResult,
  EndRestTimerLiveActivityResult,
  FinishStrengthWorkoutResult,
  HealthAuthorizationResult,
  LatestBodyWeight,
  RestTimerLiveActivityResult,
  TimerNotificationResult,
  UnfinishedWorkoutNotificationResult,
  WatchWorkoutCommand,
  WatchWorkoutItemSnapshot,
  WatchWorkoutSnapshot,
  WatchWorkoutSnapshotResult,
} from "./LiftHealth.types";

export function isHealthAvailable() {
  return LiftHealthModule.isHealthAvailable();
}

export function getHealthAuthorizationStatus() {
  return LiftHealthModule.getHealthAuthorizationStatus();
}

export function requestHealthAuthorization() {
  return LiftHealthModule.requestHealthAuthorization();
}

export function getLatestBodyWeight() {
  return LiftHealthModule.getLatestBodyWeight();
}

export function addUnfinishedWorkoutReminderListener(listener: () => void) {
  return LiftHealthModule.addListener("onUnfinishedWorkoutReminder", listener);
}

export function addWatchWorkoutCommandListener(
  listener: (command: WatchWorkoutCommand) => void,
) {
  return LiftHealthModule.addListener("onWatchWorkoutCommand", listener);
}

export function finishStrengthWorkout(startedAtMs: number, endedAtMs: number) {
  return LiftHealthModule.finishStrengthWorkout(startedAtMs, endedAtMs);
}

export function scheduleWorkoutTimerNotification(seconds: number) {
  return LiftHealthModule.scheduleWorkoutTimerNotification(seconds);
}

export function startOrUpdateRestTimerLiveActivity(
  durationSeconds: number,
  endsAtMs: number,
  title?: string | null,
) {
  return LiftHealthModule.startOrUpdateRestTimerLiveActivity(
    durationSeconds,
    endsAtMs,
    title,
  );
}

export function endRestTimerLiveActivity() {
  return LiftHealthModule.endRestTimerLiveActivity();
}

export function cancelWorkoutTimerNotification(identifier?: string | null) {
  return LiftHealthModule.cancelWorkoutTimerNotification(identifier);
}

export function scheduleUnfinishedWorkoutNotification(
  workoutName: string,
  seconds: number,
) {
  return LiftHealthModule.scheduleUnfinishedWorkoutNotification(
    workoutName,
    seconds,
  );
}

export function cancelUnfinishedWorkoutNotification() {
  return LiftHealthModule.cancelUnfinishedWorkoutNotification();
}

export function updateWatchWorkoutSnapshot(snapshot: WatchWorkoutSnapshot) {
  return LiftHealthModule.updateWatchWorkoutSnapshot(snapshot);
}

export function clearWatchWorkoutSnapshot() {
  return LiftHealthModule.clearWatchWorkoutSnapshot();
}
