#!/usr/bin/env bash
# ==============================================================================
# regularizar-creditos.sh — Regulariza el crédito del personal (corre el script de consola de la API)
# ==============================================================================
# Uso: ./regularizar-creditos.sh <demo|prod> <si|no> [dias=60] [ajustar=no|si]
#   segundo argumento: si = --aplicar (registra el consumo); no = simulacro (no escribe)
#   ajustar=si agrega --ajustar-descuento (cambia descuento y total de esos pedidos; apagado por defecto)
# Corre: node dist/scripts/regularizar-creditos.js --dias N [--aplicar] [--ajustar-descuento]
# Idempotente: un pedido con consumo registrado no se toca de nuevo. Nombres enmascarados en la salida.
# Pruebas: CAPRICHOS_RAIZ apunta a otra raíz.
# ==============================================================================

set -euo pipefail
umask 077

AMBIENTE="${1:-}"
APLICAR="${2:-no}"
DIAS="${3:-60}"
AJUSTAR="${4:-no}"
RAIZ="${CAPRICHOS_RAIZ:-/opt/caprichos}"

case "$AMBIENTE" in
  demo|prod) ;;
  *) echo "ERROR: ambiente '${AMBIENTE}' no válido (use demo o prod)." >&2; exit 1 ;;
esac
case "$APLICAR" in
  si|no) ;;
  *) echo "ERROR: el segundo argumento debe ser si o no (recibido: '${APLICAR}')." >&2; exit 1 ;;
esac
case "$AJUSTAR" in
  si|no) ;;
  *) echo "ERROR: ajustar debe ser si o no (recibido: '${AJUSTAR}')." >&2; exit 1 ;;
esac
[[ "$DIAS" =~ ^[0-9]{1,4}$ ]] && [[ "$DIAS" -ge 1 ]] || { echo "ERROR: dias debe ser un número entre 1 y 9999 (recibido: '${DIAS}')." >&2; exit 1; }

ENV_FILE="${RAIZ}/${AMBIENTE}/.env"
COMPOSE_DIR="${RAIZ}/compose"
[[ -f "$ENV_FILE" ]] || { echo "ERROR: no existe ${ENV_FILE}." >&2; exit 1; }

ARGS=(--dias "$DIAS")
[[ "$APLICAR" == "si" ]] && ARGS+=(--aplicar)
[[ "$AJUSTAR" == "si" ]] && ARGS+=(--ajustar-descuento)

if [[ "$APLICAR" == "si" && "$AMBIENTE" == "prod" ]]; then
  echo "AVISO: se registran consumos reales en PRODUCCIÓN."
fi

RC=0
docker compose --env-file "$ENV_FILE" -f "${COMPOSE_DIR}/docker-compose.base.yml" \
  -f "${COMPOSE_DIR}/docker-compose.${AMBIENTE}.yml" \
  run --rm -T -e ENTORNO_DATOS="$AMBIENTE" -e HOME=/tmp \
  api node dist/scripts/regularizar-creditos.js "${ARGS[@]}" || RC=$?

exit "$RC"
