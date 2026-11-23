const { execFileSync } = require('child_process');
const paths = require('../config/paths');
const settingsStore = require('./settingsStore');

function runPowerShell(script) {
  return execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8',
  });
}

// Idempotente: cria as regras Allow só se não existirem, e remove regras de
// bloqueio automáticas do Windows associadas ao cs2.exe (o bug encontrado
// nesta sessão: o Windows cria uma regra "Block" sozinho quando o processo é
// lançado sem interface para responder ao popup de segurança).
function ensure() {
  const port = settingsStore.getServer().port;
  const exe = paths.CS2_EXE.replace(/'/g, "''");

  const script = `
    $ErrorActionPreference = 'SilentlyContinue'
    if (-not (Get-NetFirewallRule -DisplayName "CS2 Panel TCP ${port}")) {
      New-NetFirewallRule -DisplayName "CS2 Panel TCP ${port}" -Direction Inbound -Protocol TCP -LocalPort ${port} -Action Allow | Out-Null
    }
    if (-not (Get-NetFirewallRule -DisplayName "CS2 Panel UDP ${port}")) {
      New-NetFirewallRule -DisplayName "CS2 Panel UDP ${port}" -Direction Inbound -Protocol UDP -LocalPort ${port} -Action Allow | Out-Null
    }
    Get-NetFirewallRule -Direction Inbound -Action Block -Enabled True |
      Where-Object {
        $f = Get-NetFirewallApplicationFilter -AssociatedNetFirewallRule $_ -ErrorAction SilentlyContinue
        $f -and $f.Program -eq '${exe}'
      } | Remove-NetFirewallRule
    Write-Output "OK"
  `;

  try {
    const out = runPowerShell(script);
    return { ok: out.includes('OK') };
  } catch (err) {
    return { ok: false, error: err.message, needsAdmin: true };
  }
}

module.exports = { ensure };
