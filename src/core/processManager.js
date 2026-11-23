const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const paths = require('../config/paths');
const settingsStore = require('./settingsStore');
const registry = require('./convarRegistry');
const firewall = require('./firewall');
const rcon = require('./rcon');

function readRuntime() {
  return settingsStore.readJson(paths.RUNTIME_JSON, null);
}

function writeRuntime(data) {
  settingsStore.atomicWriteJson(paths.RUNTIME_JSON, data);
}

function clearRuntime() {
  try { fs.unlinkSync(paths.RUNTIME_JSON); } catch (_) { /* já não existe */ }
}

function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (_) {
    return false;
  }
}

// Procura um cs2.exe a correr no sistema para ESTA instalação (filtra pelo
// caminho do executável configurado em CS2_ROOT), mesmo que não tenha sido
// lançado por esta app. CRÍTICO: nunca remover este filtro — numa máquina
// com várias instalações (ex. produção + teste), um cs2.exe de outra
// instalação NUNCA deve ser considerado "gerível" por esta instância da app,
// ou uma ação de stop/restart feita durante testes poderia desligar o
// servidor de produção por engano.
function findUnmanagedProcess() {
  try {
    const out = execFileSync('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-Command',
      "Get-CimInstance Win32_Process -Filter \"Name='cs2.exe'\" | Select-Object ProcessId,CommandLine,ExecutablePath | ConvertTo-Json",
    ], { encoding: 'utf8' });
    const trimmed = out.trim();
    if (!trimmed) return null;
    const parsed = JSON.parse(trimmed);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    const ourExe = paths.CS2_EXE.toLowerCase();
    const ourPortFlag = `-port ${settingsStore.getServer().port}`;
    const match = list.find((p) => {
      const exePath = (p.ExecutablePath || '').toLowerCase();
      const cmd = p.CommandLine || '';
      return exePath === ourExe || cmd.toLowerCase().includes(ourExe) || cmd.includes(ourPortFlag);
    });
    return match || null;
  } catch (_) {
    return null;
  }
}

function isRunning() {
  const runtime = readRuntime();
  if (runtime && isPidAlive(runtime.pid)) {
    return { running: true, managed: true, pid: runtime.pid, startedAt: runtime.startedAt, launchArgs: runtime.launchArgs };
  }
  if (runtime) clearRuntime(); // PID gravado mas morto

  const unmanaged = findUnmanagedProcess();
  if (unmanaged) {
    return { running: true, managed: false, pid: unmanaged.ProcessId, commandLine: unmanaged.CommandLine };
  }
  return { running: false, managed: false };
}

function adopt() {
  const unmanaged = findUnmanagedProcess();
  if (!unmanaged) throw new Error('Nenhum processo cs2.exe encontrado para adotar.');
  writeRuntime({ pid: unmanaged.ProcessId, startedAt: null, launchArgs: unmanaged.CommandLine, adopted: true });
  return { pid: unmanaged.ProcessId };
}

function buildLaunchArgs() {
  const server = settingsStore.getServer();
  const mode = settingsStore.getMode(server.activeMode);
  const { gameType, gameMode } = mode;

  const args = [
    '-dedicated', '-console', '-usercon',
    '-maxplayers', String(server.maxplayers),
    '+map', server.activeMap,
    '-port', String(server.port),
    '+sv_lan', String(server.sv_lan ? 1 : 0),
    '+game_type', String(gameType),
    '+game_mode', String(gameMode),
    '+hostname', server.hostname,
    '+sv_password', server.sv_password || '',
  ];
  if (server.rcon_password) {
    args.push('+rcon_password', server.rcon_password);
  }
  return args;
}

async function start() {
  const current = isRunning();
  if (current.running) {
    return { started: false, reason: 'already-running', ...current };
  }

  const fwResult = firewall.ensure();
  const args = buildLaunchArgs();

  const child = spawn(paths.CS2_EXE, args, {
    cwd: paths.CS2_BIN_DIR,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();

  writeRuntime({ pid: child.pid, startedAt: new Date().toISOString(), launchArgs: args, managed: true });

  return { started: true, pid: child.pid, firewall: fwResult };
}

async function stop({ timeoutMs = 8000 } = {}) {
  const current = isRunning();
  if (!current.running) return { stopped: false, reason: 'not-running' };

  if (rcon.isConfigured()) {
    try {
      await rcon.quit();
      await waitUntilStopped(timeoutMs);
      clearRuntime();
      return { stopped: true, method: 'rcon' };
    } catch (_) {
      // cai para taskkill abaixo
    }
  }

  try {
    execFileSync('taskkill.exe', ['/PID', String(current.pid)]);
  } catch (_) {
    // ignora, tenta forçar a seguir
  }
  const stillAlive = await waitUntilStopped(3000);
  if (stillAlive) {
    execFileSync('taskkill.exe', ['/PID', String(current.pid), '/F']);
    await waitUntilStopped(3000);
  }
  clearRuntime();
  return { stopped: true, method: 'taskkill' };
}

function waitUntilStopped(timeoutMs) {
  return new Promise((resolve) => {
    const start = Date.now();
    const interval = setInterval(() => {
      if (!isRunning().running) {
        clearInterval(interval);
        resolve(false);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        resolve(true); // ainda vivo, caller decide escalar
      }
    }, 300);
  });
}

async function restart() {
  await stop();
  return start();
}

module.exports = { isRunning, adopt, start, stop, restart, buildLaunchArgs, registry };
