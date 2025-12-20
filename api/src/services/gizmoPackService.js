import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Pool } = pg;

// Initialize a connection pool using the DATABASE_URL environment variable.
// This pool is shared across all functions in this service.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Determine the directory in which this module resides. We need this to
// construct the absolute path to the gizmo-packs folder.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The Gizmo Pack JSON files live two levels up from this file in
// serviceup/gizmo-packs. Compute that path once here.
const PACKS_DIR = path.join(__dirname, "..", "..", "gizmo-packs");

/**
 * List all available Gizmo Packs. Gizmo Packs are JSON files stored in
 * serviceup/gizmo-packs. Each file must end with .json. Returns an array
 * of objects describing each pack: slug, name, description, and filename.
 *
 * @returns {Promise<Array<{pack_slug: string, name: string, description: string, filename: string}>>}
 */
export async function listGizmoPacks() {
  const files = fs.readdirSync(PACKS_DIR).filter((f) => f.endsWith(".json"));
  return files.map((file) => {
    const fullPath = path.join(PACKS_DIR, file);
    const raw = fs.readFileSync(fullPath, "utf8");
    const pack = JSON.parse(raw);
    const slugFromFile = file.replace(/\.json$/, "");
    return {
      pack_slug: pack.pack_slug || slugFromFile,
      name: pack.name || slugFromFile,
      description: pack.description || "",
      filename: file
    };
  });
}

/**
 * Apply a Gizmo Pack to create a new Gadget with its Gizmos, content types,
 * and seed entries. If a gadget with the specified slug already exists, this
 * function throws an error. Gizmo slugs are automatically prefixed with the
 * gadgetSlug to avoid collisions between different gadgets created from packs.
 *
 * @param {{packSlug: string, gadgetSlug: string, gadgetName: string}} opts
 * @returns {Promise<{gadget_id: string, gadget_slug: string, gadget_name: string}>}
 */
