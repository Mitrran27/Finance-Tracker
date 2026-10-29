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

// Mark a debt cleared once its payments cover the amount, and un-clear it if they no longer do
export async function refreshCleared(userId, debtId) {
  if (!debtId) return;
  await sql`
    UPDATE debts d SET
      cleared    = p.paid >= d.amount,
      cleared_at = CASE WHEN p.paid >= d.amount THEN COALESCE(d.cleared_at, CURRENT_DATE) ELSE NULL END
    FROM (SELECT COALESCE(SUM(amount), 0) AS paid FROM debt_payments WHERE debt_id = ${debtId}) p
    WHERE d.id = ${debtId} AND d.user_id = ${userId}
  `;
}

// Keep the debt payment that mirrors an expense transaction in step with it
export async function syncTxPayment(userId, tx) {
  await sql`DELETE FROM debt_payments WHERE tx_id = ${tx.id}`;
  if (tx.debt_id && tx.type === 'expense') {
    await sql`
      INSERT INTO debt_payments (user_id, debt_id, tx_id, amount, date, note)
      SELECT ${userId}, id, ${tx.id}, ${tx.amount}, ${day(tx.date)}::date, ${tx.description || null}
      FROM debts WHERE id = ${tx.debt_id} AND user_id = ${userId}
    `;
  }
}

router.get('/', async (req, res) => {
  try {
    const debts = await sql`
      SELECT d.*, COALESCE(p.paid, 0)::float AS paid, COALESCE(p.payments, '[]'::json) AS payments
      FROM debts d
      LEFT JOIN LATERAL (
        SELECT SUM(amount) AS paid,
               json_agg(json_build_object('id', id, 'amount', amount, 'date', date, 'note', note, 'tx_id', tx_id)
                        ORDER BY date DESC, id DESC) AS payments
        FROM debt_payments WHERE debt_id = d.id
      ) p ON TRUE
      WHERE d.user_id = ${req.userId}
      ORDER BY d.cleared ASC, (d.amount - COALESCE(p.paid, 0)) DESC, d.created_at ASC
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
    // A changed total may mean the payments now do (or no longer) cover it
    if (amount != null && cleared == null) await refreshCleared(req.userId, debt.id);
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

// ── Payments keyed in by hand (linked expenses are added via /transactions)
router.post('/:id/payments', async (req, res) => {
  try {
    const { amount, date, note } = req.body;
    if (amount == null || isNaN(Number(amount)) || Number(amount) <= 0)
      return res.status(400).json({ error: 'amount must be more than 0' });
    const [payment] = await sql`
      INSERT INTO debt_payments (user_id, debt_id, amount, date, note)
      SELECT ${req.userId}, id, ${Number(amount)}, COALESCE(${date || null}::date, CURRENT_DATE), ${note || null}
      FROM debts WHERE id = ${req.params.id} AND user_id = ${req.userId}
      RETURNING *
    `;
    if (!payment) return res.status(404).json({ error: 'Debt not found' });
    await refreshCleared(req.userId, payment.debt_id);
    res.status(201).json({ ...payment, date: day(payment.date) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id/payments/:pid', async (req, res) => {
  try {
    const [deleted] = await sql`
      DELETE FROM debt_payments
      WHERE id = ${req.params.pid} AND debt_id = ${req.params.id} AND user_id = ${req.userId} AND tx_id IS NULL
      RETURNING debt_id
    `;
    if (!deleted) return res.status(404).json({ error: 'Payment not found (payments from a linked expense are removed from Transactions)' });
    await refreshCleared(req.userId, deleted.debt_id);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
