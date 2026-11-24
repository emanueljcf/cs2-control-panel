@echo off
setlocal

REM --- CS2 Control Panel - lancador para esta maquina (producao) ---
REM Corre sempre a partir da pasta onde este ficheiro esta.
cd /d "%~dp0"

REM Garante privilegios de administrador (precisos para a gestao da firewall).
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo A pedir privilegios de administrador...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

set NODE_ENV=production

echo A arrancar o CS2 Control Panel (e o servidor CS2, se nao estiver a correr)...
start "" /min node "src\server.js"

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
