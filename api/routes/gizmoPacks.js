// api/routes/gizmoPacks.js

import express from 'express';
import fs from 'fs';
import path from 'path';
import pg from 'pg';

const router = express.Router();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { require: true, rejectUnauthorized: false },
});

// Directory where pack JSON files live: api/gizmo-packs/*.json
const PACKS_DIR = path.join(process.cwd(), 'api', 'gizmo-packs');

/**
 * Safely read all .json files in PACKS_DIR and return a list of
 * simple metadata objects for the UI.
 */
async function loadPackMetadataFromDisk() {
  try {
    const entries = await fs.promises.readdir(PACKS_DIR, { withFileTypes: true });
    const jsonFiles = entries.filter(
      (ent) => ent.isFile() && ent.name.toLowerCase().endsWith('.json'),
    );

    const results = [];
    for (const file of jsonFiles) {
      const fullPath = path.join(PACKS_DIR, file.name);
      try {
        const raw = await fs.promises.readFile(fullPath, 'utf8');
        const parsed = JSON.parse(raw);

        const packSlug =
          typeof parsed.pack_slug === 'string' && parsed.pack_slug.trim()
            ? parsed.pack_slug.trim()
            : file.name.replace(/\.json$/i, '');

        results.push({
          pack_slug: packSlug,
          name:
            typeof parsed.name === 'string' && parsed.name.trim()
              ? parsed.name.trim()
              : packSlug,
          description:
            typeof parsed.description === 'string'
              ? parsed.description
              : '',
          filename: file.name,
        });
      } catch (err) {
        console.error('[gizmo-packs] Failed to read/parse', fullPath, err);
        // Skip broken file but continue
      }
    }

    return results;
  } catch (err) {
    console.error('[gizmo-packs] loadPackMetadataFromDisk error', err);
    return [];
  }
}

// GET /api/gizmo-packs
// Return list of packs (slug, name, description, filename)
router.get('/', async (_req, res) => {
  try {
    const packs = await loadPackMetadataFromDisk();
    return res.json(packs);
  } catch (err) {
    console.error('[GET /api/gizmo-packs] error', err);
    return res.status(500).json({ error: 'Failed to list gizmo packs' });
  }
});

// POST /api/gizmo-packs/apply
// NOTE: This is still a stub – it validates the payload and confirms which
// pack would be applied, but does not yet write to the database.
router.post('/apply', async (req, res) => {
  const { packSlug, gadgetSlug, gadgetName } = (req.body || {});

  if (!packSlug || !gadgetSlug || !gadgetName) {
    return res.status(400).json({
      error: 'packSlug, gadgetSlug and gadgetName are required',
    });
  }

  try {
    const packs = await loadPackMetadataFromDisk();
    const packMeta = packs.find((p) => p.pack_slug === packSlug);

    if (!packMeta) {
      return res.status(404).json({ error: 'Pack not found' });
    }

    // For now just echo back what *would* happen; real implementation
    // that creates gadgets, gizmos, content types and entries can be
    // added later.
    return res.json({
      ok: true,
      message:
        'Gizmo Pack apply endpoint is wired but not fully implemented yet.',
      pack: packMeta,
      gadgetSlug,
      gadgetName,
    });
  } catch (err) {
    console.error('[POST /api/gizmo-packs/apply] error', err);
    return res.status(500).json({ error: 'Failed to apply gizmo pack' });
  }
});

export default router;
