// api/routes/gizmoPacks.js
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const router = express.Router();

// Resolve /api directory → /api/gizmo-packs folder
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKS_DIR = path.join(__dirname, '..', 'gizmo-packs');

// Local pg pool (same pattern as api/index.js)
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { require: true, rejectUnauthorized: false },
});

/**
 * Helper: list all *.json packs with minimal metadata.
 */
async function listPacks() {
  const files = await fs.readdir(PACKS_DIR);
  const packs = [];

  for (const file of files) {
    if (!file.toLowerCase().endsWith('.json')) continue;

    const fullPath = path.join(PACKS_DIR, file);
    try {
      const raw = await fs.readFile(fullPath, 'utf8');
      const data = JSON.parse(raw);

      packs.push({
        pack_slug: data.pack_slug || path.basename(file, '.json'),
        name: data.name || data.pack_slug || path.basename(file, '.json'),
        description: data.description || '',
        filename: file,
      });
    } catch (err) {
      console.error('[gizmo-packs] Failed to read pack file', file, err);
    }
  }

  return packs;
}

/**
 * Helper: load a single pack by slug.
 * 1) Try <slug>.json
 * 2) Fallback: scan all JSON files and match data.pack_slug
 */
async function loadPackBySlug(packSlug) {
  if (!packSlug) {
    throw new Error('packSlug is required');
  }

  // Try direct filename match first
  const directPath = path.join(PACKS_DIR, `${packSlug}.json`);
  try {
    const raw = await fs.readFile(directPath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('[gizmo-packs] Error reading direct pack file', err);
      throw err;
    }
    // else fall through and scan directory
  }

  // Scan directory and match pack_slug
  const files = await fs.readdir(PACKS_DIR);
  for (const file of files) {
    if (!file.toLowerCase().endsWith('.json')) continue;

    const fullPath = path.join(PACKS_DIR, file);
    try {
      const raw = await fs.readFile(fullPath, 'utf8');
      const data = JSON.parse(raw);
      if (data.pack_slug === packSlug) {
        return data;
      }
    } catch (err) {
      console.error('[gizmo-packs] Error scanning pack file', file, err);
    }
  }

  const e = new Error(`Pack "${packSlug}" not found`);
  e.code = 'PACK_NOT_FOUND';
  throw e;
}

/* ------------------------------------------------------------------ */
/* GET /api/gizmo-packs                                               */
/* ------------------------------------------------------------------ */

router.get('gizmo-packs', async (_req, res) => {
  try {
    const packs = await listPacks();
    res.json(packs);
  } catch (err) {
    console.error('[GET /api/gizmo-packs] error', err);
    res.status(500).json({
      error: 'Failed to list Gizmo Packs',
      detail: err.message,
    });
  }
});

/* ------------------------------------------------------------------ */
/* POST /api/gizmo-packs/apply                                        */
/* ------------------------------------------------------------------ */
/**
 * Body: { packSlug, gadgetSlug, gadgetName }
 *
 * This will:
 *   - Insert a row into gadgets
 *   - Insert rows into gizmos
 *   - Insert rows into gadget_gizmos
 *   - Insert rows into content_types + content_fields
 *   - Insert rows into entries
 */
