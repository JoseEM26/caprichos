#!/usr/bin/env bash
# ==============================================================================
# logs.sh — Consulta y seguimiento en tiempo real de registros de contenedores
# ==============================================================================
# Uso:
#   ./logs.sh             # Muestra y sigue registros de todos los servicios
#   ./logs.sh api         # Muestra y sigue registros de la API
#   ./logs.sh traefik     # Registros de Traefik (Dokploy): rutas y certificados de la demo
#   (el Traefik es de Dokploy: se consulta con docker logs dokploy-traefik)
#   ./logs.sh web         # Muestra registros del servidor Web Nginx
#   ./logs.sh postgres    # Muestra registros de PostgreSQL
#   ./logs.sh redis       # Muestra registros de Redis
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="docker-compose.demo.yml"
if [[ ! -f "$COMPOSE_FILE" && -f "${SCRIPT_DIR}/docker-compose.demo.yml" ]]; then
  COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.demo.yml"
fi

SERVICIO="${1:-}"

if [[ "$SERVICIO" == "traefik" ]]; then
  echo "==> Mostrando registros de dokploy-traefik (Ctrl+C para salir)..."
  docker logs -f --tail=100 dokploy-traefik
elif [[ -n "$SERVICIO" ]]; then
  echo "==> Mostrando registros de: ${SERVICIO} (Ctrl+C para salir)..."
  docker compose -f "$COMPOSE_FILE" logs -f --tail=100 "$SERVICIO"
else
  echo "==> Mostrando registros de todos los servicios (Ctrl+C para salir)..."
  docker compose -f "$COMPOSE_FILE" logs -f --tail=50
fi
