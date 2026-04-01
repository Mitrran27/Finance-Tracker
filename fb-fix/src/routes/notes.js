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

async function scheduleNoteReminders(userId, noteId, text, date) {
  if (!date) return;
  const [user] = await sql`SELECT id, name, email FROM users WHERE id = ${userId}`;
  const [setting] = await sql`SELECT value FROM settings WHERE user_id = ${userId} AND key = 'reminder_emails'`;
  const toEmail = (setting?.value && setting.value.trim()) ? JSON.parse(setting.value)[0] || user.email : user.email;

  const today = localToday();
  const offsets = [{ days:1, label:'1 day' }, { days:3, label:'3 days' }, { days:7, label:'1 week' }];

  for (const { days, label } of offsets) {
    const [ny,nm,nd] = String(date).slice(0,10).split('-').map(Number);
    const base = new Date(ny, nm-1, nd-days);
    const rdStr = `${base.getFullYear()}-${String(base.getMonth()+1).padStart(2,'0')}-${String(base.getDate()).padStart(2,'0')}`;

    if (rdStr >= today) {
      await sql`INSERT INTO notifications (user_id, text, date) VALUES (
        ${userId},
        ${`Note reminder: "${text.slice(0,60)}" is due in ${label} (${String(date).slice(0,10)}) — email → ${toEmail}`},
        ${rdStr}
      )`;
      if (rdStr === today) {
        sendEmail(
          toEmail,
          `Note Reminder: "${text.slice(0,60)}" is due ${days===1?'tomorrow':`in ${days} days`}`,
          buildReminderEmail({ userName:user.name, title:text, eventDate:fmtDate(date), daysAway:days, type:'note' })
        ).catch(console.error);
      }
    }
  }
}

router.get('/', async (req, res) => {
  try {
    const { search, sort = 'date-desc' } = req.query;
    const uid = req.userId;
    const tsearch = search ? `%${search}%` : null;
    let notes;
    if (sort === 'date-asc')          notes = await sql`SELECT * FROM notes WHERE user_id=${uid} AND (${tsearch}::text IS NULL OR text ILIKE ${tsearch}::text) ORDER BY date ASC NULLS LAST`;
    else if (sort==='status-active')  notes = await sql`SELECT * FROM notes WHERE user_id=${uid} AND (${tsearch}::text IS NULL OR text ILIKE ${tsearch}::text) ORDER BY completed ASC, date DESC NULLS LAST`;
    else if (sort==='status-completed') notes = await sql`SELECT * FROM notes WHERE user_id=${uid} AND (${tsearch}::text IS NULL OR text ILIKE ${tsearch}::text) ORDER BY completed DESC, date DESC NULLS LAST`;
    else notes = await sql`SELECT * FROM notes WHERE user_id=${uid} AND (${tsearch}::text IS NULL OR text ILIKE ${tsearch}::text) ORDER BY date DESC NULLS LAST`;
    res.json(notes);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { text, date } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });
    const [note] = await sql`INSERT INTO notes (user_id, text, date) VALUES (${req.userId}, ${text}, ${date ?? null}) RETURNING *`;
    if (date) scheduleNoteReminders(req.userId, note.id, text, date).catch(console.error);
    res.status(201).json(note);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id', async (req, res) => {
  try {
    const { text, date, completed } = req.body;
    const [note] = await sql`
      UPDATE notes SET
        text      = COALESCE(${text      ?? null}, text),
        date      = COALESCE(${date      ?? null}::date, date),
        completed = COALESCE(${completed ?? null}, completed)
      WHERE id = ${req.params.id} AND user_id = ${req.userId} RETURNING *
    `;
    if (!note) return res.status(404).json({ error: 'Note not found' });
    if (date && !note.completed) scheduleNoteReminders(req.userId, note.id, note.text, date).catch(console.error);
    res.json(note);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const [deleted] = await sql`DELETE FROM notes WHERE id=${req.params.id} AND user_id=${req.userId} RETURNING id`;
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
