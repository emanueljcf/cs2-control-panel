const express = require('express');
const fs = require('fs');
const processManager = require('../core/processManager');
const settingsStore = require('../core/settingsStore');
const registry = require('../core/convarRegistry');
const rcon = require('../core/rcon');
const cfgGenerator = require('../core/cfgGenerator');

const router = express.Router();

// [destrutivo] desliga todos os jogadores
router.post('/stop', async (req, res) => {
  res.json(await processManager.stop());
});

// [destrutivo] desliga todos os jogadores
router.post('/restart', async (req, res) => {
  res.json(await processManager.restart());
});

router.post('/start', async (req, res) => {
  res.json(await processManager.start());
});

router.get('/settings', (req, res) => {
  const server = settingsStore.getServer();
  res.json({
    ...server,
    sv_password: server.sv_password ? '••••••••' : '',
    rcon_password: server.rcon_password ? '••••••••' : '',
    houseRuleFields: registry.houseRules(),
  });
});

router.put('/settings', async (req, res) => {
  const server = settingsStore.getServer();
  const changes = req.body || {};
  const status = processManager.isRunning();
  const rconReady = status.running && rcon.isConfigured();

  const appliedLive = [];
  const pendingRestart = [];
  const warnings = [];
  let houseRuleChanged = false;

  for (const [key, value] of Object.entries(changes)) {
    if ((key === 'sv_password' || key === 'rcon_password') && value === '••••••••') {
      continue; // nunca sobrescrever com o placeholder mascarado
    }

    const entry = registry.get(key);
    const isHouseRule = Boolean(entry && entry.houseRule);

    if (isHouseRule) {
      server.houseRules = server.houseRules || {};
      server.houseRules[key] = value;
      houseRuleChanged = true;
    } else {
      server[key] = value;
    }

    const liveApplicable = entry ? entry.liveApplicable : false;

    if (liveApplicable && rconReady) {
      try {
        await rcon.setConvar(key, typeof value === 'string' ? `"${value}"` : value);
        appliedLive.push(key);
      } catch (err) {
        pendingRestart.push(key);
        warnings.push(`${key}: não foi possível aplicar ao vivo (${err.message}), fica para o próximo arranque.`);
      }
    } else if (!liveApplicable) {
      pendingRestart.push(key);
      warnings.push(`${key}: esta alteração só é aplicada depois de reiniciar o servidor.`);
    } else if (!rconReady) {
      pendingRestart.push(key);
      warnings.push(`${key}: RCON indisponível — fica pendente até ativares RCON e reiniciares uma vez.`);
    }
  }

  settingsStore.setServer(server);

  // server.cfg (hostname/rcon_password/etc.) fica sempre em sincronia.
  const serverCfg = cfgGenerator.generateServerCfg();
  fs.writeFileSync(serverCfg.targetPath, serverCfg.finalText, 'utf8');

  // Uma regra geral afeta os 4 modos - regenera todos os .cfg para ficarem
  // corretos no próximo load/restart, mesmo nos modos que não estão ativos.
  if (houseRuleChanged) {
    for (const mode of registry.MODES) {
      const { targetPath, finalText } = cfgGenerator.generateMode(mode);
      fs.writeFileSync(targetPath, finalText, 'utf8');
    }
  }

  res.json({ saved: true, appliedLive, pendingRestart, pendingNextLoad: [], warnings });
});

module.exports = router;
