const express = require('express');
const settingsStore = require('../core/settingsStore');
const rcon = require('../core/rcon');
const processManager = require('../core/processManager');

const router = express.Router();

router.get('/', (req, res) => {
  const modes = settingsStore.GAME_TYPE_MODE;
  const server = settingsStore.getServer();
  res.json({ modes, activeMode: server.activeMode });
});

// Ao vivo por omissão: tenta RCON primeiro, só cai para aviso de restart se
// o RCON estiver indisponível ou a tentativa falhar.
router.post('/change', async (req, res) => {
  const { mode } = req.body || {};
  if (!settingsStore.GAME_TYPE_MODE[mode]) return res.status(400).json({ error: 'mode-invalido' });

  const server = settingsStore.getServer();
  const status = processManager.isRunning();
  const { gameType, gameMode } = settingsStore.GAME_TYPE_MODE[mode];

  if (status.running && rcon.isConfigured()) {
    try {
      await rcon.changeMode(gameType, gameMode, server.activeMap);
      server.activeMode = mode;
      settingsStore.setServer(server);
      return res.json({ applied: true, live: true });
    } catch (err) {
      server.activeMode = mode;
      settingsStore.setServer(server);
      return res.json({ applied: false, pendingRestart: true, warning: `Troca ao vivo falhou (${err.message}) — fica pendente para o próximo restart.` });
    }
  }

  server.activeMode = mode;
  settingsStore.setServer(server);
  res.json({ applied: false, pendingRestart: true, warning: 'Servidor parado ou RCON não configurado — a troca de modo só acontece no próximo arranque.' });
});

module.exports = router;
