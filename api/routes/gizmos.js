import express from 'express';
import pg from 'pg';

/**
 * Express router for CRUD operations on the `gizmos` table.  Gizmos are small
 * modules or integrations that add functionality to a Gadget (e.g. Stripe,
 * Twilio, SEO module).  This router implements list, create, read, update and
 * delete endpoints.  Authentication should be enforced by mounting this
 * router behind your `authMiddleware` in the main API.
 */
const router = express.Router();

// Configure a Postgres connection pool using your DATABASE_URL environment var.
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { require: true, rejectUnauthorized: false },
});

// List all gizmos.  Accepts optional query param `type` to filter by gizmo_type.
router.get('/gizmos', async (req, res) => {
  const { type } = req.query;
  try {
    const params = [];
    let where = '';
    if (type) {
      params.push(type);
      where = 'WHERE gizmo_type = $1';
    }
    const { rows } = await pool.query(`SELECT * FROM gizmos ${where} ORDER BY created_at DESC`, params);
    res.json(rows);
  } catch (err) {
    console.error('[GET /gizmos]', err);
    res.status(500).json({ error: 'Failed to list gizmos' });
  }
});

// Create a new gizmo.  Expects name, slug (optional), gizmo_type and optional description, icon and config.
router.post('/gizmos', async (req, res) => {
  const { name, slug, gizmo_type, description, icon, config = {}, is_enabled = true } = req.body || {};
  if (!name || !gizmo_type) {
    return res.status(400).json({ error: 'name and gizmo_type are required' });
  }
  try {
    const finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const { rows } = await pool.query(
      `INSERT INTO gizmos (name, slug, gizmo_type, description, icon, config, is_enabled)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
       RETURNING *`,
      [name, finalSlug, gizmo_type, description || null, icon || null, config, is_enabled],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[POST /gizmos]', err);
    // Handle unique slug constraint
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Slug already exists for a gizmo', detail: err.detail });
    }
    res.status(500).json({ error: 'Failed to create gizmo' });
  }
});

// Get a single gizmo by ID.
router.get('/gizmos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query('SELECT * FROM gizmos WHERE id = $1 LIMIT 1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Gizmo not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[GET /gizmos/:id]', err);
    res.status(500).json({ error: 'Failed to fetch gizmo' });
  }
});

// Update a gizmo by ID.  Accepts partial fields.
router.put('/gizmos/:id', async (req, res) => {
  const { id } = req.params;
  const fields = [
    'name', 'slug', 'gizmo_type', 'description', 'icon', 'config', 'is_enabled',
  ];
  const updates = [];
  const params = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      const value = (f === 'config' ? JSON.stringify(req.body[f]) : req.body[f]);
      params.push(value);
      updates.push(`${f} = $${params.length}`);
    }
  }
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
  params.push(id);
  try {
    const { rows } = await pool.query(
      `UPDATE gizmos SET ${updates.join(', ')}, updated_at = now() WHERE id = $${params.length} RETURNING *`,
      params,
    );
    if (!rows.length) return res.status(404).json({ error: 'Gizmo not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[PUT /gizmos/:id]', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Slug already exists for a gizmo', detail: err.detail });
    }
    res.status(500).json({ error: 'Failed to update gizmo' });
  }
});

// Delete a gizmo by ID.  Note: this will also remove references in gadget_gizmos via foreign key if ON DELETE CASCADE is set.
router.delete('/gizmos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query('DELETE FROM gizmos WHERE id = $1 RETURNING id', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Gizmo not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /gizmos/:id]', err);
    res.status(500).json({ error: 'Failed to delete gizmo' });
  }
});

export default router;