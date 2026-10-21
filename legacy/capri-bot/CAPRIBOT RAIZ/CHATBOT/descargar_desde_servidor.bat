@echo off
chcp 65001 > NUL
title Descarga de Archivos - Caprichos Bot - Oracle Cloud
echo ========================================================
echo   CAPRICHOS CAFETERIA - SINCRONIZANDO DESDE EL SERVIDOR
echo ========================================================
echo.

set SERVER_IP=147.15.95.200
set SERVER_USER=ubuntu
set KEY_FILE=ssh-key-2026-08-13.key

echo [1/1] Descargando archivos del servidor a tu máquina local...
scp -i %KEY_FILE% -o StrictHostKeyChecking=no -r %SERVER_USER%@%SERVER_IP%:/home/ubuntu/chatbot/bot_wa.py %SERVER_USER%@%SERVER_IP%:/home/ubuntu/chatbot/bot.py %SERVER_USER%@%SERVER_IP%:/home/ubuntu/chatbot/prompt.py %SERVER_USER%@%SERVER_IP%:/home/ubuntu/chatbot/client_db.py %SERVER_USER%@%SERVER_IP%:/home/ubuntu/chatbot/geo_utils.py %SERVER_USER%@%SERVER_IP%:/home/ubuntu/chatbot/menu_dinamico.txt %SERVER_USER%@%SERVER_IP%:/home/ubuntu/chatbot/LIMITES_DELIVERY.geojson %SERVER_USER%@%SERVER_IP%:/home/ubuntu/chatbot/requirements.txt %SERVER_USER%@%SERVER_IP%:/home/ubuntu/chatbot/clientes.json %SERVER_USER%@%SERVER_IP%:/home/ubuntu/chatbot/chat_history.json %SERVER_USER%@%SERVER_IP%:/home/ubuntu/chatbot/user_sessions.json %SERVER_USER%@%SERVER_IP%:/home/ubuntu/chatbot/index.html %SERVER_USER%@%SERVER_IP%:/home/ubuntu/chatbot/css %SERVER_USER%@%SERVER_IP%:/home/ubuntu/chatbot/js %SERVER_USER%@%SERVER_IP%:/home/ubuntu/chatbot/AGENTS.md %SERVER_USER%@%SERVER_IP%:/home/ubuntu/chatbot/sheet_sync.py %SERVER_USER%@%SERVER_IP%:/home/ubuntu/chatbot/.env .

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] No se pudieron descargar los archivos por SCP. Verifica tu conexión o credenciales.
    pause
    exit /b 1
)

echo.
echo ========================================================
echo   [OK] ¡ARCHIVOS SINCRONIZADOS CORRECTAMENTE!
echo ========================================================
echo.
pause
