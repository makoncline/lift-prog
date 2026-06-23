"use client";

type ClientErrorReportInput = {
  error: Error & { digest?: string };
  scope: string;
  screen?: string;
};

const STRING_LIMITS = {
  scope: 120,
  screen: 120,
  name: 160,
  message: 1_000,
  stack: 8_000,
  digest: 240,
  url: 2_000,
  pathname: 1_000,
  userAgent: 600,
  language: 80,
  platform: 80,
} as const;

const MAX_REPORTED_ERROR_KEYS = 25;
const reportedErrorKeys = new Map<string, string>();

export function reportClientBoundaryError({
  error,
  scope,
  screen,
}: ClientErrorReportInput) {
  const key = [
    scope,
    screen ?? "",
    error.name,
    limitString(error.message, 250),
    error.digest ?? "",
  ].join("|");
  const existingReportId = reportedErrorKeys.get(key);

  if (existingReportId) {
    return existingReportId;
  }

  const reportId = createReportId();
  rememberReportedError(key, reportId);
  void sendClientBoundaryError({ error, scope, screen, reportId });

  return reportId;
}

async function sendClientBoundaryError({
  error,
  scope,
  screen,
  reportId,
}: ClientErrorReportInput & { reportId: string }) {
  try {
    await fetch("/api/error-reports", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        reportId,
        source: "web",
        scope: limitString(scope, STRING_LIMITS.scope),
        screen: limitString(screen, STRING_LIMITS.screen),
        name: limitString(error.name, STRING_LIMITS.name),
        message: limitString(error.message, STRING_LIMITS.message),
        stack: limitString(error.stack, STRING_LIMITS.stack),
        digest: limitString(error.digest, STRING_LIMITS.digest),
        url: limitString(window.location.href, STRING_LIMITS.url),
        pathname: limitString(window.location.pathname, STRING_LIMITS.pathname),
        userAgent: limitString(navigator.userAgent, STRING_LIMITS.userAgent),
        language: limitString(navigator.language, STRING_LIMITS.language),
        platform: limitString(navigator.platform, STRING_LIMITS.platform),
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio,
        },
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
