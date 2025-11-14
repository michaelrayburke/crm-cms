// api/routes/users.js (ESM, uses pg Pool)
import { Router } from 'express';
import { pool } from '../dbPool.js';
import bcrypt from 'bcryptjs';

const router = Router();

// GET /api/users?q=search
router.get('/', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const params = [];
    let sql =
      'select id, email, name, username, avatar, role, status, updated_at from public.users';
    if (q) {
      params.push(`%${q}%`);
      sql += ' where (email ilike $1 or name ilike $1 or username ilike $1)';
    }
    sql += ' order by name nulls last, email asc limit 50';

    const { rows } = await pool.query(sql, params);
    res.json({ ok: true, users: rows });
  } catch (e) {
    console.error('users route error:', e);
    res.status(500).json({
      ok: false,
      error: 'Failed to list users',
      detail: String(e?.message || e),
    });
  }
});

// POST /api/users  -> create a new user
router.post('/', async (req, res) => {
  try {
    const { email, name, password, role = 'EDITOR' } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const hashed = await bcrypt.hash(password, 10);

    const insertSql = `
      insert into users (email, name, password_hash, role, status)
      values ($1, $2, $3, $4, $5)
      returning id, email, name, username, avatar, role, status, updated_at
    `;

    const { rows } = await pool.query(insertSql, [
      email,
      name || null,
      hashed,
      role,
      'ACTIVE',
    ]);

    return res.status(201).json(rows[0]);
  } catch (e) {
    console.error('Error creating user', e);
    if (e?.code === '23505') {
      return res.status(409).json({ error: 'A user with that email already exists.' });
    }
    return res.status(500).json({ error: 'Failed to create user' });
  }
});

// PATCH /api/users/:id  -> update role (and optionally name)
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { role, name } = req.body || {};

    if (!role && !name) {
      return res.status(400).json({ error: 'Nothing to update.' });
    }

    const fields = [];
    const params = [];
    let idx = 1;

    if (role) {
      fields.push(`role = $${idx++}`);
      params.push(role);
    }
    if (name !== undefined) {
      fields.push(`name = $${idx++}`);
      params.push(name || null);
    }

    fields.push(`updated_at = now()`);

    params.push(id);

    const sql = `
      update users
      set ${fields.join(', ')}
      where id = $${idx}
      returning id, email, name, username, avatar, role, status, updated_at
    `;

    const { rows } = await pool.query(sql, params);
    if (!rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(rows[0]);
  } catch (e) {
    console.error('Error updating user', e);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE /api/users/:id  -> remove user
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      'delete from users where id = $1 returning id',
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('Error deleting user', e);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
