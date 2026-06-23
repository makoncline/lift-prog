import { NativeModule, registerWebModule } from "expo";

class LiftHealthModule extends NativeModule<{}> {
  isHealthAvailable() {
    return false;
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
}

export default registerWebModule(LiftHealthModule, "LiftHealth");
