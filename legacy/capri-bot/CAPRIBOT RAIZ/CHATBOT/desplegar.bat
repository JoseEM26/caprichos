@echo off
chcp 65001 > NUL
title Desplegador Automatico Caprichos Bot - Oracle Cloud
echo ========================================================
echo   CAPRICHOS CAFETERIA - ACTUALIZANDO BOT EN ORACLE CLOUD
echo ========================================================
echo.

set SERVER_IP=147.15.95.200
set SERVER_USER=ubuntu
set KEY_FILE=ssh-key-2026-08-13.key

echo [1/3] Subiendo archivos actualizados del bot al servidor...
scp -i %KEY_FILE% -o StrictHostKeyChecking=no -r assets css js bot_wa.py bot.py prompt.py client_db.py geo_utils.py menu_dinamico.txt LIMITES_DELIVERY.geojson requirements.txt AGENTS.md sheet_sync.py index.html .env %SERVER_USER%@%SERVER_IP%:/home/ubuntu/chatbot/

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] No se pudieron subir los archivos por SCP. Verifica tu conexion a internet.
    pause
    exit /b 1
)

echo.
echo [2/3] Instalando dependencias y reiniciando el bot en la nube...
ssh -i %KEY_FILE% -o StrictHostKeyChecking=no %SERVER_USER%@%SERVER_IP% "cd /home/ubuntu/chatbot && source venv/bin/activate && pip install -r requirements.txt && sudo systemctl restart caprichos-bot"

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Hubo un problema reiniciando el servicio en el servidor.
    pause
    exit /b 1
)

echo.
echo ========================================================
echo   [OK] ¡BOT ACTUALIZADO Y CORRIENDO EN VIVO EN LA NUBE!
echo.
echo   - Servidor Webhook: http://%SERVER_IP%:8000/webhook
echo   - Panel de Monitoreo: http://%SERVER_IP%:8000/admin
echo ========================================================
echo.
pause                                                                           