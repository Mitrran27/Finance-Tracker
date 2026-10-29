import { Router } from 'express';
import sql from '../db/client.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// DATE columns come back as local-midnight Date objects; send plain YYYY-MM-DD
function day(d) {
  if (!(d instanceof Date)) return d;
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
const shape = d => ({ ...d, cleared_at: day(d.cleared_at) });

router.get('/', async (req, res) => {
  try {
    const debts = await sql`
      SELECT * FROM debts WHERE user_id = ${req.userId}
      ORDER BY cleared ASC, amount DESC, created_at ASC
    `;
    res.json(debts.map(shape));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, amount, details } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'name is required' });
    if (amount == null || isNaN(Number(amount))) return res.status(400).json({ error: 'amount is required' });
    const [debt] = await sql`
      INSERT INTO debts (user_id, name, amount, details)
      VALUES (${req.userId}, ${String(name).trim()}, ${Number(amount)}, ${details || null})
      RETURNING *
    `;
    res.status(201).json(shape(debt));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id', async (req, res) => {
  try {
    const { name, amount, details, cleared } = req.body;
    const has = k => Object.prototype.hasOwnProperty.call(req.body, k);
    const [debt] = await sql`
      UPDATE debts SET
        name       = COALESCE(${name ?? null}, name),
        amount     = COALESCE(${amount ?? null}, amount),
        details    = CASE WHEN ${has('details')} THEN ${details || null} ELSE details END,
        cleared    = COALESCE(${cleared ?? null}, cleared),
        cleared_at = CASE WHEN ${cleared ?? null}::boolean IS TRUE  THEN CURRENT_DATE
                          WHEN ${cleared ?? null}::boolean IS FALSE THEN NULL
                          ELSE cleared_at END
      WHERE id = ${req.params.id} AND user_id = ${req.userId}
      RETURNING *
    `;
    if (!debt) return res.status(404).json({ error: 'Debt not found' });
    res.json(shape(debt));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const [deleted] = await sql`DELETE FROM debts WHERE id = ${req.params.id} AND user_id = ${req.userId} RETURNING id`;
    if (!deleted) return res.status(404).json({ error: 'Debt not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
