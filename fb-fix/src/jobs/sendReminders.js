/**
 * Reminder Job
 * ─────────────────────────────────────────────────────────────────────────
 * Checks the DB for events and notes whose reminder dates match today,
 * then sends an email to the configured reminder_email.
 *
 * Called by:
 *  • The cron scheduler in index.js (automatically, daily)
 *  • POST /api/reminders/trigger   (manually, e.g. for testing)
 *  • npm run send-reminders        (CLI, e.g. from external cron)
 */

import dotenv from 'dotenv';
dotenv.config();

import sql from '../db/client.js';
import { sendReminderEmail } from '../services/mailer.js';

// Local date as YYYY-MM-DD (avoids UTC shift issues)
function localToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Add/subtract days from a YYYY-MM-DD string, return YYYY-MM-DD
function shiftDate(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export async function runReminderJob() {
  const today = localToday();
  console.log(`\n🔔 Running reminder job for ${today}`);

  let sent = 0, skipped = 0, errors = 0;

  // ── 1. EVENTS ─────────────────────────────────────────────────────────
  // Find events that have a reminder_email set and whose date is
  // exactly 1, 3, or 7 days from today
  const OFFSETS = [1, 3, 7];

  for (const days of OFFSETS) {
    const targetDate = shiftDate(today, days);  // event must be on this date

    const events = await sql`
      SELECT e.id, e.title, e.date, e.reminder_email,
             u.name AS user_name
      FROM events e
      JOIN users u ON u.id = e.user_id
      WHERE e.reminder_email IS NOT NULL
        AND e.reminder_email <> ''
        AND e.date::text = ${targetDate}
    `;

    for (const ev of events) {
      try {
        await sendReminderEmail({
          to:            ev.reminder_email,
          recipientName: ev.user_name,
          eventTitle:    ev.title,
          eventDate:     String(ev.date).slice(0, 10),
          daysUntil:     days,
          type:          'event',
        });
        sent++;
      } catch (err) {
        console.error(`  ❌ Failed to send for event ${ev.id}:`, err.message);
        errors++;
      }
    }
  }

  // ── 2. NOTES with a due date ──────────────────────────────────────────
  // Notes can also have a date; if they have a reminder_email in settings,
  // send reminders using the user's account reminder_email setting
  for (const days of OFFSETS) {
    const targetDate = shiftDate(today, days);

    const notes = await sql`
      SELECT n.id, n.text, n.date,
             u.name AS user_name,
             s.value AS reminder_email
      FROM notes n
      JOIN users u ON u.id = n.user_id
      LEFT JOIN settings s
        ON s.user_id = n.user_id AND s.key = 'reminder_email'
      WHERE n.completed = FALSE
        AND n.date IS NOT NULL
        AND n.date::text = ${targetDate}
        AND s.value IS NOT NULL
        AND s.value <> ''
    `;

    for (const note of notes) {
      try {
        await sendReminderEmail({
          to:            note.reminder_email,
          recipientName: note.user_name,
          eventTitle:    note.text,
          eventDate:     String(note.date).slice(0, 10),
          daysUntil:     days,
          type:          'note',
        });
        sent++;
      } catch (err) {
        console.error(`  ❌ Failed to send for note ${note.id}:`, err.message);
        errors++;
      }
    }
  }

  console.log(`✅ Reminder job done — sent: ${sent}, errors: ${errors}`);
  return { sent, skipped, errors, date: today };
}

// ── Allow running as standalone script: node src/jobs/sendReminders.js ──
if (process.argv[1]?.endsWith('sendReminders.js')) {
  runReminderJob()
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
}
