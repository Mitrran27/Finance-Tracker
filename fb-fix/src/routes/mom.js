import { Router } from 'express';
import sql from '../db/client.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// DATE columns come back as local-midnight Date objects; send plain YYYY-MM-DD so
// the timezone shift in JSON serialisation doesn't move them to the previous day.
function day(d) {
  if (!(d instanceof Date)) return d;
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
const shapeTransfer = t => ({ ...t, month: day(t.month)?.slice(0,7), date: day(t.date) });
const shapeBill = b => b && ({ ...b, due_date: day(b.due_date), settled_at: day(b.settled_at) });

// Month picker gives "YYYY-MM"; store it as the 1st of that month
const toMonth = m => (m && m.length === 7 ? m + '-01' : m) || null;

// The expense in Expenses this section is linked to
async function ammaBill(userId) {
  const [bill] = await sql`
    SELECT * FROM bills
    WHERE user_id = ${userId} AND LOWER(TRIM(name)) = 'amma'
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return bill || null;
}

router.get('/', async (req, res) => {
  try {
    const bill = await ammaBill(req.userId);
    const transfers = await sql`
      SELECT * FROM mom_transfers WHERE user_id = ${req.userId}
      ORDER BY month DESC, date DESC, created_at DESC
    `;
    const total = transfers.reduce((s, t) => s + Number(t.amount), 0);
    res.json({ expense: shapeBill(bill), transfers: transfers.map(shapeTransfer), total });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Body: { month: 'YYYY-MM', date: 'YYYY-MM-DD', amount, note?, settle? }
// settle = true also marks the Amma expense as settled
router.post('/', async (req, res) => {
  try {
    const { month, date, amount, note, settle } = req.body;
    if (!month) return res.status(400).json({ error: 'month is required' });
    if (!date) return res.status(400).json({ error: 'date is required' });
    if (amount == null || isNaN(Number(amount)) || Number(amount) <= 0)
      return res.status(400).json({ error: 'Valid amount required' });

    const bill = await ammaBill(req.userId);
    const [transfer] = await sql`
      INSERT INTO mom_transfers (user_id, bill_id, month, date, amount, note)
      VALUES (${req.userId}, ${bill?.id ?? null}, ${toMonth(month)}, ${date}, ${Number(amount)}, ${note || null})
      RETURNING *
    `;
    if (settle && bill && !bill.settled) {
      await sql`UPDATE bills SET settled = true, settled_at = ${date} WHERE id = ${bill.id} AND user_id = ${req.userId}`;
    }
    res.status(201).json(shapeTransfer(transfer));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id', async (req, res) => {
  try {
    const { month, date, amount, note } = req.body;
    const has = k => Object.prototype.hasOwnProperty.call(req.body, k);
    const [transfer] = await sql`
      UPDATE mom_transfers SET
        month  = COALESCE(${toMonth(month)}::date, month),
        date   = COALESCE(${date ?? null}::date, date),
        amount = COALESCE(${amount ?? null}, amount),
        note   = CASE WHEN ${has('note')} THEN ${note || null} ELSE note END
      WHERE id = ${req.params.id} AND user_id = ${req.userId}
      RETURNING *
    `;
    if (!transfer) return res.status(404).json({ error: 'Transfer not found' });
    res.json(shapeTransfer(transfer));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const [deleted] = await sql`DELETE FROM mom_transfers WHERE id = ${req.params.id} AND user_id = ${req.userId} RETURNING id`;
    if (!deleted) return res.status(404).json({ error: 'Transfer not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
