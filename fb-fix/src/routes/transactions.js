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
      txs = await sql`SELECT t.*, b.name AS bank_name FROM transactions t LEFT JOIN bank_accounts b ON b.id = t.bank_id WHERE t.user_id=${uid} AND (${bid}::int IS NULL OR t.bank_id=${bid}::int) AND (${ttype}::text IS NULL OR t.type=${ttype}::text) AND (${tcat}::text IS NULL OR t.category=${tcat}::text) AND (${tmonth}::text IS NULL OR TO_CHAR(t.date,'YYYY-MM')=${tmonth}::text) AND (${tsearch}::text IS NULL OR t.description ILIKE ${tsearch}::text OR t.category ILIKE ${tsearch}::text) ORDER BY t.amount DESC`;
    } else if (sort === 'amount-asc') {
      txs = await sql`SELECT t.*, b.name AS bank_name FROM transactions t LEFT JOIN bank_accounts b ON b.id = t.bank_id WHERE t.user_id=${uid} AND (${bid}::int IS NULL OR t.bank_id=${bid}::int) AND (${ttype}::text IS NULL OR t.type=${ttype}::text) AND (${tcat}::text IS NULL OR t.category=${tcat}::text) AND (${tmonth}::text IS NULL OR TO_CHAR(t.date,'YYYY-MM')=${tmonth}::text) AND (${tsearch}::text IS NULL OR t.description ILIKE ${tsearch}::text OR t.category ILIKE ${tsearch}::text) ORDER BY t.amount ASC`;
    } else if (sort === 'date-asc') {
      txs = await sql`SELECT t.*, b.name AS bank_name FROM transactions t LEFT JOIN bank_accounts b ON b.id = t.bank_id WHERE t.user_id=${uid} AND (${bid}::int IS NULL OR t.bank_id=${bid}::int) AND (${ttype}::text IS NULL OR t.type=${ttype}::text) AND (${tcat}::text IS NULL OR t.category=${tcat}::text) AND (${tmonth}::text IS NULL OR TO_CHAR(t.date,'YYYY-MM')=${tmonth}::text) AND (${tsearch}::text IS NULL OR t.description ILIKE ${tsearch}::text OR t.category ILIKE ${tsearch}::text) ORDER BY t.date ASC, t.created_at ASC`;
    } else {
      txs = await sql`SELECT t.*, b.name AS bank_name FROM transactions t LEFT JOIN bank_accounts b ON b.id = t.bank_id WHERE t.user_id=${uid} AND (${bid}::int IS NULL OR t.bank_id=${bid}::int) AND (${ttype}::text IS NULL OR t.type=${ttype}::text) AND (${tcat}::text IS NULL OR t.category=${tcat}::text) AND (${tmonth}::text IS NULL OR TO_CHAR(t.date,'YYYY-MM')=${tmonth}::text) AND (${tsearch}::text IS NULL OR t.description ILIKE ${tsearch}::text OR t.category ILIKE ${tsearch}::text) ORDER BY t.date DESC, t.created_at DESC`;
    }
    res.json(txs);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { bank_id, type, amount, description, category, date, is_savings = false, goal_id } = req.body;
    if (!type || !amount || !date)
      return res.status(400).json({ error: 'type, amount and date are required' });

    const [tx] = await sql`
      INSERT INTO transactions (user_id, bank_id, type, amount, description, category, date, is_savings, goal_id)
      VALUES (${req.userId}, ${bank_id ?? null}, ${type}, ${amount}, ${description ?? null}, ${category ?? null}, ${date}, ${is_savings}, ${goal_id ?? null})
      RETURNING *
    `;

    // Update bank balance immediately on add
    if (bank_id) {
      if (type === 'income') {
        await sql`UPDATE bank_accounts SET balance = balance + ${amount} WHERE id = ${bank_id} AND user_id = ${req.userId}`;
      } else if (type === 'expense') {
        await sql`UPDATE bank_accounts SET balance = balance - ${amount} WHERE id = ${bank_id} AND user_id = ${req.userId}`;
      }
    }

    // Auto-contribute to goal when flagged as savings and a goal is selected
    if (is_savings && goal_id) {
      const [goal] = await sql`SELECT * FROM savings_goals WHERE id = ${goal_id} AND user_id = ${req.userId}`;
      if (goal) {
        await sql`
          INSERT INTO goal_transactions (goal_id, user_id, tx_id, amount, note)
          VALUES (${goal_id}, ${req.userId}, ${tx.id}, ${amount}, ${description ?? null})
        `;
        await sql`UPDATE savings_goals SET current = current + ${amount} WHERE id = ${goal_id} AND user_id = ${req.userId}`;
      }
    }

    res.status(201).json(tx);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

router.patch('/:id', async (req, res) => {
  try {
    const { bank_id, type, amount, description, category, date, is_savings } = req.body;
    const [old] = await sql`SELECT * FROM transactions WHERE id = ${req.params.id} AND user_id = ${req.userId}`;
    if (!old) return res.status(404).json({ error: 'Transaction not found' });

    // Reverse old transaction's effect on balance
    if (old.bank_id) {
      if (old.type === 'income') {
        await sql`UPDATE bank_accounts SET balance = balance - ${old.amount} WHERE id = ${old.bank_id} AND user_id = ${req.userId}`;
      } else if (old.type === 'expense') {
        await sql`UPDATE bank_accounts SET balance = balance + ${old.amount} WHERE id = ${old.bank_id} AND user_id = ${req.userId}`;
      }
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

    // Apply new transaction's effect on balance
    const newBankId = tx.bank_id;
    if (newBankId) {
      if (tx.type === 'income') {
        await sql`UPDATE bank_accounts SET balance = balance + ${tx.amount} WHERE id = ${newBankId} AND user_id = ${req.userId}`;
      } else if (tx.type === 'expense') {
        await sql`UPDATE bank_accounts SET balance = balance - ${tx.amount} WHERE id = ${newBankId} AND user_id = ${req.userId}`;
      }
    }

    res.json(tx);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const [deleted] = await sql`DELETE FROM transactions WHERE id = ${req.params.id} AND user_id = ${req.userId} RETURNING *`;
    if (!deleted) return res.status(404).json({ error: 'Not found' });

    // Reverse the deleted transaction's effect on balance
    if (deleted.bank_id) {
      if (deleted.type === 'income') {
        await sql`UPDATE bank_accounts SET balance = balance - ${deleted.amount} WHERE id = ${deleted.bank_id} AND user_id = ${req.userId}`;
      } else if (deleted.type === 'expense') {
        await sql`UPDATE bank_accounts SET balance = balance + ${deleted.amount} WHERE id = ${deleted.bank_id} AND user_id = ${req.userId}`;
      }
    }

    res.json({ message: 'Deleted' });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

export default router;
