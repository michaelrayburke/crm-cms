// api/routes/gizmoPacks.js
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

/**
 * Resolve the directory that holds the pack JSON files.
 * On Render, process.cwd() is the project root, so:
 *   <root>/api/gizmo-packs
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Go one level up from routes/ into api/, then into gizmo-packs/
const PACKS_DIR = path.join(__dirname, '..', 'gizmo-packs');

console.log('[GizmoPacks] PACKS_DIR =', PACKS_DIR);

/**
 * Utility: load all .json files from PACKS_DIR and return a lightweight
 * descriptor for each pack.
 *
 * Each JSON file is expected to look roughly like:
 * {
 *   "pack_slug": "website-basic",
 *   "name": "Basic Website Pack",
 *   "description": "...",
 *   ...
 * }
 */
async function loadPackDescriptors() {
  try {
    const entries = await fs.promises.readdir(PACKS_DIR, { withFileTypes: true });

    const packs = [];

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.toLowerCase().endsWith('.json')) continue;

      const filename = entry.name;
      const fullPath = path.join(PACKS_DIR, filename);

      try {
        const raw = await fs.promises.readFile(fullPath, 'utf8');
        const json = JSON.parse(raw);

        const packSlug =
          json.pack_slug || path.basename(filename, path.extname(filename));
        const name = json.name || packSlug;
        const description = json.description || '';

        packs.push({
          pack_slug: packSlug,
          name,
          description,
          filename,
        });
      } catch (err) {
        console.error(
          `[GizmoPacks] Failed to read/parse pack file ${filename}`,
          err
        );
        // Skip bad files but keep going
      }
    }

    return packs;
  } catch (err) {
    console.error('[GizmoPacks] Failed to read PACKS_DIR', err);
    throw err;
  }
}

/**
 * GET /api/gizmo-packs
 *
 * Returns an array of pack descriptors:
 * [
 *   {
 *     pack_slug: "website-basic",
 *     name: "Basic Website Pack",
 *     description: "...",
 *     filename: "website-basic.json"
 *   },
 *   ...
 * ]
 *
 * NOTE: index.js mounts this router at `/api/gizmo-packs`, so we use
 * `router.get('/')` here (NOT `/gizmo-packs`).
 */
router.get('/', async (req, res) => {
  try {
    const packs = await loadPackDescriptors();
    res.json(packs);
  } catch (err) {
    res.status(500).json({
      error: 'Failed to load Gizmo Packs',
      detail: err.message,
    });
  }
});

/**
 * POST /api/gizmo-packs/apply
 *
 * For now this is still a stub so we don’t break anything in the UI.
 * Later we’ll:
 *  - read the selected pack file
 *  - create the gadget row
 *  - create gizmos, content types, entries, etc.
 */
router.post('/apply', async (req, res) => {
  try {
    const { packSlug, gadgetSlug, gadgetName } = req.body || {};

    if (!packSlug || !gadgetSlug || !gadgetName) {
      return res.status(400).json({
        error: 'packSlug, gadgetSlug, and gadgetName are required',
      });
    }

    // Placeholder stub for now
    console.log('[GizmoPacks] apply pack requested:', {
      packSlug,
      gadgetSlug,
      gadgetName,
    });

    return res.status(501).json({
      ok: false,
      message: 'Gizmo Pack apply() is not implemented yet.',
      received: { packSlug, gadgetSlug, gadgetName },
    });
  } catch (err) {
    console.error('[POST /api/gizmo-packs/apply] error', err);
    res.status(500).json({
      error: 'Failed to apply Gizmo Pack',
      detail: err.message,
    });
  }
});

export default router;
