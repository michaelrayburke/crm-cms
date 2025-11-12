// api/routes/users.js (ESM, uses pg Pool)
import { Router } from 'express';
import { pool } from '../dbPool.js';

const router = Router();

// GET /api/users?q=search
router.get('/', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const params = [];
    // keep it minimal first to avoid column mismatch surprises
    let sql = `select id, email, name, username, avatar, role, status, updated_at from public.users`;
    if (q) {
      params.push(`%${q}%`);
      sql += ` where (email ilike $1 or name ilike $1 or username ilike $1)`;
    }
    sql += ` order by name nulls last, email asc limit 50`;

    const { rows } = await pool.query(sql, params);
    res.json({ ok: true, users: rows });
  } catch (e) {
    console.error('users route error:', e); // <- check nodemon console for details
    // temporarily surface message in dev so we can see it in the browser
    res.status(500).json({ ok: false, error: 'Failed to list users', detail: String(e?.message || e) });
  }
});

export default router;
