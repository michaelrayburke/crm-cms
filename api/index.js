import usersRouter from './routes/users.js'; 
import taxonomiesRouter from './routes/taxonomies.js';
import rolesRouter from './routes/roles.js';
import {
  normalizeEmail,
  normalizePhoneE164,
  normalizeUrl,
  normalizeAddress,
} from './lib/fieldUtils.js';
import mountExtraRoutes from './extra-routes.js';
import express from 'express';
import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import permissionsRouter from './routes/permissions.js';
import settingsRouter from './routes/settings.js';
import dashboardRouter from './routes/dashboard.js';
import contentTypesRouter from './routes/contentTypes.js';
import entryViewsRouter from './routes/entryViews.js';
import listViewsRouter from './routes/listViews.js';

// NEW: Gizmos & Gadgets & Widgets routers
import gizmosRouter from './routes/gizmos.js';
import gadgetsRouter from './routes/gadgets.js';
import widgetsRouter from './routes/widgets.js';
import publicWidgetsRouter from './routes/publicWidgets.js';


// Gizmo Packs 
import gizmoPacksRouter from './routes/gizmoPacks.js';

// Frontend Renderer
import publicSiteRouter from './routes/publicSite.js';




/**
 * This file defines the main Express app for the ServiceUp API.  It is
 * largely identical to the original `api/index.js` in your repository
 * but includes two important enhancements:
 *
 *   1. Entry lookups now accept either an ID or a slug.  When
 *      requesting or updating a single entry, the second path
 *      parameter can be a UUID (id) or the entry slug.  The server
 *      checks whether the value looks like a UUID; if not it
 *      performs the query using the `slug` column instead of `id`.
 *
 *   2. Field definitions used for data normalization are pulled
 *      from `content_fields` rather than `fields`.  This ensures
 *      that all fields defined via the Content Type builder are
 *      taken into account when normalizing data before insert/update.
 *
 *   3. New: The `normalizeEntryData` helper now automatically
 *      normalizes camelCase keys to snake_case.  Historically some
 *      clients wrote data using camelCase field keys (e.g. `customField`) while
 *      the database and API expect snake_case (`custom_field`).  To prevent
 *      mismatched keys from causing blank values when entries are loaded,
 *      this function copies values from the camelCase version of a key to
 *      its snake_case counterpart and deletes the camelCase key.  This
 *      happens before any type-specific normalization runs.
 */

dotenv.config();

const app = express();

/* ----------------------- CORS (credentialed) ----------------------- */
const ALLOW = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (ALLOW.length === 0) {
  // Local defaults; add Netlify + custom domains via Render env ALLOWED_ORIGINS
  ALLOW.push('http://localhost:5173', 'http://localhost:5174');
}

app.use((req, res, next) => {
  const origin = req.headers.origin;

  // In case any prior middleware set a wildcard, clear it first
  res.removeHeader('Access-Control-Allow-Origin');

  const allowed = origin && ALLOW.includes(origin);
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
    // Optional: expose headers if you need them in the client (e.g., ETag)
    res.setHeader('Access-Control-Expose-Headers', 'ETag');
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log('[CORS]', {
      origin,
      allowed,
      sent: res.getHeader('Access-Control-Allow-Origin'),
    });
  }

  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Who-am-I helper to confirm allowlist at runtime
app.get('/__whoami', (req, res) => {
  res.json({
    ok: true,
    allowEnv: process.env.ALLOWED_ORIGINS || '',
    allowList: ALLOW,
    sawOrigin: req.headers.origin || null,
    willAllow: !!(req.headers.origin && ALLOW.includes(req.headers.origin)),
  });
});

console.log('[BOOT] ServiceUp API starting…');
console.log('[ALLOWLIST]', ALLOW);

/* ----------------------- Crash surfacing --------------------------- */
process.on('unhandledRejection', (err) => {
  console.error('[unhandledRejection]', err);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

/* ----------------------- Parsers & logging ------------------------- */
app.use(express.json({ limit: '2mb' })); // adjust if you expect larger payloads

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log('[HTTP]', req.method, req.path, '->', res.statusCode, Date.now() - start + 'ms');
  });
  next();
});

/* ----------------------- Postgres ---------------------------------- */
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { require: true, rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('[pg.pool error]', err);
});

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

