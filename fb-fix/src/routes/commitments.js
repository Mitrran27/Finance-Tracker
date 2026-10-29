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
const shape = c => ({ ...c, end_date: day(c.end_date) });

// ?month=YYYY-MM (the client's month, so timezones don't matter) adds paid_month:
// the total of expenses linked to each commitment in that month
router.get('/', async (req, res) => {
  try {
    const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : null;
    const commitments = await sql`
      SELECT c.*,
        COALESCE((SELECT SUM(t.amount) FROM transactions t
                  WHERE t.commitment_id = c.id AND t.type = 'expense'
                    AND TO_CHAR(t.date, 'YYYY-MM') = COALESCE(${month}::text, TO_CHAR(CURRENT_DATE, 'YYYY-MM'))), 0)::float AS paid_month,
        (SELECT TO_CHAR(MAX(t.date), 'YYYY-MM-DD') FROM transactions t
         WHERE t.commitment_id = c.id AND t.type = 'expense') AS last_paid
      FROM commitments c WHERE c.user_id = ${req.userId}
      ORDER BY c.amount DESC, c.created_at ASC
    `;
    res.json(commitments.map(shape));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, type, amount, end_date, details } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'name is required' });
    if (amount == null || isNaN(Number(amount))) return res.status(400).json({ error: 'amount is required' });
    const [c] = await sql`
      INSERT INTO commitments (user_id, name, type, amount, end_date, details)
      VALUES (${req.userId}, ${String(name).trim()}, ${type || null}, ${Number(amount)}, ${end_date || null}, ${details || null})
      RETURNING *
    `;
    res.status(201).json(shape(c));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id', async (req, res) => {
  try {
    const { name, type, amount, end_date, details } = req.body;
    // type / end_date / details may be explicitly cleared with null
    const has = k => Object.prototype.hasOwnProperty.call(req.body, k);
    const [c] = await sql`
      UPDATE commitments SET
        name     = COALESCE(${name ?? null}, name),
        amount   = COALESCE(${amount ?? null}, amount),
        type     = CASE WHEN ${has('type')}     THEN ${type || null}           ELSE type END,
        end_date = CASE WHEN ${has('end_date')} THEN ${end_date || null}::date ELSE end_date END,
        details  = CASE WHEN ${has('details')}  THEN ${details || null}        ELSE details END
      WHERE id = ${req.params.id} AND user_id = ${req.userId}
      RETURNING *
    `;
    if (!c) return res.status(404).json({ error: 'Commitment not found' });
    res.json(shape(c));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const [deleted] = await sql`DELETE FROM commitments WHERE id = ${req.params.id} AND user_id = ${req.userId} RETURNING id`;
    if (!deleted) return res.status(404).json({ error: 'Commitment not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
