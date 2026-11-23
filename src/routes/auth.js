const express = require('express');
const rateLimit = require('express-rate-limit');
const auth = require('../core/auth');

const router = express.Router();

const loginLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 20, standardHeaders: true });

router.get('/status', (req, res) => {
  res.json({ setUp: auth.isSetUp(), authenticated: Boolean(req.session && req.session.authenticated) });
});

// Só funciona uma vez — enquanto não houver password de admin criada.
router.post('/setup', async (req, res) => {
  if (auth.isSetUp()) return res.status(409).json({ error: 'already-set-up' });
  const { password } = req.body || {};
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'password-too-short' });
  }
  await auth.setup(password);
  req.session.authenticated = true;
  res.json({ ok: true });
});

router.post('/login', loginLimiter, async (req, res) => {
  const { password } = req.body || {};
  const ok = password && (await auth.verify(password));
  if (!ok) return res.status(401).json({ error: 'invalid-password' });
  req.session.authenticated = true;
  res.json({ ok: true });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

module.exports = router;
