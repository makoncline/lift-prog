import type { ExpoConfig } from "expo/config";

const clerkPublishableKey =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const workoutApiBaseUrl =
  process.env.EXPO_PUBLIC_WORKOUT_API_BASE_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "https://lift.makon.dev";
const localDevUserId = process.env.EXPO_PUBLIC_MOBILE_LOCAL_DEV_USER_ID;
const skipClerk = process.env.EXPO_PUBLIC_MOBILE_SKIP_CLERK === "1";

const config: ExpoConfig = {
  name: "Lift Prog",
  slug: "lift-prog",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.makon.liftprog",
    entitlements: {
      "com.apple.developer.healthkit": true,
    },
    infoPlist: {
      NSHealthShareUsageDescription:
        "Lift Prog reads your latest body weight so bodyweight workouts can start with the right value.",
      NSHealthUpdateUsageDescription:
        "Lift Prog saves strength training workouts to Apple Health when you choose to start a Health workout.",
    },
  },
  extra: {
    clerkPublishableKey,
    workoutApiBaseUrl,
    localDevUserId,
    skipClerk,
  },
};

export default config;
