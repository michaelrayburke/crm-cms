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
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

// GET /api/content-types
router.get("/", async (req, res) => {
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

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching content types", err);
    res.status(500).json({ error: "Failed to fetch content types" });
  }
});

// POST /api/content-types
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

    const insertSql = `
      INSERT INTO content_types
        (slug, type, label_singular, label_plural, description, icon, is_system)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
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
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const typeResult = await pool.query(
      `SELECT id, slug, type, label_singular, label_plural, description, icon, is_system
       FROM content_types
       WHERE id = $1`,
      [id]
    );

    if (!typeResult.rows.length) {
      return res.status(404).json({ error: "Content type not found" });
    }

    const fieldsResult = await pool.query(
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
router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
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
      id,
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

// DELETE /api/content-types/:id
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      "SELECT is_system FROM content_types WHERE id = $1",
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Content type not found" });
    }
    if (rows[0].is_system) {
      return res.status(400).json({ error: "Cannot delete system content type" });
    }

    await pool.query("DELETE FROM content_types WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting content type", err);
    res.status(500).json({ error: "Failed to delete content type" });
  }
});

// PUT /api/content-types/:id/fields
router.put("/:id/fields", requireAdmin, async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { fields } = req.body || {};

    await client.query("BEGIN");

    const ct = await client.query(
      "SELECT id FROM content_types WHERE id = $1",
      [id]
    );
    if (!ct.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Content type not found" });
    }

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
    for (const [index, f] of (fields || []).entries()) {
      const { rows } = await client.query(insertSql, [
        id,
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
