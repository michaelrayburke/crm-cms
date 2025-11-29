// ServiceUp/api/routes/contentTypes.js
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
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

// Helper: is value a UUID?
function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(value || "").trim()
  );
}

// Helper: look up a content type by id OR slug
async function findContentTypeByIdOrSlug(idOrSlug) {
  if (!idOrSlug) return null;
  const raw = String(idOrSlug).trim();
  const isId = isUuid(raw);

  const where = isId ? "id = $1::uuid" : "slug = $1";
  const { rows } = await pool.query(
    `
      SELECT
        id,
        slug,
        type,
        label_singular,
        label_plural,
        description,
        icon,
        is_system,
        name,
        created_at,
        updated_at
      FROM content_types
      WHERE ${where}
      LIMIT 1
    `,
    [raw]
  );

  return rows[0] || null;
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
        name,
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
      RETURNING
        id,
        slug,
        type,
        label_singular,
        label_plural,
        description,
        icon,
        is_system,
        name,
        created_at,
        updated_at;
    `;

    const { rows } = await pool.query(insertSql, [
      slug,
      type,
      label_singular,
      label_plural,
      description,
      icon,
      !!is_system,
      legacyName,
    ]);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Error creating content type", err);
    if (err.code === "23505") {
      // unique_violation on slug
      return res.status(409).json({ error: "Slug already exists" });
    }
    res.status(500).json({ error: "Failed to create content type" });
  }
});

/**
 * GET /api/content-types/:id
 * NOTE: :id may be the UUID or the slug.
 */
router.get("/:id", async (req, res) => {
  try {
    const { id: idOrSlug } = req.params;

    const typeRow = await findContentTypeByIdOrSlug(idOrSlug);
    if (!typeRow) {
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
         config,
         created_at,
         updated_at
       FROM content_fields
       WHERE content_type_id = $1
       ORDER BY order_index ASC, created_at ASC`,
      [typeRow.id]
    );

    res.json({
      ...typeRow,
      fields: fieldsResult.rows,
    });
  } catch (err) {
    console.error("Error fetching content type", err);
    res.status(500).json({ error: "Failed to fetch content type" });
  }
});

/**
 * PUT /api/content-types/:id
 * Update content type metadata.
 * NOTE: :id may be the UUID or the slug.
 */
router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const { id: idOrSlug } = req.params;
    const existing = await findContentTypeByIdOrSlug(idOrSlug);

    if (!existing) {
      return res.status(404).json({ error: "Content type not found" });
    }

    const {
      slug,
      label_singular,
      label_plural,
      description,
      icon,
      type,
      is_system,
      name,
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
        is_system = COALESCE($7, is_system),
        name = COALESCE($8, name),
        updated_at = NOW()
      WHERE id = $9
      RETURNING
        id,
        slug,
        type,
        label_singular,
        label_plural,
        description,
        icon,
        is_system,
        name,
        created_at,
        updated_at;
    `;

    const { rows } = await pool.query(updateSql, [
      slug,
      label_singular,
      label_plural,
      description,
      icon,
      type,
      typeof is_system === "boolean" ? is_system : null,
      name,
      existing.id,
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
 * PUT /api/content-types/:id/rename
 * Convenience endpoint to rename the slug only.
 * NOTE: :id may be the UUID or the current slug.
 */
router.put("/:id/rename", requireAdmin, async (req, res) => {
  try {
    const { id: idOrSlug } = req.params;
    const { slug: newSlug } = req.body || {};

    if (!newSlug || typeof newSlug !== "string") {
      return res
        .status(400)
        .json({ error: "New slug is required in body.slug" });
    }

    const existing = await findContentTypeByIdOrSlug(idOrSlug);
    if (!existing) {
      return res.status(404).json({ error: "Content type not found" });
    }

    const updateSql = `
      UPDATE content_types
      SET slug = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING
        id,
        slug,
        type,
        label_singular,
        label_plural,
        description,
        icon,
        is_system,
        name,
        created_at,
        updated_at;
    `;

    const { rows } = await pool.query(updateSql, [newSlug, existing.id]);
    if (!rows.length) {
      return res.status(404).json({ error: "Content type not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Error renaming content type slug", err);
    if (err.code === "23505") {
      return res.status(409).json({ error: "Slug already exists" });
    }
    res.status(500).json({ error: "Failed to rename content type" });
  }
});

/**
 * DELETE /api/content-types/:id
 * NOTE: :id may be the UUID or the slug.
 */
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const { id: idOrSlug } = req.params;
    const existing = await findContentTypeByIdOrSlug(idOrSlug);

    if (!existing) {
      return res.status(404).json({ error: "Content type not found" });
    }
    if (existing.is_system) {
      return res
        .status(400)
        .json({ error: "Cannot delete system content type" });
    }

    await pool.query("DELETE FROM content_fields WHERE content_type_id = $1", [
      existing.id,
    ]);
    await pool.query("DELETE FROM content_types WHERE id = $1", [existing.id]);

    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting content type", err);
    res.status(500).json({ error: "Failed to delete content type" });
  }
});

/**
 * PUT /api/content-types/:id/fields
 * Replace the field definitions for a content type.
 * NOTE: :id may be the UUID or the slug.
 */
router.put("/:id/fields", requireAdmin, async (req, res) => {
  const client = await pool.connect();

  try {
    const { id: idOrSlug } = req.params;
    const { fields } = req.body || {};

    await client.query("BEGIN");

    const existing = await findContentTypeByIdOrSlug(idOrSlug);
    if (!existing) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Content type not found" });
    }

    const typeId = existing.id;

    await client.query(
      "DELETE FROM content_fields WHERE content_type_id = $1",
      [typeId]
    );

    const insertSql = `
      INSERT INTO content_fields
        (content_type_id, field_key, label, type, required, help_text, order_index, config)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING
        id,
        content_type_id,
        field_key,
        label,
        type,
        required,
        help_text,
        order_index,
        config,
        created_at,
        updated_at;
    `;

    const inserted = [];

    if (Array.isArray(fields)) {
      for (let idx = 0; idx < fields.length; idx++) {
        const f = fields[idx] || {};
        const {
          field_key,
          label,
          type,
          required,
          help_text,
          order_index,
          config,
        } = f;

        const { rows } = await client.query(insertSql, [
          typeId,
          field_key,
          label,
          type,
          !!required,
          help_text || "",
          typeof order_index === "number" ? order_index : idx,
          config || {},
        ]);
        inserted.push(rows[0]);
      }
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
