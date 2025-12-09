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
 * Temporarily VERY simple:
 *  - Ignores gadget_slug
 *  - Returns all widgets, same as the admin list route
 *
 * Response:
 *   { widgets: [...] }
 */
router.get('/public/widgets', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM widgets ORDER BY created_at DESC',
    );

    // Wrap the rows in { widgets: [...] } so the frontend code still works
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
