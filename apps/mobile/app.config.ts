import type { ExpoConfig } from "expo/config";

const clerkPublishableKey =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

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
  },
  extra: {
    clerkPublishableKey,
  },
};

export default config;
