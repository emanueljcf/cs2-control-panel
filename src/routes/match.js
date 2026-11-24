const express = require('express');
const rcon = require('../core/rcon');
const processManager = require('../core/processManager');

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
