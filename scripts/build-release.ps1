<#
  Monta uma release "um-clique" do CS2 Control Panel:
  - Node.js portátil (não precisa de estar instalado na máquina de destino)
  - Código da app + dependências (npm install --production)
  - SteamCMD incluído
  - Iniciar.bat / Instalar-Servidor-CS2.bat

  Não toca no servidor de produção (C:\cs2server) nem no painel em execução -
  monta tudo numa pasta "dist\" à parte.

  Uso: powershell -File scripts\build-release.ps1
#>

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$DistRoot = Join-Path $ProjectRoot 'dist'
$ReleaseDir = Join-Path $DistRoot 'release'
$NodeVersion = 'v26.13.1'
$NodeZipName = "node-$NodeVersion-win-x64.zip"
$NodeZipUrl = "https://nodejs.org/dist/$NodeVersion/$NodeZipName"
$CacheDir = Join-Path $DistRoot '.cache'

Write-Host "== CS2 Control Panel - build da release ==" -ForegroundColor Cyan

if (Test-Path $ReleaseDir) {
    Write-Host "A limpar release anterior..."
    Remove-Item $ReleaseDir -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $ReleaseDir | Out-Null
New-Item -ItemType Directory -Force -Path $CacheDir | Out-Null

# --- 1. Node.js portátil ---
$nodeZipPath = Join-Path $CacheDir $NodeZipName
if (-not (Test-Path $nodeZipPath)) {
    Write-Host "A descarregar Node.js portátil ($NodeVersion)..."
    Invoke-WebRequest -Uri $NodeZipUrl -OutFile $nodeZipPath
} else {
    Write-Host "Node.js portátil já em cache."
}
$nodeExtractTmp = Join-Path $CacheDir "node-extract-tmp"
if (Test-Path $nodeExtractTmp) { Remove-Item $nodeExtractTmp -Recurse -Force }
Expand-Archive -Path $nodeZipPath -DestinationPath $nodeExtractTmp -Force
$nodeInnerDir = Get-ChildItem $nodeExtractTmp -Directory | Select-Object -First 1
Move-Item $nodeInnerDir.FullName (Join-Path $ReleaseDir 'node-runtime')
Remove-Item $nodeExtractTmp -Recurse -Force
Write-Host "Node.js portátil pronto." -ForegroundColor Green

# --- 2. Código da app ---
Write-Host "A copiar código da app..."
$appDir = Join-Path $ReleaseDir 'app'
New-Item -ItemType Directory -Force -Path $appDir | Out-Null
foreach ($item in @('src', 'public', 'package.json', 'package-lock.json', 'README.md')) {
    Copy-Item (Join-Path $ProjectRoot $item) (Join-Path $appDir $item) -Recurse -Force
}
# config: só os templates/gamemodes/presets "de fábrica" - nunca o
# server.*.json/auth.json/state de uma instalação já em uso.
$configSrc = Join-Path $ProjectRoot 'config'
$configDst = Join-Path $appDir 'config'
New-Item -ItemType Directory -Force -Path $configDst | Out-Null
foreach ($item in @('templates', 'gamemodes', 'presets.json')) {
    Copy-Item (Join-Path $configSrc $item) (Join-Path $configDst $item) -Recurse -Force
}
New-Item -ItemType Directory -Force -Path (Join-Path $appDir 'state') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $appDir 'backups') | Out-Null

Write-Host "A instalar dependências (npm install --omit=dev)..."
$nodeRuntimeDir = Join-Path $ReleaseDir 'node-runtime'
Push-Location $appDir
$oldPath = $env:PATH
try {
    # O npm.cmd portátil invoca "node" (sem caminho) para correr scripts de
    # build nativos (ex. bcrypt) - tem de estar no PATH desta sessão.
    $env:PATH = "$nodeRuntimeDir;$env:PATH"
    & (Join-Path $nodeRuntimeDir 'npm.cmd') install --omit=dev --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw "npm install falhou (exit $LASTEXITCODE)" }
} finally {
    $env:PATH = $oldPath
    Pop-Location
}
Write-Host "Dependências instaladas." -ForegroundColor Green

# --- 3. SteamCMD ---
Write-Host "A incluir o SteamCMD..."
$toolsDir = Join-Path $ReleaseDir 'tools'
New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null
$steamcmdCache = Join-Path $CacheDir 'steamcmd.zip'
if (-not (Test-Path $steamcmdCache)) {
    Invoke-WebRequest -Uri 'https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip' -OutFile $steamcmdCache
}
Expand-Archive -Path $steamcmdCache -DestinationPath $toolsDir -Force

# --- 4. Lançadores ---
Copy-Item (Join-Path $ProjectRoot 'release-assets\Iniciar.bat') (Join-Path $ReleaseDir 'Iniciar.bat') -Force
Copy-Item (Join-Path $ProjectRoot 'release-assets\Instalar-Servidor-CS2.bat') (Join-Path $ReleaseDir 'Instalar-Servidor-CS2.bat') -Force
Copy-Item (Join-Path $ProjectRoot 'release-assets\LEIA-ME.txt') (Join-Path $ReleaseDir 'LEIA-ME.txt') -Force -ErrorAction SilentlyContinue

# --- 5. Compactar para distribuição ---
$zipPath = Join-Path $DistRoot 'cs2-control-panel-release.zip'
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Write-Host "A compactar para $zipPath ..."
Compress-Archive -Path (Join-Path $ReleaseDir '*') -DestinationPath $zipPath -CompressionLevel Optimal

Write-Host ""
Write-Host "== Release pronta ==" -ForegroundColor Cyan
Write-Host "Pasta: $ReleaseDir"
Write-Host "Zip:   $zipPath"
Write-Host "Passos para quem for usar: 1) Instalar-Servidor-CS2.bat  2) Iniciar.bat"
