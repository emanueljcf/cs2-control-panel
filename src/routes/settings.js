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
  const server = settingsStore.getServer();
  const activePresetId = server.activeMode === mode ? server.activePresetId : null;
  // Competitivo/Casual/Deathmatch/Custom nunca têm overrides próprios
  // persistidos - os valores mostrados vêm sempre do preset ativo (se
  // houver) ou do standard puro.
  const { overrides, rawOverrides } = settingsStore.getEffectiveOverrides(mode);
  res.json({
    fields: registry.forMode(mode),
    values: { ...overrides },
    raw: rawOverrides,
    activePresetId,
  });
});

// POST /api/settings/modes/:mode/apply-live  body: { changes: {convar: valor, ...} }
// Aplica SÓ ao vivo via RCON, sem persistir em disco (ephemeral): se o
// servidor reiniciar sem isto ter sido guardado como preset com nome,
// perde-se - exatamente como pedido. Nunca escreve em <mode>.json.
router.post('/modes/:mode/apply-live', async (req, res) => {
  const { mode } = req.params;
  if (!registry.MODES.includes(mode)) return res.status(404).json({ error: 'modo-desconhecido' });

  const changes = req.body?.changes || {};
  const server = settingsStore.getServer();
  const status = processManager.isRunning();
  const isActiveMode = server.activeMode === mode;
  const rconReady = status.running && rcon.isConfigured();

  const appliedLive = [];
  const notApplied = [];
  const warnings = [];

  for (const [key, value] of Object.entries(changes)) {
    // Convars registados respeitam a flag liveApplicable; convars "avançados"
    // (fora do registry) são tentados ao vivo na mesma - confia-se no admin
    // que os está a escrever à mão.
    const entry = registry.get(key);
    const liveApplicable = entry ? entry.liveApplicable : true;

    if (!liveApplicable) {
      notApplied.push(key);
      warnings.push(`${key}: este campo nunca é aplicável em runtime (precisa sempre de reiniciar).`);
      continue;
    }
    if (!rconReady) {
      notApplied.push(key);
      warnings.push(`${key}: RCON indisponível — ativa-o e reinicia uma vez para poder aplicar ao vivo.`);
      continue;
    }
    if (!isActiveMode) {
      notApplied.push(key);
      warnings.push(`${key}: "${mode}" não é o modo ativo agora — nada para aplicar ao vivo.`);
      continue;
    }
    try {
      await rcon.setConvar(key, value);
      appliedLive.push(key);
    } catch (err) {
      notApplied.push(key);
      warnings.push(`${key}: falhou a aplicação ao vivo (${err.message}).`);
    }
  }

  res.json({ appliedLive, notApplied, warnings, ephemeral: true });
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
