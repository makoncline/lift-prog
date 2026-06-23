export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { isLocalDevAuthBypassEnabled } from "@/lib/local-dev-auth";

const STRING_LIMITS = {
  reportId: 120,
  source: 80,
  scope: 120,
  screen: 120,
  name: 160,
  message: 1_000,
  stack: 8_000,
  digest: 240,
  componentStack: 8_000,
  url: 2_000,
  pathname: 1_000,
  userAgent: 600,
  language: 80,
  platform: 80,
  osVersion: 120,
  appVersion: 120,
  buildVersion: 120,
  timestamp: 80,
} as const;

type ErrorReportPayload = {
  reportId?: string;
  source?: string;
  scope?: string;
  screen?: string;
  name?: string;
  message?: string;
  stack?: string;
  digest?: string;
  componentStack?: string;
  url?: string;
  pathname?: string;
  userAgent?: string;
  language?: string;
  platform?: string;
  osVersion?: string;
  appVersion?: string;
  buildVersion?: string;
  viewport?: {
    width?: number;
    height?: number;
    devicePixelRatio?: number;
  };
  timestamp?: string;
};

type AuthContext = {
  userId?: string;
  authError?: string;
};

export async function POST(request: Request) {
  const receivedAt = new Date().toISOString();
  const authContext = await getAuthContext(request);
  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "client_error_report_invalid_json",
        receivedAt,
        server: getServerContext(request, authContext),
        error: serializeUnknownError(error),
      }),
    );

    return new Response(null, { status: 204 });
  }

  console.error(
    JSON.stringify({
      level: "error",
      event: "client_error_boundary",
      receivedAt,
      report: sanitizePayload(payload),
      server: getServerContext(request, authContext),
    }),
  );

  return new Response(null, { status: 204 });
}

function sanitizePayload(payload: unknown): ErrorReportPayload {
  if (!isRecord(payload)) {
    return {
      message: "Client sent a non-object error report payload.",
    };
  }

  const viewport = isRecord(payload.viewport)
    ? {
        width: finiteNumber(payload.viewport.width),
        height: finiteNumber(payload.viewport.height),
        devicePixelRatio: finiteNumber(payload.viewport.devicePixelRatio),
      }
    : undefined;

  return {
    reportId: limitString(payload.reportId, STRING_LIMITS.reportId),
    source: limitString(payload.source, STRING_LIMITS.source),
    scope: limitString(payload.scope, STRING_LIMITS.scope),
    screen: limitString(payload.screen, STRING_LIMITS.screen),
    name: limitString(payload.name, STRING_LIMITS.name),
    message: limitString(payload.message, STRING_LIMITS.message),
    stack: limitString(payload.stack, STRING_LIMITS.stack),
    digest: limitString(payload.digest, STRING_LIMITS.digest),
    componentStack: limitString(
      payload.componentStack,
      STRING_LIMITS.componentStack,
    ),
    url: limitString(payload.url, STRING_LIMITS.url),
    pathname: limitString(payload.pathname, STRING_LIMITS.pathname),
    userAgent: limitString(payload.userAgent, STRING_LIMITS.userAgent),
    language: limitString(payload.language, STRING_LIMITS.language),
    platform: limitString(payload.platform, STRING_LIMITS.platform),
    osVersion: limitString(payload.osVersion, STRING_LIMITS.osVersion),
    appVersion: limitString(payload.appVersion, STRING_LIMITS.appVersion),
    buildVersion: limitString(payload.buildVersion, STRING_LIMITS.buildVersion),
    viewport,
    timestamp: limitString(payload.timestamp, STRING_LIMITS.timestamp),
  };
}

async function getAuthContext(request: Request): Promise<AuthContext> {
  const localDevUserId =
    isLocalDevAuthBypassEnabled()
      ? (process.env.LOCAL_DEV_USER_ID ?? null)
      : null;

  try {
    const [{ auth }, { resolveAppUserIdForAuthUser }] = await Promise.all([
      import("@/server/auth"),
      import("@/server/auth/app-user"),
    ]);
    const session = await auth.api.getSession({ headers: request.headers });
    const userId = session?.user
      ? await resolveAppUserIdForAuthUser(session.user)
      : (localDevUserId ?? undefined);
    return { userId };
  } catch (error) {
    return {
      authError: serializeUnknownError(error).message,
    };
  }
}

function getServerContext(request: Request, authContext: AuthContext) {
  return {
    vercelEnv: process.env.VERCEL_ENV,
    vercelUrl: process.env.VERCEL_URL,
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA,
    requestId: request.headers.get("x-vercel-id") ?? undefined,
    referer: limitString(request.headers.get("referer"), 2_000),
    userId: authContext.userId,
    authError: authContext.authError,
  };
}

function serializeUnknownError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: limitString(error.stack, 4_000),
    };
  }

  return {
    message: limitString(String(error), 1_000),
  };
}

function limitString(value: unknown, limit: number) {
  if (typeof value !== "string") {
    return undefined;
  }

  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