/* ----------------------- Helpers ----------------------------------- */
function listRoutes(appRef) {
  const table = [];
  const stack = appRef._router?.stack || [];
  stack.forEach((layer) => {
    if (layer.route && layer.route.path) {
      const methods = Object.keys(layer.route.methods)
        .map((m) => m.toUpperCase())
        .join(',');
      table.push({ path: layer.route.path, methods });
    } else if (layer.name === 'router' && layer.handle?.stack) {
      layer.handle.stack.forEach((r) => {
        if (r.route) {
          const methods = Object.keys(r.route.methods)
            .map((m) => m.toUpperCase())
            .join(',');
          table.push({ path: r.route.path, methods });
        }
      });
    }
  });
  return table;
}

// Detect if a string is a UUID (used for entry lookup)
function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(value || '').trim(),
  );
}

// Normalize incoming entry data based on field types
function normalizeEntryData(fieldDefs, dataIn) {
  try {
    const out = { ...(dataIn || {}) };

    // New: Normalize camelCase keys to snake_case for known fields.  Historically
    // some clients wrote data using camelCase keys (e.g. `customField`) while
    // the API expects snake_case (`custom_field`).  Copy values from camelCase
    // keys to snake_case and delete the camelCase key before type-specific
    // normalization.
    for (const f of fieldDefs || []) {
      const snake = f.key;
      const camel = snake.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      if (out[camel] !== undefined && out[snake] === undefined) {
        out[snake] = out[camel];
        delete out[camel];
      }
    }

    for (const f of fieldDefs || []) {
      const k = f.key;
      const t = f.type;
      const v = out[k];
      switch (t) {
        case 'email':
          out[k] = normalizeEmail(v);
          break;
        case 'phone':
          out[k] = normalizePhoneE164(v, 'US');
          break;
        case 'url':
          out[k] = normalizeUrl(v);
          break;
        case 'address':
          out[k] = normalizeAddress(v);
          break;
        default:
          break;
      }
    }
    return out;
  } catch (e) {
    return dataIn;
  }
}

/* ----------------------- Debug endpoints --------------------------- */
app.get('/__ping', (_req, res) => res.json({ ok: true, build: Date.now() }));
app.get('/__routes', (_req, res) => res.json({ routes: listRoutes(app) }));

