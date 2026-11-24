// Le os backups de ronda que o proprio motor do CS2 grava em disco (um por
// ronda terminada, ver convar mp_backup_round_file em convarRegistry.js) -
// e a unica fonte real de "reverter rondas": o painel nao tem acesso ao
// estado de jogo (posicoes, dinheiro, equipamento) senao atraves disto.
const fs = require('fs');
const path = require('path');
const paths = require('../config/paths');
const registry = require('./convarRegistry');
const settingsStore = require('./settingsStore');

function getPrefix() {
  const server = settingsStore.getServer();
  // "??" (não "||"): uma string vazia explícita significa que o admin
  // desligou os backups de propósito - não deve cair no default.
  const configured = server.houseRules?.mp_backup_round_file;
  return configured ?? registry.get('mp_backup_round_file').default;
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Não sabemos ao certo o padrão exato de nome gerado pelo motor (pode levar
// o nome do mapa a meio - ver mp_backup_round_file_pattern), por isso
// aceita-se qualquer ficheiro que comece pelo prefixo configurado e cujo
// último grupo de dígitos antes da extensão seja o número da ronda. Esse
// número só serve para apresentação (ver nota abaixo sobre ordenação).
//
// Ordenado por mtime (data de modificação), não pelo número de ronda: o
// motor nunca apaga estes ficheiros sozinho, por isso uma partida/mapa
// anterior pode deixar números de ronda mais altos do que os da partida
// atual. Ordenar por número de ronda faria "a ronda mais recente" apontar
// para outro jogo. mtime reflete sempre a ordem real em que os ficheiros
// foram escritos nesta sessão do servidor.
function list() {
  const prefix = getPrefix();
  if (!prefix) return [];

  let names;
  try {
    names = fs.readdirSync(paths.CS2_CSGO_DIR);
  } catch (_) {
    return [];
  }

  const pattern = new RegExp(`^${escapeRegExp(prefix)}.*?(\\d+)\\.[A-Za-z0-9]+$`, 'i');
  const backups = [];
  for (const name of names) {
    const match = name.match(pattern);
    if (!match) continue;
    let mtimeMs = 0;
    try {
      mtimeMs = fs.statSync(path.join(paths.CS2_CSGO_DIR, name)).mtimeMs;
    } catch (_) { /* ficheiro pode ter sido removido entre o readdir e o stat */ }
    backups.push({ round: Number(match[1]), file: name, mtimeMs });
  }
  backups.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return backups;
}

module.exports = { list, getPrefix };
