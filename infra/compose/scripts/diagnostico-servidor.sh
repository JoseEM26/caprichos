#!/usr/bin/env bash
# ==============================================================================
# diagnostico-servidor.sh — Consumo del VPS y estado de respaldos (SOLO LECTURA)
# ==============================================================================
# Uso (en el VPS):  ./diagnostico-servidor.sh
# No cambia nada y no imprime secretos: solo cifras de CPU, memoria, disco, contenedores,
# tamaño de las bases y fecha de los últimos respaldos y tareas programadas.
# ==============================================================================
set -uo pipefail

linea() { echo "------------------------------------------------------------------------"; }

echo "== SERVIDOR =="
echo "Hora: $(date '+%F %T %Z') · Encendido hace: $(uptime -p)"
echo "CPUs: $(nproc) · Carga (1/5/15 min): $(cut -d' ' -f1-3 /proc/loadavg)"
free -h | awk 'NR==1{print "Memoria:   "$0} NR==2{print "           "$0} NR==3{print "Swap:      "$0}'
linea
echo "== DISCO =="
df -h / | awk 'NR==1||NR==2'
echo "Respaldos locales: $(du -sh /opt/caprichos/respaldos 2>/dev/null | cut -f1)"
echo "Docker (imágenes, volúmenes, caché):"
docker system df 2>/dev/null | sed 's/^/  /'
linea
echo "== CONTENEDORES (CPU y memoria ahora) =="
docker stats --no-stream --format '{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}' 2>/dev/null | column -t -s $'\t' | sed 's/^/  /'
echo ""
echo "Reinicios de contenedores (si alguno sube, algo se está cayendo):"
docker ps -a --format '{{.Names}}' 2>/dev/null | while read -r n; do
  r=$(docker inspect -f '{{.RestartCount}}' "$n" 2>/dev/null || echo "?")
  e=$(docker inspect -f '{{.State.Status}}' "$n" 2>/dev/null || echo "?")
  echo "  $n: estado=$e reinicios=$r"
done
linea
echo "== BASES DE DATOS =="
for AMB in prod demo; do
  C="caprichos-${AMB}-postgres"
  if docker ps --format '{{.Names}}' | grep -qx "$C"; then
    TAM=$(docker exec "$C" sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT pg_size_pretty(pg_database_size(current_database()))"' 2>/dev/null || echo "?")
    CON=$(docker exec "$C" sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT count(*) FROM pg_stat_activity"' 2>/dev/null || echo "?")
    echo "  ${AMB}: tamaño=${TAM} · conexiones activas=${CON}"
  else
    echo "  ${AMB}: contenedor de base no encontrado"
  fi
done
linea
echo "== RESPALDOS =="
for AMB in prod demo; do
  echo "  ${AMB}: últimos 3 volcados de base"
  ls -1t /opt/caprichos/respaldos/${AMB}/db_${AMB}_*.sql.gz 2>/dev/null | head -3 | while read -r f; do
    echo "    $(basename "$f") · $(du -h "$f" | cut -f1) · $(date -r "$f" '+%F %H:%M')"
  done
  [[ -n "$(ls -1 /opt/caprichos/respaldos/${AMB}/db_${AMB}_*.sql.gz 2>/dev/null)" ]] || echo "    (ninguno)"
done
echo ""
echo "Copia fuera del servidor (restic): $( [[ -f /opt/caprichos/restic.env ]] && echo 'CONFIGURADA' || echo 'NO configurada' )"
echo "Tareas programadas de respaldo:"
{ crontab -l 2>/dev/null; sudo -n crontab -l 2>/dev/null; ls /etc/cron.d 2>/dev/null; systemctl list-timers --no-pager 2>/dev/null | grep -i "caprichos\|respald" ; } | grep -iE "respald|caprichos" | sed 's/^/  /' || true
[[ -n "$( { crontab -l 2>/dev/null; systemctl list-timers --no-pager 2>/dev/null; } | grep -iE 'respaldar|caprichos' )" ]] || echo "  (no se encontró ninguna tarea programada visible para este usuario)"
linea
echo "== EVOLUTION (demo) =="
# Solo lectura. En un repositorio público: se ocultan números (6+ dígitos), tokens y textos de mensajes.
ocultar() { sed -E 's/[0-9]{6,}/<num>/g; s/(token|apikey|key)=[^&" ]+/\1=<oculto>/Ig; s/"(conversation|text|body)":"[^"]*"/"\1":"<texto>"/g'; }
EVO_DIR=/opt/caprichos/evolution
if [[ -f "$EVO_DIR/evolution.env" ]]; then
  evo() { docker compose -p caprichos-evolution --env-file "$EVO_DIR/evolution.env" -f /opt/caprichos/compose/docker-compose.evolution.yml "$@"; }
  evo ps --format 'table {{.Service}}\t{{.Image}}\t{{.Status}}' 2>&1 | ocultar
  DIAG_JS='
const k = process.env.AUTHENTICATION_API_KEY; const h = { apikey: k };
const j = (u) => fetch(u, { headers: h }).then(async (r) => r.status + " " + (await r.text()).slice(0, 600)).catch((e) => "ERR " + e.message);
(async () => {
  console.log("estado:", await j("http://127.0.0.1:8080/instance/connectionState/caprichos"));
  console.log("webhook instancia:", await j("http://127.0.0.1:8080/webhook/find/caprichos"));
  console.log("api salud desde evolution:", await fetch("http://api:3000/salud").then((r) => r.status).catch((e) => "ERR " + e.message));
  console.log("webhook GLOBAL url:", (process.env.WEBHOOK_GLOBAL_URL || "").replace(/\?.*/, "?<oculto>"), "enabled:", process.env.WEBHOOK_GLOBAL_ENABLED);
})();'
  evo exec -T evolution-api node -e "$DIAG_JS" 2>&1 | ocultar
  echo "-- últimos registros de Evolution --"
  evo logs --no-color --tail 60 evolution-api 2>&1 | ocultar | tail -60
else
  echo "  Evolution no instalado"
fi
API_DEMO=$(docker ps --format '{{.Names}}' | grep -E '^caprichos-demo-api' | head -1)
if [[ -n "$API_DEMO" ]]; then
  echo "-- registros de la API demo sobre WhatsApp/Evolution --"
  docker logs --since 2h "$API_DEMO" 2>&1 | grep -iE "evolution|webhook|whatsapp|omit|descart|lista blanca|chatbot|outbox" | ocultar | tail -60
fi
linea
echo "OK: diagnóstico terminado (solo lectura)."
