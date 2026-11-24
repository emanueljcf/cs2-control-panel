const express = require('express');
const rcon = require('../core/rcon');
const processManager = require('../core/processManager');
const roundBackups = require('../core/roundBackups');

const router = express.Router();

function liveOnly(handler) {
  return async (req, res) => {
    const status = processManager.isRunning();
    if (!status.running || !rcon.isConfigured()) {
      return res.status(409).json({
        applied: false,
        warning: 'Esta ação só funciona com o servidor a correr e o RCON ativo (ativa a password RCON e reinicia uma vez).',
      });
    }
    try {
      await handler(req, res);
    } catch (err) {
      res.status(502).json({ applied: false, error: err.message });
    }
  };
}

// Ao vivo: reinicia o match no mesmo mapa, zera o placar, ninguém é desconectado.
router.post('/restart', liveOnly(async (req, res) => {
  const delay = Number(req.body?.delaySeconds ?? 3);
  await rcon.restartMatch(delay);
  res.json({ applied: true, live: true });
}));

// Ao vivo: reinicia só a ronda atual.
router.post('/restart-round', liveOnly(async (req, res) => {
  const delay = Number(req.body?.delaySeconds ?? 3);
  await rcon.restartRound(delay);
  res.json({ applied: true, live: true });
}));

// Lista os backups de ronda disponíveis (um por ronda terminada, gravados
// automaticamente pelo motor - ver mp_backup_round_file), da mais recente
// para a mais antiga. Não exige o servidor a correr: útil para a UI mostrar
// o histórico mesmo parado.
router.get('/round-backups', (req, res) => {
  const backups = roundBackups.list();
  // maxRevertRounds: é preciso o backup ANTERIOR ao mais recente para poder
  // reverter 1 ronda - com só 1 backup na lista não há nenhum sítio para
  // onde voltar.
  res.json({
    backups,
    latestRound: backups.length ? backups[0].round : null,
    earliestRound: backups.length ? backups[backups.length - 1].round : null,
    maxRevertRounds: Math.max(0, backups.length - 1),
  });
});

// Ao vivo: reverte N rondas - repõe o estado logo depois da N-ésima ronda
// mais recente ter terminado (placar, dinheiro, equipamento) e o jogo
// continua a partir daí, como se as últimas N rondas nunca tivessem
// acontecido. O alvo é escolhido pela ORDEM dos backups (mais recente
// primeiro, ver roundBackups.list), nunca por aritmética sobre o número de
// ronda - ficheiros de partidas/mapas anteriores (nunca apagados pelo
// motor) podem ter números de ronda mais altos sem serem os mais recentes.
// Depende dos backups nativos do motor existirem para esse intervalo (ver
// convar houseRule "mp_backup_round_file" nas Definições).
router.post('/revert-rounds', liveOnly(async (req, res) => {
  const rounds = Number(req.body?.rounds ?? 1);
  if (!Number.isInteger(rounds) || rounds < 1) {
    return res.status(400).json({ applied: false, error: 'Número de rondas a reverter tem de ser um número inteiro >= 1.' });
  }

  const backups = roundBackups.list();
  if (backups.length === 0) {
    return res.status(409).json({
      applied: false,
      error: 'Ainda não há backups de ronda disponíveis. Confirma que a regra "Prefixo dos backups automáticos de ronda" está ativa nas Definições e que já terminou pelo menos uma ronda desde então.',
    });
  }

  const target = backups[rounds];
  if (!target) {
    const maxRevertRounds = backups.length - 1;
    return res.status(409).json({
      applied: false,
      error: maxRevertRounds > 0
        ? `Só há histórico para reverter até ${maxRevertRounds} ronda(s) a partir daqui.`
        : 'Só há um backup de ronda disponível - não há mais nenhum para onde voltar.',
    });
  }

  await rcon.restoreRoundBackup(target.file);
  res.json({ applied: true, live: true, revertedRounds: rounds, restoredToRound: target.round });
}));

// Ao vivo: reset completo - placar a zero e volta ao aquecimento, como se o
// mapa tivesse acabado de carregar (aguarda de novo a houseRule de nº de
// jogadores antes de o jogo arrancar sozinho).
router.post('/reset-to-warmup', liveOnly(async (req, res) => {
  await rcon.resetToWarmup();
  res.json({ applied: true, live: true });
}));

// Estado da pausa - vive só em memória deste processo (como o runtime do
// servidor); se o painel for reiniciado a meio de uma pausa temporizada,
// o temporizador perde-se e a pausa fica indeterminada até se despausar
// manualmente.
let pauseState = { paused: false, until: null, timer: null };

function clearPauseTimer() {
  if (pauseState.timer) clearTimeout(pauseState.timer);
  pauseState = { paused: false, until: null, timer: null };
}

router.get('/pause-state', (req, res) => {
  res.json({ paused: pauseState.paused, until: pauseState.until });
});

// Ao vivo: pausa o jogo na próxima freeze time. Sem durationSeconds = fica
// pausado indefinidamente até alguém clicar "Despausar". Com
// durationSeconds = retoma automaticamente passado esse tempo.
router.post('/pause', liveOnly(async (req, res) => {
  const durationSeconds = req.body?.durationSeconds ? Number(req.body.durationSeconds) : null;
  await rcon.pauseMatch();
  clearPauseTimer();
  pauseState.paused = true;

  if (durationSeconds && durationSeconds > 0) {
    pauseState.until = new Date(Date.now() + durationSeconds * 1000).toISOString();
    pauseState.timer = setTimeout(async () => {
      try { await rcon.unpauseMatch(); } catch (_) { /* servidor pode ja ter parado */ }
      clearPauseTimer();
    }, durationSeconds * 1000);
  } else {
    pauseState.until = null;
  }

  res.json({ applied: true, live: true, paused: true, until: pauseState.until });
}));

// Ao vivo: despausa manualmente (cancela qualquer temporizador pendente).
router.post('/unpause', liveOnly(async (req, res) => {
  await rcon.unpauseMatch();
  clearPauseTimer();
  res.json({ applied: true, live: true, paused: false });
}));

module.exports = router;
