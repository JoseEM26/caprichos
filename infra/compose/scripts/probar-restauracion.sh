#!/usr/bin/env bash
# ==============================================================================
# probar-restauracion.sh — Comprueba que el último respaldo de la base SIRVE de verdad
# ==============================================================================
# Uso (en el VPS):  ./probar-restauracion.sh <demo|prod>
# Restaura el respaldo más reciente de /opt/caprichos/respaldos/<ambiente> en un PostgreSQL temporal y
# aislado (nunca toca la base real), con ON_ERROR_STOP, y cuenta tablas y filas de tablas clave.
# El contenedor temporal se borra siempre. No imprime datos, solo conteos.
# ==============================================================================
set -euo pipefail
umask 077

AMBIENTE="${1:-}"
case "$AMBIENTE" in demo|prod) ;; *) echo "Uso: $0 <demo|prod>" >&2; exit 1 ;; esac

DIR="/opt/caprichos/respaldos/${AMBIENTE}"
[[ -d "$DIR" ]] || { echo "ERROR: no existe ${DIR}." >&2; exit 1; }
DUMP=$(ls -1t "${DIR}"/db_${AMBIENTE}_*.sql.gz 2>/dev/null | head -1 || true)
[[ -n "$DUMP" ]] || { echo "ERROR: no hay respaldos db_${AMBIENTE}_*.sql.gz en ${DIR}." >&2; exit 1; }

EDAD_H=$(( ( $(date +%s) - $(stat -c %Y "$DUMP") ) / 3600 ))
echo "== Prueba de restauración (${AMBIENTE}) =="
echo "Respaldo: $(basename "$DUMP") · $(du -h "$DUMP" | cut -f1) · hace ${EDAD_H} h"
[[ "$EDAD_H" -le 48 ]] || echo "AVISO: el respaldo más reciente tiene más de 48 horas."

C="caprichos-restore-test-$(date +%s)"
limpiar() { docker rm -f "$C" >/dev/null 2>&1 || true; }
trap limpiar EXIT

docker run -d --name "$C" -e POSTGRES_PASSWORD=test_restore_pwd -e POSTGRES_DB=restore_test -e POSTGRES_USER=restore_test \
  postgres:16-alpine >/dev/null
# La imagen de PostgreSQL arranca un servidor temporal para inicializar, lo apaga y arranca el definitivo:
# pg_isready ya responde en el temporal, así que se espera al SEGUNDO "ready to accept connections".
for _ in $(seq 1 60); do
  [[ "$(docker logs "$C" 2>&1 | grep -c 'ready to accept connections')" -ge 2 ]] \
    && docker exec "$C" pg_isready -U restore_test -d restore_test >/dev/null 2>&1 && break
  sleep 1
done

# El volcado asigna dueños (OWNER TO <usuario>); en la base temporal esos usuarios no existen y la restauración
# se detendría. Se crean vacíos, solo dentro del contenedor temporal.
for ROL in $(gzip -dc "$DUMP" | grep -oE 'OWNER TO [A-Za-z0-9_]+' | awk '{print $3}' | sort -u); do
  [[ "$ROL" == "restore_test" ]] && continue
  docker exec "$C" psql -U restore_test -d restore_test -c "CREATE ROLE \"${ROL}\" SUPERUSER" >/dev/null 2>&1 || true
done

echo "==> Restaurando en la base temporal..."
if ! gzip -dc "$DUMP" | docker exec -i "$C" psql -v ON_ERROR_STOP=1 -U restore_test -d restore_test >/dev/null 2>"/tmp/restore-err-$$.txt"; then
  echo "FALLA: la restauración dio errores. Primeras líneas:" >&2
  head -5 "/tmp/restore-err-$$.txt" >&2
  rm -f "/tmp/restore-err-$$.txt"
  exit 1
fi
rm -f "/tmp/restore-err-$$.txt"

consulta() { docker exec "$C" psql -U restore_test -d restore_test -tA -c "$1" 2>/dev/null || echo "?"; }
echo "Tablas en el esquema público: $(consulta "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")"
for t in parametro categoria producto user_account pedido; do
  echo "Filas en ${t}: $(consulta "SELECT count(*) FROM ${t}")"
done
echo "OK: el respaldo se restaura sin errores. La base temporal se eliminó."
