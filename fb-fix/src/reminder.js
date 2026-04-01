/**
 * reminder.js
 * ───────────
 * Daily cron — runs at 08:00 server time every day.
 * Also runs once immediately on startup.
 *
 * For EACH user separately:
 *   - Looks up their OWN events and notes due in 1 day / 3 days / 7 days
 *   - Sends email to their reminder_email setting (if set), else their signup email
 *   - SMTP_USER is only the sender account, never the recipient
 */

import cron from 'node-cron';
import sql from './db/client.js';
import { sendEmail, buildReminderEmail } from './mailer.js';

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function fmtDate(d) {
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-').map(Number);
  return new Date(y, m-1, day).toLocaleDateString('en-GB', {
    weekday:'long', day:'numeric', month:'long', year:'numeric'
  });
}

function rdStr(baseDate, daysBack) {
  const rd = new Date(String(baseDate).slice(0,10) + 'T12:00:00');
  rd.setDate(rd.getDate() - daysBack);
  return `${rd.getFullYear()}-${String(rd.getMonth()+1).padStart(2,'0')}-${String(rd.getDate()).padStart(2,'0')}`;
}

export async function runReminders() {
  const today = localToday();
  console.log(`[reminder] Running for ${today}…`);

  const OFFSETS = [{ days:1 }, { days:3 }, { days:7 }];

  try {
    // Fetch every user + their custom reminder_email from settings (if set)
    const users = await sql`
      SELECT
        u.id,
        u.name,
        u.email         AS signup_email,
        s.value         AS reminder_email_setting
      FROM users u
      LEFT JOIN settings s ON s.user_id = u.id AND s.key = 'reminder_email'
    `;

    for (const user of users) {
      // Resolve THIS user's recipient address — never uses SMTP_USER
      const toEmail = (user.reminder_email_setting && user.reminder_email_setting.trim())
        ? user.reminder_email_setting.trim()   // custom address from Settings page
        : user.signup_email;                   // their own registration email

      // ── Events ────────────────────────────────────────────────────────
      const events = await sql`
        SELECT id, title, date FROM events
        WHERE user_id = ${user.id} AND date >= ${today}::date
      `;

      for (const ev of events) {
        for (const { days } of OFFSETS) {
          if (rdStr(ev.date, days) === today) {
            console.log(`[reminder] Event "${ev.title}" → ${toEmail} (${days}d before)`);
            await sendEmail(
              toEmail,
              `Reminder: "${ev.title}" is ${days === 1 ? 'tomorrow' : `in ${days} days`}`,
              buildReminderEmail({
                userName:  user.name,
                title:     ev.title,
                eventDate: fmtDate(ev.date),
                daysAway:  days,
                type:      'event',
              })
            );
          }
        }
      }

      // ── Notes with a due date ──────────────────────────────────────────
      const notes = await sql`
        SELECT id, text, date FROM notes
        WHERE user_id = ${user.id}
          AND date IS NOT NULL
          AND completed = FALSE
          AND date >= ${today}::date
      `;

      for (const note of notes) {
        for (const { days } of OFFSETS) {
          if (rdStr(note.date, days) === today) {
            console.log(`[reminder] Note "${note.text.slice(0,40)}" → ${toEmail} (${days}d before)`);
            await sendEmail(
              toEmail,
              `Reminder: "${note.text.slice(0,60)}" is due ${days === 1 ? 'tomorrow' : `in ${days} days`}`,
              buildReminderEmail({
                userName:  user.name,
                title:     note.text,
                eventDate: fmtDate(note.date),
                daysAway:  days,
                type:      'note',
              })
            );
          }
        }
      }
    }

    console.log(`[reminder] Done for ${today}.`);
  } catch (err) {
    console.error('[reminder] Error:', err.message);
  }
}

export function startReminderCron() {
  console.log('[reminder] Cron scheduled — daily at 08:00, and running now on startup…');
  runReminders();
  cron.schedule('0 8 * * *', runReminders);
}
