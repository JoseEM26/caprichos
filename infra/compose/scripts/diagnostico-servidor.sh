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
echo "OK: diagnóstico terminado (solo lectura)."
