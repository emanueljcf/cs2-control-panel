const express = require('express');
const settingsStore = require('../core/settingsStore');
const cfgGenerator = require('../core/cfgGenerator');
const rcon = require('../core/rcon');
const processManager = require('../core/processManager');
const fs = require('fs');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ presets: settingsStore.getPresets() });
});

// Guarda os overrides ATUAIS de um modo como um novo preset com nome.
router.post('/', (req, res) => {
  const { name, baseMode } = req.body || {};
  if (!name || !settingsStore.GAME_TYPE_MODE[baseMode]) {
    return res.status(400).json({ error: 'name-e-baseMode-obrigatorios' });
  }
  const modeData = settingsStore.getMode(baseMode);
  const preset = settingsStore.savePreset({ name, baseMode, overrides: modeData.overrides, rawOverrides: modeData.rawOverrides });

  const server = settingsStore.getServer();
  if (server.activeMode === baseMode) {
    server.activePresetId = preset.id;
    settingsStore.setServer(server);
  }
  res.json({ saved: true, preset });
});

router.delete('/:id', (req, res) => {
  settingsStore.deletePreset(req.params.id);
  res.json({ ok: true });
});

// Aplica um preset guardado: copia os overrides para o modo base, torna-o o
// modo ativo, e tenta ao vivo via RCON (mesma política de mode/change).
router.post('/:id/apply', async (req, res) => {
  const preset = settingsStore.getPreset(req.params.id);
  if (!preset) return res.status(404).json({ error: 'preset-nao-encontrado' });

  const modeData = settingsStore.getMode(preset.baseMode);
  modeData.overrides = { ...preset.overrides };
  modeData.rawOverrides = { ...preset.rawOverrides };
  settingsStore.setMode(preset.baseMode, modeData);

  const { targetPath, finalText } = cfgGenerator.generateMode(preset.baseMode);
  fs.writeFileSync(targetPath, finalText, 'utf8');

  const server = settingsStore.getServer();
  const status = processManager.isRunning();
  const { gameType, gameMode } = settingsStore.GAME_TYPE_MODE[preset.baseMode];

  let live = false;
  let warning;
  if (status.running && rcon.isConfigured()) {
    try {
      await rcon.changeMode(gameType, gameMode, server.activeMap);
      live = true;
    } catch (err) {
      warning = `Aplicação ao vivo falhou (${err.message}) — fica pendente para o próximo restart.`;
    }
  } else {
    warning = 'Servidor parado ou RCON não configurado — fica pendente para o próximo arranque.';
  }

  server.activeMode = preset.baseMode;
  server.activePresetId = preset.id;
  settingsStore.setServer(server);

  res.json({ applied: true, live, warning });
});

module.exports = router;
