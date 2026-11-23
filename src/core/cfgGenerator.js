const fs = require('fs');
const path = require('path');
const paths = require('../config/paths');
const registry = require('./convarRegistry');
const settingsStore = require('./settingsStore');

const GENERATED_HEADER = '// GERADO PELO CS2 CONTROL PANEL - NAO EDITAR MANUALMENTE\n// Alteracoes feitas aqui a mao sao substituidas na proxima vez que o painel gerar este ficheiro.\n\n';

function formatValue(key, value) {
  const entry = registry.get(key);
  const type = entry ? entry.type : typeof value === 'boolean' ? 'bool' : typeof value === 'number' ? 'float' : 'string';
  if (type === 'bool') return value ? '1' : '0';
  if (type === 'string') {
    const str = String(value);
    return /\s/.test(str) || str === '' ? `"${str}"` : str;
  }
  return String(value);
}

function snapshotBeforeOverwrite(targetPath) {
  if (!fs.existsSync(targetPath)) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(paths.BACKUPS_DIR, stamp);
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(targetPath, path.join(dir, path.basename(targetPath)));
}

function atomicWriteText(targetPath, content) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const tmp = `${targetPath}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, targetPath);
}

// Aplica overrides a um template .cfg linha a linha, preservando comentários e
// alinhamento onde possível. Chaves sem linha correspondente são acrescentadas
// no fim sob um comentário próprio.
function applyOverridesToTemplate(templateText, overrides, rawOverrides) {
  const allOverrides = { ...overrides, ...rawOverrides };
  const remainingKeys = new Set(Object.keys(allOverrides));
  const lines = templateText.split(/\r?\n/);

  const outLines = lines.map((line) => {
    const match = line.match(/^(\s*)([A-Za-z0-9_]+)(\s+)(\S+)(.*)$/);
    if (!match) return line;
    const [, indent, key, gap, , rest] = match;
    if (remainingKeys.has(key)) {
      remainingKeys.delete(key);
      const formatted = formatValue(key, allOverrides[key]);
      return `${indent}${key}${gap}${formatted}${rest}`;
    }
    return line;
  });

  if (remainingKeys.size > 0) {
    outLines.push('', '// CS2 Control Panel overrides');
    for (const key of remainingKeys) {
      outLines.push(`${key}\t\t\t\t\t\t\t\t\t${formatValue(key, allOverrides[key])}`);
    }
  }

  return outLines.join('\n');
}

function generateMode(mode) {
  const templatePath = path.join(paths.TEMPLATES_DIR, `gamemode_${mode}.cfg.base`);
  const targetPath = path.join(paths.CS2_CFG_DIR, `gamemode_${mode}.cfg`);
  const modeData = settingsStore.getMode(mode);

  const templateText = fs.readFileSync(templatePath, 'utf8');
  const body = applyOverridesToTemplate(templateText, modeData.overrides, modeData.rawOverrides);
  const finalText = GENERATED_HEADER + body;

  return { targetPath, finalText };
}

function generateServerCfg() {
  const templatePath = path.join(paths.TEMPLATES_DIR, 'server.cfg.base');
  const targetPath = path.join(paths.CS2_CFG_DIR, 'server.cfg');
  const server = settingsStore.getServer();

  const templateText = fs.readFileSync(templatePath, 'utf8');
  const overrides = { rcon_password: server.rcon_password || '' };
  let body = applyOverridesToTemplate(templateText, overrides, {});
  if (!body.includes('mapcyclefile')) {
    body += '\nmapcyclefile "mapcycle.txt"\n';
  }
  const finalText = GENERATED_HEADER + body;

  return { targetPath, finalText };
}

function generateMapcycle() {
  const server = settingsStore.getServer();
  const targetPath = paths.CS2_MAPCYCLE_FILE;
  const finalText = `${server.mapcycle.join('\n')}\n`;
  return { targetPath, finalText };
}

// write=false => dry-run: devolve o conteúdo gerado sem tocar em disco.
function applyAll({ write = true } = {}) {
  const results = [];
  for (const mode of registry.MODES) {
    results.push({ type: 'gamemode', mode, ...generateMode(mode) });
  }
  results.push({ type: 'server', ...generateServerCfg() });
  results.push({ type: 'mapcycle', ...generateMapcycle() });

  if (write) {
    for (const r of results) {
      snapshotBeforeOverwrite(r.targetPath);
      atomicWriteText(r.targetPath, r.finalText);
    }
  }

  return results;
}

module.exports = { applyAll, generateMode, generateServerCfg, generateMapcycle, formatValue };
