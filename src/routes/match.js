const express = require('express');
const rcon = require('../core/rcon');
const processManager = require('../core/processManager');

const router = express.Router();

function liveOnly(handler) {
  return async (req, res) => {
    const status = processManager.isRunning();
    if (!status.running || !rcon.isConfigured()) {
      return res.status(409).json({
        applied: false,
        warning: 'Esta ação só funciona com o servidor a correr e o RCON ativo (ativa a password RCON e reinicia uma vez).',
      });
    }
    try {
      await handler(req, res);
    } catch (err) {
      res.status(502).json({ applied: false, error: err.message });
    }
  };
}

// Ao vivo: reinicia o match no mesmo mapa, zera o placar, ninguém é desconectado.
router.post('/restart', liveOnly(async (req, res) => {
  const delay = Number(req.body?.delaySeconds ?? 3);
  await rcon.restartMatch(delay);
  res.json({ applied: true, live: true });
}));

// Ao vivo: reinicia só a ronda atual.
router.post('/restart-round', liveOnly(async (req, res) => {
  const delay = Number(req.body?.delaySeconds ?? 3);
  await rcon.restartRound(delay);
  res.json({ applied: true, live: true });
}));

module.exports = router;
