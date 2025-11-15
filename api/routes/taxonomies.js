import { Router } from 'express';
import { pool } from '../dbPool.js';

const router = Router();

// GET /api/taxonomies - list all taxonomies
router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, key, label, is_hierarchical, created_at FROM taxonomies ORDER BY label ASC'
    );
    res.json({ ok: true, taxonomies: rows });
  } catch (err) {
    console.error('[GET /api/taxonomies]', err);
    res.status(500).json({
      ok: false,
      error: 'Failed to list taxonomies',
      detail: String(err.message || err),
    });
  }
});

// POST /api/taxonomies - create a taxonomy
router.post('/', async (req, res) => {
  try {
    const { key, label, isHierarchical } = req.body || {};
    const trimmedKey = (key || '').trim();
    const trimmedLabel = (label || '').trim();

    if (!trimmedKey || !trimmedLabel) {
      return res
        .status(400)
        .json({ ok: false, error: 'Both "key" and "label" are required.' });
    }

    const insertSql = `
      INSERT INTO taxonomies (key, label, is_hierarchical)
      VALUES ($1, $2, COALESCE($3, FALSE))
      RETURNING id, key, label, is_hierarchical, created_at
    `.replace('\n', ' ').replace('  ', ' ');

    const { rows } = await pool.query(insertSql, [
      trimmedKey,
      trimmedLabel,
      typeof isHierarchical === 'boolean' ? isHierarchical : null,
    ]);

    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[POST /api/taxonomies]', err);
    // unique violation
    if (err && err.code === '23505') {
            return res
        .status(409)
        .json({ ok: false, error: 'A taxonomy with that key already exists.'     }
    return res.status(500).json({
      ok: false,
      error: 'Failed to create taxonomy',
      detail: String(err.message || err),
    });
  }
});

export default router;
