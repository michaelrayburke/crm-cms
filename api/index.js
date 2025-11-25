import usersRouter from './routes/users.js';
import taxonomiesRouter from './routes/taxonomies.js';
import rolesRouter from './routes/roles.js';
import { normalizeEmail, normalizePhoneE164, normalizeUrl, normalizeAddress } from './lib/fieldUtils.js';
import mountExtraRoutes from './extra-routes.js';
import express from 'express';
import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import permissionsRouter from './routes/permissions.js';
import settingsRouter from './routes/settings.js';
import dashboardRouter from "./routes/dashboard.js";
import contentTypesRouter from './routes/contentTypes.js';


dotenv.config();

const app = express();

/* ----------------------- CORS (credentialed) ----------------------- */
const ALLOW = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
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
    console.log('[CORS]', { origin, allowed, sent: res.getHeader('Access-Control-Allow-Origin') });
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
    console.log('[HTTP]', req.method, req.path, '->', res.statusCode, (Date.now() - start) + 'ms');
  });
  next();
});

/* ----------------------- Postgres ---------------------------------- */
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { require: true, rejectUnauthorized: false }
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
      const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase()).join(',');
      table.push({ path: layer.route.path, methods });
    } else if (layer.name === 'router' && layer.handle?.stack) {
      layer.handle.stack.forEach(r => {
        if (r.route) {
          const methods = Object.keys(r.route.methods).map(m => m.toUpperCase()).join(',');
          table.push({ path: r.route.path, methods });
        }
      });
    }
  });
  return table;
}

