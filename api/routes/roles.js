// api/routes/roles.js
import { Router } from 'express';
import { pool } from '../dbPool.js';
import { checkPermission } from '../middleware/checkPermission.js';

const router = Router();

// GET /api/roles
router.get(
  '/',
  checkPermission('roles.manage'),
  async (_req, res) => {
    try {
      const { rows } = await pool.query(
        'select id, slug, label, is_system, created_at, updated_at from public.roles order by is_system desc, label asc'
      );
      res.json(rows);
    } catch (err) {
      console.error('[GET /api/roles]', err);
      res.status(500).json({ error: 'Failed to load roles' });
    }
  }
);

// POST /api/roles
router.post(
  '/',
  checkPermission('roles.manage'),
  async (req, res) => {
    const { slug, label } = req.body || {};
    if (!slug || !label) {
      return res.status(400).json({ error: 'Slug and label are required' });
    }
    try {
      const { rows } = await pool.query(
        `insert into public.roles (slug, label, is_system)
         values ($1, $2, false)
         returning id, slug, label, is_system, created_at, updated_at`,
        [slug.trim().toUpperCase(), label.trim()]
      );
      res.status(201).json(rows[0]);
    } catch (err) {
      console.error('[POST /api/roles]', err);
      if (err.code === '23505') {
        return res.status(409).json({ error: 'A role with that slug already exists.' });
      }
      res.status(500).json({ error: 'Failed to create role' });
    }
  }
);

// PATCH /api/roles/:id
router.patch(
  '/:id',
  checkPermission('roles.manage'),
  async (req, res) => {
    const { id } = req.params;
    const { slug, label } = req.body || {};
    try {
      // Don't allow slug changes for system roles
      const { rows: existingRows } = await pool.query(
        'select * from public.roles where id = $1',
        [id]
      );
      if (!existingRows.length) {
        return res.status(404).json({ error: 'Role not found' });
      }
      const existing = existingRows[0];

      const newSlug = slug ? slug.trim().toUpperCase() : existing.slug;
      const newLabel = label ? label.trim() : existing.label;

      if (existing.is_system && newSlug !== existing.slug) {
        return res
          .status(400)
          .json({ error: 'Cannot change slug of a system role.' });
      }

      const { rows } = await pool.query(
        `update public.roles
         set slug = $1, label = $2
         where id = $3
         returning id, slug, label, is_system, created_at, updated_at`,
        [newSlug, newLabel, id]
      );
      res.json(rows[0]);
    } catch (err) {
      console.error('[PATCH /api/roles/:id]', err);
      if (err.code === '23505') {
        return res.status(409).json({ error: 'A role with that slug already exists.' });
      }
      res.status(500).json({ error: 'Failed to update role' });
    }
  }
);

// DELETE /api/roles/:id
router.delete(
  '/:id',
  checkPermission('roles.manage'),
  async (req, res) => {
    const { id } = req.params;
    try {
      const { rows: existingRows } = await pool.query(
        'select * from public.roles where id = $1',
        [id]
      );
      if (!existingRows.length) {
        return res.status(404).json({ error: 'Role not found' });
      }
      const existing = existingRows[0];
      if (existing.is_system) {
        return res.status(400).json({ error: 'Cannot delete a system role.' });
      }

      // Prevent delete if any users still use this role
      const { rows: userRows } = await pool.query(
        'select count(*)::int as count from public.users where role = $1',
        [existing.slug]
      );
      if (userRows[0].count > 0) {
        return res.status(400).json({
          error: 'Cannot delete this role because some users are still assigned to it.',
        });
      }

      await pool.query('delete from public.roles where id = $1', [id]);
      res.json({ ok: true });
    } catch (err) {
      console.error('[DELETE /api/roles/:id]', err);
      res.status(500).json({ error: 'Failed to delete role' });
    }
  }
);

export default router;