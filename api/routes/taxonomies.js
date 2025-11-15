import { Router } from 'express';
import { pool } from '../dbPool.js';

const router = Router();

// Single-tenant for now: every taxonomy row gets the same tenant_id.
// Later we can move this into a real Tenants table or an env var.
const SINGLE_TENANT_ID =
  process.env.DEFAULT_TENANT_ID || '00000000-0000-0000-0000-000000000001';

async function ensureTable() {
  // Safe: IF NOT EXISTS is a no-op if the table already exists.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS taxonomies (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      slug text NOT NULL,
      label text NOT NULL,
      is_hierarchical boolean NOT NULL DEFAULT false,
      is_visible boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS taxonomies_tenant_slug_idx
      ON taxonomies (tenant_id, slug);
  `);
}

// GET /api/taxonomies
router.get('/', async (req, res) => {
  try {
    await ensureTable();

    const { rows } = await pool.query(
      `
      SELECT
        id,
        slug,
        label,
        is_hierarchical,
        is_visible,
        created_at
      FROM taxonomies
      ORDER BY label ASC
      `
    );

    res.json({ ok: true, taxonomies: rows });
  } catch (err) {
    console.error('[GET /api/taxonomies] error', err);
    res.status(500).json({
      ok: false,
      error: 'Failed to list taxonomies',
      detail: err.message || String(err),
    });
  }
});

// POST /api/taxonomies
router.post('/', async (req, res) => {
  try {
    await ensureTable();

    const { key, slug, label, isHierarchical } = req.body || {};

    // Allow UI to send either "key" or "slug"
    const rawSlug = (slug || key || '').trim();
    const trimmedLabel = (label || '').trim();
    const isHier =
      typeof isHierarchical === 'boolean' ? isHierarchical : false;

    if (!rawSlug || !trimmedLabel) {
      return res.status(400).json({
        ok: false,
        error: 'Both "key/slug" and "label" are required.',
      });
    }

    // Check for duplicate within this tenant
    const { rows: existing } = await pool.query(
      `
      SELECT id
      FROM taxonomies
      WHERE tenant_id = $1 AND slug = $2
      LIMIT 1
      `,
      [SINGLE_TENANT_ID, rawSlug]
    );

    if (existing.length) {
      return res.status(409).json({
        ok: false,
        error: 'A taxonomy with that key/slug already exists.',
      });
    }

    const insertSql = `
      INSERT INTO taxonomies (tenant_id, slug, label, is_hierarchical, is_visible)
      VALUES ($1, $2, $3, $4, TRUE)
      RETURNING
        id,
        slug,
        label,
        is_hierarchical,
        is_visible,
        created_at
    `;

    const params = [SINGLE_TENANT_ID, rawSlug, trimmedLabel, isHier];

    const { rows } = await pool.query(insertSql, params);

    res.status(201).json({
      ok: true,
      taxonomy: rows[0],
    });
  } catch (err) {
    console.error('[POST /api/taxonomies] error', err);
    res.status(500).json({
      ok: false,
      error: 'Failed to create taxonomy',
      detail: err.message || String(err),
    });
  }
});

// DELETE /api/taxonomies/:id
router.delete('/:id', async (req, res) => {
  try {
    await ensureTable();

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        ok: false,
        error: 'Missing taxonomy id',
      });
    }

    await pool.query('DELETE FROM taxonomies WHERE id = $1', [id]);

    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/taxonomies/:id] error', err);
    res.status(500).json({
      ok: false,
      error: 'Failed to delete taxonomy',
      detail: err.message || String(err),
    });
  }
});

export default router;