export async function applyGizmoPack({ packSlug, gadgetSlug, gadgetName }) {
  if (!packSlug) {
    throw new Error("packSlug is required");
  }
  if (!gadgetSlug) {
    throw new Error("gadgetSlug is required");
  }
  if (!gadgetName) {
    throw new Error("gadgetName is required");
  }

  // Resolve the JSON file for this pack.
  const packPath = path.join(PACKS_DIR, `${packSlug}.json`);
  if (!fs.existsSync(packPath)) {
    throw new Error(`Gizmo Pack not found: ${packSlug}`);
  }
  const raw = fs.readFileSync(packPath, "utf8");
  const pack = JSON.parse(raw);

  const client = await pool.connect();
  try {
    // All DB operations in this function happen in a single transaction.
    await client.query("BEGIN");

    // Insert the gadget. If the slug already exists, we throw because
    // a conflicting gadget would be ambiguous.
    const g = pack.gadget || {};
    const gadgetRes = await client.query(
      `
      INSERT INTO gadgets (
        name, slug, gadget_type, description,
        api_base_url, deploy_url_web,
        primary_color, secondary_color, accent_color,
        logo_url, favicon_url,
        design_config, structure_config,
        is_active, is_system
      )
      VALUES (
        $1, $2, $3, $4,
        $5, $6,
        $7, $8, $9,
        $10, $11,
        $12::jsonb, $13::jsonb,
        $14, $15
      )
      ON CONFLICT (slug)
      DO NOTHING
      RETURNING id;
      `,
      [
        gadgetName,
        gadgetSlug,
        g.gadget_type || "website",
        g.description || null,
        g.api_base_url || null,
        g.deploy_url_web || null,
        g.primary_color || null,
        g.secondary_color || null,
        g.accent_color || null,
        g.logo_url || null,
        g.favicon_url || null,
        JSON.stringify(g.design_config || {}),
        JSON.stringify(g.structure_config || {}),
        g.is_active ?? true,
        g.is_system ?? false
      ]
    );
    if (gadgetRes.rows.length === 0) {
      throw new Error(`Gadget slug "${gadgetSlug}" already exists.`);
    }
    const gadgetId = gadgetRes.rows[0].id;

    // Insert gizmos from the pack.
    const gizmoSlugToId = new Map();
    for (const gz of pack.gizmos || []) {
      const finalSlug = `${gadgetSlug}-${gz.slug}`;
      const gizmoRes = await client.query(
        `
        INSERT INTO gizmos (
          name, slug, gizmo_type, description,
          config, is_enabled, is_system
        )
        VALUES (
          $1, $2, $3, $4,
          $5::jsonb, $6, $7
        )
        ON CONFLICT (slug)
        DO UPDATE SET
          name = EXCLUDED.name,
          gizmo_type = EXCLUDED.gizmo_type,
          description = EXCLUDED.description,
          config = EXCLUDED.config,
          is_enabled = EXCLUDED.is_enabled,
          is_system = EXCLUDED.is_system
        RETURNING id;
        `,
        [
          `${gadgetName} – ${gz.name}`,
          finalSlug,
          gz.gizmo_type,
          gz.description || null,
          JSON.stringify(rewriteGizmoConfigSlugs(gz.config || {}, gz.slug, gadgetSlug)),
          gz.is_enabled ?? true,
          gz.is_system ?? false
        ]
      );
      const gizmoId = gizmoRes.rows[0].id;
      gizmoSlugToId.set(gz.slug, { id: gizmoId, finalSlug });
    }

    // Attach gizmos to gadget via the pivot table gadget_gizmos
    for (const originalSlug of pack.gadget_gizmos || []) {
      const meta = gizmoSlugToId.get(originalSlug);
      if (!meta) continue;
      await client.query(
        `
        INSERT INTO gadget_gizmos (gadget_id, gizmo_id, config)
        VALUES ($1, $2, '{}'::jsonb)
        ON CONFLICT (gadget_id, gizmo_id)
        DO NOTHING;
        `,
        [gadgetId, meta.id]
      );
    }

    // Insert content types and their fields.
    const contentTypeSlugToId = new Map();
    for (const ct of pack.content_types || []) {
      const ctRes = await client.query(
        `
        INSERT INTO content_types (name, slug, description, is_system)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (slug)
        DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          is_system = EXCLUDED.is_system
        RETURNING id;
        `,
        [ct.name, ct.slug, ct.description || null, ct.is_system ?? false]
      );
      const contentTypeId = ctRes.rows[0].id;
      contentTypeSlugToId.set(ct.slug, contentTypeId);
      // Delete existing fields and insert new ones for this content type.
      await client.query(`DELETE FROM content_fields WHERE content_type_id = $1`, [contentTypeId]);
      for (const field of ct.fields || []) {
        await client.query(
          `
          INSERT INTO content_fields (
            content_type_id, field_key, type, label, order_index
          )
          VALUES ($1, $2, $3, $4, $5);
          `,
          [
            contentTypeId,
            field.field_key,
            field.type,
            field.label,
            field.order_index ?? 0
          ]
        );
      }
    }

    // Insert seed entries.
    for (const entry of pack.entries || []) {
      const contentTypeId = contentTypeSlugToId.get(entry.content_type_slug);
      if (!contentTypeId) continue;
      await client.query(
        `
        INSERT INTO entries (
          content_type_id,
          title,
          slug,
          status,
          data
        )
        VALUES (
          $1, $2, $3, $4, $5::jsonb
        )
        ON CONFLICT (content_type_id, slug)
        DO UPDATE SET
          title = EXCLUDED.title,
          status = EXCLUDED.status,
          data = EXCLUDED.data;
        `,
        [
          contentTypeId,
          entry.title,
          entry.slug,
          entry.status || "draft",
          JSON.stringify(entry.data || {})
        ]
      );
    }

    await client.query("COMMIT");
    return {
      gadget_id: gadgetId,
      gadget_slug: gadgetSlug,
      gadget_name: gadgetName
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Rewrite references to other gizmos in a gizmo's config. Some fields refer
 * to other gizmos by slug (e.g. menu_gizmo_slug, header_gizmo_slug,
 * footer_gizmo_slug). Prefix those values with the gadgetSlug so that
 * gizmo-to-gizmo relationships work when multiple gadgets have similarly named
 * gizmos.
 *
 * @param {object} config The config object to rewrite
 * @param {string} originalSlug The original gizmo slug (unused currently)
 * @param {string} gadgetSlug The gadget slug to prefix
 * @returns {object} A cloned config with rewritten slugs
 */
function rewriteGizmoConfigSlugs(config, originalSlug, gadgetSlug) {
  const cloned = JSON.parse(JSON.stringify(config));
  const slugFields = [
    "menu_gizmo_slug",
    "header_gizmo_slug",
    "footer_gizmo_slug"
  ];
  for (const key of slugFields) {
    if (cloned[key] && typeof cloned[key] === "string") {
      cloned[key] = `${gadgetSlug}-${cloned[key]}`;
    }
  }
  return cloned;
}