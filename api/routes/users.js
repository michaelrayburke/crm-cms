// api/routes/users.js
import { Router } from 'express';
import { pool } from '../dbPool.js';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

const router = Router();

/* Helpers ---------------------------------------------------------- */

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
router.get(
  '/',
  async (req, res) => {
    try {
      const q = (req.query.q || '').trim();
      const params = [];
      let sql =
        'select id, email, name, role, status, supabase_id, created_at, updated_at from public.users';

      if (q) {
        sql +=
          ' where email ilike $1 or name ilike $1';
        params.push(`%${q}%`);
      }

      sql += ' order by created_at desc';

      const { rows } = await pool.query(sql, params);
      res.json(rows);
    } catch (e) {
      console.error('[GET /api/users]', e);
      res.status(500).json({ error: 'Failed to load users' });
    }
  }
);

// POST /api/users
router.post(
  '/',
  async (req, res) => {
    const { email, name, password, role = 'EDITOR' } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    try {
      const normalizedRole = (role || 'EDITOR').toUpperCase();

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
  }
);

// PATCH /api/users/:id
router.patch(
  '/:id',
  async (req, res) => {
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
      const newRole = role ? role.trim().toUpperCase() : existing.role;
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
        [
          newEmail,
          newName,
          newPasswordHash,
          newRole,
          newStatus,
          id,
        ]
      );

      const user = rows[0];

      // Sync to Supabase auth, if applicable
      await syncRoleToSupabase(user);

      res.json(user);
    } catch (e) {
      console.error('[PATCH /api/users/:id]', e);
      res.status(500).json({ error: 'Failed to update user' });
    }
  }
);

// DELETE /api/users/:id
router.delete(
  '/:id',
  async (req, res) => {
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
  }
);

export default router;
