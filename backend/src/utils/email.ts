import nodemailer from "nodemailer";
import {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
  APP_URL,
} from "../config.js";

function isSmtpConfigured(): boolean {
  return !!(SMTP_HOST && SMTP_USER && SMTP_PASS && SMTP_FROM);
}

function createTransporter() {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

export async function sendPasswordResetEmail(
  to: string,
  resetToken: string,
): Promise<void> {
  if (!isSmtpConfigured()) {
    throw new Error("Email service is not configured");
  }

  const resetUrl = `${APP_URL}/reset-password?token=${resetToken}`;
  const transporter = createTransporter();

  await transporter.sendMail({
    from: SMTP_FROM,
    to,
    subject: "Reset your plumio password",
    text: `You requested a password reset.\n\nClick the link below to set a new password. The link expires in 1 hour.\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <p>You requested a password reset. Click the button below to set a new password.</p>
        <p>The link expires in <strong>1 hour</strong>.</p>
        <a href="${resetUrl}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#2a9d8f;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">
          Reset Password
        </a>
        <p style="color:#888;font-size:13px;">If the button doesn't work, copy this link into your browser:<br>${resetUrl}</p>
        <p style="color:#888;font-size:13px;">If you did not request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}
