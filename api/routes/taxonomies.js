router.post('/', async (req, res) => {
  try {
    await ensureTable();

    const { key, slug, label, isHierarchical } = req.body || {};

    const rawSlug = slug || key;
    const trimmedSlug = (rawSlug || '').trim();
    const trimmedLabel = (label || '').trim();

    if (!trimmedSlug || !trimmedLabel) {
      return res.status(400).json({
        ok: false,
        error: 'Both "key/slug" and "label" are required.',
      });
    }

    const insertSql = `
      INSERT INTO taxonomies (slug, label, is_hierarchical)
      VALUES ($1, $2, COALESCE($3, FALSE))
      RETURNING id, slug, label, is_hierarchical, created_at
    `;

    const { rows } = await pool.query(insertSql, [
      trimmedSlug,
      trimmedLabel,
      typeof isHierarchical === 'boolean' ? isHierarchical : null,
    ]);

    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[POST /api/taxonomies]', err);

    if (err && err.code === '23505') {
      return res.status(409).json({
        ok: false,
        error: 'A taxonomy with that key/slug already exists.',
      });
    }

    return res.status(500).json({
      ok: false,
      error: 'Failed to create taxonomy',
      detail: String(err.message || err),
    });
  }
});
