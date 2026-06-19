import Constants from "expo-constants";

type MobileExpoExtra = {
  clerkPublishableKey?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as MobileExpoExtra;

export const mobileClerkPublishableKey = extra.clerkPublishableKey ?? "";
