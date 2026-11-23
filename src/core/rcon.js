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

// Linha de um jogador real, ex:
//    2  01:23   45    0     active  12000 192.168.1.5:27005 'Nome do jogador'
// Linha de um bot, ex:
//    0      BOT    0    0     active      0 'Cavalry'
const PLAYER_LINE = /^\s*(\d+)\s+(BOT|[\d:]+)\s+(-?\d+)\s+(-?\d+)\s+(\S+)\s+(\d+)\s+(?:(\S+:\d+)\s+)?'(.*)'\s*$/;

function parsePlayers(statusText) {
  const players = [];
  for (const line of statusText.split('\n')) {
    const m = line.match(PLAYER_LINE);
    if (!m) continue;
    const [, userid, time, ping, loss, state, rate, address, name] = m;
    if (!name || state !== 'active') continue; // ignora ligações a meio do handshake (sem nome)
    players.push({
      userid,
      isBot: time === 'BOT',
      time: time === 'BOT' ? null : time,
      ping: Number(ping),
      loss: Number(loss),
      state,
      rate: Number(rate),
      address: address || null,
      name,
    });
  }
  return players;
}

// Ao vivo: lista de jogadores ligados agora (via "status"), incluindo bots.
async function getPlayers() {
  const text = await status();
  return parsePlayers(text);
}

// Ao vivo: kick imediato, sem banir. "reason" aparece ao jogador.
async function kickPlayer(userid, reason = 'Removido pelo administrador') {
  return command(`kickid ${userid} ${reason}`);
}

// Ao vivo: bane por N minutos (0 = permanente) e kicka de imediato; "writeid"
// persiste a lista de banidos em disco (banned_user.cfg) para sobreviver a
// um restart. Nota: em sv_lan 1, sem Steam real, a identidade do banido é o
// "uniqueid" local da sessão — pode não sobreviver a uma nova ligação da
// mesma pessoa se o motor atribuir um id diferente. É a limitação nativa do
// modo LAN, não desta app.
async function banPlayer(userid, minutes = 0, reason = 'Banido pelo administrador') {
  await command(`banid ${minutes} ${userid} kick`);
  return command('writeid');
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
  getPlayers,
  kickPlayer,
  banPlayer,
  parsePlayers,
  RconUnavailableError,
};
