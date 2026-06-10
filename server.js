require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const path     = require('path');

const requestsRouter = require('./routes/requests');
const authRouter     = require('./routes/auth');
const usersRouter    = require('./routes/users');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

//API Routes
app.use('/api/auth',     authRouter);
app.use('/api/users',    usersRouter);
app.use('/api/requests', requestsRouter);

//default: index.html
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`HAK Doc Approval running on http://localhost:${PORT}`);
});
