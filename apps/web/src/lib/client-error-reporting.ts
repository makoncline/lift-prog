"use client";

export type ClientErrorReportInput = {
  error: Error & { digest?: string };
  scope: string;
  componentStack?: string;
};

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
    error.message,
    componentStack ?? "",
    getLocation(),
  ].join("|");
  const existingReportId = reportedErrorKeys.get(key);

  if (existingReportId) {
    return existingReportId;
  }

  const reportId = createReportId();
  reportedErrorKeys.set(key, reportId);

  const payload = {
    reportId,
    scope,
    name: error.name,
    message: error.message,
    stack: error.stack,
    digest: error.digest,
    componentStack,
    url: getLocation(),
    pathname: typeof window === "undefined" ? undefined : window.location.pathname,
    userAgent:
      typeof navigator === "undefined" ? undefined : navigator.userAgent,
    language: typeof navigator === "undefined" ? undefined : navigator.language,
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

  return window.location.href;
}
