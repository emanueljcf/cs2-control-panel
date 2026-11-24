const express = require('express');
const processManager = require('../core/processManager');
const rcon = require('../core/rcon');
const settingsStore = require('../core/settingsStore');
const { getLanIp } = require('../core/network');

const router = express.Router();

router.get('/', (req, res) => {
  const proc = processManager.isRunning();
  const server = settingsStore.getServer();
  res.json({
    ...proc,
    activeMode: server.activeMode,
    activePresetId: server.activePresetId,
    activeMap: server.activeMap,
    rconAvailable: rcon.isConfigured(),
    ip: getLanIp(),
    port: server.port,
  });
});

router.post('/adopt', (req, res) => {
  try {
    res.json(processManager.adopt());
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
