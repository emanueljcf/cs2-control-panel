const express = require('express');
const fs = require('fs');
const processManager = require('../core/processManager');
const settingsStore = require('../core/settingsStore');
const registry = require('../core/convarRegistry');
const rcon = require('../core/rcon');
const cfgGenerator = require('../core/cfgGenerator');

const router = express.Router();

// [destrutivo] desliga todos os jogadores
router.post('/stop', async (req, res) => {
  res.json(await processManager.stop());
});

// [destrutivo] desliga todos os jogadores
router.post('/restart', async (req, res) => {
  res.json(await processManager.restart());
});

router.post('/start', async (req, res) => {
  res.json(await processManager.start());
});

router.get('/settings', (req, res) => {
  const server = settingsStore.getServer();
  res.json({ ...server, sv_password: server.sv_password ? '••••••••' : '', rcon_password: server.rcon_password ? '••••••••' : '' });
});

router.put('/settings', async (req, res) => {
  const server = settingsStore.getServer();
  const changes = req.body || {};
  const status = processManager.isRunning();
  const rconReady = status.running && rcon.isConfigured();

  const appliedLive = [];
  const pendingRestart = [];
  const warnings = [];

  for (const [key, value] of Object.entries(changes)) {
    if (key === 'sv_password' || key === 'rcon_password' || key === '••••••••') {
      // nunca sobrescrever com o placeholder mascarado
      if (value === '••••••••') continue;
    }
    server[key] = value;

    const entry = registry.get(key);
    const liveApplicable = entry ? entry.liveApplicable : false;

    if (liveApplicable && rconReady && (key === 'hostname' || key === 'sv_password')) {
      try {
        await rcon.setConvar(key, typeof value === 'string' ? `"${value}"` : value);
        appliedLive.push(key);
      } catch (err) {
        pendingRestart.push(key);
        warnings.push(`${key}: não foi possível aplicar ao vivo (${err.message}), fica para o próximo arranque.`);
      }
    } else if (key === 'maxplayers' || key === 'port' || key === 'rcon_password') {
      pendingRestart.push(key);
      warnings.push(`${key}: esta alteração só é aplicada depois de reiniciar o servidor.`);
    }
  }

  settingsStore.setServer(server);
  // mantém server.cfg (ex. rcon_password) em sincronia com o JSON, mesmo
  // que a alteração só faça efeito no próximo arranque.
  const { targetPath, finalText } = cfgGenerator.generateServerCfg();
  fs.writeFileSync(targetPath, finalText, 'utf8');
  res.json({ saved: true, appliedLive, pendingRestart, pendingNextLoad: [], warnings });
});

module.exports = router;
