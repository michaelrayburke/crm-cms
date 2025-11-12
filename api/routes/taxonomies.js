import { Router } from 'express';
export const router = Router();

// list taxonomies
router.get('/', async (req, res) => {
  try {
    const { pool } = await import('../dbPool.js'); // or your pooled pg instance
    const { rows } = await pool.query('select * from taxonomies order by key asc');
    res.json({ ok: true, taxonomies: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Failed to list taxonomies' });
  }
});

// list terms by taxonomy key
router.get('/:key/terms', async (req, res) => {
  try {
    const { pool } = await import('../dbPool.js');
    const { key } = req.params;
    const { rows: tx } = await pool.query('select id, tenant_id from taxonomies where key = $1 limit 1', [key]);
    if (!tx.length) return res.status(404).json({ ok: false, error: 'Taxonomy not found' });
    const { rows } = await pool.query(
      'select * from terms where taxonomy_id = $1 order by parent_id nulls first, name asc',
      [tx[0].id]
    );
    res.json({ ok: true, terms: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Failed to list terms' });
  }
});

export default router;
/* router code */
