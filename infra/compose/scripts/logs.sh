#!/usr/bin/env bash
# ==============================================================================
# logs.sh — Consulta y Seguimiento de Registros por Ambiente y Servicio
# ==============================================================================
# Uso:
#   ./logs.sh                       # Muestra menú o ayuda
#   ./logs.sh proxy                 # Registros de Traefik (proxy perimetral)
#   ./logs.sh <demo|staging|prod>   # Registros de todos los servicios del ambiente
#   ./logs.sh <ambiente> <servicio> # Registros de un servicio específico (api, web, postgres, redis)
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_COMPOSE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

OBJETIVO="${1:-}"
SERVICIO="${2:-}"

if [[ -z "$OBJETIVO" ]]; then
  echo "Uso:"
  echo "  $0 proxy                        # Registros de Traefik"
  echo "  $0 <demo|staging|prod>          # Todos los servicios de un ambiente"
  echo "  $0 <demo|staging|prod> <servicio> # Servicio (api, web, postgres, redis)"
  exit 1
fi

if [[ "$OBJETIVO" == "proxy" ]]; then
  echo "==> Mostrando registros en tiempo real de Traefik (Ctrl+C para salir)..."
  docker compose -f "${BASE_COMPOSE_DIR}/proxy/docker-compose.yml" logs -f --tail=100
  exit 0
fi

DIR_ENV="/opt/caprichos/${OBJETIVO}"
if [[ ! -d "$DIR_ENV" && -d "${BASE_COMPOSE_DIR}/${OBJETIVO}" ]]; then
  DIR_ENV="${BASE_COMPOSE_DIR}/${OBJETIVO}"
elif [[ ! -d "$DIR_ENV" ]]; then
  DIR_ENV="${BASE_COMPOSE_DIR}"
fi

ENV_FILE="${DIR_ENV}/.env"
COMPOSE_BASE="${BASE_COMPOSE_DIR}/docker-compose.base.yml"
COMPOSE_ENV="${BASE_COMPOSE_DIR}/docker-compose.${OBJETIVO}.yml"

if [[ ! -f "$COMPOSE_ENV" ]]; then
  echo "ERROR: Archivo ${COMPOSE_ENV} no encontrado." >&2
  exit 1
fi

OPTS=()
if [[ -f "$ENV_FILE" ]]; then
  OPTS+=(--env-file "$ENV_FILE")
fi
OPTS+=(-f "$COMPOSE_BASE" -f "$COMPOSE_ENV")

if [[ -n "$SERVICIO" ]]; then
  echo "==> Mostrando registros de '${SERVICIO}' en [${OBJETIVO^^}] (Ctrl+C para salir)..."
  docker compose "${OPTS[@]}" logs -f --tail=100 "$SERVICIO"
else
  echo "==> Mostrando registros de todos los servicios en [${OBJETIVO^^}] (Ctrl+C para salir)..."
  docker compose "${OPTS[@]}" logs -f --tail=50
fi
