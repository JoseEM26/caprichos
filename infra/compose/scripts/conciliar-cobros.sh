#!/usr/bin/env bash
# ==============================================================================
# conciliar-cobros.sh — Concilia pedidos PAGADO sin Cobro (corre el script de consola de la API)
# ==============================================================================
# Uso: ./conciliar-cobros.sh <demo|prod> <si|no> <desde AAAA-MM-DD> <hasta AAAA-MM-DD>
#   segundo argumento: si = --aplicar (crea los cobros que faltan); no = simulacro (no escribe)
# Corre: node dist/scripts/conciliar-cobros.js --desde D --hasta H [--aplicar]
# Idempotente: un pedido que ya tiene cobro vigente no se toca. No emite comprobantes ni mueve efectivo de cajas
# ya cerradas. Pruebas: CAPRICHOS_RAIZ apunta a otra raíz.
# ==============================================================================

set -euo pipefail
umask 077

AMBIENTE="${1:-}"
APLICAR="${2:-no}"
DESDE="${3:-}"
HASTA="${4:-}"
RAIZ="${CAPRICHOS_RAIZ:-/opt/caprichos}"

case "$AMBIENTE" in
  demo|prod) ;;
  *) echo "ERROR: ambiente '${AMBIENTE}' no válido (use demo o prod)." >&2; exit 1 ;;
esac
case "$APLICAR" in
  si|no) ;;
  *) echo "ERROR: el segundo argumento debe ser si o no (recibido: '${APLICAR}')." >&2; exit 1 ;;
esac
for F in "$DESDE" "$HASTA"; do
  [[ "$F" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || { echo "ERROR: las fechas deben ser AAAA-MM-DD (recibido: '${F}')." >&2; exit 1; }
done

ENV_FILE="${RAIZ}/${AMBIENTE}/.env"
COMPOSE_DIR="${RAIZ}/compose"
[[ -f "$ENV_FILE" ]] || { echo "ERROR: no existe ${ENV_FILE}." >&2; exit 1; }

ARGS=(--desde "$DESDE" --hasta "$HASTA")
[[ "$APLICAR" == "si" ]] && ARGS+=(--aplicar)

if [[ "$APLICAR" == "si" && "$AMBIENTE" == "prod" ]]; then
  echo "AVISO: se crean cobros reales de regularización en PRODUCCIÓN."
fi

RC=0
docker compose --env-file "$ENV_FILE" -f "${COMPOSE_DIR}/docker-compose.base.yml" \
  -f "${COMPOSE_DIR}/docker-compose.${AMBIENTE}.yml" \
  run --rm -T -e ENTORNO_DATOS="$AMBIENTE" -e HOME=/tmp \
  api node dist/scripts/conciliar-cobros.js "${ARGS[@]}" || RC=$?

exit "$RC"
