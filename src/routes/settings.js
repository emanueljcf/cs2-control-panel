const express = require('express');
const registry = require('../core/convarRegistry');
const settingsStore = require('../core/settingsStore');
const cfgGenerator = require('../core/cfgGenerator');
const rcon = require('../core/rcon');
const processManager = require('../core/processManager');

const router = express.Router();

router.get('/modes/:mode', (req, res) => {
  const { mode } = req.params;
  if (!registry.MODES.includes(mode)) return res.status(404).json({ error: 'modo-desconhecido' });
  const modeData = settingsStore.getMode(mode);
  const server = settingsStore.getServer();
  const activePresetId = server.activeMode === mode ? server.activePresetId : null;
  const isCustom = !settingsStore.matchesPreset(mode, server.activeMode === mode ? activePresetId : null);
  res.json({
    fields: registry.forMode(mode),
    values: { ...modeData.overrides },
    raw: modeData.rawOverrides,
    activePresetId,
    isCustom,
  });
});

// PUT /api/settings/modes/:mode  body: { changes: {convar: valor, ...} }
router.put('/modes/:mode', async (req, res) => {
  const { mode } = req.params;
  if (!registry.MODES.includes(mode)) return res.status(404).json({ error: 'modo-desconhecido' });

  const changes = req.body?.changes || {};
  const modeData = settingsStore.getMode(mode);
  const server = settingsStore.getServer();
  const status = processManager.isRunning();
  const isActiveMode = server.activeMode === mode;
  const rconReady = status.running && rcon.isConfigured();

  const appliedLive = [];
  const pendingRestart = [];
  const pendingNextLoad = [];
  const warnings = [];

  settingsStore.mergeModeOverrides(modeData, changes);

  for (const [key, value] of Object.entries(changes)) {
    const liveApplicable = registry.isLiveApplicable(key);

    if (!liveApplicable) {
      pendingRestart.push(key);
      warnings.push(`${key}: esta alteração só é aplicada depois de reiniciar o servidor.`);
      continue;
    }
    if (!rconReady) {
      pendingRestart.push(key);
      warnings.push(`${key}: RCON indisponível — fica pendente até ativares RCON e reiniciares uma vez.`);
      continue;
    }
    if (!isActiveMode) {
      pendingNextLoad.push(key);
      continue;
    }
    try {
      await rcon.setConvar(key, value);
      appliedLive.push(key);
    } catch (err) {
      pendingRestart.push(key);
      warnings.push(`${key}: falhou a aplicação ao vivo (${err.message}).`);
    }
  }

  settingsStore.setMode(mode, modeData);
  const { targetPath, finalText } = cfgGenerator.generateMode(mode); // mantém o .cfg persistido em sincronia
  require('fs').writeFileSync(targetPath, finalText, 'utf8');

  res.json({ saved: true, appliedLive, pendingRestart, pendingNextLoad, warnings });
});

router.post('/apply', (req, res) => {
  const dryRun = req.query.dryRun === 'true';
  const results = cfgGenerator.applyAll({ write: !dryRun });
  res.json({
    written: !dryRun,
    files: results.map((r) => ({ type: r.type, mode: r.mode, path: r.targetPath, preview: dryRun ? r.finalText : undefined })),
  });
});

module.exports = router;
