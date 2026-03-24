import { Router } from 'express';
import sql from '../db/client.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/cards', async (req, res) => {
  try {
    const cards = await sql`SELECT * FROM credit_cards WHERE user_id = ${req.userId} ORDER BY created_at DESC`;
    res.json(cards);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/cards', async (req, res) => {
  try {
    const { name, credit_limit = 0, outstanding = 0 } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const [card] = await sql`
      INSERT INTO credit_cards (user_id, name, credit_limit, outstanding)
      VALUES (${req.userId}, ${name}, ${credit_limit}, ${outstanding}) RETURNING *
    `;
    res.status(201).json(card);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/cards/:id', async (req, res) => {
  try {
    const { name, credit_limit, outstanding } = req.body;
    const [old] = await sql`SELECT * FROM credit_cards WHERE id = ${req.params.id} AND user_id = ${req.userId}`;
    if (!old) return res.status(404).json({ error: 'Card not found' });
    const [card] = await sql`
      UPDATE credit_cards SET
        name         = COALESCE(${name         ?? null}, name),
        credit_limit = COALESCE(${credit_limit ?? null}, credit_limit),
        outstanding  = COALESCE(${outstanding  ?? null}, outstanding)
      WHERE id = ${req.params.id} AND user_id = ${req.userId} RETURNING *
    `;
    const amountPaid = Number(old.outstanding) - Number(outstanding ?? old.outstanding);
    if (amountPaid > 0) {
      const today = new Date().toISOString().split('T')[0];
      await sql`
        INSERT INTO cc_payment_history (user_id, card_id, card_name, outstanding_amount, amount_paid, outstanding_date, payment_date)
        VALUES (${req.userId}, ${old.id}, ${old.name}, ${old.outstanding}, ${amountPaid}, ${today}, ${today})
      `;
    }
    res.json(card);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/cards/:id', async (req, res) => {
  try {
    const [deleted] = await sql`DELETE FROM credit_cards WHERE id = ${req.params.id} AND user_id = ${req.userId} RETURNING id`;
    if (!deleted) return res.status(404).json({ error: 'Card not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/transactions', async (req, res) => {
  try {
    const { card_id, month, search, sort = 'date-desc' } = req.query;
    const uid     = req.userId;
    const cid     = card_id ? parseInt(card_id) : null;
    const tmonth  = month   || null;
    const tsearch = search  ? `%${search}%` : null;

    let txs;
    if (sort === 'amount-desc') {
      txs = await sql`
        SELECT t.*, c.name AS card_name FROM cc_transactions t LEFT JOIN credit_cards c ON c.id = t.card_id
        WHERE t.user_id = ${uid}
          AND (${cid}::int    IS NULL OR t.card_id = ${cid}::int)
          AND (${tmonth}::text  IS NULL OR TO_CHAR(t.date,'YYYY-MM') = ${tmonth}::text)
          AND (${tsearch}::text IS NULL OR t.description ILIKE ${tsearch}::text OR t.category ILIKE ${tsearch}::text)
        ORDER BY t.amount DESC`;
    } else if (sort === 'amount-asc') {
      txs = await sql`
        SELECT t.*, c.name AS card_name FROM cc_transactions t LEFT JOIN credit_cards c ON c.id = t.card_id
        WHERE t.user_id = ${uid}
          AND (${cid}::int    IS NULL OR t.card_id = ${cid}::int)
          AND (${tmonth}::text  IS NULL OR TO_CHAR(t.date,'YYYY-MM') = ${tmonth}::text)
          AND (${tsearch}::text IS NULL OR t.description ILIKE ${tsearch}::text OR t.category ILIKE ${tsearch}::text)
        ORDER BY t.amount ASC`;
    } else if (sort === 'date-asc') {
      txs = await sql`
        SELECT t.*, c.name AS card_name FROM cc_transactions t LEFT JOIN credit_cards c ON c.id = t.card_id
        WHERE t.user_id = ${uid}
          AND (${cid}::int    IS NULL OR t.card_id = ${cid}::int)
          AND (${tmonth}::text  IS NULL OR TO_CHAR(t.date,'YYYY-MM') = ${tmonth}::text)
          AND (${tsearch}::text IS NULL OR t.description ILIKE ${tsearch}::text OR t.category ILIKE ${tsearch}::text)
        ORDER BY t.date ASC`;
    } else {
      txs = await sql`
        SELECT t.*, c.name AS card_name FROM cc_transactions t LEFT JOIN credit_cards c ON c.id = t.card_id
        WHERE t.user_id = ${uid}
          AND (${cid}::int    IS NULL OR t.card_id = ${cid}::int)
          AND (${tmonth}::text  IS NULL OR TO_CHAR(t.date,'YYYY-MM') = ${tmonth}::text)
          AND (${tsearch}::text IS NULL OR t.description ILIKE ${tsearch}::text OR t.category ILIKE ${tsearch}::text)
        ORDER BY t.date DESC`;
    }
    res.json(txs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/transactions', async (req, res) => {
  try {
    const { card_id, amount, description, category, date } = req.body;
    if (!amount || !date) return res.status(400).json({ error: 'amount and date are required' });
    const [tx] = await sql`
      INSERT INTO cc_transactions (user_id, card_id, amount, description, category, date)
      VALUES (${req.userId}, ${card_id ?? null}, ${amount}, ${description ?? null}, ${category ?? null}, ${date})
      RETURNING *
    `;
    if (card_id) {
      await sql`UPDATE credit_cards SET outstanding = outstanding + ${amount} WHERE id = ${card_id} AND user_id = ${req.userId}`;
    }
    res.status(201).json(tx);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/transactions/:id', async (req, res) => {
  try {
    const [deleted] = await sql`DELETE FROM cc_transactions WHERE id = ${req.params.id} AND user_id = ${req.userId} RETURNING *`;
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/history', async (req, res) => {
  try {
    const history = await sql`SELECT * FROM cc_payment_history WHERE user_id = ${req.userId} ORDER BY outstanding_date DESC`;
    res.json(history);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/history/:id', async (req, res) => {
  try {
    const [deleted] = await sql`DELETE FROM cc_payment_history WHERE id = ${req.params.id} AND user_id = ${req.userId} RETURNING id`;
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
