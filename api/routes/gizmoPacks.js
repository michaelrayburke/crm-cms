// api/routes/gizmoPacks.js
import express from 'express';

const router = express.Router();

/**
 * Minimal placeholder Gizmo Packs router.
 *
 * This keeps the API booting cleanly and wires up the endpoints:
 *   GET  /api/gizmo-packs
 *   POST /api/gizmo-packs/apply
 *
 * For now:
 *   - GET returns an empty array (no packs yet).
 *   - POST /apply returns a 501 "not implemented" response.
 *
 * This DOES NOT touch any existing Gizmos, Gadgets, content types, entries,
 * or settings behavior. It only affects the new Gizmo Pack feature.
 */

// In the future we’ll load these from JSON files or a database.
const AVAILABLE_PACKS = [];

// GET /api/gizmo-packs
router.get('/', async (_req, res) => {
  try {
    // Later: return real packs from disk or DB.
    res.json(AVAILABLE_PACKS);
  } catch (err) {
    console.error('[GET /api/gizmo-packs] error', err);
    res.status(500).json({ error: 'Failed to list Gizmo Packs' });
  }
});

// POST /api/gizmo-packs/apply
router.post('/apply', async (req, res) => {
  try {
    const { packSlug, gadgetSlug, gadgetName } = req.body || {};

    if (!packSlug || !gadgetSlug || !gadgetName) {
      return res.status(400).json({
        error: 'packSlug, gadgetSlug, and gadgetName are required',
      });
    }

    // Later: perform the real work of:
    // - loading the pack
    // - creating the gadget + gizmos
    // - creating content types + entries
    // For now, just echo back the request so the UI can confirm wiring.
    res.status(501).json({
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
