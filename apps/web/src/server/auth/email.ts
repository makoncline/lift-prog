import "server-only";

import nodemailer from "nodemailer";

import { env } from "@/env";

type AuthOtpEmailInput = {
  email: string;
  otp: string;
  type: "sign-in" | "email-verification" | "forget-password" | "change-email";
};

const getSmtpPort = () => {
  const port = Number.parseInt(env.SMTP_PORT ?? "587", 10);
  return Number.isFinite(port) ? port : 587;
};

const getMailer = () => {
  if (!env.SMTP_USER || !env.SMTP_PASS) {
    throw new Error("SMTP_USER and SMTP_PASS are required to send OTP email.");
  }

  return nodemailer.createTransport({
    host: env.SMTP_HOST ?? "smtp.gmail.com",
    port: getSmtpPort(),
    secure: env.SMTP_SECURE === "true",
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
};

const getSubject = (type: AuthOtpEmailInput["type"]) => {
  if (type === "email-verification") return "Lift Prog email code";
  if (type === "forget-password") return "Lift Prog reset code";
  if (type === "change-email") return "Lift Prog email change code";
  return "Lift Prog sign-in code";
};

export async function sendAuthOtpEmail({
  email,
  otp,
  type,
}: AuthOtpEmailInput) {
  const from = env.AUTH_EMAIL_FROM ?? env.SMTP_USER;
  if (!from) {
    throw new Error("AUTH_EMAIL_FROM or SMTP_USER is required to send OTP email.");
  }

  await getMailer().sendMail({
    from,
    to: email,
    subject: getSubject(type),
    text: `Your Lift Prog code is ${otp}.\n\nIt expires soon. If you did not request this, ignore this email.`,
    html: `<div style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 16px; line-height: 1.5;"><p>Your Lift Prog code is:</p><p style="font-size: 28px; font-weight: 700; letter-spacing: 0.2em;">${otp}</p><p>It expires soon. If you did not request this, ignore this email.</p></div>`,
  });
}
