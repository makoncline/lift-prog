import Constants from "expo-constants";

type MobileExpoExtra = {
  localDevUserId?: string;
  workoutApiBaseUrl?: string;
  authBaseUrl?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as MobileExpoExtra;

export const mobileLocalDevUserId = extra.localDevUserId ?? "";
export const mobileWorkoutApiBaseUrl =
  extra.workoutApiBaseUrl ?? "https://lift.makon.dev";
export const mobileAuthBaseUrl = extra.authBaseUrl ?? mobileWorkoutApiBaseUrl;
