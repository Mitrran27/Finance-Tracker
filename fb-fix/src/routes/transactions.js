import { Router } from 'express';
import sql from '../db/client.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { bank_id, type, category, month, search, sort = 'date-desc' } = req.query;
    const uid     = req.userId;
    const bid     = bank_id  ? parseInt(bank_id) : null;
    const ttype   = type     || null;
    const tcat    = category || null;
    const tmonth  = month    || null;
    const tsearch = search   ? `%${search}%` : null;

    let txs;
    if (sort === 'amount-desc') {
      txs = await sql`
        SELECT t.*, b.name AS bank_name FROM transactions t
        LEFT JOIN bank_accounts b ON b.id = t.bank_id
        WHERE t.user_id = ${uid}
          AND (${bid}::int    IS NULL OR t.bank_id  = ${bid}::int)
          AND (${ttype}::text IS NULL OR t.type     = ${ttype}::text)
          AND (${tcat}::text  IS NULL OR t.category = ${tcat}::text)
          AND (${tmonth}::text IS NULL OR TO_CHAR(t.date,'YYYY-MM') = ${tmonth}::text)
          AND (${tsearch}::text IS NULL OR t.description ILIKE ${tsearch}::text OR t.category ILIKE ${tsearch}::text)
        ORDER BY t.amount DESC`;
    } else if (sort === 'amount-asc') {
      txs = await sql`
        SELECT t.*, b.name AS bank_name FROM transactions t
        LEFT JOIN bank_accounts b ON b.id = t.bank_id
        WHERE t.user_id = ${uid}
          AND (${bid}::int    IS NULL OR t.bank_id  = ${bid}::int)
          AND (${ttype}::text IS NULL OR t.type     = ${ttype}::text)
          AND (${tcat}::text  IS NULL OR t.category = ${tcat}::text)
          AND (${tmonth}::text IS NULL OR TO_CHAR(t.date,'YYYY-MM') = ${tmonth}::text)
          AND (${tsearch}::text IS NULL OR t.description ILIKE ${tsearch}::text OR t.category ILIKE ${tsearch}::text)
        ORDER BY t.amount ASC`;
    } else if (sort === 'date-asc') {
      txs = await sql`
        SELECT t.*, b.name AS bank_name FROM transactions t
        LEFT JOIN bank_accounts b ON b.id = t.bank_id
        WHERE t.user_id = ${uid}
          AND (${bid}::int    IS NULL OR t.bank_id  = ${bid}::int)
          AND (${ttype}::text IS NULL OR t.type     = ${ttype}::text)
          AND (${tcat}::text  IS NULL OR t.category = ${tcat}::text)
          AND (${tmonth}::text IS NULL OR TO_CHAR(t.date,'YYYY-MM') = ${tmonth}::text)
          AND (${tsearch}::text IS NULL OR t.description ILIKE ${tsearch}::text OR t.category ILIKE ${tsearch}::text)
        ORDER BY t.date ASC, t.created_at ASC`;
    } else {
      txs = await sql`
        SELECT t.*, b.name AS bank_name FROM transactions t
        LEFT JOIN bank_accounts b ON b.id = t.bank_id
        WHERE t.user_id = ${uid}
          AND (${bid}::int    IS NULL OR t.bank_id  = ${bid}::int)
          AND (${ttype}::text IS NULL OR t.type     = ${ttype}::text)
          AND (${tcat}::text  IS NULL OR t.category = ${tcat}::text)
          AND (${tmonth}::text IS NULL OR TO_CHAR(t.date,'YYYY-MM') = ${tmonth}::text)
          AND (${tsearch}::text IS NULL OR t.description ILIKE ${tsearch}::text OR t.category ILIKE ${tsearch}::text)
        ORDER BY t.date DESC, t.created_at DESC`;
    }
    res.json(txs);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { bank_id, type, amount, description, category, date, is_savings = false } = req.body;
    if (!type || !amount || !date)
      return res.status(400).json({ error: 'type, amount and date are required' });
    const [tx] = await sql`
      INSERT INTO transactions (user_id, bank_id, type, amount, description, category, date, is_savings)
      VALUES (${req.userId}, ${bank_id ?? null}, ${type}, ${amount}, ${description ?? null}, ${category ?? null}, ${date}, ${is_savings})
      RETURNING *
    `;
    if (type === 'income' && bank_id) {
      await sql`UPDATE bank_accounts SET balance = balance + ${amount} WHERE id = ${bank_id} AND user_id = ${req.userId}`;
    }
    res.status(201).json(tx);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

router.patch('/:id', async (req, res) => {
  try {
    const { bank_id, type, amount, description, category, date, is_savings } = req.body;
    const [old] = await sql`SELECT * FROM transactions WHERE id = ${req.params.id} AND user_id = ${req.userId}`;
    if (!old) return res.status(404).json({ error: 'Transaction not found' });
    if (old.type === 'income' && old.bank_id) {
      await sql`UPDATE bank_accounts SET balance = balance - ${old.amount} WHERE id = ${old.bank_id} AND user_id = ${req.userId}`;
    }
    const [tx] = await sql`
      UPDATE transactions SET
        bank_id     = COALESCE(${bank_id     ?? null}, bank_id),
        type        = COALESCE(${type        ?? null}, type),
        amount      = COALESCE(${amount      ?? null}, amount),
        description = COALESCE(${description ?? null}, description),
        category    = COALESCE(${category    ?? null}, category),
        date        = COALESCE(${date        ?? null}::date, date),
        is_savings  = COALESCE(${is_savings  ?? null}, is_savings)
      WHERE id = ${req.params.id} AND user_id = ${req.userId}
      RETURNING *
    `;
    const newBankId = bank_id ?? old.bank_id;
    const newType   = type   ?? old.type;
    const newAmount = amount ?? old.amount;
    if (newType === 'income' && newBankId) {
      await sql`UPDATE bank_accounts SET balance = balance + ${newAmount} WHERE id = ${newBankId} AND user_id = ${req.userId}`;
    }
    res.json(tx);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const [deleted] = await sql`DELETE FROM transactions WHERE id = ${req.params.id} AND user_id = ${req.userId} RETURNING *`;
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
