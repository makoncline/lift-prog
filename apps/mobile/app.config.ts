import type { ExpoConfig } from "expo/config";

const cleanBaseUrl = (rawUrl: string | undefined): string | undefined => {
  if (!rawUrl) {
    return undefined;
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return undefined;
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    const isLocalHost =
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname.startsWith("192.168.") ||
      parsed.hostname.startsWith("10.");

    if (isLocalHost) {
      return undefined;
    }

    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return undefined;
  }
};

const fallbackWorkoutApiBaseUrl =
  process.env.EXPO_PUBLIC_WORKOUT_API_BASE_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "https://lift.makon.dev";
const workoutApiBaseUrl =
  cleanBaseUrl(fallbackWorkoutApiBaseUrl) ?? "https://lift.makon.dev";
const authBaseUrl =
  cleanBaseUrl(process.env.EXPO_PUBLIC_AUTH_BASE_URL) ?? workoutApiBaseUrl;
const localDevUserId =
  process.env.EXPO_PUBLIC_MOBILE_LOCAL_DEV_USER_ID ??
  process.env.LOCAL_DEV_USER_ID;

const config: ExpoConfig = {
  name: "Lift Prog",
  slug: "lift-prog",
  scheme: "lift-prog",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  icon: "./ios/LiftProg/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png",
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.makon.liftprog",
    buildNumber: "2",
    entitlements: {
      "com.apple.developer.healthkit": true,
    },
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSHealthShareUsageDescription:
        "Lift Prog reads your latest body weight so bodyweight workouts can start with the right value.",
      NSHealthUpdateUsageDescription:
        "Lift Prog saves completed strength training workouts to Apple Health.",
    },
  },
  plugins: ["expo-secure-store", "@react-native-community/datetimepicker"],
  extra: {
    workoutApiBaseUrl,
    authBaseUrl,
    localDevUserId,
  },
};

export default config;
