import Constants from "expo-constants";

type MobileExpoExtra = {
  workoutApiBaseUrl?: string;
  authBaseUrl?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as MobileExpoExtra;

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

    if (isLocalHost && !__DEV__) {
      return undefined;
    }

    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return undefined;
  }
};

export const mobileWorkoutApiBaseUrl =
  cleanBaseUrl(extra.workoutApiBaseUrl) ?? "https://lift.makon.dev";
export const mobileAuthBaseUrl =
  cleanBaseUrl(extra.authBaseUrl) ?? mobileWorkoutApiBaseUrl;
