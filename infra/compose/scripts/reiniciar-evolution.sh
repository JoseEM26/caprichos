#!/usr/bin/env bash
# Recrea SOLO el contenedor evolution-api de un ambiente (demo|prod) con la imagen fijada, sin tocar sus volúmenes:
# la sesión de WhatsApp se conserva (no hay que volver a escanear el QR). Sirve cuando Evolution dice
# «open» pero deja de pasar al sistema los mensajes que recibe. Las claves nunca se imprimen.
set -euo pipefail
AMB="${1:?uso: reiniciar-evolution.sh demo|prod}"
sufijo=""; [[ "$AMB" == "prod" ]] && sufijo="-prod"
EVO_DIR="/opt/caprichos/evolution${sufijo}"
[[ -f "$EVO_DIR/evolution.env" ]] || { echo "ERROR: Evolution no está instalado en ${AMB}." >&2; exit 1; }
evo() { docker compose -p "caprichos-evolution${sufijo}" --env-file "$EVO_DIR/evolution.env" -f /opt/caprichos/compose/docker-compose.evolution.yml "$@"; }
ESTADO_JS='fetch("http://127.0.0.1:8080/instance/connectionState/caprichos",{headers:{apikey:process.env.AUTHENTICATION_API_KEY}}).then(r=>r.text()).then(t=>console.log(t)).catch(e=>console.log("ERR "+e.message))'
echo "==> Estado antes: $(evo exec -T evolution-api node -e "$ESTADO_JS" 2>&1 | tail -1)"
# Recrea el contenedor con la imagen fijada en el compose (si cambió la versión, la baja); los volúmenes se conservan
echo "==> Imagen fijada: $(grep -o 'evoapicloud/evolution-api:[^ ]*' /opt/caprichos/compose/docker-compose.evolution.yml)"
evo pull evolution-api >/dev/null 2>&1 || true
echo "==> Recreando evolution-api (${AMB})..."
evo up -d --no-deps --force-recreate evolution-api >/dev/null
for i in $(seq 1 24); do
  sleep 5
  e=$(evo exec -T evolution-api node -e "$ESTADO_JS" 2>/dev/null | tail -1 || true)
  if [[ "$e" == *'"open"'* ]]; then echo "==> Estado después (${i}x5 s): $e"; echo "OK: Evolution reiniciado y conectado."; exit 0; fi
done
echo "AVISO: tras 2 minutos el estado es: ${e:-sin respuesta}. Si dice close, hay que volver a vincular con el QR." >&2
exit 1
