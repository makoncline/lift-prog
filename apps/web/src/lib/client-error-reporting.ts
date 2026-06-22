"use client";

export type ClientErrorReportInput = {
  error: Error & { digest?: string };
  scope: string;
  componentStack?: string;
};

const STRING_LIMITS = {
  name: 160,
  message: 1_000,
  stack: 8_000,
  digest: 240,
  componentStack: 8_000,
  url: 2_000,
  pathname: 1_000,
  userAgent: 600,
  language: 80,
} as const;

const MAX_REPORTED_ERROR_KEYS = 25;
const reportedErrorKeys = new Map<string, string>();

export function reportClientError({
  error,
  scope,
  componentStack,
}: ClientErrorReportInput) {
  const key = [
    scope,
    error.digest ?? "",
    error.name,
    limitString(error.message, 250),
    getPathname(),
  ].join("|");
  const existingReportId = reportedErrorKeys.get(key);

  if (existingReportId) {
    return existingReportId;
  }

  const reportId = createReportId();
  rememberReportedError(key, reportId);

  const payload = {
    reportId,
    scope,
    name: limitString(error.name, STRING_LIMITS.name),
    message: limitString(error.message, STRING_LIMITS.message),
    stack: limitString(error.stack, STRING_LIMITS.stack),
    digest: limitString(error.digest, STRING_LIMITS.digest),
    componentStack: limitString(
      componentStack,
      STRING_LIMITS.componentStack,
    ),
    url: getLocation(),
    pathname: getPathname(),
    userAgent:
      typeof navigator === "undefined"
        ? undefined
        : limitString(navigator.userAgent, STRING_LIMITS.userAgent),
    language:
      typeof navigator === "undefined"
        ? undefined
        : limitString(navigator.language, STRING_LIMITS.language),
    viewport:
      typeof window === "undefined"
        ? undefined
        : {
            width: window.innerWidth,
            height: window.innerHeight,
            devicePixelRatio: window.devicePixelRatio,
          },
    timestamp: new Date().toISOString(),
  };

  void fetch("/api/error-reports", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => undefined);

  return reportId;
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

function getLocation() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return limitString(window.location.href, STRING_LIMITS.url);
}

function getPathname() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return limitString(window.location.pathname, STRING_LIMITS.pathname);
}

function limitString(value: string | undefined, limit: number) {
  if (!value) {
    return undefined;
  }

  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}