// Normalize incoming entry data based on field types
function normalizeEntryData(fieldDefs, dataIn) {
  try {
    const out = { ...(dataIn || {}) };
    for (const f of (fieldDefs || [])) {
      const k = f.key;
      const t = f.type;
      const v = out[k];
      switch (t) {
        case 'email':   out[k] = normalizeEmail(v); break;
        case 'phone':   out[k] = normalizePhoneE164(v, 'US'); break;
        case 'url':     out[k] = normalizeUrl(v); break;
        case 'address': out[k] = normalizeAddress(v); break;
        default: break;
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

/* ----------------------- Content Types ----------------------------- */
app.get('/api/content-types', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM content_types ORDER BY created_at');
    res.json(rows);
  } catch (err) {
    console.error('[GET /api/content-types]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/content-types', authMiddleware, async (req, res) => {
  const { slug, name, fields } = req.body || {};
  if (!slug || !name || !Array.isArray(fields)) {
    return res.status(400).json({ error: 'Invalid body' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO content_types (slug, name) VALUES ($1, $2) RETURNING *',
      [slug, name]
    );
    const ctype = result.rows[0];

    for (const field of fields) {
      const { key, label, type, required = false, sort = 0, options = null } = field;
      await pool.query(
        `INSERT INTO fields (content_type_id, key, label, type, required, sort, options)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [ctype.id, key, label, type, !!required, Number.isFinite(sort) ? sort : 0, options ? JSON.stringify(options) : null]
      );
    }

    const fieldsRes = await pool.query(
      'SELECT * FROM fields WHERE content_type_id = $1 ORDER BY sort, id',
      [ctype.id]
    );
    res.status(201).json({ ...ctype, fields: fieldsRes.rows });
  } catch (err) {
    console.error('[POST /api/content-types]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/content-types/:slug', async (req, res) => {
  const { slug } = req.params;
  try {
    const { rows } = await pool.query('SELECT * FROM content_types WHERE slug = $1 LIMIT 1', [slug]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const ctype = rows[0];
    const fieldsRes = await pool.query(
      'SELECT * FROM fields WHERE content_type_id = $1 ORDER BY sort, id',
      [ctype.id]
    );
    res.json({ ...ctype, fields: fieldsRes.rows });
  } catch (err) {
    console.error('[GET /api/content-types/:slug]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/content-types/:slug', authMiddleware, async (req, res) => {
  const { slug } = req.params;
  const { slug: newSlug, name } = req.body || {};
  try {
    const result = await pool.query(
      'UPDATE content_types SET slug = $1, name = $2 WHERE slug = $3 RETURNING *',
      [newSlug || slug, name, slug]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[PUT /api/content-types/:slug]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/content-types/:slug/fields', authMiddleware, async (req, res) => {
  const { slug } = req.params;
  const { key, label, type, required = false, sort = 0, options = null } = req.body || {};

  try {
    const ctRes = await pool.query('SELECT id FROM content_types WHERE slug = $1 LIMIT 1', [slug]);
    if (!ctRes.rows.length) return res.status(404).json({ error: 'Not found' });
    const ctId = ctRes.rows[0].id;

    const insertRes = await pool.query(
      `INSERT INTO fields (content_type_id, key, label, type, required, sort, options)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, content_type_id, key, label, type, required, sort, options`,
      [ctId, key, label, type, !!required, Number.isFinite(sort) ? sort : 0, options ? JSON.stringify(options) : null]
    );

    res.json(insertRes.rows[0]);
  } catch (err) {
    console.error('[POST /api/content-types/:slug/fields]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/content-types/:slug/fields/:fieldId', authMiddleware, async (req, res) => {
  const { fieldId } = req.params;
  const { key, label, type, required, sort, options } = req.body || {};

  try {
    const updateRes = await pool.query(
      `UPDATE fields
       SET key = COALESCE($1, key),
           label = COALESCE($2, label),
           type = COALESCE($3, type),
           required = COALESCE($4, required),
           sort = COALESCE($5, sort),
           options = COALESCE($6, options)
       WHERE id = $7
       RETURNING id, content_type_id, key, label, type, required, sort, options`,
      [
        key ?? null,
        label ?? null,
        type ?? null,
        typeof required === 'boolean' ? required : null,
        Number.isFinite(sort) ? sort : null,
        options !== undefined ? (options ? JSON.stringify(options) : null) : null,
        fieldId
      ]
    );

    if (!updateRes.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(updateRes.rows[0]);
  } catch (err) {
    console.error('[PUT /api/content-types/:slug/fields/:fieldId]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ----------------------- Entries ----------------------------------- */

// List entries for a content type
app.get('/api/content/:slug', async (req, res) => {
  const { slug } = req.params;

  try {
    const { rows: typeRows } = await pool.query(
      'SELECT id FROM content_types WHERE slug = $1 LIMIT 1',
      [slug]
    );

    if (!typeRows.length) {
      return res.status(404).json({ error: 'Content type not found' });
    }

    const typeId = typeRows[0].id;

    // Use SELECT * to avoid issues if columns change
    const { rows: entries } = await pool.query(
      'SELECT * FROM entries WHERE content_type_id = $1 ORDER BY created_at DESC',
      [typeId]
    );

    res.json(entries);
  } catch (err) {
    console.error('[GET /api/content/:slug] error', err);
    res.status(500).json({
      error: 'Server error listing entries',
      detail: err.message,
    });
  }
});

// Create entry
app.post('/api/content/:slug', authMiddleware, async (req, res) => {
  const typeSlug = req.params.slug;
  const { title, slug, status, data } = req.body || {};

  function slugify(str) {
    return (str || '')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  try {
    const { rows: ctRows } = await pool.query(
      'SELECT id FROM content_types WHERE slug = $1 LIMIT 1',
      [typeSlug]
    );
    if (!ctRows.length) {
      return res.status(404).json({ error: 'Content type not found' });
    }

    const typeId = ctRows[0].id;

    const safeTitle =
      typeof title === 'string' && title.trim() ? title.trim() : null;
    if (!safeTitle) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const finalSlug =
      typeof slug === 'string' && slug.trim()
        ? slug.trim()
        : slugify(safeTitle);

    const finalStatus =
      typeof status === 'string' && status.trim()
        ? status.trim()
        : 'draft';

    const { rows: fieldsRows } = await pool.query(
      'SELECT key, type FROM fields WHERE content_type_id = $1',
      [typeId]
    );

    const normalizedData = normalizeEntryData(fieldsRows, data || {});

    const { rows } = await pool.query(
      `INSERT INTO entries (content_type_id, title, slug, status, data)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [typeId, safeTitle, finalSlug, finalStatus, normalizedData]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[POST /api/content/:slug] error', err);

    // Handle unique slug errors nicely
    if (err.code === '23505') {
      return res.status(409).json({
        error: 'Slug already exists for this content type',
        code: err.code,
        detail: err.detail || err.message,
      });
    }

    res.status(500).json({
      error: 'Failed to create entry',
      code: err.code || null,
      detail: err.message,
    });
  }
});

// Get single entry
app.get('/api/content/:slug/:id', authMiddleware, async (req, res) => {
  const { slug: typeSlug, id } = req.params;

  try {
    const { rows: ctRows } = await pool.query(
      'SELECT id FROM content_types WHERE slug = $1 LIMIT 1',
      [typeSlug]
    );
    if (!ctRows.length) {
      return res.status(404).json({ error: 'Content type not found' });
    }

    const typeId = ctRows[0].id;

    const { rows } = await pool.query(
      `SELECT *
       FROM entries
       WHERE id = $1 AND content_type_id = $2
       LIMIT 1`,
      [id, typeId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('[GET /api/content/:slug/:id] error', err);
    res.status(500).json({ error: 'Failed to fetch entry' });
  }
});

// Update entry
app.put('/api/content/:slug/:id', authMiddleware, async (req, res) => {
  const { slug: typeSlug, id } = req.params;
  const { title, slug, status, data } = req.body || {};

  function slugify(str) {
    return (str || '')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  try {
    const { rows: ctRows } = await pool.query(
      'SELECT id FROM content_types WHERE slug = $1 LIMIT 1',
      [typeSlug]
    );
    if (!ctRows.length) {
      return res.status(404).json({ error: 'Content type not found' });
    }

    const typeId = ctRows[0].id;

    const safeTitle =
      typeof title === 'string' && title.trim() ? title.trim() : null;
    if (!safeTitle) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const finalSlug =
      typeof slug === 'string' && slug.trim()
        ? slug.trim()
        : slugify(safeTitle);

    const finalStatus =
      typeof status === 'string' && status.trim()
        ? status.trim()
        : 'draft';

    const { rows: fieldsRows } = await pool.query(
      'SELECT key, type FROM fields WHERE content_type_id = $1',
      [typeId]
    );
    const normalizedData = normalizeEntryData(fieldsRows, data || {});

    const { rows } = await pool.query(
      `UPDATE entries
       SET title = $1,
           slug = $2,
           status = $3,
           data = $4,
           updated_at = now()
       WHERE id = $5 AND content_type_id = $6
       RETURNING *`,
      [safeTitle, finalSlug, finalStatus, normalizedData, id, typeId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('[PUT /api/content/:slug/:id] error', err);

    if (err.code === '23505') {
      return res.status(409).json({
        error: 'Slug already exists for this content type',
        code: err.code,
        detail: err.detail || err.message,
      });
    }

    res.status(500).json({
      error: 'Failed to update entry',
      code: err.code || null,
      detail: err.message,
    });
  }
});



/* ----------------------- Deletes ----------------------------------- */
app.delete('/api/content-types/:slug', authMiddleware, async (req, res) => {
  const { slug } = req.params;
  try {
    const { rows } = await pool.query('SELECT id FROM content_types WHERE slug = $1 LIMIT 1', [slug]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const typeId = rows[0].id;

    await pool.query('DELETE FROM entry_versions WHERE entry_id IN (SELECT id FROM entries WHERE content_type_id = $1)', [typeId]);
    await pool.query('DELETE FROM entries WHERE content_type_id = $1', [typeId]);
    await pool.query('DELETE FROM fields WHERE content_type_id = $1', [typeId]);
    await pool.query('DELETE FROM content_types WHERE id = $1', [typeId]);

    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/content-types/:slug]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/content-types/:slug/fields/:fieldId', authMiddleware, async (req, res) => {
  const { slug, fieldId } = req.params;
  try {
    const { rows } = await pool.query('SELECT id FROM content_types WHERE slug = $1 LIMIT 1', [slug]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const typeId = rows[0].id;

    const del = await pool.query('DELETE FROM fields WHERE id = $1 AND content_type_id = $2 RETURNING id', [fieldId, typeId]);
    if (!del.rows.length) return res.status(404).json({ error: 'Not found' });

    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/content-types/:slug/fields/:fieldId]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/content/:slug/:id', authMiddleware, async (req, res) => {
  const { slug, id } = req.params;
  try {
    const typeRes = await pool.query('SELECT id FROM content_types WHERE slug = $1 LIMIT 1', [slug]);
    if (!typeRes.rows.length) return res.status(404).json({ error: 'Not found' });
    const typeId = typeRes.rows[0].id;

    await pool.query('DELETE FROM entry_versions WHERE entry_id = $1', [id]);
    const del = await pool.query('DELETE FROM entries WHERE id = $1 AND content_type_id = $2 RETURNING id', [id, typeId]);
    if (!del.rows.length) return res.status(404).json({ error: 'Not found' });

    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/content/:slug/:id]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ----------------------- Legacy delete aliases --------------------- */
app.delete('/api/content/type/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const t = await pool.query('SELECT id FROM content_types WHERE id = $1 LIMIT 1', [id]);
    if (!t.rows.length) return res.status(404).json({ error: 'Not found' });
    const typeId = t.rows[0].id;

    await pool.query('DELETE FROM entry_versions WHERE entry_id IN (SELECT id FROM entries WHERE content_type_id = $1)', [typeId]);
    await pool.query('DELETE FROM entries WHERE content_type_id = $1', [typeId]);
    await pool.query('DELETE FROM fields WHERE content_type_id = $1', [typeId]);
    await pool.query('DELETE FROM content_types WHERE id = $1', [typeId]);

    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/content/type/:id]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/content-type/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const t = await pool.query('SELECT id FROM content_types WHERE id = $1 LIMIT 1', [id]);
    if (!t.rows.length) return res.status(404).json({ error: 'Not found' });
    const typeId = t.rows[0].id;

    await pool.query('DELETE FROM entry_versions WHERE entry_id IN (SELECT id FROM entries WHERE content_type_id = $1)', [typeId]);
    await pool.query('DELETE FROM entries WHERE content_type_id = $1', [typeId]);
    await pool.query('DELETE FROM fields WHERE content_type_id = $1', [typeId]);
    await pool.query('DELETE FROM content_types WHERE id = $1', [typeId]);

    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/content-type/:id]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

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

// In-memory settings (temporary)
let inMemorySettings = {};
app.get('/api/settings', (_req, res) => res.json(inMemorySettings));
app.post('/api/settings', (req, res) => {
  inMemorySettings = req.body || {};
  res.json(inMemorySettings);
});

// Non-/api temporary aliases (optional)
app.get('/settings', (_req, res) => res.json(inMemorySettings));
app.post('/settings', (req, res) => {
  inMemorySettings = req.body || {};
  res.json(inMemorySettings);
});

/* ----------------------- Routers ----------------------------------- */
app.use('/api/users', authMiddleware, usersRouter);
app.use('/api/taxonomies', taxonomiesRouter);
app.use('/api/roles', authMiddleware, rolesRouter);
app.use('/api/permissions', authMiddleware, permissionsRouter);
app.use('/api/settings', settingsRouter);
app.use("/api/dashboard", authMiddleware, dashboardRouter);


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
