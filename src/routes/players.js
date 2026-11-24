const express = require('express');
const rcon = require('../core/rcon');
const processManager = require('../core/processManager');
const bansStore = require('../core/bansStore');

const router = express.Router();

function liveOnly(handler) {
  return async (req, res) => {
    const status = processManager.isRunning();
    if (!status.running || !rcon.isConfigured()) {
      return res.status(409).json({
        error: 'Esta ação só funciona com o servidor a correr e o RCON ativo (ativa a password RCON e reinicia uma vez).',
      });
    }
    try {
      await handler(req, res);
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  };
}

router.get('/', liveOnly(async (req, res) => {
  const players = await rcon.getPlayers();
  res.json({ players });
}));

router.post('/:userid/kick', liveOnly(async (req, res) => {
  const { reason } = req.body || {};
  await rcon.kickPlayer(req.params.userid, reason);
  res.json({ applied: true });
}));

// Ao vivo, só para bots: expulsa o bot e pede um novo nessa equipa (fica com
// nome novo - o motor não permite "mudar" um bot existente de equipa
// mantendo a identidade). Não serve para jogadores humanos - ver nota em
// core/rcon.js (não há comando nativo para isso).
router.post('/bots/:name/move', liveOnly(async (req, res) => {
  const team = req.body?.team === 'ct' ? 'ct' : 't';
  await rcon.moveBotToTeam(req.params.name, team);
  res.json({ applied: true });
}));

router.post('/:userid/ban', liveOnly(async (req, res) => {
  const { minutes, reason, name, address } = req.body || {};
  await rcon.banPlayer(req.params.userid, Number(minutes) || 0, reason);
  const entry = bansStore.addEntry({
    userid: req.params.userid,
    name: name || null,
    address: address || null,
    reason: reason || null,
    minutes: Number(minutes) || 0,
    bannedAt: new Date().toISOString(),
  });
  res.json({ applied: true, entry });
}));

// Histórico de banimentos aplicados pelo painel (não é o mesmo que a lista
// real do motor - ver nota em bansStore.js).
router.get('/bans', (req, res) => {
  res.json({ bans: bansStore.getLog(), rawFileExists: bansStore.rawBannedUserCfgExists() });
});

// Melhor esforço: só desbane de facto se o id corresponder ao que o motor
// guardou internamente.
router.post('/bans/:id/unban', liveOnly(async (req, res) => {
  const log = bansStore.getLog();
  const entry = log.find((b) => b.id === req.params.id);
  if (!entry) return res.status(404).json({ error: 'entrada-nao-encontrada' });
  await rcon.unbanId(entry.userid);
  bansStore.markLifted(entry.id);
  res.json({ applied: true, warning: 'Tentativa feita via removeid — confirma no ficheiro bruto se queres ter a certeza.' });
}));

router.get('/bans/raw', (req, res) => {
  res.json(bansStore.readRawBannedFiles());
});

// Rede de segurança: limpa TODOS os banimentos do motor (ficheiros em
// disco). Usar quando não há certeza do id exato de uma entrada específica.
router.post('/bans/clear-all', (req, res) => {
  bansStore.clearAllEngineBans();
  res.json({ ok: true, warning: 'Ficheiros de banimento apagados. Pode ser preciso reiniciar o servidor para garantir que nenhum banimento antigo fica em memória.' });
});

module.exports = router;
