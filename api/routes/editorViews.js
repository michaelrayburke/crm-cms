const express = require('express');
const router = express.Router();

// This file defines routes for managing entry editor views for a given
// content type. The API follows the same structure as our List Views
// implementation and supports grouping fields into configurable
// "widgets" (sections). Each editor view is stored as one row in
// `entry_editor_views` with a JSON `config` containing roles,
// default_roles and sections. You can create, update or delete views
// via these endpoints.

// GET /api/content-types/:id/editor-views
// Returns all editor views for a content type. If a `role` query
// parameter is provided, only views applicable to that role are
// returned (admins always receive all views).
router.get('/content-types/:id/editor-views', async (req, res) => {
  const { id } = req.params;
  const { role } = req.query;

  try {
    // Fetch all editor views for the given content type from the database.
    // Using Supabase client here; adjust according to your DB library.
    const { data: views, error } = await req.supabase
      .from('entry_editor_views')
      .select('*')
      .eq('content_type_id', id);
    if (error) throw error;

    // Filter by role if provided. Admins implicitly get all views.
    const filtered = role && role !== 'ADMIN'
      ? views.filter(v => {
          const roles = v.config?.roles || [];
          return roles.includes(role);
        })
      : views;

    res.json(filtered);
  } catch (err) {
    console.error('Error fetching editor views', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/content-types/:id/editor-view
// Creates or updates a single editor view for a content type.
// Expects body: { slug, label, roles, default_roles, sections }
router.put('/content-types/:id/editor-view', async (req, res) => {
  const { id } = req.params;
  const { slug, label, roles, default_roles, sections } = req.body;

  // Normalize roles arrays
  const normalizedRoles = Array.isArray(roles) ? roles : [];
  const normalizedDefaultRoles = Array.isArray(default_roles) ? default_roles : [];

  try {
    // Upsert the view by slug & content type id
    const { data, error } = await req.supabase
      .from('entry_editor_views')
      .upsert({
        content_type_id: id,
        slug,
        label,
        config: {
          roles: normalizedRoles,
          default_roles: normalizedDefaultRoles,
          sections
        }
      }, { onConflict: ['content_type_id', 'slug'] })
      .select('*')
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error upserting editor view', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/content-types/:id/editor-view/:slug
// Removes a single editor view by slug for a given content type.
router.delete('/content-types/:id/editor-view/:slug', async (req, res) => {
  const { id, slug } = req.params;
  try {
    const { error } = await req.supabase
      .from('entry_editor_views')
      .delete()
      .eq('content_type_id', id)
      .eq('slug', slug);
    if (error) throw error;
    res.status(204).end();
  } catch (err) {
    console.error('Error deleting editor view', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
