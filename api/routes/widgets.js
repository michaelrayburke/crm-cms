// api/routes/widgets.js
import express from 'express';
import pg from 'pg';

const router = express.Router();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { require: true, rejectUnauthorized: false },
});

// Helper – tiny slugify for convenience (if you use it later)
function slugify(str) {
  return (str || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// GET /api/widgets – list all widgets
router.get('/widgets', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM widgets ORDER BY created_at DESC',
    );
    res.json(rows);
  } catch (err) {
    console.error('[GET /api/widgets]', err);
    res.status(500).json({ error: 'Failed to list widgets' });
  }
});

// GET /api/widgets/:id – single widget by id
router.get('/widgets/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      'SELECT * FROM widgets WHERE id = $1 LIMIT 1',
      [id],
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('[GET /api/widgets/:id]', err);
    res.status(500).json({ error: 'Failed to fetch widget' });
  }
});

// POST /api/widgets – create widget
router.post('/widgets', async (req, res) => {
  const body = req.body || {};
  try {
    const { name, slug, widget_type, description, config, is_active, is_system } =
      body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const finalSlug =
      typeof slug === 'string' && slug.trim().length > 0
        ? slug.trim()
        : slugify(name);

    const { rows } = await pool.query(
      `INSERT INTO widgets
       (name, slug, widget_type, description, config, is_active, is_system)
       VALUES
       ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        name.trim(),
        finalSlug,
        widget_type || null,
        description || null,
        config || {},
        is_active ?? true,
        is_system ?? false,
      ],
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[POST /api/widgets]', err);
    res.status(500).json({ error: 'Failed to create widget' });
  }
});

// PUT /api/widgets/:id – update widget
router.put('/widgets/:id', async (req, res) => {
  const { id } = req.params;
  const body = req.body || {};

  try {
    const { name, slug, widget_type, description, config, is_active, is_system } =
      body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const finalSlug =
      typeof slug === 'string' && slug.trim().length > 0
        ? slug.trim()
        : slugify(name);

    const { rows } = await pool.query(
      `UPDATE widgets SET
         name = $1,
         slug = $2,
         widget_type = $3,
         description = $4,
         config = $5,
         is_active = $6,
         is_system = $7,
         updated_at = now()
       WHERE id = $8
       RETURNING *`,
      [
        name.trim(),
        finalSlug,
        widget_type || null,
        description || null,
        config || {},
        is_active ?? true,
        is_system ?? false,
        id,
      ],
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('[PUT /api/widgets/:id]', err);
    res.status(500).json({ error: 'Failed to update widget' });
  }
});

// DELETE /api/widgets/:id – delete widget
router.delete('/widgets/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // If you end up using gadget_widgets, clean those up first
    await pool.query('DELETE FROM gadget_widgets WHERE widget_id = $1', [id]);

    const { rowCount } = await pool.query(
      'DELETE FROM widgets WHERE id = $1',
      [id],
    );

    if (!rowCount) {
      return res.status(404).json({ error: 'Not found' });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/widgets/:id]', err);
    res.status(500).json({ error: 'Failed to delete widget' });
  }
});

export default router;