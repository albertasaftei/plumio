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

export async function sendEmailChangeConfirmationEmail(
  to: string,
  confirmToken: string,
): Promise<void> {
  if (!isSmtpConfigured()) {
    throw new Error("Email service is not configured");
  }

  const confirmUrl = `${APP_URL}/confirm-email-change?token=${confirmToken}`;
  const transporter = createTransporter();

  await transporter.sendMail({
    from: SMTP_FROM,
    to,
    subject: "Confirm your plumio email change",
    text: `You requested an email address change for your plumio account.\n\nClick the link below to confirm your new email address. The link expires in 1 hour.\n\n${confirmUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <p>You requested an email address change for your plumio account. Click the button below to confirm your new email address.</p>
        <p>The link expires in <strong>1 hour</strong>.</p>
        <a href="${confirmUrl}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#2a9d8f;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">
          Confirm Email Change
        </a>
        <p style="color:#888;font-size:13px;">If the button doesn't work, copy this link into your browser:<br>${confirmUrl}</p>
        <p style="color:#888;font-size:13px;">If you did not request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}

export async function sendJoinRequestEmail(
  to: string,
  requesterUsername: string,
  orgName: string,
): Promise<void> {
  if (!isSmtpConfigured()) {
    return; // Silently skip — in-app notification is the primary channel
  }

  const loginUrl = `${APP_URL}`;
  const transporter = createTransporter();

  await transporter.sendMail({
    from: SMTP_FROM,
    to,
    subject: `New join request for ${orgName} — plumio`,
    text: `${requesterUsername} has requested to join your organization "${orgName}".\n\nLog in to review the request: ${loginUrl}\n`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <p><strong>${requesterUsername}</strong> has requested to join your organization <strong>${orgName}</strong>.</p>
        <a href="${loginUrl}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#2a9d8f;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">
          Review Request
        </a>
        <p style="color:#888;font-size:13px;">You can accept or reject this request from the notification center in plumio.</p>
      </div>
    `,
  });
}

export async function sendJoinRequestAcceptedEmail(
  to: string,
  orgName: string,
): Promise<void> {
  if (!isSmtpConfigured()) {
    return;
  }

  const loginUrl = `${APP_URL}`;
  const transporter = createTransporter();

  await transporter.sendMail({
    from: SMTP_FROM,
    to,
    subject: `You've been accepted into ${orgName} — plumio`,
    text: `Your request to join "${orgName}" has been accepted!\n\nLog in to access your new organization: ${loginUrl}\n`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <p>Your request to join <strong>${orgName}</strong> has been <span style="color:#2a9d8f;font-weight:600;">accepted</span>!</p>
        <a href="${loginUrl}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#2a9d8f;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">
          Go to plumio
        </a>
        <p style="color:#888;font-size:13px;">You can now switch to this organization from the organization selector.</p>
      </div>
    `,
  });
}

export async function sendJoinRequestRejectedEmail(
  to: string,
  orgName: string,
): Promise<void> {
  if (!isSmtpConfigured()) {
    return;
  }

  const transporter = createTransporter();

  await transporter.sendMail({
    from: SMTP_FROM,
    to,
    subject: `Join request for ${orgName} was declined — plumio`,
    text: `Your request to join "${orgName}" was declined by an organization administrator.\n`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <p>Your request to join <strong>${orgName}</strong> was <span style="color:#e76f51;font-weight:600;">declined</span> by an organization administrator.</p>
        <p style="color:#888;font-size:13px;">If you believe this was a mistake, please contact the organization owner directly.</p>
      </div>
    `,
  });
}

export async function sendMemberJoinedEmail(
  to: string,
  memberUsername: string,
  orgName: string,
): Promise<void> {
  if (!isSmtpConfigured()) {
    return;
  }

  const loginUrl = `${APP_URL}`;
  const transporter = createTransporter();

  await transporter.sendMail({
    from: SMTP_FROM,
    to,
    subject: `${memberUsername} joined ${orgName} — plumio`,
    text: `${memberUsername} has automatically joined your organization "${orgName}".\n\nLog in to manage your organization: ${loginUrl}\n`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <p><strong>${memberUsername}</strong> has automatically joined your organization <strong>${orgName}</strong>.</p>
        <a href="${loginUrl}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#2a9d8f;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">
          Manage Organization
        </a>
        <p style="color:#888;font-size:13px;">Auto-accept is enabled for this organization.</p>
      </div>
    `,
  });
}
