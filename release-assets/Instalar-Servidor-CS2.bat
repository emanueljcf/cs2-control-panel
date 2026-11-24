@echo off
setlocal
cd /d "%~dp0"

echo ===================================================================
echo  Instalar/atualizar o servidor dedicado CS2 (via SteamCMD, ~70GB)
echo  Pode demorar bastante tempo, dependendo da ligacao a internet.
echo ===================================================================
echo.

if not exist "tools\steamcmd.exe" (
    echo ERRO: nao encontrei tools\steamcmd.exe. A release esta incompleta.
    pause
    exit /b 1
)

"tools\steamcmd.exe" +force_install_dir "%~dp0cs2server" +login anonymous +app_update 730 validate +quit

echo.
echo Instalacao/atualizacao concluida. Abre o Iniciar.bat para arrancar o painel.
pause
