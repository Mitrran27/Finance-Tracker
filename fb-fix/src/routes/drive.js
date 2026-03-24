import { Router } from 'express';
import sql from '../db/client.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/folders', async (req, res) => {
  try {
    const folders = await sql`
      SELECT f.*, COUNT(fi.id)::int AS file_count
      FROM folders f LEFT JOIN files fi ON fi.folder_id = f.id
      WHERE f.user_id = ${req.userId}
      GROUP BY f.id ORDER BY f.created_at DESC
    `;
    res.json(folders);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/folders', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const [folder] = await sql`INSERT INTO folders (user_id, name) VALUES (${req.userId}, ${name}) RETURNING *`;
    res.status(201).json(folder);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/folders/:id', async (req, res) => {
  try {
    const [deleted] = await sql`DELETE FROM folders WHERE id = ${req.params.id} AND user_id = ${req.userId} RETURNING id`;
    if (!deleted) return res.status(404).json({ error: 'Folder not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/files', async (req, res) => {
  try {
    const { folder_id, search, month, sort = 'date-desc' } = req.query;
    const uid     = req.userId;
    const tmonth  = month  || null;
    const tsearch = search ? `%${search}%` : null;
    const asc     = sort === 'date-asc';

    let files;
    if (folder_id === 'root') {
      files = asc
        ? await sql`SELECT f.*, fo.name AS folder_name FROM files f LEFT JOIN folders fo ON fo.id = f.folder_id WHERE f.user_id = ${uid} AND f.folder_id IS NULL AND (${tmonth}::text IS NULL OR TO_CHAR(f.date,'YYYY-MM') = ${tmonth}::text) AND (${tsearch}::text IS NULL OR f.name ILIKE ${tsearch}::text OR f.type ILIKE ${tsearch}::text) ORDER BY f.date ASC`
        : await sql`SELECT f.*, fo.name AS folder_name FROM files f LEFT JOIN folders fo ON fo.id = f.folder_id WHERE f.user_id = ${uid} AND f.folder_id IS NULL AND (${tmonth}::text IS NULL OR TO_CHAR(f.date,'YYYY-MM') = ${tmonth}::text) AND (${tsearch}::text IS NULL OR f.name ILIKE ${tsearch}::text OR f.type ILIKE ${tsearch}::text) ORDER BY f.date DESC`;
    } else if (folder_id) {
      const fid = parseInt(folder_id);
      files = asc
        ? await sql`SELECT f.*, fo.name AS folder_name FROM files f LEFT JOIN folders fo ON fo.id = f.folder_id WHERE f.user_id = ${uid} AND f.folder_id = ${fid} AND (${tmonth}::text IS NULL OR TO_CHAR(f.date,'YYYY-MM') = ${tmonth}::text) AND (${tsearch}::text IS NULL OR f.name ILIKE ${tsearch}::text OR f.type ILIKE ${tsearch}::text) ORDER BY f.date ASC`
        : await sql`SELECT f.*, fo.name AS folder_name FROM files f LEFT JOIN folders fo ON fo.id = f.folder_id WHERE f.user_id = ${uid} AND f.folder_id = ${fid} AND (${tmonth}::text IS NULL OR TO_CHAR(f.date,'YYYY-MM') = ${tmonth}::text) AND (${tsearch}::text IS NULL OR f.name ILIKE ${tsearch}::text OR f.type ILIKE ${tsearch}::text) ORDER BY f.date DESC`;
    } else {
      files = asc
        ? await sql`SELECT f.*, fo.name AS folder_name FROM files f LEFT JOIN folders fo ON fo.id = f.folder_id WHERE f.user_id = ${uid} AND (${tmonth}::text IS NULL OR TO_CHAR(f.date,'YYYY-MM') = ${tmonth}::text) AND (${tsearch}::text IS NULL OR f.name ILIKE ${tsearch}::text OR f.type ILIKE ${tsearch}::text) ORDER BY f.date ASC`
        : await sql`SELECT f.*, fo.name AS folder_name FROM files f LEFT JOIN folders fo ON fo.id = f.folder_id WHERE f.user_id = ${uid} AND (${tmonth}::text IS NULL OR TO_CHAR(f.date,'YYYY-MM') = ${tmonth}::text) AND (${tsearch}::text IS NULL OR f.name ILIKE ${tsearch}::text OR f.type ILIKE ${tsearch}::text) ORDER BY f.date DESC`;
    }
    res.json(files);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/files', async (req, res) => {
  try {
    const { name, type, size, folder_id, date } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const today = new Date().toISOString().split('T')[0];
    const [file] = await sql`
      INSERT INTO files (user_id, folder_id, name, type, size, date)
      VALUES (${req.userId}, ${folder_id ?? null}, ${name}, ${type ?? null}, ${size ?? null}, ${date ?? today})
      RETURNING *
    `;
    res.status(201).json(file);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/files/:id', async (req, res) => {
  try {
    const [deleted] = await sql`DELETE FROM files WHERE id = ${req.params.id} AND user_id = ${req.userId} RETURNING id`;
    if (!deleted) return res.status(404).json({ error: 'File not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
