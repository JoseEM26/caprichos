#!/usr/bin/env bash
# ==============================================================================
# instalar-monitor.sh — Instala o actualiza Uptime Kuma en /opt/caprichos/monitor
# ==============================================================================
# Uso (en el VPS):  ./instalar-monitor.sh
# Idempotente: si ya existe, solo asegura que esté arriba. Escucha únicamente en 127.0.0.1:3001.
# No toca la demo ni producción.
# ==============================================================================
set -euo pipefail

ORIGEN="/opt/caprichos/monitor-nuevo/docker-compose.yml"
DESTINO="/opt/caprichos/monitor"
[[ -f "$ORIGEN" ]] || { echo "ERROR: no llegó el compose del monitor (${ORIGEN})." >&2; exit 1; }

mkdir -p "$DESTINO"
cp "$ORIGEN" "${DESTINO}/docker-compose.yml"
cd "$DESTINO"
docker compose up -d

for _ in $(seq 1 30); do
  codigo=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:3001/ || true)
  if [[ "$codigo" == "200" || "$codigo" == "302" ]]; then
    echo "OK: Uptime Kuma responde en 127.0.0.1:3001 (solo desde el servidor)."
    echo "Para abrirlo: ssh -L 3001:127.0.0.1:3001 <usuario>@<servidor> y luego http://localhost:3001"
    exit 0
  fi
  sleep 2
done
echo "ERROR: Uptime Kuma no respondió a tiempo." >&2
docker compose logs --tail 20 >&2 || true
exit 1
