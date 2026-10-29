#!/usr/bin/env bash
# ==============================================================================
# sanear-clientes-demo.sh — Saneamiento de clientes/DNI de la DEMO (IRREVERSIBLE)
# ==============================================================================
# Uso (en el VPS):  ./sanear-clientes-demo.sh <simulacro|real>
# Solo existe el ambiente demo: este script no acepta otro y nunca lee el de producción.
#   simulacro: informa lo que borraría/anonimizaría; no escribe nada.
#   real     : primero respaldo completo con respaldar.sh demo, luego sanea.
# Lo invoca .github/workflows/sanear-clientes-demo.yml.
# ==============================================================================
set -euo pipefail

MODO="${1:-simulacro}"
case "$MODO" in simulacro|real) ;; *) echo "Uso: $0 <simulacro|real>" >&2; exit 1 ;; esac

AMBIENTE="demo"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "${SCRIPT_DIR}/../docker-compose.base.yml" ]]; then
  BASE_COMPOSE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
else
  BASE_COMPOSE_DIR="$(cd "${SCRIPT_DIR}/../compose" && pwd)"
fi

DIR_ENV="/opt/caprichos/${AMBIENTE}"
[[ -d "$DIR_ENV" ]] || DIR_ENV="${BASE_COMPOSE_DIR}"
ENV_FILE="${DIR_ENV}/.env"
[[ -f "$ENV_FILE" ]] || { echo "ERROR: No existe ${ENV_FILE}." >&2; exit 1; }

compose() {
  docker compose --env-file "$ENV_FILE" -f "${BASE_COMPOSE_DIR}/docker-compose.base.yml" -f "${BASE_COMPOSE_DIR}/docker-compose.${AMBIENTE}.yml" "$@"
}

sanear() {
  # ENTORNO_DATOS=demo: el script se niega si la base no es postgres/*demo* (ver guardas.ts)
  compose run --rm -T -e ENTORNO_DATOS=demo api \
    tsx prisma/reset/saneamiento-clientes-dni.ts --confirmar="SANEAR CLIENTES DNI" "$@"
}

echo "==> [1/2] Simulacro (siempre primero)"
sanear

if [[ "$MODO" == "real" ]]; then
  echo "==> [2/2] Respaldo completo de la demo antes de tocar nada"
  "${SCRIPT_DIR}/respaldar.sh" "$AMBIENTE"
  echo "==> Saneamiento real (el respaldo quedó en /opt/caprichos/respaldos/${AMBIENTE})"
  # pg_dump no existe en la imagen de la API: el respaldo es el de respaldar.sh (arriba)
  sanear --ejecutar --sin-respaldo
fi
