const fs = require('fs');
const path = require('path');
const paths = require('../config/paths');
const settingsStore = require('./settingsStore');

// Mapas oficiais confirmados como instalados nesta sessão (ver
// game\csgo\maps\*.vpk). Lista curada em vez de ler o disco em cada pedido.
const AVAILABLE_MAPS = [
  'de_dust2', 'de_inferno', 'de_mirage', 'de_cache', 'de_ancient', 'de_anubis',
  'de_nuke', 'de_overpass', 'de_train', 'de_vertigo', 'cs_office', 'cs_italy',
];

function listAvailableMaps() {
  const mapsDir = path.join(paths.CS2_ROOT, 'game', 'csgo', 'maps');
  try {
    const installed = fs.readdirSync(mapsDir)
      .filter((f) => f.endsWith('.vpk') && !f.includes('_vanity') && !f.includes('workshop_preview'))
      .map((f) => f.replace('.vpk', ''));
    return installed.length ? installed : AVAILABLE_MAPS;
  } catch (_) {
    return AVAILABLE_MAPS;
  }
}

function getMapcycle() {
  return settingsStore.getServer().mapcycle;
}

function setMapcycle(maps) {
  const server = settingsStore.getServer();
  server.mapcycle = maps;
  settingsStore.setServer(server);
  return server.mapcycle;
}

module.exports = { listAvailableMaps, getMapcycle, setMapcycle };
