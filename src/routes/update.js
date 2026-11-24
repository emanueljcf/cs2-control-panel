const express = require('express');
const steamUpdate = require('../core/steamUpdate');

const router = express.Router();

// Só leitura - consulta o Steam, nunca descarrega nada.
router.get('/check', async (req, res) => {
  try {
    const result = await steamUpdate.checkForUpdate();
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// [destrutivo] Para o servidor, atualiza, reaplica configs, arranca outra
// vez - corre em segundo plano, ver /status para acompanhar.
router.post('/run', (req, res) => {
  if (steamUpdate.getUpdateState().running) {
    return res.status(409).json({ error: 'ja-em-curso' });
  }
  steamUpdate.runUpdate();
  res.json({ started: true });
});

router.get('/status', (req, res) => {
  res.json(steamUpdate.getUpdateState());
});

module.exports = router;
