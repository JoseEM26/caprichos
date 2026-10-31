#!/usr/bin/env bash
# ==============================================================================
# cargar-resenas.sh — Carga inicial de reseñas de Google en el ambiente (corre el comando de la API)
# ==============================================================================
# Uso:
#   ./cargar-resenas.sh <demo|prod> "<consulta>" [si|no]
#     consulta: texto para buscar el local (p. ej. "Caprichos Campoy") o business_id (0x...:0x...)
#     tercer argumento: si = --repetir (vuelve a cargar aunque ya haya reseñas)
#
# Ejecuta en el contenedor de la API el mismo comando que usa la pantalla de reseñas:
#   node dist/scripts/resenas-carga-inicial.js --buscar "<texto>" | --business-id <id> [--repetir]
# Los argumentos van separados (sin eval). La salida del comando se muestra tal cual y el script
# devuelve su código de salida (2 = búsqueda ambigua; ver el comando).
# Nunca imprime la clave: el comando de la API tampoco la muestra.
# Pruebas: CAPRICHOS_RAIZ apunta a otra raíz.
# ==============================================================================

set -euo pipefail
umask 077

AMBIENTE="${1:-}"
CONSULTA="${2:-}"
REPETIR="${3:-no}"
RAIZ="${CAPRICHOS_RAIZ:-/opt/caprichos}"

case "$AMBIENTE" in
  demo|prod) ;;
  *) echo "ERROR: ambiente '${AMBIENTE}' no válido (use demo o prod)." >&2; exit 1 ;;
esac

# Texto de búsqueda: 1 a 120 caracteres, sin comillas, barra invertida, $, acento grave ni caracteres de control
if [[ -z "$CONSULTA" ]]; then
  echo "ERROR: falta la consulta (nombre del local o business_id)." >&2
  exit 1
fi
if (( ${#CONSULTA} > 120 )); then
  echo "ERROR: la consulta tiene más de 120 caracteres." >&2
  exit 1
fi
case "$CONSULTA" in
  *\"*|*\'*|*\\*|*\$*|*\`*) echo "ERROR: la consulta no puede llevar comillas, barra invertida, \$ ni acento grave." >&2; exit 1 ;;
esac
if [[ "$CONSULTA" =~ [[:cntrl:]] ]]; then
  echo "ERROR: la consulta no puede llevar caracteres de control ni saltos de línea." >&2
  exit 1
fi

case "$REPETIR" in
  si|no) ;;
  *) echo "ERROR: el tercer argumento debe ser si o no (recibido: '${REPETIR}')." >&2; exit 1 ;;
esac

ENV_FILE="${RAIZ}/${AMBIENTE}/.env"
COMPOSE_DIR="${RAIZ}/compose"
[[ -f "$ENV_FILE" ]] || { echo "ERROR: no existe ${ENV_FILE}." >&2; exit 1; }

# Un business_id (0x...:0x...) o una consulta que empiece por 0x va como --business-id; lo demás como --buscar
ARGS=()
if [[ "$CONSULTA" == 0x* || "$CONSULTA" == *:* ]]; then
  ARGS+=(--business-id "$CONSULTA")
else
  ARGS+=(--buscar "$CONSULTA")
fi
[[ "$REPETIR" == "si" ]] && ARGS+=(--repetir)

echo "== Carga inicial de reseñas (${AMBIENTE}) =="
echo "Argumentos: ${ARGS[*]}"
if [[ "$AMBIENTE" == "prod" ]]; then
  echo "AVISO: lo normal es NO cargar reseñas en producción; los datos de la empresa llegan con importar-datos-produccion."
  echo "       Se ejecuta porque se pidió explícitamente."
fi

RC=0
docker compose --env-file "$ENV_FILE" -f "${COMPOSE_DIR}/docker-compose.base.yml" \
  -f "${COMPOSE_DIR}/docker-compose.${AMBIENTE}.yml" \
  run --rm -T -e ENTORNO_DATOS="$AMBIENTE" -e HOME=/tmp \
  api node dist/scripts/resenas-carga-inicial.js "${ARGS[@]}" || RC=$?

exit "$RC"
