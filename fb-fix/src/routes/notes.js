import { Router } from 'express';
import sql from '../db/client.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { search, sort = 'date-desc' } = req.query;
    const uid     = req.userId;
    const tsearch = search ? `%${search}%` : null;

    let notes;
    if (sort === 'date-asc') {
      notes = await sql`SELECT * FROM notes WHERE user_id = ${uid} AND (${tsearch}::text IS NULL OR text ILIKE ${tsearch}::text) ORDER BY date ASC NULLS LAST`;
    } else if (sort === 'status-active') {
      notes = await sql`SELECT * FROM notes WHERE user_id = ${uid} AND (${tsearch}::text IS NULL OR text ILIKE ${tsearch}::text) ORDER BY completed ASC, date DESC NULLS LAST`;
    } else if (sort === 'status-completed') {
      notes = await sql`SELECT * FROM notes WHERE user_id = ${uid} AND (${tsearch}::text IS NULL OR text ILIKE ${tsearch}::text) ORDER BY completed DESC, date DESC NULLS LAST`;
    } else {
      notes = await sql`SELECT * FROM notes WHERE user_id = ${uid} AND (${tsearch}::text IS NULL OR text ILIKE ${tsearch}::text) ORDER BY date DESC NULLS LAST`;
    }
    res.json(notes);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { text, date } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });
    const [note] = await sql`INSERT INTO notes (user_id, text, date) VALUES (${req.userId}, ${text}, ${date ?? null}) RETURNING *`;
    res.status(201).json(note);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id', async (req, res) => {
  try {
    const { text, date, completed } = req.body;
    const [note] = await sql`
      UPDATE notes SET
        text      = COALESCE(${text      ?? null}, text),
        date      = COALESCE(${date      ?? null}::date, date),
        completed = COALESCE(${completed ?? null}, completed)
      WHERE id = ${req.params.id} AND user_id = ${req.userId} RETURNING *
    `;
    if (!note) return res.status(404).json({ error: 'Note not found' });
    res.json(note);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const [deleted] = await sql`DELETE FROM notes WHERE id = ${req.params.id} AND user_id = ${req.userId} RETURNING id`;
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