/* ----------------------- Auth -------------------------------------- */
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '2d' });
    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    console.error('[auth/login]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

function authMiddleware(req, res, next) {
  // Allow all /public/* endpoints to be accessed without a token
  // When mounted at '/api', req.path will be like '/public/widgets', '/public/pages/...'
  if (req.path.startsWith('/public/')) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/* ----------------------- Entries ----------------------------------- */

// List entries for a content type
app.get('/api/content/:slug', async (req, res) => {
  const { slug } = req.params;

  try {
    const { rows: typeRows } = await pool.query('SELECT id FROM content_types WHERE slug = $1 LIMIT 1', [slug]);

    if (!typeRows.length) {
      return res.status(404).json({ error: 'Content type not found' });
    }

    const typeId = typeRows[0].id;

    // Use SELECT * to avoid issues if columns change
    const { rows: entries } = await pool.query('SELECT * FROM entries WHERE content_type_id = $1 ORDER BY created_at DESC', [typeId]);

    res.json(entries);
  } catch (err) {
    console.error('[GET /api/content/:slug] error', err);
    res.status(500).json({ error: 'Server error listing entries', detail: err.message });
  }
});

// Create entry
app.post('/api/content/:slug', authMiddleware, async (req, res) => {
  const typeSlug = req.params.slug;
  const { title, slug: entrySlug, status, data } = req.body || {};

  function slugify(str) {
    return (str || '')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  try {
    const { rows: ctRows } = await pool.query('SELECT id FROM content_types WHERE slug = $1 LIMIT 1', [typeSlug]);
    if (!ctRows.length) {
      return res.status(404).json({ error: 'Content type not found' });
    }

    const typeId = ctRows[0].id;

    const safeTitle = typeof title === 'string' && title.trim() ? title.trim() : null;
    if (!safeTitle) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const finalSlug = typeof entrySlug === 'string' && entrySlug.trim() ? entrySlug.trim() : slugify(safeTitle);

    const finalStatus = typeof status === 'string' && status.trim() ? status.trim() : 'draft';

    // Fetch field definitions from content_fields instead of fields
    const { rows: fieldsRows } = await pool.query('SELECT field_key AS key, type FROM content_fields WHERE content_type_id = $1', [typeId]);

    const normalizedData = normalizeEntryData(fieldsRows, data || {});

    const { rows } = await pool.query(
      `INSERT INTO entries (content_type_id, title, slug, status, data)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [typeId, safeTitle, finalSlug, finalStatus, normalizedData],
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[POST /api/content/:slug] error', err);

    // Handle unique slug errors nicely
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Slug already exists for this content type', code: err.code, detail: err.detail || err.message });
    }

    res.status(500).json({ error: 'Failed to create entry', code: err.code || null, detail: err.message });
  }
});

// Get single entry (accepts ID or slug)
app.get('/api/content/:slug/:id', authMiddleware, async (req, res) => {
  const { slug: typeSlug, id } = req.params;

  try {
    const { rows: ctRows } = await pool.query('SELECT id FROM content_types WHERE slug = $1 LIMIT 1', [typeSlug]);
    if (!ctRows.length) {
      return res.status(404).json({ error: 'Content type not found' });
    }

    const typeId = ctRows[0].id;

    let entryQuery;
    let entryParams;
    if (isUuid(id)) {
      // Look up by ID
      entryQuery = `SELECT * FROM entries WHERE id = $1 AND content_type_id = $2 LIMIT 1`;
      entryParams = [id, typeId];
    } else {
      // Look up by slug
      entryQuery = `SELECT * FROM entries WHERE slug = $1 AND content_type_id = $2 LIMIT 1`;
      entryParams = [id, typeId];
    }

    const { rows } = await pool.query(entryQuery, entryParams);

    if (!rows.length) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('[GET /api/content/:slug/:id] error', err);
    res.status(500).json({ error: 'Failed to fetch entry' });
  }
});

// Update entry (accepts ID or slug)
app.put('/api/content/:slug/:id', authMiddleware, async (req, res) => {
  const { slug: typeSlug, id } = req.params;
  const { title, slug: entrySlug, status, data } = req.body || {};

  function slugify(str) {
    return (str || '')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  try {
    const { rows: ctRows } = await pool.query('SELECT id FROM content_types WHERE slug = $1 LIMIT 1', [typeSlug]);
    if (!ctRows.length) {
      return res.status(404).json({ error: 'Content type not found' });
    }

    const typeId = ctRows[0].id;

    const safeTitle = typeof title === 'string' && title.trim() ? title.trim() : null;
    if (!safeTitle) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const finalSlug = typeof entrySlug === 'string' && entrySlug.trim() ? entrySlug.trim() : slugify(safeTitle);

    const finalStatus = typeof status === 'string' && status.trim() ? status.trim() : 'draft';

    // Fetch field definitions from content_fields
    const { rows: fieldsRows } = await pool.query('SELECT field_key AS key, type FROM content_fields WHERE content_type_id = $1', [typeId]);
    const normalizedData = normalizeEntryData(fieldsRows, data || {});

    let updated;
    if (isUuid(id)) {
      // Update by ID
      updated = await pool.query(
        `UPDATE entries
         SET title = $1,
             slug = $2,
             status = $3,
             data = $4,
             updated_at = now()
         WHERE id = $5 AND content_type_id = $6
         RETURNING *`,
        [safeTitle, finalSlug, finalStatus, normalizedData, id, typeId],
      );
    } else {
      // Update by slug
      updated = await pool.query(
        `UPDATE entries
         SET title = $1,
             slug = $2,
             status = $3,
             data = $4,
             updated_at = now()
         WHERE slug = $5 AND content_type_id = $6
         RETURNING *`,
        [safeTitle, finalSlug, finalStatus, normalizedData, id, typeId],
      );
    }

    if (!updated.rows.length) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    res.json(updated.rows[0]);
  } catch (err) {
    console.error('[PUT /api/content/:slug/:id] error', err);

    if (err.code === '23505') {
      return res.status(409).json({ error: 'Slug already exists for this content type', code: err.code, detail: err.detail || err.message });
    }

    res.status(500).json({ error: 'Failed to update entry', code: err.code || null, detail: err.message });
  }
});

/* ----------------------- Deletes ----------------------------------- */

app.delete('/api/content/:slug/:id', authMiddleware, async (req, res) => {
  const { slug, id } = req.params;
  try {
    const typeRes = await pool.query('SELECT id FROM content_types WHERE slug = $1 LIMIT 1', [slug]);
    if (!typeRes.rows.length) return res.status(404).json({ error: 'Not found' });
    const typeId = typeRes.rows[0].id;

    if (isUuid(id)) {
      await pool.query('DELETE FROM entry_versions WHERE entry_id = $1', [id]);
      const del = await pool.query('DELETE FROM entries WHERE id = $1 AND content_type_id = $2 RETURNING id', [id, typeId]);
      if (!del.rows.length) return res.status(404).json({ error: 'Not found' });
    } else {
      // Delete by slug
      const { rows: entryRows } = await pool.query('SELECT id FROM entries WHERE slug = $1 AND content_type_id = $2 LIMIT 1', [id, typeId]);
      if (!entryRows.length) return res.status(404).json({ error: 'Not found' });
      const entryId = entryRows[0].id;
      await pool.query('DELETE FROM entry_versions WHERE entry_id = $1', [entryId]);
      const del = await pool.query('DELETE FROM entries WHERE id = $1 AND content_type_id = $2 RETURNING id', [entryId, typeId]);
      if (!del.rows.length) return res.status(404).json({ error: 'Not found' });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/content/:slug/:id]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ----------------------- Legacy delete aliases --------------------- */
app.delete('/api/content/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM entry_versions WHERE entry_id = $1', [id]);
    const del = await pool.query('DELETE FROM entries WHERE id = $1 RETURNING id', [id]);
    if (!del.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/content/:id]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ----------------------- Extra routes & settings ------------------- */
mountExtraRoutes(app);

// Health
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

/*
 * The original code exposed an in-memory settings object via GET/POST on
 * /api/settings and /settings. Those endpoints are removed in favor of
 * persisting settings in the `app_settings` table and serving them via
 * the new settings router. If you need to access settings, use GET/PUT
 * on /api/settings (base path /settings from the client).
 */

/* ----------------------- Routers ----------------------------------- */

// PUBLIC routes first (no auth needed for /public/*)
app.use('/api', publicSiteRouter);      // e.g. /api/public/pages/:slug
app.use('/api', publicWidgetsRouter);  // /api/public/widgets

app.use('/api/content-types', authMiddleware, contentTypesRouter);
app.use('/api/users', authMiddleware, usersRouter);
app.use('/api/taxonomies', taxonomiesRouter);
app.use('/api/roles', authMiddleware, rolesRouter);
app.use('/api/permissions', authMiddleware, permissionsRouter);

// Mount the settings router at /api/settings. In the client, calls to
// `api.get('/settings')` or `api.put('/settings', ...)` will be prefixed
// with API_BASE (usually '/api'), yielding the correct path.
app.use('/api/settings', settingsRouter);

app.use('/api/dashboard', authMiddleware, dashboardRouter);

// NEW: editor + list views routers, no corsMiddleware/jsonParser needed here
app.use('/api', entryViewsRouter);
app.use('/api', listViewsRouter);

// NEW: Gizmos & Gadgets & Widgets routers
app.use('/api', authMiddleware, gizmosRouter);
app.use('/api', authMiddleware, gadgetsRouter);
app.use('/api', authMiddleware, widgetsRouter);


// Gizmo Packs
app.use('/api/gizmo-packs', gizmoPacksRouter);



// Simple redirects for old paths
app.get('/content-types', (_req, res) => res.redirect(301, '/api/content-types'));
app.get('/content/:slug', (req, res) => res.redirect(301, `/api/content/${req.params.slug}`));

/* ----------------------- Last-chance error handler ----------------- */
app.use((err, req, res, _next) => {
  console.error('[FATAL]', err);
  const origin = req.headers.origin;
  if (origin && ALLOW.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.status(500).json({ error: 'Server error' });
});

/* ----------------------- Listen ------------------------------------ */
const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('[BOOT] ServiceUp API listening on', PORT);
});
