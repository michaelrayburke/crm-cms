// api/routes/taxonomies.js
// Express router for taxonomy CRUD, single-tenant for now.

import express from 'express';
import { pool } from '../dbPool.js';

const router = express.Router();

// Hard-coded tenant for now; later we’ll thread the real tenant id from auth/session.
const DEFAULT_TENANT_ID =
  process.env.DEFAULT_TENANT_ID || '00000000-0000-0000-0000-000000000000';

function mapRow(row) {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    slug: row.slug,
    label: row.label,
    // expose both camelCase & snake_case for convenience
    isHierarchical: row.is_hierarchical,
    is_hierarchical: row.is_hierarchical,
    isVisible: row.is_visible,
    is_visible: row.is_visible,
    created_at: row.created_at,
  };
}

// GET /api/taxonomies
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT id, tenant_id, slug, label, is_hierarchical, is_visible, created_at
      FROM taxonomies
      WHERE tenant_id = $1
      ORDER BY created_at ASC
    `,
      [DEFAULT_TENANT_ID],
    );

    res.json({ ok: true, taxonomies: rows.map(mapRow) });
  } catch (err) {
    console.error('[GET /api/taxonomies] error', err);
    res
      .status(500)
      .json({ ok: false, error: 'Failed to load taxonomies', detail: err.message });
  }
});

// POST /api/taxonomies
router.post('/', async (req, res) => {
  const { slug, label, is_hierarchical, isHierarchical } = req.body || {};

  const finalSlug = (slug || '').trim();
  const finalLabel = (label || '').trim();
  const finalHier = Boolean(
    typeof is_hierarchical === 'boolean' ? is_hierarchical : isHierarchical,
  );

  if (!finalSlug || !finalLabel) {
    return res.status(400).json({
      ok: false,
      error: 'Slug and label are required to create a taxonomy.',
    });
  }

  try {
    const { rows } = await pool.query(
      `
      INSERT INTO taxonomies (tenant_id, slug, label, is_hierarchical, is_visible)
      VALUES ($1, $2, $3, $4, TRUE)
      RETURNING id, tenant_id, slug, label, is_hierarchical, is_visible, created_at
    `,
      [DEFAULT_TENANT_ID, finalSlug, finalLabel, finalHier],
    );

    res.status(201).json({ ok: true, taxonomy: mapRow(rows[0]) });
  } catch (err) {
    // 23505 = unique_violation
    if (err.code === '23505') {
      return res.status(400).json({
        ok: false,
        error: 'A taxonomy with that slug already exists.',
      });
    }

    console.error('[POST /api/taxonomies] error', err);
    res
      .status(500)
      .json({ ok: false, error: 'Failed to create taxonomy', detail: err.message });
  }
});

// PATCH /api/taxonomies/:id
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { slug, label, is_hierarchical, isHierarchical, is_visible } = req.body || {};

  const fields = [];
  const values = [];
  let idx = 1;

  if (typeof slug === 'string') {
    fields.push(`slug = $${idx++}`);
    values.push(slug.trim());
  }
  if (typeof label === 'string') {
    fields.push(`label = $${idx++}`);
    values.push(label.trim());
  }
  if (typeof is_hierarchical === 'boolean' || typeof isHierarchical === 'boolean') {
    fields.push(`is_hierarchical = $${idx++}`);
    values.push(
      Boolean(
        typeof is_hierarchical === 'boolean' ? is_hierarchical : isHierarchical,
      ),
    );
  }
  if (typeof is_visible === 'boolean') {
    fields.push(`is_visible = $${idx++}`);
    values.push(is_visible);
  }

  if (!fields.length) {
    return res.status(400).json({ ok: false, error: 'No fields to update.' });
  }

  // WHERE … AND tenant_id = DEFAULT_TENANT_ID
  values.push(id);
  values.push(DEFAULT_TENANT_ID);

  const sql = `
    UPDATE taxonomies
       SET ${fields.join(', ')}
     WHERE id = $${idx++}
       AND tenant_id = $${idx}
     RETURNING id, tenant_id, slug, label, is_hierarchical, is_visible, created_at
  `;

  try {
    const { rows } = await pool.query(sql, values);
    if (!rows.length) {
      return res.status(404).json({ ok: false, error: 'Taxonomy not found.' });
    }
    res.json({ ok: true, taxonomy: mapRow(rows[0]) });
  } catch (err) {
    console.error('[PATCH /api/taxonomies/:id] error', err);
    res
      .status(500)
      .json({ ok: false, error: 'Failed to update taxonomy', detail: err.message });
  }
});

// DELETE /api/taxonomies/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { rowCount } = await pool.query(
      'DELETE FROM taxonomies WHERE id = $1 AND tenant_id = $2',
      [id, DEFAULT_TENANT_ID],
    );
    if (!rowCount) {
      return res.status(404).json({ ok: false, error: 'Taxonomy not found.' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/taxonomies/:id] error', err);
    res
      .status(500)
      .json({ ok: false, error: 'Failed to delete taxonomy', detail: err.message });
  }
});

export default router;
