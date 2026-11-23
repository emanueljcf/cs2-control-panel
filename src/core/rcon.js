// Wrapper fino sobre o protocolo Source RCON. Todas as ações aqui são "ao
// vivo": nunca desconectam jogadores nem tocam no processo cs2.exe.
const os = require('os');
const Rcon = require('rcon-srcds').default || require('rcon-srcds');
const settingsStore = require('./settingsStore');

const TIMEOUT_MS = 3000;

// O motor do CS2 liga o socket de RCON (TCP) ao IP da rede local da
// máquina, não a 127.0.0.1 — confirmado nesta sessão (Test-NetConnection a
// 127.0.0.1 falha, ao IP da LAN funciona). Por isso ligamos sempre ao IP
// IPv4 ativo e não-interno, nunca a localhost.
function lanHost() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1'; // fallback, não deverá ser necessário
}

function isConfigured() {
  const server = settingsStore.getServer();
  return Boolean(server.rcon_password);
}

async function withClient(fn) {
  const server = settingsStore.getServer();
  if (!server.rcon_password) {
    throw new RconUnavailableError('rcon_password não está definido — ativa o RCON e reinicia uma vez.');
  }
  const client = new Rcon({ host: lanHost(), port: server.port, timeout: TIMEOUT_MS });
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
  quit,
  status,
  RconUnavailableError,
};
