const express = require("express");
const router = express.Router();
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

// GET /api/content-types
// List all content types, optionally filter by ?type=content|taxonomy
router.get("/", requireAuth, async (req, res) => {
  try {
    const { type } = req.query;
    const params = [];
    let sql = `
      SELECT id, slug, type, label_singular, label_plural, description, icon, is_system,
             created_at, updated_at
      FROM content_types
    `;

    if (type) {
      params.push(type);
      sql += " WHERE type = $1";
    }

    sql += " ORDER BY label_plural ASC";

    const { rows } = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching content types", err);
    res.status(500).json({ error: "Failed to fetch content types" });
  }
});

// POST /api/content-types
// Create a new content type
router.post("/", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const {
      slug,
      type = "content",
      label_singular,
      label_plural,
      description = "",
      icon = null,
      is_system = false,
    } = req.body;

    if (!slug || !label_singular || !label_plural) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const insertSql = `
      INSERT INTO content_types
        (slug, type, label_singular, label_plural, description, icon, is_system)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;

    const { rows } = await db.query(insertSql, [
      slug,
      type,
      label_singular,
      label_plural,
      description,
      icon,
      is_system,
    ]);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Error creating content type", err);
    if (err.code === "23505") {
      return res.status(409).json({ error: "Slug already exists" });
    }
    res.status(500).json({ error: "Failed to create content type" });
  }
});

// GET /api/content-types/:id
// Fetch a single content type with its fields
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const typeResult = await db.query(
      `SELECT id, slug, type, label_singular, label_plural, description, icon, is_system
       FROM content_types
       WHERE id = $1`,
      [id]
    );

    if (typeResult.rows.length === 0) {
      return res.status(404).json({ error: "Content type not found" });
    }

    const fieldsResult = await db.query(
      `SELECT id, field_key, label, type, required, help_text, order_index, config
       FROM content_fields
       WHERE content_type_id = $1
       ORDER BY order_index ASC, created_at ASC`,
      [id]
    );

    res.json({
      ...typeResult.rows[0],
      fields: fieldsResult.rows,
    });
  } catch (err) {
    console.error("Error fetching content type", err);
    res.status(500).json({ error: "Failed to fetch content type" });
  }
});

// PUT /api/content-types/:id
// Update a content type's core properties
router.put("/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      slug,
      label_singular,
      label_plural,
      description,
      icon,
      type,
    } = req.body;

    const updateSql = `
      UPDATE content_types
      SET
        slug = COALESCE($1, slug),
        label_singular = COALESCE($2, label_singular),
        label_plural = COALESCE($3, label_plural),
        description = COALESCE($4, description),
        icon = COALESCE($5, icon),
        type = COALESCE($6, type),
        updated_at = NOW()
      WHERE id = $7
      RETURNING *;
    `;

    const { rows } = await db.query(updateSql, [
      slug,
      label_singular,
      label_plural,
      description,
      icon,
      type,
      id,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Content type not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Error updating content type", err);
    if (err.code === "23505") {
      return res.status(409).json({ error: "Slug already exists" });
    }
    res.status(500).json({ error: "Failed to update content type" });
  }
});

// DELETE /api/content-types/:id
router.delete("/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await db.query(
      "SELECT is_system FROM content_types WHERE id = $1",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Content type not found" });
    }
    if (rows[0].is_system) {
      return res.status(400).json({ error: "Cannot delete system content type" });
    }

    await db.query("DELETE FROM content_types WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting content type", err);
    res.status(500).json({ error: "Failed to delete content type" });
  }
});

// PUT /api/content-types/:id/fields
// Replace the full set of fields for a content type
router.put("/:id/fields", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const client = await db.connect();
  try {
    const { id } = req.params;
    const { fields } = req.body; // array of { field_key, label, type, required, help_text, order_index, config }

    await client.query("BEGIN");

    // Ensure content type exists
    const ct = await client.query(
      "SELECT id FROM content_types WHERE id = $1",
      [id]
    );
    if (ct.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Content type not found" });
    }

    // Delete existing fields
    await client.query(
      "DELETE FROM content_fields WHERE content_type_id = $1",
      [id]
    );

    const insertSql = `
      INSERT INTO content_fields
        (content_type_id, field_key, label, type, required, help_text, order_index, config)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      RETURNING *;
    `;

    const inserted = [];
    for (const f of fields || []) {
      const { rows } = await client.query(insertSql, [
        id,
        f.field_key,
        f.label,
        f.type,
        !!f.required,
        f.help_text || "",
        typeof f.order_index === "number" ? f.order_index : 0,
        JSON.stringify(f.config || {}),
      ]);
      inserted.push(rows[0]);
    }

    await client.query("COMMIT");
    res.json(inserted);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error saving content fields", err);
    res.status(500).json({ error: "Failed to save content fields" });
  } finally {
    client.release();
  }
});

module.exports = router;
