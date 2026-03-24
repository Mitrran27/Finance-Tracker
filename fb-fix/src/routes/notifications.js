import { Router } from 'express';
import sql from '../db/client.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const notifs = await sql`
      SELECT * FROM notifications WHERE user_id = ${req.userId} ORDER BY date DESC NULLS LAST, created_at DESC
    `;
    res.json(notifs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// IMPORTANT: read-all must come BEFORE /:id/read to avoid route conflict
router.patch('/read-all', async (req, res) => {
  try {
    await sql`UPDATE notifications SET is_read = TRUE WHERE user_id = ${req.userId}`;
    res.json({ message: 'All marked as read' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id/read', async (req, res) => {
  try {
    const [notif] = await sql`
      UPDATE notifications SET is_read = TRUE WHERE id = ${req.params.id} AND user_id = ${req.userId} RETURNING *
    `;
    if (!notif) return res.status(404).json({ error: 'Not found' });
    res.json(notif);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const [deleted] = await sql`DELETE FROM notifications WHERE id = ${req.params.id} AND user_id = ${req.userId} RETURNING id`;
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
