// ServiceUp/api/routes/contentTypes.js (updated to accept slug)
import express from "express";
import pg from "pg";

const router = express.Router();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false,
});

// Simple helper: require admin role
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

// Helper to detect UUID
function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(value || '').trim()
  );
}

// Resolve content type ID from slug or ID
async function resolveContentTypeId(idOrSlug) {
  const raw = String(idOrSlug).trim();
  if (isUuid(raw)) {
    return raw;
  }
  const { rows } = await pool.query(
    `SELECT id FROM content_types WHERE slug = $1`,
    [raw]
  );
  return rows[0]?.id ?? null;
}

/**
 * GET /api/content-types
 * Optional ?type=content|taxonomy
 */
router.get("/", async (req, res) => {
  try {
    const { type } = req.query;
    const params = [];
    let sql = `
      SELECT
        id,
        slug,
        type,
        label_singular,
        label_plural,
        description,
        icon,
        is_system,
        created_at,
        updated_at
      FROM content_types
    `;
    
    if (type) {
      sql += " WHERE type = $1";
      params.push(type);
    }
    
    sql += " ORDER BY label_plural ASC";
    
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching content types", err);
    res.status(500).json({ error: "Failed to fetch content types" });
  }
});

/**
 * POST /api/content-types
 * Create new content type
 */
router.post("/", requireAdmin, async (req, res) => {
  try {
    const {
      slug,
      type = "content",
      label_singular,
      label_plural,
      description = "",
      icon = null,
      is_system = false,
    } = req.body || {};

    if (!slug || !label_singular || !label_plural) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    // Legacy "name" column for backwards compatibility
    const legacyName = label_plural;
    
    const insertSql = `
      INSERT INTO content_types
        (slug, type, label_singular, label_plural, description, icon, is_system, name)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    
    const { rows } = await pool.query(insertSql, [
      slug,
      type,
      label_singular,
      label_plural,
      description,
      icon,
      is_system,
      legacyName,
    ]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Error creating content type", err);
    if (err.code === "23505") {
      // unique_violation
      return res.status(409).json({ error: "Slug already exists" });
    }
    res.status(500).json({ error: "Failed to create content type" });
  }
});

/**
 * GET /api/content-types/:id
 * Fetch type + its fields
 * Accepts either a UUID or a slug
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const resolvedId = await resolveContentTypeId(id);
    if (!resolvedId) {
      return res.status(404).json({ error: "Content type not found" });
    }
    
    const typeResult = await pool.query(
      `SELECT
         id,
         slug,
         type,
         label_singular,
         label_plural,
         description,
         icon,
         is_system
       FROM content_types
       WHERE id = $1`,
      [resolvedId]
    );
    if (!typeResult.rows.length) {
      return res.status(404).json({ error: "Content type not found" });
    }
    
    const fieldsResult = await pool.query(
      `SELECT
         id,
         content_type_id,
         field_key,
         label,
         type,
         required,
         help_text,
         order_index,
         config
       FROM content_fields
       WHERE content_type_id = $1
       ORDER BY order_index ASC, created_at ASC`,
      [resolvedId]
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

/**
 * PUT /api/content-types/:id
 * Update base metadata
 */
router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const resolvedId = await resolveContentTypeId(id);
    if (!resolvedId) {
      return res.status(404).json({ error: "Content type not found" });
    }
    const {
      slug,
      label_singular,
      label_plural,
      description,
      icon,
      type,
    } = req.body || {};
    
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
    
    const { rows } = await pool.query(updateSql, [
      slug,
      label_singular,
      label_plural,
      description,
      icon,
      type,
      resolvedId,
    ]);
    if (!rows.length) {
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

/**
 * DELETE /api/content-types/:id
 */
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const resolvedId = await resolveContentTypeId(id);
    if (!resolvedId) {
      return res.status(404).json({ error: "Content type not found" });
    }
    const { rows } = await pool.query(
      "SELECT is_system FROM content_types WHERE id = $1",
      [resolvedId]
    );
    if (!rows.length) {
      return res.status(404).json({ error: "Content type not found" });
    }
    if (rows[0].is_system) {
      return res.status(400).json({ error: "Cannot delete system content type" });
    }
    await pool.query("DELETE FROM content_types WHERE id = $1", [resolvedId]);
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting content type", err);
    res.status(500).json({ error: "Failed to delete content type" });
  }
});

/**
 * PUT /api/content-types/:id/fields
 * Replace field set for a type
 */
router.put("/:id/fields", requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const resolvedId = await resolveContentTypeId(id);
    if (!resolvedId) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Content type not found" });
    }
    const { fields } = req.body || {};
    await client.query("BEGIN");
    const ct = await client.query(
      "SELECT id FROM content_types WHERE id = $1",
      [resolvedId]
    );
    if (!ct.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Content type not found" });
    }
    await client.query(
      "DELETE FROM content_fields WHERE content_type_id = $1",
      [resolvedId]
    );
    const insertSql = `
      INSERT INTO content_fields
        (content_type_id, field_key, label, type, required, help_text, order_index, config)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      RETURNING *;
    `;
    const inserted = [];
    for (const [index, f] of (fields || []).entries()) {
      const { rows } = await client.query(insertSql, [
        resolvedId,
        f.field_key,
        f.label,
        f.type || "text",
        !!f.required,
        f.help_text || "",
        typeof f.order_index === "number" ? f.order_index : index,
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

export default router;
