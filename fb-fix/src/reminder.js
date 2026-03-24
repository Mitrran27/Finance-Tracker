import cron from 'node-cron';
import sql from './db/client.js';
import { sendEmail, buildReminderEmail } from './mailer.js';

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function fmtDate(d) {
  const s = String(d).slice(0,10);
  const [y,m,day] = s.split('-').map(Number);
  return new Date(y,m-1,day).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
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
    const users = await sql`
      SELECT u.id, u.name, u.email AS signup_email, s.value AS reminder_emails_json
      FROM users u
      LEFT JOIN settings s ON s.user_id = u.id AND s.key = 'reminder_emails'
    `;

    for (const user of users) {
      // Build the full list: signup email + any extras added in Settings
      const extras = user.reminder_emails_json ? JSON.parse(user.reminder_emails_json) : [];
      const allEmails = [user.signup_email, ...extras];

      // ── Events ────────────────────────────────────────────────────────
      const events = await sql`
        SELECT id, title, date FROM events
        WHERE user_id = ${user.id} AND date >= ${today}::date
      `;
      for (const ev of events) {
        for (const { days } of OFFSETS) {
          if (rdStr(ev.date, days) === today) {
            for (const email of allEmails) {
              console.log(`[reminder] Event "${ev.title}" → ${email} (${days}d before)`);
              await sendEmail(email,
                `Reminder: "${ev.title}" is ${days===1?'tomorrow':`in ${days} days`}`,
                buildReminderEmail({ userName:user.name, title:ev.title, eventDate:fmtDate(ev.date), daysAway:days, type:'event' })
              );
            }
          }
        }
      }

      // ── Notes ─────────────────────────────────────────────────────────
      const notes = await sql`
        SELECT id, text, date FROM notes
        WHERE user_id = ${user.id} AND date IS NOT NULL AND completed = FALSE AND date >= ${today}::date
      `;
      for (const note of notes) {
        for (const { days } of OFFSETS) {
          if (rdStr(note.date, days) === today) {
            for (const email of allEmails) {
              console.log(`[reminder] Note "${note.text.slice(0,40)}" → ${email} (${days}d before)`);
              await sendEmail(email,
                `Reminder: "${note.text.slice(0,60)}" due ${days===1?'tomorrow':`in ${days} days`}`,
                buildReminderEmail({ userName:user.name, title:note.text, eventDate:fmtDate(note.date), daysAway:days, type:'note' })
              );
            }
          }
        }
      }
    }
    console.log(`[reminder] Done for ${today}.`);
  } catch (err) { console.error('[reminder] Error:', err.message); }
}

export function startReminderCron() {
  console.log('[reminder] Cron scheduled — daily at 08:00, running now on startup…');
  runReminders();
  cron.schedule('0 8 * * *', runReminders);
}
