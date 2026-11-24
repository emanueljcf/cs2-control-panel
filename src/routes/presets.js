const express = require('express');
const settingsStore = require('../core/settingsStore');
const cfgGenerator = require('../core/cfgGenerator');
const rcon = require('../core/rcon');
const registry = require('../core/convarRegistry');
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

// Atualiza (overwrite) um preset já existente com as definições atuais do
// formulário - mesmo id/nome/baseMode, ao contrário de POST / que cria
// sempre um preset novo. Nunca usa changelevel (evita reiniciar o mapa para
// todos) - se este preset for o ativo agora, aplica cada convar ao vivo via
// "set", exatamente como o botão "Aplicar" de Definições por modo.
router.put('/:id', async (req, res) => {
  const existing = settingsStore.getPreset(req.params.id);
  if (!existing) return res.status(404).json({ error: 'preset-nao-encontrado' });

  const { overrides, rawOverrides } = req.body || {};
  const preset = settingsStore.updatePreset(req.params.id, { overrides, rawOverrides });

  const server = settingsStore.getServer();
  const isActivePreset = server.activeMode === existing.baseMode && server.activePresetId === existing.id;
  const appliedLive = [];
  const warnings = [];

  if (isActivePreset) {
    const { targetPath, finalText } = cfgGenerator.generateMode(existing.baseMode);
    fs.writeFileSync(targetPath, finalText, 'utf8');

    const status = processManager.isRunning();
    const rconReady = status.running && rcon.isConfigured();
    for (const [key, value] of Object.entries({ ...(overrides || {}), ...(rawOverrides || {}) })) {
      const entry = registry.get(key);
      const liveApplicable = entry ? entry.liveApplicable : true;
      if (!liveApplicable || !rconReady) continue;
      try {
        await rcon.setConvar(key, value);
        appliedLive.push(key);
      } catch (err) {
        warnings.push(`${key}: falhou a aplicação ao vivo (${err.message}).`);
      }
    }
    if (!rconReady) warnings.push('RCON indisponível — fica pronto para a próxima vez que este preset for aplicado.');
  }

  res.json({ saved: true, preset, live: isActivePreset, appliedLive, warnings });
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
