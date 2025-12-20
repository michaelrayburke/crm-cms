// api/routes/users.js
import { Router } from 'express';
import { pool } from '../dbPool.js';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

const router = Router();

/* Helpers ---------------------------------------------------------- */

function normalizeRole(role, fallback = 'EDITOR') {
  const r = typeof role === 'string' ? role.trim() : '';
  return (r || fallback).toUpperCase();
}

function parseBool(v, defaultValue = false) {
  if (v === undefined || v === null || v === '') return defaultValue;
  const s = String(v).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(s)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(s)) return false;
  return defaultValue;
}

async function syncRoleToSupabase(userRow) {
  if (!supabaseAdmin || !userRow.supabase_id) return;

  try {
    const metaPatch = {
      name: userRow.name || null,
      role: userRow.role || null,
    };

    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      userRow.supabase_id,
      {
        email: userRow.email,
        user_metadata: metaPatch,
      }
    );

    if (error) {
      console.error('[supabase sync] updateUserById error', error);
    }
  } catch (err) {
    console.error('[supabase sync] updateUserById failed', err);
  }
}

/* Routes ----------------------------------------------------------- */

// GET /api/users?q=search
router.get('/', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const params = [];
    let sql =
      'select id, email, name, role, status, supabase_id, created_at, updated_at from public.users';

    if (q) {
      sql += ' where email ilike $1 or name ilike $1';
      params.push(`%${q}%`);
    }

    sql += ' order by created_at desc';

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error('[GET /api/users]', e);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

/**
 * GET /api/users/picker?q=mic&role=ADMIN&onlyActive=true&limit=20
 * Lightweight endpoint intended for user relationship pickers in the admin UI.
 */
router.get('/picker', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const role = String(req.query.role || '').trim();
    const onlyActive = parseBool(req.query.onlyActive, true);
    const limitRaw = parseInt(String(req.query.limit || '20'), 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 20;

    const params = [];
    let where = 'where 1=1';

    if (q) {
      params.push(`%${q}%`);
      where += ` and (email ilike $${params.length} or name ilike $${params.length})`;
    }

    if (role) {
      params.push(normalizeRole(role, role));
      where += ` and role = $${params.length}`;
    }

    if (onlyActive) {
      where += ` and status = 'ACTIVE'`;
    }

    params.push(limit);

    const sql = `
      select id, email, name, role, status
      from public.users
      ${where}
      order by name asc nulls last, email asc
      limit $${params.length}
    `;

    const { rows } = await pool.query(sql, params);
    res.json({ ok: true, users: rows });
  } catch (e) {
    console.error('[GET /api/users/picker]', e);
    res.status(500).json({ error: 'Failed to load picker users' });
  }
});

/**
 * POST /api/users/resolve
 * Body: { ids: ["uuid", "uuid"] }
 * Returns a map for fast lookup: { ok: true, users: [{id,name,email,role,status}], byId: { [id]: user } }
 *
 * This is a key building block for "Option B" (auto-expanding relation_user fields).
 */
router.post('/resolve', async (req, res) => {
  try {
    const idsRaw = req.body?.ids;
    const ids = Array.isArray(idsRaw)
      ? idsRaw.map((x) => String(x).trim()).filter(Boolean)
      : [];

    if (!ids.length) {
      return res.json({ ok: true, users: [], byId: {} });
    }

    const { rows } = await pool.query(
      `
        select id, email, name, role, status
        from public.users
        where id = any($1::uuid[])
      `,
      [ids]
    );

    const byId = {};
    for (const u of rows) byId[u.id] = u;

    res.json({ ok: true, users: rows, byId });
  } catch (e) {
    console.error('[POST /api/users/resolve]', e);
    res.status(500).json({ error: 'Failed to resolve users' });
  }
});

// POST /api/users
router.post('/', async (req, res) => {
  const { email, name, password, role = 'EDITOR' } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const normalizedRole = normalizeRole(role, 'EDITOR');

    // Check existing user with that email
    const { rows: existing } = await pool.query(
      'select id from public.users where email = $1 limit 1',
      [email.trim().toLowerCase()]
    );
    if (existing.length) {
      return res.status(409).json({ error: 'A user with that email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Create Supabase auth user first (if configured)
    let supabaseId = null;
    if (supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email: email.trim().toLowerCase(),
          password,
          email_confirm: true,
          user_metadata: {
            name: name || null,
            role: normalizedRole,
          },
        });
        if (error) {
          console.error('[supabase] createUser error', error);
        } else if (data?.user?.id) {
          supabaseId = data.user.id;
        }
      } catch (err) {
        console.error('[supabase] createUser exception', err);
      }
    }

    // Insert into our local users table
    const { rows } = await pool.query(
      `insert into public.users (email, name, password_hash, role, status, supabase_id)
       values ($1, $2, $3, $4, 'ACTIVE', $5)
       returning id, email, name, role, status, supabase_id, created_at, updated_at`,
      [
        email.trim().toLowerCase(),
        name || null,
        passwordHash,
        normalizedRole,
        supabaseId,
      ]
    );

    const user = rows[0];
    res.status(201).json(user);
  } catch (e) {
    console.error('[POST /api/users]', e);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PATCH /api/users/:id
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { email, name, password, role, status } = req.body || {};

  try {
    const { rows: existingRows } = await pool.query(
      'select * from public.users where id = $1',
      [id]
    );
    if (!existingRows.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    const existing = existingRows[0];

    const newEmail = email ? email.trim().toLowerCase() : existing.email;
    const newName = typeof name === 'string' ? name : existing.name;
    const newRole = role ? normalizeRole(role, existing.role) : existing.role;
    const newStatus = status || existing.status;

    let newPasswordHash = existing.password_hash;
    if (password && password.trim()) {
      newPasswordHash = await bcrypt.hash(password.trim(), 10);
    }

    const { rows } = await pool.query(
      `update public.users
       set email = $1,
           name = $2,
           password_hash = $3,
           role = $4,
           status = $5
       where id = $6
       returning id, email, name, role, status, supabase_id, created_at, updated_at`,
      [newEmail, newName, newPasswordHash, newRole, newStatus, id]
    );

    const user = rows[0];

    // Sync to Supabase auth, if applicable
    await syncRoleToSupabase(user);

    res.json(user);
  } catch (e) {
    console.error('[PATCH /api/users/:id]', e);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE /api/users/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows: existingRows } = await pool.query(
      'delete from public.users where id = $1 returning id, supabase_id',
      [id]
    );
    if (!existingRows.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    const deleted = existingRows[0];

    if (supabaseAdmin && deleted.supabase_id) {
      try {
        const { error } = await supabaseAdmin.auth.admin.deleteUser(
          deleted.supabase_id
        );
        if (error) {
          console.error('[supabase] deleteUser error', error);
        }
      } catch (err) {
        console.error('[supabase] deleteUser exception', err);
      }
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('[DELETE /api/users/:id]', e);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
