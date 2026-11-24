@echo off
setlocal

REM --- CS2 Control Panel - lancador da release ---
REM Corre sempre a partir da pasta onde este ficheiro esta.
cd /d "%~dp0"

REM Garante privilegios de administrador (precisos para a gestao da firewall).
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo A pedir privilegios de administrador...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

if not exist "node-runtime\node.exe" (
    echo ERRO: nao encontrei node-runtime\node.exe. A release esta incompleta.
    pause
    exit /b 1
)

REM Deixa um atalho no ambiente de trabalho a apontar para este ficheiro, para
REM depois de reiniciar o PC bastar um clique para religar tudo. So cria na
REM primeira vez (nao faz nada se o atalho ja existir).
powershell -NoProfile -Command "$p = Join-Path ([Environment]::GetFolderPath('Desktop')) 'CS2 Control Panel.lnk'; if (-not (Test-Path $p)) { $ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut($p); $s.TargetPath = '%~f0'; $s.WorkingDirectory = '%~dp0'; $s.WindowStyle = 7; $s.Description = 'Arranca o painel de controlo e o servidor CS2'; $s.Save() }"

set NODE_ENV=production
if not exist "app\.env.production" (
    echo Primeira utilizacao: a criar .env.production...
    (
        echo CS2_ROOT=%~dp0cs2server
        echo CS2_GAME_PORT=27015
        echo PANEL_PORT=3000
        echo SESSION_SECRET=%RANDOM%%RANDOM%%RANDOM%%RANDOM%
        echo NODE_ENV=production
    ) > "app\.env.production"
)

echo A arrancar o CS2 Control Panel...
start "" /min "node-runtime\node.exe" "app\src\server.js"

REM Espera a porta do painel ficar disponivel antes de abrir o browser.
set TENTATIVAS=0
:espera
timeout /t 1 /nobreak >nul
set /a TENTATIVAS+=1
powershell -NoProfile -Command "try { (Invoke-WebRequest -Uri 'http://127.0.0.1:3000' -UseBasicParsing -TimeoutSec 1) | Out-Null; exit 0 } catch { exit 1 }"
if %errorlevel% neq 0 (
    if %TENTATIVAS% lss 30 goto espera
)

start "" "http://127.0.0.1:3000"
echo.
echo O painel esta a correr. Podes fechar esta janela (o servidor continua em segundo plano);
echo para o desligar de vez, usa o botao "Parar servidor" no proprio painel, ou fecha o processo node.exe.
pause
