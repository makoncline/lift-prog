import { NativeModule, requireNativeModule } from "expo";

import type {
  CancelTimerNotificationResult,
  CancelUnfinishedWorkoutNotificationResult,
  EndRestTimerLiveActivityResult,
  FinishStrengthWorkoutResult,
  HealthAuthorizationResult,
  LiftHealthEvents,
  LatestBodyWeight,
  RestTimerLiveActivityResult,
  TimerNotificationResult,
  UnfinishedWorkoutNotificationResult,
  WatchWorkoutSnapshot,
  WatchWorkoutSnapshotResult,
} from "./LiftHealth.types";

declare class LiftHealthModule extends NativeModule<LiftHealthEvents> {
  isHealthAvailable(): boolean;
  getHealthAuthorizationStatus(): Promise<HealthAuthorizationResult>;
  requestHealthAuthorization(): Promise<HealthAuthorizationResult>;
  getLatestBodyWeight(): Promise<LatestBodyWeight>;
  finishStrengthWorkout(
    startedAtMs: number,
    endedAtMs: number,
  ): Promise<FinishStrengthWorkoutResult>;
  scheduleWorkoutTimerNotification(
    seconds: number,
  ): Promise<TimerNotificationResult>;
  startOrUpdateRestTimerLiveActivity(
    durationSeconds: number,
    endsAtMs: number,
    title?: string | null,
  ): Promise<RestTimerLiveActivityResult>;
  endRestTimerLiveActivity(): Promise<EndRestTimerLiveActivityResult>;
  cancelWorkoutTimerNotification(
    identifier?: string | null,
  ): Promise<CancelTimerNotificationResult>;
  scheduleUnfinishedWorkoutNotification(
    workoutName: string,
    seconds: number,
  ): Promise<UnfinishedWorkoutNotificationResult>;
  cancelUnfinishedWorkoutNotification(): Promise<CancelUnfinishedWorkoutNotificationResult>;
  updateWatchWorkoutSnapshot(
    snapshot: WatchWorkoutSnapshot,
  ): Promise<WatchWorkoutSnapshotResult>;
  clearWatchWorkoutSnapshot(): Promise<WatchWorkoutSnapshotResult>;
}

export default requireNativeModule<LiftHealthModule>("LiftHealth");
