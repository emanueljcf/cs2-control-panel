const express = require('express');
const mapcycle = require('../core/mapcycle');
const cfgGenerator = require('../core/cfgGenerator');
const rcon = require('../core/rcon');
const processManager = require('../core/processManager');
const settingsStore = require('../core/settingsStore');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ available: mapcycle.listAvailableMaps(), mapcycle: mapcycle.getMapcycle() });
});

router.put('/mapcycle', (req, res) => {
  const { maps } = req.body || {};
  if (!Array.isArray(maps) || maps.length === 0) {
    return res.status(400).json({ error: 'maps-required' });
  }
  mapcycle.setMapcycle(maps);
  const { targetPath, finalText } = cfgGenerator.generateMapcycle();
  require('fs').writeFileSync(targetPath, finalText, 'utf8');
  res.json({ ok: true, mapcycle: maps });
});

// Ao vivo por omissão: troca de mapa sem desligar ninguém.
router.post('/change', async (req, res) => {
  const { map } = req.body || {};
  if (!map) return res.status(400).json({ error: 'map-required' });

  const status = processManager.isRunning();
  if (!status.running || !rcon.isConfigured()) {
    return res.json({ applied: false, pendingRestart: true, warning: 'Servidor parado ou RCON não configurado — a troca só acontece no próximo arranque.' });
  }

  try {
    await rcon.changeMap(map);
    const server = settingsStore.getServer();
    server.activeMap = map;
    settingsStore.setServer(server);
    res.json({ applied: true, live: true });
  } catch (err) {
    res.status(502).json({ applied: false, error: err.message });
  }
});

module.exports = router;
