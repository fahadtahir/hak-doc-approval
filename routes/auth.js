const express = require('express');
const router  = express.Router();
const db      = require('../db');

// POST /api/auth/login
// Body: { email, password }
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  if (password !== 'password') {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  try {
    const [[user]] = await db.query(
      'SELECT id, name, email, department FROM users WHERE email = ?',
      [email.toLowerCase().trim()]
    );
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    // Return the user profile — frontend stores this in localStorage
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

module.exports = router;
