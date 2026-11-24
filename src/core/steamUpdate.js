const fs = require('fs');
const { execFile } = require('child_process');
const paths = require('../config/paths');
const processManager = require('./processManager');
const cfgGenerator = require('./cfgGenerator');

function getLocalBuildId() {
  if (!fs.existsSync(paths.APPMANIFEST_730)) return null;
  const text = fs.readFileSync(paths.APPMANIFEST_730, 'utf8');
  const m = text.match(/"buildid"\s*"(\d+)"/);
  return m ? m[1] : null;
}

// Consulta o Steam (login anónimo) pelo buildid atual do branch "public" -
// nunca descarrega nada, só lê informação. Confirmado nesta sessão: o
// "app_info_print" devolve uma árvore com "branches" { "public" { "buildid" ... } }.
function getRemoteBuildId() {
  return new Promise((resolve, reject) => {
    execFile(paths.STEAMCMD_EXE, ['+login', 'anonymous', '+app_info_print', '730', '+quit'], {
      timeout: 30000,
      maxBuffer: 20 * 1024 * 1024,
    }, (err, stdout) => {
      if (err && !stdout) return reject(err);
      const m = stdout.match(/"public"\s*\{\s*"buildid"\s*"(\d+)"/);
      if (!m) return reject(new Error('Não foi possível ler o buildid público do Steam.'));
      resolve(m[1]);
    });
  });
}

async function checkForUpdate() {
  const localBuildId = getLocalBuildId();
  const remoteBuildId = await getRemoteBuildId();
  return {
    localBuildId,
    remoteBuildId,
    upToDate: Boolean(localBuildId) && localBuildId === remoteBuildId,
  };
}

// Estado em memória do ciclo de atualização (stop -> steamcmd -> reaplicar
// configs -> start), para a UI conseguir mostrar progresso via polling.
let updateState = { running: false, phase: null, error: null, startedAt: null, finishedAt: null };

function getUpdateState() {
  return updateState;
}

function runSteamCmdUpdate() {
  return new Promise((resolve, reject) => {
    execFile(paths.STEAMCMD_EXE, [
      '+force_install_dir', paths.CS2_ROOT,
      '+login', 'anonymous',
      '+app_update', '730', 'validate',
      '+quit',
    ], { timeout: 20 * 60 * 1000, maxBuffer: 50 * 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout);
    });
  });
}

// [destrutivo] Para o servidor, atualiza via SteamCMD, reaplica as
// configurações (o validate repõe sempre os .cfg originais da Valve) e
// arranca outra vez. Corre em segundo plano - ver getUpdateState() para
// acompanhar o progresso.
async function runUpdate() {
  if (updateState.running) throw new Error('Já há uma atualização em curso.');
  updateState = { running: true, phase: 'stopping', error: null, startedAt: new Date().toISOString(), finishedAt: null };

  try {
    await processManager.stop();

    updateState.phase = 'downloading';
    await runSteamCmdUpdate();

    updateState.phase = 'reapplying-configs';
    cfgGenerator.applyAll({ write: true });

    updateState.phase = 'starting';
    await processManager.start();

    updateState.phase = 'done';
  } catch (err) {
    updateState.phase = 'error';
    updateState.error = err.message;
  } finally {
    updateState.running = false;
    updateState.finishedAt = new Date().toISOString();
  }
}

module.exports = { getLocalBuildId, getRemoteBuildId, checkForUpdate, runUpdate, getUpdateState };
