// Wrapper fino sobre o protocolo Source RCON. Todas as ações aqui são "ao
// vivo": nunca desconectam jogadores nem tocam no processo cs2.exe.
const Rcon = require('rcon-srcds').default || require('rcon-srcds');
const settingsStore = require('./settingsStore');
const { getLanIp } = require('./network');

const TIMEOUT_MS = 3000;

function isConfigured() {
  const server = settingsStore.getServer();
  return Boolean(server.rcon_password);
}

async function withClient(fn) {
  const server = settingsStore.getServer();
  if (!server.rcon_password) {
    throw new RconUnavailableError('rcon_password não está definido — ativa o RCON e reinicia uma vez.');
  }
  const client = new Rcon({ host: getLanIp(), port: server.port, timeout: TIMEOUT_MS });
  try {
    await client.authenticate(server.rcon_password);
    return await fn(client);
  } finally {
    try { client.disconnect(); } catch (_) { /* já desligado */ }
  }
}

class RconUnavailableError extends Error {}

async function command(cmd) {
  return withClient((client) => client.execute(cmd));
}

async function setConvar(key, value) {
  return command(`${key} ${value}`);
}

async function changeMap(mapName) {
  return command(`changelevel ${mapName}`);
}

async function restartMatch(delaySeconds = 3) {
  return command(`mp_restartgame ${delaySeconds}`);
}

async function restartRound(delaySeconds = 3) {
  return command(`mp_restartround ${delaySeconds}`);
}

async function changeMode(gameType, gameMode, currentMap) {
  await setConvar('game_type', gameType);
  await setConvar('game_mode', gameMode);
  return changeMap(currentMap);
}

async function pauseMatch() {
  return command('mp_pause_match');
}

async function unpauseMatch() {
  return command('mp_unpause_match');
}

async function quit() {
  return command('quit');
}

async function status() {
  return command('status');
}

module.exports = {
  isConfigured,
  command,
  setConvar,
  changeMap,
  restartMatch,
  restartRound,
  changeMode,
  pauseMatch,
  unpauseMatch,
  quit,
  status,
  RconUnavailableError,
};
