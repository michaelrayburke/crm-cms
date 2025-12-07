// api/routes/gizmoPacks.js
import express from 'express';
import fs from 'fs/promises';
import path from 'path';

const router = express.Router();

// Directory where Gizmo Pack JSON files live:
// e.g. api/gizmo-packs/website-basic.json
const PACKS_DIR = path.join(process.cwd(), 'api', 'gizmo-packs');

/**
 * GET /api/gizmo-packs
 *
 * Lists all available Gizmo Pack JSON files in PACKS_DIR.
 * Each pack reports:
 *   - pack_slug
 *   - name
 *   - description
 *   - filename
 */
router.get('/', async (req, res) => {
  try {
    const entries = await fs.readdir(PACKS_DIR, { withFileTypes: true });
    const packs = [];

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.toLowerCase().endsWith('.json')) continue;

      const fullPath = path.join(PACKS_DIR, entry.name);

      try {
        const raw = await fs.readFile(fullPath, 'utf8');
        const parsed = JSON.parse(raw || '{}');

        const slugFromFilename = entry.name.replace(/\.json$/i, '');
        packs.push({
          pack_slug: parsed.pack_slug || slugFromFilename,
          name: parsed.name || parsed.pack_slug || slugFromFilename,
          description: parsed.description || '',
          filename: entry.name,
        });
      } catch (err) {
        console.error('[gizmo-packs] Failed to read/parse', entry.name, err);
        // Skip bad files but don't blow up the whole list
      }
    }

    res.json(packs);
  } catch (err) {
    if (err.code === 'ENOENT') {
      // Directory doesn't exist yet -> just report no packs
      console.warn('[gizmo-packs] PACKS_DIR does not exist:', PACKS_DIR);
      return res.json([]);
    }

    console.error('[GET /api/gizmo-packs] error', err);
    res.status(500).json({
      error: 'Failed to list Gizmo Packs',
      detail: err.message,
    });
  }
});

/**
 * POST /api/gizmo-packs/apply
 *
 * For now this is still a stub. Once we wire it fully, this will:
 *  - Read the selected pack JSON
 *  - Create a gadget row
 *  - Create gizmos, content types, entries, etc.
 */
router.post('/apply', async (req, res) => {
  const { packSlug, gadgetSlug, gadgetName } = req.body || {};
  if (!packSlug || !gadgetSlug || !gadgetName) {
    return res.status(400).json({
      error: 'packSlug, gadgetSlug and gadgetName are required',
    });
  }

  // Temporary placeholder until we wire full "apply" logic
  console.log('[gizmo-packs/apply] requested', {
    packSlug,
    gadgetSlug,
    gadgetName,
  });

  return res.status(501).json({
    error: 'Gizmo Pack apply is not implemented yet',
  });
});

export default router;
