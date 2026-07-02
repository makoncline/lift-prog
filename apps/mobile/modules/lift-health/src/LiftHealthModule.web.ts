import { NativeModule, registerWebModule } from "expo";

import type { LiftHealthEvents } from "./LiftHealth.types";

class LiftHealthModule extends NativeModule<LiftHealthEvents> {
  isHealthAvailable() {
    return false;
  }

  async getHealthAuthorizationStatus() {
    return { available: false, canWriteWorkouts: false };
  }

  async requestHealthAuthorization() {
    return { available: false, canWriteWorkouts: false };
  }

  async getLatestBodyWeight() {
    return null;
  }

  async startStrengthWorkout() {
    return {
      started: false,
      live: false,
      message: "HealthKit is only available on iOS.",
    };
  }

  async finishStrengthWorkout() {
    return {
      saved: false,
      live: false,
      message: "HealthKit is only available on iOS.",
    };
  }

  async cancelStrengthWorkout() {
    return { cancelled: true };
  }

  async scheduleWorkoutTimerNotification() {
    return {
      scheduled: false,
      message: "Notifications are only available in the native app.",
    };
  }

  async startOrUpdateRestTimerLiveActivity() {
    return {
      active: false,
      available: false,
      message: "Live Activities are only available in the native iOS app.",
    };
  }

  async endRestTimerLiveActivity() {
    return {
      ended: false,
      available: false,
    };
  }

  async cancelWorkoutTimerNotification() {
    return { cancelled: true };
  }

  async scheduleUnfinishedWorkoutNotification() {
    return {
      scheduled: false,
      message: "Notifications are only available in the native app.",
    };
  }

  async cancelUnfinishedWorkoutNotification() {
    return { cancelled: true };
  }

  async updateWatchWorkoutSnapshot() {
    return {
      sent: false,
      message: "Apple Watch sync is only available in the native iOS app.",
    };
  }

  async clearWatchWorkoutSnapshot() {
    return {
      sent: false,
      message: "Apple Watch sync is only available in the native iOS app.",
    };
  }
}

export default registerWebModule(LiftHealthModule, "LiftHealth");
