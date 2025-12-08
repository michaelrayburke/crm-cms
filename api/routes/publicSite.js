// api/routes/publicSite.js
import express from 'express';
import pg from 'pg';

const router = express.Router();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { require: true, rejectUnauthorized: false },
});

/**
 * GET /api/public/sites/:gadgetSlug/pages/:pageSlug
 *
 * Returns:
 * {
 *   gadget,
 *   gizmos: [...],
 *   widgets: [...],
 *   page: entryRow
 * }
 *
 * - gadgetSlug: slug of the gadget (e.g. "serviceup-site")
 * - pageSlug: slug of the page entry (e.g. "home", "about", "contact")
 */
router.get('/sites/:gadgetSlug/pages/:pageSlug', async (req, res) => {
  const { gadgetSlug, pageSlug } = req.params;

  try {
    // 1) Load gadget by slug
    const { rows: gadgetRows } = await pool.query(
      'SELECT * FROM gadgets WHERE slug = $1 LIMIT 1',
      [gadgetSlug],
    );

    if (!gadgetRows.length) {
      return res.status(404).json({ error: 'Gadget not found' });
    }

    const gadget = gadgetRows[0];

    // 2) Load gizmos attached to this gadget, if you use gadget_gizmos
    let gizmos = [];
    try {
      const { rows: gizmoRows } = await pool.query(
        `
          SELECT g.*
          FROM gizmos g
          JOIN gadget_gizmos gg ON gg.gizmo_id = g.id
          WHERE gg.gadget_id = $1
          ORDER BY g.created_at ASC
        `,
        [gadget.id],
      );
      gizmos = gizmoRows;
    } catch (err) {
      console.error('[publicSite] gizmos query failed (maybe no gadget_gizmos table yet)', err.message);
    }

    // 3) Load widgets attached to this gadget, if using gadget_widgets
    let widgets = [];
    try {
      const { rows: widgetRows } = await pool.query(
        `
          SELECT w.*
          FROM widgets w
          JOIN gadget_widgets gw ON gw.widget_id = w.id
          WHERE gw.gadget_id = $1
          ORDER BY w.created_at ASC
        `,
        [gadget.id],
      );
      widgets = widgetRows;
    } catch (err) {
      console.error('[publicSite] widgets query failed (maybe no gadget_widgets table yet)', err.message);
    }

    // 4) Find the page content_type first
    const { rows: ctRows } = await pool.query(
      `SELECT id FROM content_types WHERE slug = 'page' LIMIT 1`,
    );
    if (!ctRows.length) {
      return res.status(404).json({ error: 'Content type "page" not found' });
    }
    const pageTypeId = ctRows[0].id;

    // 5) Load the page entry by slug
    const { rows: entryRows } = await pool.query(
      `
        SELECT *
        FROM entries
        WHERE content_type_id = $1
          AND slug = $2
        LIMIT 1
      `,
      [pageTypeId, pageSlug],
    );

    if (!entryRows.length) {
      return res.status(404).json({ error: 'Page entry not found' });
    }

    const page = entryRows[0];

    // 6) Respond with everything the frontend needs
    return res.json({
      ok: true,
      gadget,
      gizmos,
      widgets,
      page,
    });
  } catch (err) {
    console.error('[GET /api/public/sites/:gadgetSlug/pages/:pageSlug] error', err);
    return res.status(500).json({
      ok: false,
      error: 'Server error',
      detail: err.message,
    });
  }
});

export default router;
