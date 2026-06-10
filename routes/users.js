const express = require('express');
const router  = express.Router();
const db      = require('../db');

// GET /api/users — list all users (for approver picker dropdown)
router.get('/', async (_req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, email, department FROM users ORDER BY name ASC'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

module.exports = router;
