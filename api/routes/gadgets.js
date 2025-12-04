import express from 'express';
import pg from 'pg';

/**
 * Express router for the `gadgets` table.  Gadgets represent full products (websites,
 * apps, or system apps) built on top of ServiceUp.  They contain project-level
 * settings such as API endpoints, Supabase credentials and branding colours.
 * This router implements CRUD operations and helpers to attach/detach gizmos.
 *
 * To enable authentication, mount this router behind your auth middleware
 * in the main API (e.g. app.use('/api', authMiddleware, gadgetsRouter)).
 */
const router = express.Router();

// Configure Postgres pool
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { require: true, rejectUnauthorized: false },
});

// Helper to list gadgets with optional filters
router.get('/gadgets', async (req, res) => {
  const { type, active } = req.query;
  const clauses = [];
  const params = [];
  if (type) {
    params.push(type);
    clauses.push(`gadget_type = $${params.length}`);
  }
  if (active !== undefined) {
    params.push(active === 'true');
    clauses.push(`is_active = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const query = `SELECT * FROM gadgets ${where} ORDER BY created_at DESC`;
  try {
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('[GET /gadgets]', err);
    res.status(500).json({ error: 'Failed to list gadgets' });
  }
});

// Create a new gadget
router.post('/gadgets', async (req, res) => {
  const {
    name,
    slug,
    gadget_type,
    description,
    api_base_url,
    supabase_url,
    supabase_anon_key,
    deploy_url_web,
    deploy_url_app,
    primary_color,
    secondary_color,
    accent_color,
    logo_url,
    favicon_url,
    design_config = {},
    structure_config = {},
    is_active = true,
    is_system = false,
  } = req.body || {};
  if (!name || !gadget_type) {
    return res.status(400).json({ error: 'name and gadget_type are required' });
  }
  try {
    const finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const { rows } = await pool.query(
      `INSERT INTO gadgets (
        name, slug, gadget_type, description,
        api_base_url, supabase_url, supabase_anon_key,
        deploy_url_web, deploy_url_app,
        primary_color, secondary_color, accent_color,
        logo_url, favicon_url,
        design_config, structure_config,
        is_active, is_system
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7,
        $8, $9,
        $10, $11, $12,
        $13, $14,
        $15::jsonb, $16::jsonb,
        $17, $18
      ) RETURNING *`,
      [
        name,
        finalSlug,
        gadget_type,
        description || null,
        api_base_url,
        supabase_url,
        supabase_anon_key,
        deploy_url_web,
        deploy_url_app,
        primary_color,
        secondary_color,
        accent_color,
        logo_url,
        favicon_url,
        design_config,
        structure_config,
        is_active,
        is_system,
      ],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[POST /gadgets]', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Slug already exists for a gadget', detail: err.detail });
    }
    res.status(500).json({ error: 'Failed to create gadget' });
  }
});

// Get single gadget with attached gizmos
router.get('/gadgets/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query('SELECT * FROM gadgets WHERE id = $1 LIMIT 1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Gadget not found' });
    const gadget = rows[0];
    const { rows: gizmoRows } = await pool.query(
      `SELECT g.id as gizmo_id, g.name, gg.config
       FROM gadget_gizmos gg
       JOIN gizmos g ON gg.gizmo_id = g.id
       WHERE gg.gadget_id = $1`,
      [id],
    );
    gadget.gizmos = gizmoRows;
    res.json(gadget);
  } catch (err) {
    console.error('[GET /gadgets/:id]', err);
    res.status(500).json({ error: 'Failed to fetch gadget' });
  }
});

// Update gadget
router.put('/gadgets/:id', async (req, res) => {
  const { id } = req.params;
  const fields = [
    'name', 'slug', 'gadget_type', 'description', 'api_base_url', 'supabase_url',
    'supabase_anon_key', 'deploy_url_web', 'deploy_url_app',
    'primary_color', 'secondary_color', 'accent_color',
    'logo_url', 'favicon_url', 'design_config', 'structure_config',
    'is_active', 'is_system'
  ];
  const updates = [];
  const params = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      params.push(f === 'design_config' || f === 'structure_config'
        ? JSON.stringify(req.body[f])
        : req.body[f]);
      updates.push(`${f} = $${params.length}`);
    }
  }
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
  params.push(id);
  try {
    const { rows } = await pool.query(
      `UPDATE gadgets SET ${updates.join(', ')}, updated_at = now() WHERE id = $${params.length} RETURNING *`,
      params,
    );
    if (!rows.length) return res.status(404).json({ error: 'Gadget not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[PUT /gadgets/:id]', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Slug already exists for a gadget', detail: err.detail });
    }
    res.status(500).json({ error: 'Failed to update gadget' });
  }
});

// Delete gadget and detach all gizmos
router.delete('/gadgets/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM gadget_gizmos WHERE gadget_id = $1', [id]);
    const { rows } = await pool.query('DELETE FROM gadgets WHERE id = $1 RETURNING id', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Gadget not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /gadgets/:id]', err);
    res.status(500).json({ error: 'Failed to delete gadget' });
  }
});

// Attach a gizmo to a gadget.  Expects `gizmo_id` and optional `config`.
router.post('/gadgets/:id/gizmos', async (req, res) => {
  const { id } = req.params;
  const { gizmo_id, config = {} } = req.body || {};
  if (!gizmo_id) return res.status(400).json({ error: 'gizmo_id is required' });
  try {
    await pool.query(
      `INSERT INTO gadget_gizmos (gadget_id, gizmo_id, config)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (gadget_id, gizmo_id)
       DO UPDATE SET config = EXCLUDED.config`,
      [id, gizmo_id, config],
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[POST /gadgets/:id/gizmos]', err);
    res.status(500).json({ error: 'Failed to attach gizmo' });
  }
});

// Detach a gizmo from a gadget
router.delete('/gadgets/:id/gizmos/:gizmoId', async (req, res) => {
  const { id, gizmoId } = req.params;
  try {
    await pool.query('DELETE FROM gadget_gizmos WHERE gadget_id = $1 AND gizmo_id = $2', [id, gizmoId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /gadgets/:id/gizmos/:gizmoId]', err);
    res.status(500).json({ error: 'Failed to detach gizmo' });
  }
});

export default router;