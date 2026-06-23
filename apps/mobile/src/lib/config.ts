import Constants from "expo-constants";

type MobileExpoExtra = {
  clerkPublishableKey?: string;
  localDevUserId?: string;
  skipClerk?: boolean;
  workoutApiBaseUrl?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as MobileExpoExtra;

export const mobileClerkPublishableKey = extra.clerkPublishableKey ?? "";
export const mobileLocalDevUserId = extra.localDevUserId ?? "";
export const mobileSkipClerk = extra.skipClerk === true;
export const mobileWorkoutApiBaseUrl =
  extra.workoutApiBaseUrl ?? "https://lift.makon.dev";
