import { Router } from 'express';
import sql from '../db/client.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const banks = await sql`
      SELECT * FROM bank_accounts WHERE user_id = ${req.userId} ORDER BY created_at DESC
    `;
    res.json(banks);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, balance = 0 } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const [bank] = await sql`
      INSERT INTO bank_accounts (user_id, name, balance)
      VALUES (${req.userId}, ${name}, ${balance})
      RETURNING *
    `;
    res.status(201).json(bank);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id', async (req, res) => {
  try {
    const { name, balance } = req.body;
    const [bank] = await sql`
      UPDATE bank_accounts
      SET name    = COALESCE(${name    ?? null}, name),
          balance = COALESCE(${balance ?? null}, balance)
      WHERE id = ${req.params.id} AND user_id = ${req.userId}
      RETURNING *
    `;
    if (!bank) return res.status(404).json({ error: 'Bank account not found' });
    res.json(bank);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const [deleted] = await sql`
      DELETE FROM bank_accounts WHERE id = ${req.params.id} AND user_id = ${req.userId} RETURNING id
    `;
    if (!deleted) return res.status(404).json({ error: 'Bank account not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
