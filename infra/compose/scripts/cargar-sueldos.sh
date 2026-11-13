#!/usr/bin/env bash
# ==============================================================================
# cargar-sueldos.sh — Carga de sueldos en el ambiente (corre el script de consola de la API)
# ==============================================================================
# Uso:
#   echo "<CSV en base64>" | ./cargar-sueldos.sh <demo|prod> <si|no>
#     segundo argumento: si = --aplicar (escribe los sueldos); no = simulacro (no escribe)
#
# El CSV en base64 llega por stdin (una línea). No se escribe en disco ni va en la línea de comando:
# se exporta como variable de entorno y el contenedor la toma por nombre (-e SUELDOS_CSV_B64).
# Corre: node dist/scripts/cargar-sueldos.js --desde-env SUELDOS_CSV_B64 [--aplicar]
# El script nunca imprime documentos, celulares ni montos, y nunca crea usuarios.
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

IFS= read -r SUELDOS_CSV_B64 || true
SUELDOS_CSV_B64="${SUELDOS_CSV_B64//[[:space:]]/}"
if [[ -z "$SUELDOS_CSV_B64" ]]; then
  echo "ERROR: no llegó el CSV por stdin (el secreto SUELDOS_CSV_B64 viene vacío)." >&2
  exit 1
fi
export SUELDOS_CSV_B64

ARGS=(--desde-env SUELDOS_CSV_B64)
[[ "$APLICAR" == "si" ]] && ARGS+=(--aplicar)

echo "== Carga de sueldos (${AMBIENTE}, $([[ "$APLICAR" == "si" ]] && echo APLICAR || echo SIMULACRO)) =="
if [[ "$APLICAR" == "si" && "$AMBIENTE" == "prod" ]]; then
  echo "AVISO: se guardan sueldos reales en PRODUCCIÓN."
fi

RC=0
docker compose --env-file "$ENV_FILE" -f "${COMPOSE_DIR}/docker-compose.base.yml" \
  -f "${COMPOSE_DIR}/docker-compose.${AMBIENTE}.yml" \
  run --rm -T -e SUELDOS_CSV_B64 -e ENTORNO_DATOS="$AMBIENTE" -e HOME=/tmp \
  api node dist/scripts/cargar-sueldos.js "${ARGS[@]}" || RC=$?

exit "$RC"
