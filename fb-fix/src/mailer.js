/**
 * mailer.js
 * ─────────
 * Thin wrapper around Nodemailer.
 * Supports any SMTP provider — configure via .env:
 *
 *   SMTP_HOST=smtp.gmail.com
 *   SMTP_PORT=587
 *   SMTP_SECURE=false          # true for port 465
 *   SMTP_USER=you@gmail.com
 *   SMTP_PASS=your-app-password
 *   SMTP_FROM="Finance Tracker <you@gmail.com>"
 *
 * For Gmail: use an App Password (not your main password).
 * For Mailtrap / dev testing: use Mailtrap SMTP credentials.
 */

import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
  port:   Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Send a reminder email.
 * @param {string} to       - Recipient email address
 * @param {string} subject  - Email subject
 * @param {string} html     - HTML body
 */
export async function sendEmail(to, subject, html) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(`[mailer] SMTP not configured — skipping email to ${to}: ${subject}`);
    return;
  }
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || `"Finance Tracker" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`[mailer] ✉️  Sent to ${to}: ${subject} (${info.messageId})`);
  } catch (err) {
    console.error(`[mailer] ❌ Failed to send to ${to}:`, err.message);
  }
}

/**
 * Build a nicely formatted reminder HTML email.
 */
export function buildReminderEmail({ userName, title, eventDate, daysAway, type }) {
  const typeLabel = type === 'note' ? 'Note Reminder' : 'Event Reminder';
  const urgency   = daysAway === 1 ? '🔴 Tomorrow!' : daysAway === 3 ? '🟡 In 3 days' : '🟢 In 1 week';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f0f2f5; margin: 0; padding: 24px; }
    .card { background: #fff; max-width: 520px; margin: 0 auto; border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,.1); overflow: hidden; }
    .top  { background: #1a1a2e; padding: 24px 28px; color: #fff; }
    .top h1 { margin: 0; font-size: 20px; font-weight: 700; color: #00e5a0; }
    .top p  { margin: 4px 0 0; font-size: 12px; color: rgba(255,255,255,.6); }
    .body { padding: 28px; }
    .label { font-size: 11px; font-weight: 700; text-transform: uppercase;
             letter-spacing: 1px; color: #999; margin-bottom: 4px; }
    .title { font-size: 22px; font-weight: 700; color: #1a1a2e; margin-bottom: 20px; }
    .detail-row { display: flex; justify-content: space-between; padding: 10px 0;
                  border-bottom: 1px solid #f0f0f0; font-size: 14px; }
    .detail-row:last-child { border-bottom: none; }
    .detail-key { color: #888; }
    .detail-val { font-weight: 600; color: #333; }
    .urgency-badge { display: inline-block; padding: 8px 16px; border-radius: 20px;
                     background: #f0fdf4; color: #16a34a; font-weight: 700;
                     font-size: 14px; margin: 16px 0; }
    .footer { background: #f8f9fa; padding: 16px 28px; font-size: 11px; color: #aaa;
              border-top: 1px solid #eee; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="top">
      <h1>Finance Tracker</h1>
      <p>${typeLabel}</p>
    </div>
    <div class="body">
      <p class="label">Hi ${userName || 'there'},</p>
      <p style="color:#555;font-size:14px;margin:0 0 20px;">
        You have an upcoming ${type === 'note' ? 'note deadline' : 'event'}:
      </p>
      <p class="title">${title}</p>
      <div class="detail-row">
        <span class="detail-key">Date</span>
        <span class="detail-val">${eventDate}</span>
      </div>
      <div class="detail-row">
        <span class="detail-key">Reminder</span>
        <span class="detail-val">${daysAway === 1 ? '1 day before' : daysAway === 3 ? '3 days before' : '1 week before'}</span>
      </div>
      <div class="urgency-badge">${urgency}</div>
    </div>
    <div class="footer">
      This reminder was sent by Finance Tracker. To manage reminders, update your settings.
    </div>
  </div>
</body>
</html>`;
}
