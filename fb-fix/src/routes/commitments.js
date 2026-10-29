import { Router } from 'express';
import sql from '../db/client.js';
import { authenticate } from '../middleware/auth.js';
import { resyncCommitment } from './debts.js';

const router = Router();
router.use(authenticate);

// DATE columns come back as local-midnight Date objects; send plain YYYY-MM-DD
function day(d) {
  if (!(d instanceof Date)) return d;
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
const shape = c => ({ ...c, end_date: day(c.end_date) });

// ?month=YYYY-MM (the client's month, so timezones don't matter) adds paid_month: the total
// of linked expense transactions plus linked expense-list items settled in that month
router.get('/', async (req, res) => {
  try {
    const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : null;
    const commitments = await sql`
      SELECT c.*, d.name AS debt_name,
        (COALESCE((SELECT SUM(t.amount) FROM transactions t
                   WHERE t.commitment_id = c.id AND t.type = 'expense'
                     AND TO_CHAR(t.date, 'YYYY-MM') = COALESCE(${month}::text, TO_CHAR(CURRENT_DATE, 'YYYY-MM'))), 0)
       + COALESCE((SELECT SUM(b.amount) FROM bills b
                   WHERE b.commitment_id = c.id AND b.settled
                     AND TO_CHAR(b.settled_at, 'YYYY-MM') = COALESCE(${month}::text, TO_CHAR(CURRENT_DATE, 'YYYY-MM'))), 0))::float AS paid_month
      FROM commitments c
      LEFT JOIN debts d ON d.id = c.debt_id
      WHERE c.user_id = ${req.userId}
      ORDER BY c.amount DESC, c.created_at ASC
    `;
    res.json(commitments.map(shape));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, type, amount, end_date, details, debt_id } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'name is required' });
    if (amount == null || isNaN(Number(amount))) return res.status(400).json({ error: 'amount is required' });
    const [c] = await sql`
      INSERT INTO commitments (user_id, name, type, amount, end_date, details, debt_id)
      VALUES (${req.userId}, ${String(name).trim()}, ${type || null}, ${Number(amount)}, ${end_date || null}, ${details || null}, ${debt_id || null})
      RETURNING *
    `;
    res.status(201).json(shape(c));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id', async (req, res) => {
  try {
    const { name, type, amount, end_date, details, debt_id } = req.body;
    // type / end_date / details / debt_id may be explicitly cleared with null
    const has = k => Object.prototype.hasOwnProperty.call(req.body, k);
    const [old] = await sql`SELECT debt_id FROM commitments WHERE id = ${req.params.id} AND user_id = ${req.userId}`;
    if (!old) return res.status(404).json({ error: 'Commitment not found' });
    const [c] = await sql`
      UPDATE commitments SET
        name     = COALESCE(${name ?? null}, name),
        amount   = COALESCE(${amount ?? null}, amount),
        type     = CASE WHEN ${has('type')}     THEN ${type || null}           ELSE type END,
        end_date = CASE WHEN ${has('end_date')} THEN ${end_date || null}::date ELSE end_date END,
        details  = CASE WHEN ${has('details')}  THEN ${details || null}        ELSE details END,
        debt_id  = CASE WHEN ${has('debt_id')}  THEN ${debt_id || null}::int   ELSE debt_id END
      WHERE id = ${req.params.id} AND user_id = ${req.userId}
      RETURNING *
    `;
    // Payments already made through this commitment move to the newly linked debt
    if (c.debt_id !== old.debt_id) await resyncCommitment(req.userId, c.id);
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
