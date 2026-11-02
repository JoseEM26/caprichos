#!/usr/bin/env bash
# ==============================================================================
# importar-personal.sh — Importación de personal en el ambiente (corre el script de consola de la API)
# ==============================================================================
# Uso:
#   echo "<CSV en base64>" | ./importar-personal.sh <demo|prod> <si|no>
#     segundo argumento: si = --aplicar (crea de verdad); no = simulacro (no escribe)
#
# El CSV en base64 llega por stdin (una línea). No se escribe en disco ni va en la línea de comando:
# se exporta como variable de entorno y el contenedor la toma por nombre (-e PERSONAL_CSV_B64).
# Corre: node dist/scripts/importar-personal.js --desde-env PERSONAL_CSV_B64 [--aplicar]
# La clave inicial de cada persona es su número de documento; el script no la imprime.
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

IFS= read -r PERSONAL_CSV_B64 || true
PERSONAL_CSV_B64="${PERSONAL_CSV_B64//[[:space:]]/}"
if [[ -z "$PERSONAL_CSV_B64" ]]; then
  echo "ERROR: no llegó el CSV por stdin (el secreto PERSONAL_CSV_B64 viene vacío)." >&2
  exit 1
fi
export PERSONAL_CSV_B64

ARGS=(--desde-env PERSONAL_CSV_B64)
[[ "$APLICAR" == "si" ]] && ARGS+=(--aplicar)

echo "== Importación de personal (${AMBIENTE}, $([[ "$APLICAR" == "si" ]] && echo APLICAR || echo SIMULACRO)) =="
if [[ "$APLICAR" == "si" && "$AMBIENTE" == "prod" ]]; then
  echo "AVISO: se crean cuentas reales en PRODUCCIÓN; cada una entra con su documento como clave inicial."
fi

RC=0
docker compose --env-file "$ENV_FILE" -f "${COMPOSE_DIR}/docker-compose.base.yml" \
  -f "${COMPOSE_DIR}/docker-compose.${AMBIENTE}.yml" \
  run --rm -T -e PERSONAL_CSV_B64 -e ENTORNO_DATOS="$AMBIENTE" -e HOME=/tmp \
  api node dist/scripts/importar-personal.js "${ARGS[@]}" || RC=$?

exit "$RC"
