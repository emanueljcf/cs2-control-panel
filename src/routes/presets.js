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

// Guarda os valores ATUAIS DO FORMULÁRIO (enviados pelo cliente) como um novo
// preset com nome. Nunca lê nem escreve em <baseMode>.json - esse fica
// sempre puro. Se o modo-base for o modo ativo, este preset passa também a
// ser o que está (ou fica, no próximo arranque) a correr para esse modo.
router.post('/', async (req, res) => {
  const { name, baseMode, overrides, rawOverrides } = req.body || {};
  if (!name || !settingsStore.GAME_TYPE_MODE[baseMode]) {
    return res.status(400).json({ error: 'name-e-baseMode-obrigatorios' });
  }
  const preset = settingsStore.savePreset({ name, baseMode, overrides, rawOverrides });

  const server = settingsStore.getServer();
  let live = false;
  let warning;
  if (server.activeMode === baseMode) {
    server.activePresetId = preset.id;
    settingsStore.setServer(server);

    const { targetPath, finalText } = cfgGenerator.generateMode(baseMode);
    fs.writeFileSync(targetPath, finalText, 'utf8');

    const status = processManager.isRunning();
    if (status.running && rcon.isConfigured()) {
      try {
        const { gameType, gameMode } = settingsStore.GAME_TYPE_MODE[baseMode];
        await rcon.changeMode(gameType, gameMode, server.activeMap);
        live = true;
      } catch (err) {
        warning = `Guardado, mas a aplicação ao vivo falhou (${err.message}) — fica pronto para o próximo restart.`;
      }
    }
  }

  res.json({ saved: true, preset, live, warning });
});

router.delete('/:id', (req, res) => {
  settingsStore.deletePreset(req.params.id);
  res.json({ ok: true });
});

// Aplica um preset guardado: torna-o o preset ativo do seu modo-base (nunca
// escreve em <baseMode>.json - fica sempre puro) e tenta ao vivo via RCON.
router.post('/:id/apply', async (req, res) => {
  const preset = settingsStore.getPreset(req.params.id);
  if (!preset) return res.status(404).json({ error: 'preset-nao-encontrado' });

  const server = settingsStore.getServer();
  server.activeMode = preset.baseMode;
  server.activePresetId = preset.id;
  settingsStore.setServer(server);

  const { targetPath, finalText } = cfgGenerator.generateMode(preset.baseMode);
  fs.writeFileSync(targetPath, finalText, 'utf8');

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

  res.json({ applied: true, live, warning });
});

module.exports = router;
