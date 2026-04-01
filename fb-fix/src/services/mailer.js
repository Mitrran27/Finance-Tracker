import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

// Create transporter once, reused for all sends
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
  port:   Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',   // false = STARTTLS (port 587)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = `"${process.env.EMAIL_FROM_NAME || 'Finance Tracker'}" <${process.env.SMTP_USER}>`;

// ── Send a single reminder email ──────────────────────────────────────────
export async function sendReminderEmail({ to, recipientName, eventTitle, eventDate, daysUntil, type }) {
  const dayLabel   = daysUntil === 1 ? '1 day'  : daysUntil === 3 ? '3 days' : '1 week';
  const typeLabel  = type === 'note' ? 'note/task' : 'event';
  const subject    = `⏰ Reminder: "${eventTitle}" is in ${dayLabel}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background:#f0f2f5; margin:0; padding:24px; }
    .card { max-width:520px; margin:0 auto; background:#fff; border-radius:8px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,.08); }
    .header { background:linear-gradient(135deg,#1a1a2e,#16213e); padding:28px 32px; }
    .header-title { color:#00e5a0; font-size:22px; font-weight:700; margin:0; }
    .header-sub { color:rgba(255,255,255,.6); font-size:12px; margin-top:4px; }
    .body { padding:28px 32px; }
    .pill { display:inline-block; background:#fef3c7; color:#92400e; font-size:12px; font-weight:600; padding:4px 12px; border-radius:20px; margin-bottom:16px; }
    .event-box { background:#f8f9fa; border-left:4px solid #00e5a0; border-radius:4px; padding:16px 20px; margin:16px 0; }
    .event-title { font-size:18px; font-weight:700; color:#1a1a2e; margin:0 0 6px; }
    .event-date  { font-size:13px; color:#666; margin:0; }
    .countdown { font-size:14px; color:#555; margin:16px 0 0; line-height:1.6; }
    .footer { background:#f8f9fa; padding:16px 32px; font-size:11px; color:#aaa; border-top:1px solid #eee; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <p class="header-title">Finance Tracker</p>
      <p class="header-sub">Reminder Notification</p>
    </div>
    <div class="body">
      <span class="pill">⏰ ${dayLabel} away</span>
      <p style="color:#555;font-size:14px;margin:0 0 8px;">Hi${recipientName ? ` ${recipientName}` : ''},</p>
      <p style="color:#555;font-size:14px;margin:0 0 16px;">This is your reminder that you have an upcoming ${typeLabel}:</p>
      <div class="event-box">
        <p class="event-title">${eventTitle}</p>
        <p class="event-date">📅 ${new Date(eventDate + 'T12:00:00').toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}</p>
      </div>
      <p class="countdown">This ${typeLabel} is <strong>${dayLabel} away</strong>. Make sure you're prepared!</p>
    </div>
    <div class="footer">
      This email was sent automatically by Finance Tracker. To stop receiving reminders, remove the email from your event settings.
    </div>
  </div>
</body>
</html>`;

  const text = `Reminder: "${eventTitle}" is in ${dayLabel}\nDate: ${eventDate}\n\nThis is an automated reminder from Finance Tracker.`;

  const info = await transporter.sendMail({ from: FROM, to, subject, html, text });
  console.log(`📧 Reminder sent to ${to} — "${eventTitle}" (${dayLabel}) — msgId: ${info.messageId}`);
  return info;
}

// ── Verify SMTP connection (called on startup) ────────────────────────────
export async function verifyMailer() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('⚠️  Email not configured — set SMTP_USER and SMTP_PASS in .env to enable reminders');
    return false;
  }
  try {
    await transporter.verify();
    console.log(`✅ Mailer ready (${process.env.SMTP_HOST}:${process.env.SMTP_PORT}) — sending as ${process.env.SMTP_USER}`);
    return true;
  } catch (err) {
    console.error('❌ Mailer connection failed:', err.message);
    return false;
  }
}
