// api/routes/publicWidgets.js
import express from 'express';
import pg from 'pg';

const router = express.Router();

// Reuse the same connection style as your other routers
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { require: true, rejectUnauthorized: false },
});

/**
 * GET /api/public/widgets
 *
 * Query params:
 *   - gadget_slug (optional): filter widgets for a specific gadget
 *
 * Returns:
 *   { widgets: [...] }
 */
router.get('/public/widgets', async (req, res) => {
  const { gadget_slug: gadgetSlug } = req.query || {};

  try {
    let gadgetId = null;

    if (gadgetSlug) {
      const { rows: gadgetRows } = await pool.query(
        'SELECT id FROM gadgets WHERE slug = $1 LIMIT 1',
        [gadgetSlug],
      );
      if (!gadgetRows.length) {
        // No such gadget – return empty widget list
        return res.json({ widgets: [] });
      }
      gadgetId = gadgetRows[0].id;
    }

    let query = `
      SELECT
        id,
        created_at,
        updated_at,
        gadget_id,
        name,
        slug,
        widget_type,
        description,
        config,
        sort_order,
        is_enabled,
        is_system
      FROM widgets
      WHERE is_enabled = true
    `;
    const params = [];

    if (gadgetId) {
      params.push(gadgetId);
      query += ` AND gadget_id = $${params.length}`;
    }

    query += ' ORDER BY sort_order NULLS LAST, created_at ASC';

    const { rows } = await pool.query(query, params);

    return res.json({ widgets: rows });
  } catch (err) {
    console.error('[GET /api/public/widgets] error', err);
    return res.status(500).json({
      error: 'Failed to load widgets',
      detail: err.message,
    });
  }
});

export default router;
