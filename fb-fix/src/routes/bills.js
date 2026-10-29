import { Router } from 'express';
import sql from '../db/client.js';
import { authenticate } from '../middleware/auth.js';
import { syncBill, refreshLinkedDebt } from './debts.js';

const router = Router();
router.use(authenticate);

// DATE columns come back as local-midnight Date objects; send plain YYYY-MM-DD so
// the timezone shift in JSON serialisation doesn't move them to the previous day.
function day(d) {
  if (!(d instanceof Date)) return d;
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
const shape = b => ({ ...b, due_date: day(b.due_date), settled_at: day(b.settled_at) });

router.get('/', async (req, res) => {
  try {
    const bills = await sql`
      SELECT * FROM bills WHERE user_id = ${req.userId}
      ORDER BY settled ASC, due_date ASC NULLS LAST, created_at ASC
    `;
    res.json(bills.map(shape));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Accepts a single bill, or { items: [...] } to add many at once
router.post('/', async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [req.body];
    if (items.length === 0) return res.status(400).json({ error: 'No bills given' });
    for (const b of items) {
      if (!b.name || !String(b.name).trim()) return res.status(400).json({ error: 'name is required' });
      if (b.amount == null || isNaN(Number(b.amount))) return res.status(400).json({ error: `amount is required for "${b.name}"` });
    }
    const created = [];
    for (const b of items) {
      const [bill] = await sql`
        INSERT INTO bills (user_id, name, amount, due_date, category, note, debt_id, commitment_id)
        VALUES (${req.userId}, ${String(b.name).trim()}, ${Number(b.amount)}, ${b.due_date || null}, ${b.category || null}, ${b.note || null},
                ${b.debt_id || null}, ${b.commitment_id || null})
        RETURNING *
      `;
      created.push(shape(bill));
    }
    res.status(201).json(Array.isArray(req.body.items) ? created : created[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id', async (req, res) => {
  try {
    const { name, amount, due_date, category, note, settled, debt_id, commitment_id } = req.body;
    // due_date / category / note / debt_id / commitment_id may be explicitly cleared with null
    const has = k => Object.prototype.hasOwnProperty.call(req.body, k);
    const [bill] = await sql`
      UPDATE bills SET
        name       = COALESCE(${name ?? null}, name),
        amount     = COALESCE(${amount ?? null}, amount),
        due_date   = CASE WHEN ${has('due_date')} THEN ${due_date || null}::date ELSE due_date END,
        category   = CASE WHEN ${has('category')} THEN ${category || null} ELSE category END,
        note       = CASE WHEN ${has('note')}     THEN ${note || null}     ELSE note END,
        debt_id       = CASE WHEN ${has('debt_id')}       THEN ${debt_id || null}::int       ELSE debt_id END,
        commitment_id = CASE WHEN ${has('commitment_id')} THEN ${commitment_id || null}::int ELSE commitment_id END,
        settled    = COALESCE(${settled ?? null}, settled),
        settled_at = CASE WHEN ${settled ?? null}::boolean IS TRUE  THEN CURRENT_DATE
                          WHEN ${settled ?? null}::boolean IS FALSE THEN NULL
                          ELSE settled_at END
      WHERE id = ${req.params.id} AND user_id = ${req.userId}
      RETURNING *
    `;
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    // Settling a linked item pays its debt; un-settling or unlinking takes the payment back
    await syncBill(req.userId, bill);
    res.json(shape(bill));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const [deleted] = await sql`DELETE FROM bills WHERE id = ${req.params.id} AND user_id = ${req.userId} RETURNING *`;
    if (!deleted) return res.status(404).json({ error: 'Bill not found' });
    // Its debt payment went with it (ON DELETE CASCADE)
    await refreshLinkedDebt(req.userId, deleted);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
