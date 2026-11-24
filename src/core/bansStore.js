const fs = require('fs');
const paths = require('../config/paths');
const settingsStore = require('./settingsStore');

// Histórico próprio de banimentos aplicados pelo painel. Não é o mesmo que
// o ban real do motor (esse vive em banned_user.cfg, sem comando nativo
// para o listar) - serve para o admin conseguir identificar e tentar
// desbanir alguém que já não está ligado.
function getLog() {
  return settingsStore.readJson(paths.BANS_LOG_JSON, []);
}

function addEntry(entry) {
  const log = getLog();
  log.unshift({ id: `ban-${Date.now()}`, liftedAt: null, ...entry });
  settingsStore.atomicWriteJson(paths.BANS_LOG_JSON, log);
  return log[0];
}

function markLifted(id) {
  const log = getLog();
  const entry = log.find((b) => b.id === id);
  if (entry) entry.liftedAt = new Date().toISOString();
  settingsStore.atomicWriteJson(paths.BANS_LOG_JSON, log);
  return entry;
}

function rawBannedUserCfgExists() {
  return fs.existsSync(paths.CS2_BANNED_USER_CFG);
}

function readRawBannedFiles() {
  const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);
  return {
    bannedUser: read(paths.CS2_BANNED_USER_CFG),
    bannedIp: read(paths.CS2_BANNED_IP_CFG),
  };
}

// Rede de segurança: apaga os ficheiros de banimento do motor por completo.
// Não há como remover seletivamente sem saber o id exato persistido pelo
// motor, por isso isto é "limpar tudo", não "limpar um".
function clearAllEngineBans() {
  for (const p of [paths.CS2_BANNED_USER_CFG, paths.CS2_BANNED_IP_CFG]) {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

module.exports = { getLog, addEntry, markLifted, rawBannedUserCfgExists, readRawBannedFiles, clearAllEngineBans };
