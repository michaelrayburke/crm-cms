import { Router } from 'express';

export const router = Router();

// list taxonomies
router.get('/', async (req, res) => {
  try {
    const { pool } = await import('../dbPool.js'); // pooled pg instance
    const { rows } = await pool.query('select * from taxonomies order by key asc');
    // keep existing shape so older clients still work
    res.json({ ok: true, taxonomies: rows });
  } catch (e) {
    console.error('Error listing taxonomies', e);
    res.status(500).json({ ok: false, error: 'Failed to list taxonomies' });
  }
});

// create taxonomy
router.post('/', async (req, res) => {
  try {
    const { pool } = await import('../dbPool.js');
    const { key, label, isHierarchical } = req.body || {};

    const trimmedKey = (key || '').trim();
    const trimmedLabel = (label || '').trim();

    if (!trimmedKey || !trimmedLabel) {
      return res.status(400).json({ error: 'Both "key" and "label" are required.' });
    }

    const insertSql = `
      insert into taxonomies (key, label, is_hierarchical)
      values ($1, $2, $3)
      returning *
    `;

    const { rows } = await pool.query(insertSql, [
      trimmedKey,
      trimmedLabel,
      !!isHierarchical,
    ]);

    // Frontend expects the created row directly
    return res.status(201).json(rows[0]);
  } catch (e) {
    console.error('Error creating taxonomy', e);
    // unique violation
    if (e?.code === '23505') {
      return res.status(409).json({ error: 'A taxonomy with that key already exists.' });
    }
    return res.status(500).json({ error: 'Failed to create taxonomy' });
  }
});

// list terms by taxonomy key
router.get('/:key/terms', async (req, res) => {
  try {
    const { pool } = await import('../dbPool.js');
    const { key } = req.params;
    const { rows: tx } = await pool.query(
      'select id, tenant_id from taxonomies where key = $1 limit 1',
      [key]
    );
    if (!tx.length) {
      return res.status(404).json({ ok: false, error: 'Taxonomy not found' });
    }
    const { rows } = await pool.query(
      'select * from terms where taxonomy_id = $1 order by parent_id nulls first, name asc',
      [tx[0].id]
    );
    res.json({ ok: true, terms: rows });
  } catch (e) {
    console.error('Error listing terms', e);
    res.status(500).json({ ok: false, error: 'Failed to list terms' });
  }
});

export default router;
