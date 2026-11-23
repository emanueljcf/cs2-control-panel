const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', envFile()) });

function envFile() {
  const env = process.env.NODE_ENV || 'development';
  return env === 'production' ? '.env.production' : '.env.development';
}

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const CS2_ROOT = process.env.CS2_ROOT;
const CS2_GAME_PORT = Number(process.env.CS2_GAME_PORT || 27015);
const PANEL_PORT = Number(process.env.PANEL_PORT || 3000);

if (!CS2_ROOT) {
  throw new Error('CS2_ROOT não definido. Confirma que .env.development ou .env.production existe e tem CS2_ROOT.');
}

module.exports = {
  PROJECT_ROOT,
  CS2_ROOT,
  CS2_GAME_PORT,
  PANEL_PORT,
  CS2_EXE: path.join(CS2_ROOT, 'game', 'bin', 'win64', 'cs2.exe'),
  CS2_BIN_DIR: path.join(CS2_ROOT, 'game', 'bin', 'win64'),
  CS2_CFG_DIR: path.join(CS2_ROOT, 'game', 'csgo', 'cfg'),
  CS2_MAPCYCLE_FILE: path.join(CS2_ROOT, 'game', 'csgo', 'mapcycle.txt'),
  TEMPLATES_DIR: path.join(PROJECT_ROOT, 'config', 'templates'),
  GAMEMODES_DIR: path.join(PROJECT_ROOT, 'config', 'gamemodes'),
  SERVER_JSON: path.join(PROJECT_ROOT, 'config', 'server.json'),
  AUTH_JSON: path.join(PROJECT_ROOT, 'config', 'auth.json'),
  RUNTIME_JSON: path.join(PROJECT_ROOT, 'state', 'runtime.json'),
  BACKUPS_DIR: path.join(PROJECT_ROOT, 'backups', 'cfg-snapshots'),
};
