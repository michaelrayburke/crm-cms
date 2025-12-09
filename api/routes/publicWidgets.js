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
 *   - gadget_slug (optional): slug of the gadget (e.g. "serviceup-site")
 *
 * Returns:
 *   { widgets: [...] }
 */
router.get('/public/widgets', async (req, res) => {
  const { gadget_slug: gadgetSlug } = req.query || {};

  try {
    let widgets = [];

    if (gadgetSlug) {
      // Try the "proper" join via gadget + gadget_widgets
      try {
        // 1) Look up gadget by slug
        const { rows: gadgetRows } = await pool.query(
          'SELECT id FROM gadgets WHERE slug = $1 LIMIT 1',
          [gadgetSlug],
        );

        if (!gadgetRows.length) {
          // No such gadget – just return empty list
          return res.json({ widgets: [] });
        }

        const gadgetId = gadgetRows[0].id;

        // 2) Join gadget_widgets -> widgets
        const { rows: widgetRows } = await pool.query(
          `
            SELECT
              w.id,
              w.created_at,
              w.updated_at,
              w.name,
              w.slug,
              w.widget_type,
              w.description,
              w.config,
              w.is_active,
              w.is_system
            FROM widgets w
            JOIN gadget_widgets gw
              ON gw.widget_id = w.id
            WHERE gw.gadget_id = $1
              AND (w.is_active = true OR w.is_active IS NULL)
            ORDER BY w.created_at ASC
          `,
          [gadgetId],
        );

        widgets = widgetRows;
      } catch (err) {
        // If gadget_widgets table or columns don't exist yet, log & fall back
        console.error(
          '[GET /api/public/widgets] gadget-specific query failed, falling back to all widgets:',
          err.message,
        );
      }
    }

    // If no gadgetSlug provided, or join failed, or nothing found – fall back
    if (!gadgetSlug || widgets.length === 0) {
      const { rows: allRows } = await pool.query(
        `
          SELECT
            id,
            created_at,
            updated_at,
            name,
            slug,
            widget_type,
            description,
            config,
            is_active,
            is_system
          FROM widgets
          WHERE (is_active = true OR is_active IS NULL)
          ORDER BY created_at ASC
        `,
      );
      widgets = allRows;
    }

    return res.json({ widgets });
  } catch (err) {
    console.error('[GET /api/public/widgets] error', err);
    return res.status(500).json({
      error: 'Failed to load widgets',
      detail: err.message,
    });
  }
});

export default router;
