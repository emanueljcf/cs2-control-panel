const fs = require('fs');
const path = require('path');
const paths = require('../config/paths');
const registry = require('./convarRegistry');

function atomicWriteJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT' && fallback !== undefined) return fallback;
    throw err;
  }
}

const GAME_TYPE_MODE = {
  casual: { gameType: 0, gameMode: 0, label: 'Casual' },
  competitive: { gameType: 0, gameMode: 1, label: 'Competitivo' },
  deathmatch: { gameType: 1, gameMode: 2, label: 'Deathmatch' },
  custom: { gameType: 3, gameMode: 0, label: 'Custom' },
};

function defaultModeJson(mode) {
  const meta = GAME_TYPE_MODE[mode];
  return { ...meta, overrides: {}, rawOverrides: {} };
}

function getMode(mode) {
  const file = path.join(paths.GAMEMODES_DIR, `${mode}.json`);
  return readJson(file, defaultModeJson(mode));
}

function setMode(mode, data) {
  const file = path.join(paths.GAMEMODES_DIR, `${mode}.json`);
  atomicWriteJson(file, data);
}

function getAllModes() {
  return Object.fromEntries(Object.keys(GAME_TYPE_MODE).map((m) => [m, getMode(m)]));
}

function defaultServerJson() {
  return {
    hostname: 'Servidor LAN CS2',
    maxplayers: 15,
    port: paths.CS2_GAME_PORT,
    sv_lan: 1,
    sv_password: '',
    rcon_password: '',
    activeMode: 'competitive',
    activeMap: 'de_dust2',
    mapcycle: ['de_dust2', 'de_inferno', 'de_cache', 'de_mirage'],
  };
}

function getServer() {
  return readJson(paths.SERVER_JSON, defaultServerJson());
}

function setServer(data) {
  atomicWriteJson(paths.SERVER_JSON, data);
}

// Aplica um conjunto de alterações {key: value} a um modo, validando contra o
// registry. Devolve {applied, rejected} — não escreve nada em disco sozinho,
// quem chama decide quando persistir via setMode().
function mergeModeOverrides(modeData, changes) {
  const applied = {};
  const rejected = [];
  for (const [key, value] of Object.entries(changes)) {
    const entry = registry.get(key);
    if (entry) {
      modeData.overrides[key] = value;
      applied[key] = value;
    } else {
      modeData.rawOverrides[key] = value;
      applied[key] = value;
    }
  }
  return { modeData, applied, rejected };
}

module.exports = {
  GAME_TYPE_MODE,
  getMode,
  setMode,
  getAllModes,
  getServer,
  setServer,
  mergeModeOverrides,
  atomicWriteJson,
  readJson,
};
