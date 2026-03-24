import { Router } from 'express';
import sql from '../db/client.js';
import { authenticate } from '../middleware/auth.js';
import { sendEmail, buildReminderEmail } from '../mailer.js';

const router = Router();
router.use(authenticate);

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function fmtDate(d) {
  const s = String(d).slice(0,10);
  const [y,m,day] = s.split('-').map(Number);
  return new Date(y,m-1,day).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
}

router.get('/', async (req, res) => {
  try {
    const { month } = req.query;
    const tmonth = month || null;
    const events = await sql`
      SELECT * FROM events
      WHERE user_id = ${req.userId}
        AND (${tmonth}::text IS NULL OR TO_CHAR(date,'YYYY-MM') = ${tmonth}::text)
      ORDER BY date ASC
    `;
    res.json(events);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { title, date, reminder_email } = req.body;
    if (!title || !date) return res.status(400).json({ error: 'title and date required' });

    const [event] = await sql`
      INSERT INTO events (user_id, title, date)
      VALUES (${req.userId}, ${title}, ${date})
      RETURNING *
    `;

    // ── Resolve recipient email ──────────────────────────────────────────
    // Priority:
    //   1. reminder_email explicitly passed from the calendar dropdown
    //   2. reminder_emails list (first extra, if any)
    //   3. user's signup email (always the fallback)
    const [user] = await sql`SELECT id, name, email FROM users WHERE id = ${req.userId}`;

    let toEmail = user.email; // default: signup email

    if (reminder_email && reminder_email.trim()) {
      // Calendar modal passed a specific chosen email
      toEmail = reminder_email.trim();
    } else {
      // Check if user has a reminder_emails list saved
      const [row] = await sql`
        SELECT value FROM settings WHERE user_id = ${req.userId} AND key = 'reminder_emails'
      `;
      if (row?.value) {
        const extras = JSON.parse(row.value);
        if (extras.length > 0) toEmail = extras[0]; // use first extra if no explicit choice
      }
    }

    const todayStr = localToday();
    const offsets  = [{ days:1, label:'1 day' }, { days:3, label:'3 days' }, { days:7, label:'1 week' }];

    for (const { days, label } of offsets) {
      const rd = new Date(date + 'T12:00:00');
      rd.setDate(rd.getDate() - days);
      const rdStr = `${rd.getFullYear()}-${String(rd.getMonth()+1).padStart(2,'0')}-${String(rd.getDate()).padStart(2,'0')}`;

      if (rdStr >= todayStr) {
        await sql`
          INSERT INTO notifications (user_id, text, date) VALUES (
            ${req.userId},
            ${`Reminder: "${title}" is in ${label} (${date}) — email → ${toEmail}`},
            ${rdStr}
          )
        `;
        if (rdStr === todayStr) {
          sendEmail(toEmail, `Reminder: "${title}" is ${days===1?'tomorrow':`in ${days} days`}`,
            buildReminderEmail({ userName:user.name, title, eventDate:fmtDate(date), daysAway:days, type:'event' })
          ).catch(console.error);
        }
      }
    }

    res.status(201).json(event);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const [deleted] = await sql`DELETE FROM events WHERE id=${req.params.id} AND user_id=${req.userId} RETURNING id`;
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