router.post('/gizmo-packs/apply', async (req, res) => {
  const { packSlug, gadgetSlug, gadgetName } = req.body || {};

  if (!packSlug || !gadgetSlug || !gadgetName) {
    return res.status(400).json({
      ok: false,
      error: 'packSlug, gadgetSlug, and gadgetName are required',
    });
  }

  let pack;
  try {
    pack = await loadPackBySlug(packSlug);
  } catch (err) {
    console.error('[POST /api/gizmo-packs/apply] loadPack error', err);
    if (err.code === 'PACK_NOT_FOUND') {
      return res.status(404).json({
        ok: false,
        error: `Gizmo Pack "${packSlug}" not found`,
      });
    }
    return res.status(500).json({
      ok: false,
      error: 'Failed to load Gizmo Pack',
      detail: err.message,
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    /* -------------------- 1) Create gadget ------------------------ */
    const g = pack.gadget || {};
    const gadgetInsert = await client.query(
      `INSERT INTO gadgets (
        name,
        slug,
        gadget_type,
        description,
        icon,
        repo_url,
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
        is_system
      ) VALUES (
        $1,$2,$3,$4,$5,$6,
        $7,$8,$9,
        $10,$11,
        $12,$13,$14,
        $15,$16,
        $17,$18,
        $19,$20
      )
      RETURNING id`,
      [
        gadgetName,
        gadgetSlug,
        g.gadget_type || 'website',
        g.description || pack.description || null,
        g.icon || null,
        g.repo_url || null,
        g.api_base_url || null,
        g.supabase_url || null,
        g.supabase_anon_key || null,
        g.deploy_url_web || null,
        g.deploy_url_app || null,
        g.primary_color || null,
        g.secondary_color || null,
        g.accent_color || null,
        g.logo_url || null,
        g.favicon_url || null,
        g.design_config || {},
        g.structure_config || {},
        g.is_active !== false,
        g.is_system === true,
      ],
    );

    const gadgetId = gadgetInsert.rows[0].id;

    /* -------------------- 2) Create gizmos ------------------------ */
    const gizmoSlugToId = {};
    for (const gz of pack.gizmos || []) {
      const inserted = await client.query(
        `INSERT INTO gizmos (
          name,
          slug,
          gizmo_type,
          description,
          config,
          is_enabled,
          is_system
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7
        )
        RETURNING id`,
        [
          gz.name,
          // Prefix slug with gadgetSlug to avoid global collisions
          `${gadgetSlug}-${gz.slug}`,
          gz.gizmo_type || null,
          gz.description || null,
          gz.config || {},
          gz.is_enabled !== false,
          gz.is_system === true,
        ],
      );
      const newId = inserted.rows[0].id;
      // Remember by original pack slug (without prefix)
      gizmoSlugToId[gz.slug] = newId;
    }

    /* -------------------- 3) Link gadget_gizmos ------------------- */
    for (const gzSlug of pack.gadget_gizmos || []) {
      const gizmoId = gizmoSlugToId[gzSlug];
      if (!gizmoId) continue;

      await client.query(
        `INSERT INTO gadget_gizmos (gadget_id, gizmo_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [gadgetId, gizmoId],
      );
    }

    /* -------------------- 4) Content types + fields --------------- */
    const ctSlugToId = {};
    for (const ct of pack.content_types || []) {
      const insertedCt = await client.query(
        `INSERT INTO content_types (
          name,
          slug,
          description,
          is_system
        ) VALUES (
          $1,$2,$3,$4
        )
        RETURNING id`,
        [
          ct.name,
          ct.slug,
          ct.description || null,
          ct.is_system === true,
        ],
      );

      const ctId = insertedCt.rows[0].id;
      ctSlugToId[ct.slug] = ctId;

      for (const f of ct.fields || []) {
        await client.query(
          `INSERT INTO content_fields (
            content_type_id,
            field_key,
            type,
            label,
            order_index
          ) VALUES (
            $1,$2,$3,$4,$5
          )`,
          [
            ctId,
            f.field_key,
            f.type,
            f.label,
            f.order_index || 0,
          ],
        );
      }
    }

    /* -------------------- 5) Entries ------------------------------ */
    for (const entry of pack.entries || []) {
      const ctId = ctSlugToId[entry.content_type_slug];
      if (!ctId) continue;

      await client.query(
        `INSERT INTO entries (
          content_type_id,
          title,
          slug,
          status,
          data
        ) VALUES (
          $1,$2,$3,$4,$5
        )`,
        [
          ctId,
          entry.title,
          entry.slug,
          entry.status || 'draft',
          entry.data || {},
        ],
      );
    }

    await client.query('COMMIT');

    return res.json({
      ok: true,
      message: 'Gizmo Pack applied successfully',
      gadget_id: gadgetId,
      gadget_slug: gadgetSlug,
      gadget_name: gadgetName,
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('[gizmo-packs apply] rollback error', rollbackErr);
    }

    console.error('[POST /api/gizmo-packs/apply] error', err);
    return res.status(500).json({
      ok: false,
      error: 'Failed to apply Gizmo Pack',
      detail: err.message,
    });
  } finally {
    client.release();
  }
});

export default router;
