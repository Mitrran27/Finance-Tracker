import { Router } from 'express';
import sql from '../db/client.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const rows = await sql`SELECT key, value FROM settings WHERE user_id = ${req.userId}`;
    const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
    res.json(map);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// IMPORTANT: /profile must come BEFORE /:key to avoid route conflict
router.patch('/profile', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const [user] = await sql`UPDATE users SET name = ${name} WHERE id = ${req.userId} RETURNING id, name, email`;
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:key', async (req, res) => {
  try {
    const { value } = req.body;
    const [setting] = await sql`
      INSERT INTO settings (user_id, key, value) VALUES (${req.userId}, ${req.params.key}, ${value ?? null})
      ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value
      RETURNING *
    `;
    res.json(setting);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
