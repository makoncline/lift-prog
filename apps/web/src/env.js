import { existsSync, readFileSync } from "node:fs";
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * @param {string} relativePath
 */
const loadRootEnvFile = (relativePath) => {
  const envUrl = new URL(relativePath, import.meta.url);
  if (!existsSync(envUrl)) return;

  for (const line of readFileSync(envUrl, "utf8").split(/\r?\n/)) {
    const match = line.match(
      /^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i,
    );
    const key = match?.[1];
    const rawValue = match?.[2];
    if (!key || rawValue === undefined || process.env[key] !== undefined) {
      continue;
    }

    const trimmedValue = rawValue.trim();
    const value =
      (trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) ||
      (trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))
        ? trimmedValue.slice(1, -1)
        : trimmedValue;
    process.env[key] = value;
  }
};

if (process.env.NODE_ENV === "production") {
  loadRootEnvFile("../../../.env.production");
}
loadRootEnvFile("../../../.env");

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    TURSO_DATABASE_URL: z.string(),
    TURSO_AUTH_TOKEN: z.string(),
    ADMIN_USER_IDS: z.string().optional(),
    BETTER_AUTH_SECRET: z.string().optional(),
    BETTER_AUTH_URL: z.string().url().optional(),
    AUTH_OWNER_EMAIL: z.string().email().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.string().optional(),
    SMTP_SECURE: z.string().optional(),
    AUTH_EMAIL_FROM: z.string().optional(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {},

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
    ADMIN_USER_IDS: process.env.ADMIN_USER_IDS,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    AUTH_OWNER_EMAIL: process.env.AUTH_OWNER_EMAIL,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_SECURE: process.env.SMTP_SECURE,
    AUTH_EMAIL_FROM: process.env.AUTH_EMAIL_FROM,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
