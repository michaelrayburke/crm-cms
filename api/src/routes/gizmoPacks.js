import express from "express";
import { listGizmoPacks, applyGizmoPack } from "../services/gizmoPackService.js";

const router = express.Router();

// GET /api/gizmo-packs
// Returns the list of available Gizmo Packs. Each pack contains metadata
// including its slug, name, description, and source filename.
router.get("/", async (req, res, next) => {
  try {
    const packs = await listGizmoPacks();
    res.json(packs);
  } catch (err) {
    next(err);
  }
});

// POST /api/gizmo-packs/apply
// Applies a pack to create a new gadget. The request body must include
// packSlug, gadgetSlug, and gadgetName. Returns the created gadget's
// information on success.
router.post("/apply", async (req, res, next) => {
  try {
    const { packSlug, gadgetSlug, gadgetName } = req.body || {};
    const result = await applyGizmoPack({ packSlug, gadgetSlug, gadgetName });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

export default router;