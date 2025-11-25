const express = require("express");
const router = express.Router();
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

// placeholder - user should replace with their existing contentTypes.js if using ES modules
router.get("/", requireAuth, async (req, res) => {
  res.json([]);
});

module.exports = router;
