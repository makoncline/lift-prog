import { NativeModule, requireNativeModule } from "expo";

import type {
  CancelStrengthWorkoutResult,
  FinishStrengthWorkoutResult,
  HealthAuthorizationResult,
  LatestBodyWeight,
  StartStrengthWorkoutResult,
  TimerNotificationResult,
} from "./LiftHealth.types";

declare class LiftHealthModule extends NativeModule<{}> {
  isHealthAvailable(): boolean;
  requestHealthAuthorization(): Promise<HealthAuthorizationResult>;
  getLatestBodyWeight(): Promise<LatestBodyWeight>;
  startStrengthWorkout(
    startedAtMs?: number | null,
  ): Promise<StartStrengthWorkoutResult>;
  finishStrengthWorkout(
    startedAtMs: number,
    endedAtMs: number,
  ): Promise<FinishStrengthWorkoutResult>;
  cancelStrengthWorkout(): Promise<CancelStrengthWorkoutResult>;
  scheduleWorkoutTimerNotification(
    seconds: number,
  ): Promise<TimerNotificationResult>;
}

export default requireNativeModule<LiftHealthModule>("LiftHealth");
