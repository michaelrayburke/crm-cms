import express from "express";
const router = express.Router();
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// GET — load layout (user-specific override, fallback to role)
router.get("/", async (req, res) => {
  const userId = req.user.id;
  const role = req.user.role;

  try {
    const userRes = await pool.query(
      "SELECT layout FROM dashboard_layouts WHERE user_id = $1 LIMIT 1",
      [userId]
    );

    if (userRes.rows.length) {
      return res.json(userRes.rows[0].layout);
    }

    const roleRes = await pool.query(
      "SELECT layout FROM dashboard_layouts WHERE role = $1 LIMIT 1",
      [role]
    );

    return res.json(roleRes.rows.length ? roleRes.rows[0].layout : []);
  } catch (err) {
    console.error("dashboard GET", err);
    return res.status(500).json({ error: "Failed to load dashboard layout" });
  }
});

// POST — save layout
router.post("/", async (req, res) => {
  const userId = req.user.id;
  const { layout } = req.body;

  if (!Array.isArray(layout)) {
    return res.status(400).json({ error: "Layout must be array" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO dashboard_layouts (user_id, layout)
       VALUES ($1, $2)
       ON CONFLICT (user_id)
       DO UPDATE SET layout = EXCLUDED.layout, updated_at = now()
       RETURNING layout`,
      [userId, JSON.stringify(layout)]
    );

    return res.json(result.rows[0].layout);
  } catch (err) {
    console.error("dashboard POST", err);
    return res.status(500).json({ error: "Failed to save dashboard layout" });
  }
});

export default router;
