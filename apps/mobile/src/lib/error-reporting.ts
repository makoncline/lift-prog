import Constants from "expo-constants";
import { Platform } from "react-native";

import { mobileWorkoutApiBaseUrl } from "./config";

export type MobileErrorReportInput = {
  error: Error;
  scope: string;
  screen?: string;
  componentStack?: string;
  getHeaders?: () => Promise<Record<string, string>>;
};

const STRING_LIMITS = {
  scope: 120,
  screen: 120,
  name: 160,
  message: 1_000,
  stack: 8_000,
  componentStack: 8_000,
  platform: 80,
  osVersion: 120,
  appVersion: 120,
  buildVersion: 120,
} as const;

const MAX_REPORTED_ERROR_KEYS = 25;
const reportedErrorKeys = new Map<string, string>();

export function reportMobileError({
  error,
  scope,
  screen,
  componentStack,
  getHeaders,
}: MobileErrorReportInput) {
  const key = [
    scope,
    screen ?? "",
    error.name,
    limitString(error.message, 250),
  ].join("|");
  const existingReportId = reportedErrorKeys.get(key);

  if (existingReportId) {
    return existingReportId;
  }

  const reportId = createReportId();
  rememberReportedError(key, reportId);

  void sendMobileErrorReport({
    error,
    scope,
    screen,
    componentStack,
    getHeaders,
    reportId,
  });

  return reportId;
}

async function sendMobileErrorReport({
  error,
  scope,
  screen,
  componentStack,
  getHeaders,
  reportId,
}: MobileErrorReportInput & { reportId: string }) {
  try {
    const headers: Record<string, string> = {
      ...((await getHeaders?.().catch(() => ({}))) ?? {}),
      "content-type": "application/json",
    };

    await fetch(`${mobileWorkoutApiBaseUrl}/api/error-reports`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        reportId,
        source: "mobile",
        scope: limitString(scope, STRING_LIMITS.scope),
        screen: limitString(screen, STRING_LIMITS.screen),
        name: limitString(error.name, STRING_LIMITS.name),
        message: limitString(error.message, STRING_LIMITS.message),
        stack: limitString(error.stack, STRING_LIMITS.stack),
        componentStack: limitString(
          componentStack,
          STRING_LIMITS.componentStack,
        ),
        platform: limitString(Platform.OS, STRING_LIMITS.platform),
        osVersion: limitString(
          String(Platform.Version),
          STRING_LIMITS.osVersion,
        ),
        appVersion: limitString(
          Constants.expoConfig?.version ?? Constants.nativeAppVersion,
          STRING_LIMITS.appVersion,
        ),
        buildVersion: limitString(
          Constants.nativeBuildVersion,
          STRING_LIMITS.buildVersion,
        ),
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    // Error reporting must never make the error screen worse.
  }
}

function rememberReportedError(key: string, reportId: string) {
  reportedErrorKeys.set(key, reportId);

  if (reportedErrorKeys.size <= MAX_REPORTED_ERROR_KEYS) {
    return;
  }

  const oldestKey = reportedErrorKeys.keys().next().value;
  if (oldestKey) {
    reportedErrorKeys.delete(oldestKey);
  }
}

function createReportId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function limitString(value: string | undefined, limit: number) {
  if (!value) {
    return undefined;
  }

  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}
