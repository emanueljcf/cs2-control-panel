// Wrapper fino sobre o protocolo Source RCON. Todas as ações aqui são "ao
// vivo": nunca desconectam jogadores nem tocam no processo cs2.exe.
const Rcon = require('rcon-srcds').default || require('rcon-srcds');
const settingsStore = require('./settingsStore');
const registry = require('./convarRegistry');
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

// Ao vivo: zera o placar e reinicia a partida já a jogar (mp_restartgame),
// e de seguida passa por um breve aquecimento antes de retomar - não é um
// aquecimento completo desde o inicio (ver resetToWarmup para isso).
async function restartMatch(delaySeconds = 3) {
  await command(`mp_restartgame ${delaySeconds}`);
  return command('mp_warmup_start');
}

async function restartRound(delaySeconds = 3) {
  return command(`mp_restartround ${delaySeconds}`);
}

// Ao vivo: restaura o backup nativo de uma ronda anterior (ver
// convarRegistry mp_backup_round_file + src/core/roundBackups.js) - repõe
// placar/dinheiro/equipamento tal como estavam logo depois dessa ronda ter
// terminado, e o jogo continua a partir daí. É assim que se "reverte" N
// rondas: carrega-se o backup de (ronda atual - N).
async function restoreRoundBackup(filename) {
  return command(`mp_backup_restore_load_file "${filename}"`);
}

// Ao vivo: devolve o jogo ao INÍCIO de um aquecimento completo (não ao fim),
// tal como um mapa recém-carregado. Importante: NÃO se pode combinar com um
// mp_restartgame com atraso (ex. "mp_restartgame 1") - esse atraso dispara 1
// segundo depois e corta o aquecimento recém-iniciado quase de imediato,
// fazendo-o parecer que salta logo para o fim (bug confirmado nesta sessão).
// Em vez disso, usa-se o comportamento documentado de mp_warmuptime:
// "Changing this value resets warmup" - força a mudança (passa por um valor
// intermédio) para garantir que o motor deteta a alteração e reinicia o
// temporizador ao valor completo configurado, mesmo que o valor final seja
// igual ao que já estava. Com a houseRule mp_endwarmup_player_count, o jogo
// só volta a arrancar a sério quando esse nº de jogadores estiver ligado.
async function resetToWarmup() {
  const server = settingsStore.getServer();
  const warmupTime = server.houseRules?.mp_warmuptime ?? registry.get('mp_warmuptime').default;
  await command('mp_warmup_start');
  await setConvar('mp_warmuptime', 1);
  return setConvar('mp_warmuptime', warmupTime);
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

// Melhor esforço: remove um id da lista de banidos em memória e persiste.
// Só funciona se "id" corresponder exatamente ao que o motor guardou - não
// há comando nativo para confirmar isso de antemão.
async function unbanId(id) {
  await command(`removeid ${id}`);
  return command('writeid');
}

// Ao vivo: não existe comando nativo para mudar um bot de equipa mantendo a
// identidade - a única forma e expulsa-lo e pedir um novo bot nessa equipa
// (fica com nome novo, atribuido pelo motor). Jogadores humanos NAO têm
// equivalente: o motor não expõe nenhum comando de servidor para forçar a
// equipa de um jogador ligado (confirmado via "find jointeam/changeteam/
// switchteam/forceteam/movetoteam" - todos sem resultados). Isso só seria
// possível com um plugin de administração (MatchZy/CS2Fixes via
// MetaMod+CounterStrikeSharp), que nesta instalação está incompativel com a
// build atual do motor (crash confirmado em sessão anterior).
async function moveBotToTeam(name, team) {
  await command(`bot_kick ${name}`);
  return command(team === 'ct' ? 'bot_add_ct' : 'bot_add_t');
}

module.exports = {
  isConfigured,
  command,
  setConvar,
  changeMap,
  restartMatch,
  restartRound,
  restoreRoundBackup,
  resetToWarmup,
  changeMode,
  pauseMatch,
  unpauseMatch,
  quit,
  status,
  getPlayers,
  kickPlayer,
  banPlayer,
  unbanId,
  moveBotToTeam,
  parsePlayers,
  RconUnavailableError,
};
