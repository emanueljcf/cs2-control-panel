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
    // null = a usar as regras standard (sem personalizacao) desse modo.
    // Qualquer edicao que nao corresponda a um preset guardado mostra-se
    // na UI como "Custom" ate ser guardada com um nome.
    activePresetId: null,
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

// --- Presets guardados (biblioteca de regras com nome, reutilizavel) ---
// Cada preset {id, name, baseMode, overrides, rawOverrides, createdAt}.
// "Custom" nao e um preset fixo - e o estado transitorio de qualquer modo
// base cujos overrides atuais nao correspondem a nenhum preset guardado
// (incluindo o estado "standard", que e overrides={}).

function getPresets() {
  return readJson(paths.PRESETS_JSON, []);
}

function savePreset({ name, baseMode, overrides, rawOverrides }) {
  if (!GAME_TYPE_MODE[baseMode]) throw new Error(`baseMode invalido: ${baseMode}`);
  const presets = getPresets();
  const id = `${baseMode}-${Date.now()}`;
  const preset = { id, name, baseMode, overrides: overrides || {}, rawOverrides: rawOverrides || {}, createdAt: new Date().toISOString() };
  presets.push(preset);
  atomicWriteJson(paths.PRESETS_JSON, presets);
  return preset;
}

function deletePreset(id) {
  const presets = getPresets().filter((p) => p.id !== id);
  atomicWriteJson(paths.PRESETS_JSON, presets);
}

function getPreset(id) {
  return getPresets().find((p) => p.id === id);
}

// Compara os overrides atuais de um modo com os de um preset (ou com o
// standard, quando presetId é null) para decidir se o estado é "Custom".
function matchesPreset(mode, presetId) {
  const modeData = getMode(mode);
  const baseline = presetId ? getPreset(presetId) : { overrides: {}, rawOverrides: {} };
  if (!baseline) return false;
  return JSON.stringify(modeData.overrides) === JSON.stringify(baseline.overrides)
    && JSON.stringify(modeData.rawOverrides) === JSON.stringify(baseline.rawOverrides);
}

// Competitivo/Casual/Deathmatch/Custom nunca são editados diretamente - os
// seus ficheiros <mode>.json ficam sempre "puros" (overrides={}). A única
// forma de um modo deixar de ser standard é ter um preset guardado com nome
// ativo (server.activePresetId, só válido quando server.activeMode===mode).
// Edições pontuais nos campos só se aplicam ao vivo via RCON (ver
// routes/settings.js) e nunca chegam aqui - por isso isto é a ÚNICA fonte
// usada para gerar os .cfg (ver cfgGenerator.generateMode).
function getEffectiveOverrides(mode) {
  const server = getServer();
  if (server.activeMode === mode && server.activePresetId) {
    const preset = getPreset(server.activePresetId);
    if (preset) return { overrides: preset.overrides, rawOverrides: preset.rawOverrides };
  }
  return { overrides: {}, rawOverrides: {} };
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
  getPresets,
  savePreset,
  deletePreset,
  getPreset,
  matchesPreset,
  getEffectiveOverrides,
};
