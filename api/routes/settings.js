// api/routes/settings.js
import { Router } from 'express';
import { pool } from '../dbPool.js';

const router = Router();

/**
 * Helper: load the single settings row (if any)
 */
async function getSettingsRow() {
  const { rows } = await pool.query(
    'select id, data from public.settings order by created_at asc limit 1'
  );
  return rows[0] || null;
}

/**
 * GET /api/settings
 * Returns the settings.data JSON, or {} if none yet.
 */
router.get('/', async (req, res) => {
  try {
    const row = await getSettingsRow();
    const data = row?.data || {};
    res.json(data);
  } catch (err) {
    console.error('[GET /api/settings] Failed to load settings', err);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

/**
 * POST /api/settings
 * Replaces the entire settings.data JSON with the posted body.
 * Returns the saved JSON.
 */
router.post('/', async (req, res) => {
  const incoming = req.body || {};

  try {
    const existing = await getSettingsRow();

    let row;
    if (existing) {
      const { rows } = await pool.query(
        'update public.settings set data = $1 where id = $2 returning id, data',
        [incoming, existing.id]
      );
      row = rows[0];
    } else {
      const { rows } = await pool.query(
        'insert into public.settings (data) values ($1) returning id, data',
        [incoming]
      );
      row = rows[0];
    }

    res.json(row.data || {});
  } catch (err) {
    console.error('[POST /api/settings] Failed to save settings', err);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

export default router;
