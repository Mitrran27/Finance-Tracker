import { Router } from 'express';
import sql from '../db/client.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// ── IMPORTANT: All specific routes MUST come before /:key catch-all ──────────

// GET /settings
router.get('/', async (req, res) => {
  try {
    const rows = await sql`SELECT key, value FROM settings WHERE user_id = ${req.userId}`;
    res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /settings/reminder-emails → { login_email, extras, all }
router.get('/reminder-emails', async (req, res) => {
  try {
    const [user] = await sql`SELECT email FROM users WHERE id = ${req.userId}`;
    const [row]  = await sql`
      SELECT value FROM settings WHERE user_id = ${req.userId} AND key = 'reminder_emails'
    `;
    const extras = row?.value ? JSON.parse(row.value) : [];
    res.json({ login_email: user.email, extras, all: [user.email, ...extras] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /settings/reminder-emails → add an extra email
router.post('/reminder-emails', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@'))
      return res.status(400).json({ error: 'Valid email required' });

    const [user] = await sql`SELECT email FROM users WHERE id = ${req.userId}`;
    if (email.trim().toLowerCase() === user.email.toLowerCase())
      return res.status(400).json({ error: 'That is already your login email' });

    const [row] = await sql`
      SELECT value FROM settings WHERE user_id = ${req.userId} AND key = 'reminder_emails'
    `;
    const extras = row?.value ? JSON.parse(row.value) : [];
    if (extras.map(e => e.toLowerCase()).includes(email.trim().toLowerCase()))
      return res.status(400).json({ error: 'Email already added' });

    extras.push(email.trim());
    await sql`
      INSERT INTO settings (user_id, key, value)
      VALUES (${req.userId}, 'reminder_emails', ${JSON.stringify(extras)})
      ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value
    `;
    res.json({ extras, all: [user.email, ...extras] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /settings/reminder-emails/:email → remove an extra email
router.delete('/reminder-emails/:email', async (req, res) => {
  try {
    const target = decodeURIComponent(req.params.email);
    const [row]  = await sql`
      SELECT value FROM settings WHERE user_id = ${req.userId} AND key = 'reminder_emails'
    `;
    const extras  = row?.value ? JSON.parse(row.value) : [];
    const updated = extras.filter(e => e.toLowerCase() !== target.toLowerCase());
    await sql`
      INSERT INTO settings (user_id, key, value)
      VALUES (${req.userId}, 'reminder_emails', ${JSON.stringify(updated)})
      ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value
    `;
    const [user] = await sql`SELECT email FROM users WHERE id = ${req.userId}`;
    res.json({ extras: updated, all: [user.email, ...updated] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /settings/profile → update display name
router.patch('/profile', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const [user] = await sql`
      UPDATE users SET name = ${name} WHERE id = ${req.userId} RETURNING id, name, email
    `;
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /settings/:key → upsert any setting (MUST be last — catch-all)
router.put('/:key', async (req, res) => {
  try {
    const { value } = req.body;
    const [setting] = await sql`
      INSERT INTO settings (user_id, key, value)
      VALUES (${req.userId}, ${req.params.key}, ${value ?? null})
      ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value
      RETURNING *
    `;
    res.json(setting);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
