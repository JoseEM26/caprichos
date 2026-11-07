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

source "$(dirname "$0")/lib-restauracion.sh"
pg_temporal_iniciar "$C"
pg_temporal_restaurar "$C" "$DUMP" || exit 1
pg_temporal_resumen "$C"
echo "OK: el respaldo se restaura sin errores. La base temporal se eliminó."
