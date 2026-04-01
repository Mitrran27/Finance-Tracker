import { Router } from 'express';
import sql from '../db/client.js';
import { authenticate } from '../middleware/auth.js';
import { sendEmail, buildReminderEmail } from '../mailer.js';

const router = Router();
router.use(authenticate);

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
    const { title, date } = req.body;
    if (!title || !date) return res.status(400).json({ error: 'title and date are required' });

    // Insert event
    const [event] = await sql`
      INSERT INTO events (user_id, title, date)
      VALUES (${req.userId}, ${title}, ${date})
      RETURNING *
    `;

    // Fetch user info + reminder_email setting
    const [user] = await sql`SELECT id, name, email FROM users WHERE id = ${req.userId}`;
    const [setting] = await sql`
      SELECT value FROM settings WHERE user_id = ${req.userId} AND key = 'reminder_email'
    `;
    // Priority: settings reminder_email → signup email
    const toEmail = (setting?.value && setting.value.trim()) ? setting.value.trim() : user.email;

    // Today as local date string
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

    const eventDate = new Date(date + 'T12:00:00');
    const offsets = [
      { days: 1, label: '1 day'  },
      { days: 3, label: '3 days' },
      { days: 7, label: '1 week' },
    ];

    function fmtDate(d) {
      const s = String(d).slice(0, 10);
      const [y, m, day] = s.split('-').map(Number);
      return new Date(y, m-1, day).toLocaleDateString('en-GB', {
        weekday:'long', day:'numeric', month:'long', year:'numeric'
      });
    }

    for (const { days, label } of offsets) {
      const rd = new Date(eventDate);
      rd.setDate(rd.getDate() - days);
      const y  = rd.getFullYear();
      const m  = String(rd.getMonth()+1).padStart(2,'0');
      const d  = String(rd.getDate()).padStart(2,'0');
      const rdStr = `${y}-${m}-${d}`;

      if (rdStr >= todayStr) {
        // Create in-app notification
        const notifText = `Reminder: "${title}" is in ${label} (${date}) — email will be sent to ${toEmail}`;
        await sql`
          INSERT INTO notifications (user_id, text, date)
          VALUES (${req.userId}, ${notifText}, ${rdStr})
        `;

        // If the reminder date is TODAY, send the email immediately
        if (rdStr === todayStr) {
          sendEmail(
            toEmail,
            `Reminder: "${title}" is ${days === 1 ? 'tomorrow' : `in ${days} days`}`,
            buildReminderEmail({
              userName:  user.name,
              title,
              eventDate: fmtDate(date),
              daysAway:  days,
              type:      'event',
            })
          ).catch(console.error);
        }
      }
    }

    res.status(201).json(event);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const [deleted] = await sql`
      DELETE FROM events WHERE id = ${req.params.id} AND user_id = ${req.userId} RETURNING id
    `;
    if (!deleted) return res.status(404).json({ error: 'Event not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
