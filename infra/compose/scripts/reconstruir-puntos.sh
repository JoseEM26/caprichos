#!/usr/bin/env bash
# ==============================================================================
# reconstruir-puntos.sh — Reconstrucción de puntos por ventas anteriores (script de consola de la API)
# ==============================================================================
# Uso:  ./reconstruir-puntos.sh <demo|prod> <si|no>
#   segundo argumento: si = --aplicar (acredita de verdad); no = simulacro (no escribe)
# Corre: node dist/scripts/reconstruir-puntos.js [--aplicar]
# Usa la imagen de la API ya desplegada en el ambiente: despliegue primero la versión que trae el script.
# Pruebas: CAPRICHOS_RAIZ apunta a otra raíz.
# ==============================================================================

set -euo pipefail
umask 077

AMBIENTE="${1:-}"
APLICAR="${2:-no}"
RAIZ="${CAPRICHOS_RAIZ:-/opt/caprichos}"

case "$AMBIENTE" in
  demo|prod) ;;
  *) echo "ERROR: ambiente '${AMBIENTE}' no válido (use demo o prod)." >&2; exit 1 ;;
esac
case "$APLICAR" in
  si|no) ;;
  *) echo "ERROR: el segundo argumento debe ser si o no (recibido: '${APLICAR}')." >&2; exit 1 ;;
esac

ENV_FILE="${RAIZ}/${AMBIENTE}/.env"
COMPOSE_DIR="${RAIZ}/compose"
[[ -f "$ENV_FILE" ]] || { echo "ERROR: no existe ${ENV_FILE}." >&2; exit 1; }

FLAG=""
[[ "$APLICAR" == "si" ]] && FLAG="--aplicar"

echo "== Reconstrucción de puntos (${AMBIENTE}, $([[ "$APLICAR" == "si" ]] && echo APLICAR || echo SIMULACRO)) =="
if [[ "$APLICAR" == "si" && "$AMBIENTE" == "prod" ]]; then
  echo "AVISO: se acreditan puntos reales en PRODUCCIÓN (no se pueden deshacer en bloque; revise el simulacro antes)."
fi

RC=0
# $FLAG sin comillas a propósito: vacío no pasa argumento
# shellcheck disable=SC2086
docker compose --env-file "$ENV_FILE" -f "${COMPOSE_DIR}/docker-compose.base.yml" \
  -f "${COMPOSE_DIR}/docker-compose.${AMBIENTE}.yml" \
  run --rm -T -e ENTORNO_DATOS="$AMBIENTE" -e HOME=/tmp \
  api node dist/scripts/reconstruir-puntos.js $FLAG || RC=$?

exit "$RC"
