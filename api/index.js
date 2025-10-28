import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// set up postgres connection
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
});

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

// ---------- AUTH ----------

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
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
    console.error(err);
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

// ---------- HEALTH ----------

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// ---------- CONTENT TYPES ----------

app.get('/api/content-types', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM content_types ORDER BY created_at');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create content type (+initial fields)
app.post('/api/content-types', authMiddleware, async (req, res) => {
  const { slug, name, fields } = req.body;
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
      const {
        key,
        label,
        type,
        required = false,
        sort = 0,
        options = null,
      } = field;

      await pool.query(
        `INSERT INTO fields (content_type_id, key, label, type, required, sort, options)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          ctype.id,
          key,
          label,
          type,
          !!required,
          Number.isFinite(sort) ? sort : 0,
          options ? JSON.stringify(options) : null
        ]
      );
    }

    const fieldsRes = await pool.query(
      'SELECT * FROM fields WHERE content_type_id = $1 ORDER BY sort, id',
      [ctype.id]
    );
    res.status(201).json({ ...ctype, fields: fieldsRes.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get content type + fields
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
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update content type slug + name
app.put('/api/content-types/:slug', authMiddleware, async (req, res) => {
  const { slug } = req.params;
  const { slug: newSlug, name } = req.body;
  try {
    const result = await pool.query(
      'UPDATE content_types SET slug = $1, name = $2 WHERE slug = $3 RETURNING *',
      [newSlug || slug, name, slug]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add a field to a content type
app.post('/api/content-types/:slug/fields', authMiddleware, async (req, res) => {
  const { slug } = req.params;
  const {
    key,
    label,
    type,
    required = false,
    sort = 0,
    options = null
  } = req.body;

  try {
    const ctRes = await pool.query(
      'SELECT id FROM content_types WHERE slug = $1 LIMIT 1',
      [slug]
    );
    if (!ctRes.rows.length) {
      return res.status(404).json({ error: 'Not found' });
    }
    const ctId = ctRes.rows[0].id;

    const insertRes = await pool.query(
      `INSERT INTO fields (content_type_id, key, label, type, required, sort, options)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, content_type_id, key, label, type, required, sort, options`,
      [ctId, key, label, type, !!required, Number.isFinite(sort) ? sort : 0, options ? JSON.stringify(options) : null]
    );

    res.json(insertRes.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update a field on a content type
app.put('/api/content-types/:slug/fields/:fieldId', authMiddleware, async (req, res) => {
  const { fieldId } = req.params;
  const {
    key,
    label,
    type,
    required,
    sort,
    options
  } = req.body;

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

    if (!updateRes.rows.length) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json(updateRes.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------- ENTRIES ----------

// list entries by type
app.get('/api/content/:slug', async (req, res) => {
  const { slug } = req.params;
  try {
    const typeRes = await pool.query('SELECT id FROM content_types WHERE slug = $1 LIMIT 1', [slug]);
    if (!typeRes.rows.length) return res.status(404).json({ error: 'Not found' });
    const typeId = typeRes.rows[0].id;
    const entriesRes = await pool.query(
      'SELECT * FROM entries WHERE content_type_id = $1 ORDER BY created_at DESC',
      [typeId]
    );
    res.json(entriesRes.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// create entry
app.post('/api/content/:slug', authMiddleware, async (req, res) => {
  const { slug } = req.params;
  const { data } = req.body;
  if (typeof data !== 'object') return res.status(400).json({ error: 'Data must be an object' });
  try {
    const typeRes = await pool.query('SELECT id FROM content_types WHERE slug = $1 LIMIT 1', [slug]);
    if (!typeRes.rows.length) return res.status(404).json({ error: 'Not found' });
    const typeId = typeRes.rows[0].id;
    const entryRes = await pool.query(
      'INSERT INTO entries (content_type_id, data) VALUES ($1, $2) RETURNING *',
      [typeId, data]
    );
    const entry = entryRes.rows[0];
    await pool.query('INSERT INTO entry_versions (entry_id, data) VALUES ($1, $2)', [entry.id, data]);
    res.status(201).json(entry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// get single entry
app.get('/api/content/:slug/:id', async (req, res) => {
  const { slug, id } = req.params;
  try {
    const typeRes = await pool.query('SELECT id FROM content_types WHERE slug = $1 LIMIT 1', [slug]);
    if (!typeRes.rows.length) return res.status(404).json({ error: 'Not found' });
    const typeId = typeRes.rows[0].id;
    const entryRes = await pool.query(
      'SELECT * FROM entries WHERE id = $1 AND content_type_id = $2 LIMIT 1',
      [id, typeId]
    );
    if (!entryRes.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(entryRes.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// update entry
app.put('/api/content/:slug/:id', authMiddleware, async (req, res) => {
  const { slug, id } = req.params;
  const { data } = req.body;
  if (typeof data !== 'object') return res.status(400).json({ error: 'Data must be an object' });
  try {
    const typeRes = await pool.query('SELECT id FROM content_types WHERE slug = $1 LIMIT 1', [slug]);
    if (!typeRes.rows.length) return res.status(404).json({ error: 'Not found' });
    const typeId = typeRes.rows[0].id;
    const entryRes = await pool.query(
      'UPDATE entries SET data = $1, updated_at = now() WHERE id = $2 AND content_type_id = $3 RETURNING *',
      [data, id, typeId]
    );
    if (!entryRes.rows.length) return res.status(404).json({ error: 'Not found' });
    await pool.query('INSERT INTO entry_versions (entry_id, data) VALUES ($1, $2)', [id, data]);
    res.json(entryRes.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
