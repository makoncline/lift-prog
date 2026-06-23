import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { emailOTP } from "better-auth/plugins/email-otp";
import { expo } from "@better-auth/expo";

import { env } from "@/env";
import { db } from "@/server/db";
import { assertAuthEmailCanSignIn } from "@/server/auth/app-user";
import { sendAuthOtpEmail } from "@/server/auth/email";

const baseFallback =
  env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const configuredAuthHosts = [baseFallback, process.env.NEXT_PUBLIC_APP_URL]
  .map((url) => {
    if (!url) return null;
    try {
      return new URL(url).host;
    } catch {
      return null;
    }
  })
  .filter((host): host is string => Boolean(host));

const trustedOrigins = Array.from(
  new Set(
    [
      baseFallback,
      process.env.NEXT_PUBLIC_APP_URL,
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "http://localhost:3011",
      "http://localhost:3200",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3200",
      "https://lift.makon.dev",
      "https://lift2.makon.dev",
      "exp://",
      "lift-prog://",
      "com.makon.liftprog://",
    ].filter((origin): origin is string => Boolean(origin)),
  ),
);

export const auth = betterAuth({
  appName: "Lift Prog",
  baseURL: {
    allowedHosts: [
      ...configuredAuthHosts,
      "localhost:*",
      "127.0.0.1:*",
      "lift.makon.dev",
      "lift2.makon.dev",
      "*.vercel.app",
    ],
    fallback: baseFallback,
    protocol: "auto",
  },
  trustedOrigins,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, {
    provider: "sqlite",
  }),
  user: {
    modelName: "authUser",
  },
  session: {
    modelName: "authSession",
    expiresIn: 60 * 60 * 24 * 365,
    updateAge: 60 * 60 * 24 * 30,
  },
  account: {
    modelName: "authAccount",
  },
  verification: {
    modelName: "authVerification",
  },
  databaseHooks: {
    user: {
      create: {
        async before(user) {
          await assertAuthEmailCanSignIn(user.email);
        },
      },
    },
  },
  plugins: [
    expo(),
    emailOTP({
      overrideDefaultEmailVerification: true,
      otpLength: 6,
      expiresIn: 60 * 10,
      async sendVerificationOTP({ email, otp, type }) {
        if (type === "sign-in") {
          await assertAuthEmailCanSignIn(email);
        }
        await sendAuthOtpEmail({ email, otp, type });
      },
    }),
  ],
});
