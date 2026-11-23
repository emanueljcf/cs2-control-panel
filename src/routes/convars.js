const express = require('express');
const registry = require('../core/convarRegistry');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ convars: registry.CONVARS, modes: registry.MODES });
});

module.exports = router;
