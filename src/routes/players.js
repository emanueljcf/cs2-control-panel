const express = require('express');
const rcon = require('../core/rcon');
const processManager = require('../core/processManager');

const router = express.Router();

function liveOnly(handler) {
  return async (req, res) => {
    const status = processManager.isRunning();
    if (!status.running || !rcon.isConfigured()) {
      return res.status(409).json({
        error: 'Esta ação só funciona com o servidor a correr e o RCON ativo (ativa a password RCON e reinicia uma vez).',
      });
    }
    try {
      await handler(req, res);
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  };
}

router.get('/', liveOnly(async (req, res) => {
  const players = await rcon.getPlayers();
  res.json({ players });
}));

router.post('/:userid/kick', liveOnly(async (req, res) => {
  const { reason } = req.body || {};
  await rcon.kickPlayer(req.params.userid, reason);
  res.json({ applied: true });
}));

router.post('/:userid/ban', liveOnly(async (req, res) => {
  const { minutes, reason } = req.body || {};
  await rcon.banPlayer(req.params.userid, Number(minutes) || 0, reason);
  res.json({ applied: true });
}));

module.exports = router;
