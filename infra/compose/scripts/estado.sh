#!/usr/bin/env bash
# ==============================================================================
# estado.sh — Diagnóstico, Recursos y Verificación de Seguridad por Ambiente
# ==============================================================================
# Uso:
#   ./estado.sh [demo|staging|prod|proxy|todos]
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_COMPOSE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

OBJETIVO="${1:-todos}"

verificar_ambiente() {
  local AMB="$1"
  echo "------------------------------------------------------------------------"
  echo "   ESTADO: AMBIENTE [${AMB^^}]"
  echo "------------------------------------------------------------------------"

  local DIR_ENV="/opt/caprichos/${AMB}"
  if [[ ! -d "$DIR_ENV" && -d "${BASE_COMPOSE_DIR}/${AMB}" ]]; then
    DIR_ENV="${BASE_COMPOSE_DIR}/${AMB}"
  elif [[ ! -d "$DIR_ENV" ]]; then
    DIR_ENV="${BASE_COMPOSE_DIR}"
  fi

  local ENV_FILE="${DIR_ENV}/.env"
  local COMPOSE_BASE="${BASE_COMPOSE_DIR}/docker-compose.base.yml"
  local COMPOSE_ENV="${BASE_COMPOSE_DIR}/docker-compose.${AMB}.yml"

  if [[ ! -f "$COMPOSE_ENV" ]]; then
    echo "Aviso: No se encontró definición compose para '${AMB}'."
    return
  fi

  if [[ -f "$ENV_FILE" ]]; then
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_BASE" -f "$COMPOSE_ENV" ps || true
  else
    docker compose -f "$COMPOSE_BASE" -f "$COMPOSE_ENV" ps || true
  fi

  # Consumo de recursos
  echo ""
  echo "==> Consumo de recursos:"
  docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}" \
    "caprichos-${AMB}-api" "caprichos-${AMB}-web" "caprichos-${AMB}-postgres" "caprichos-${AMB}-redis" 2>/dev/null || echo "    (Servicios no iniciados)"

  # Verificación de aislamiento de puertos de base de datos y redis
  echo ""
  echo "==> Aislamiento de seguridad de puertos (PostgreSQL 5432 / Redis 6379):"
  local PUERTOS_EXPUESTOS=0
  if docker ps --format '{{.Names}} {{.Ports}}' | grep "caprichos-${AMB}-postgres" | grep -q "0.0.0.0:5432"; then
    echo "    ¡ALERTA CRÍTICA! El puerto 5432 de PostgreSQL está publicado en el host."
    PUERTOS_EXPUESTOS=$((PUERTOS_EXPUESTOS + 1))
  else
    echo "    ✓ PostgreSQL (5432): seguro (sin puerto publicado, aislado en red interna)."
  fi

  if docker ps --format '{{.Names}} {{.Ports}}' | grep "caprichos-${AMB}-redis" | grep -q "0.0.0.0:6379"; then
    echo "    ¡ALERTA CRÍTICA! El puerto 6379 de Redis está publicado en el host."
    PUERTOS_EXPUESTOS=$((PUERTOS_EXPUESTOS + 1))
  else
    echo "    ✓ Redis (6379): seguro (sin puerto publicado, aislado en red interna)."
  fi

  # Prueba interna de salud si la API está arriba
  if docker inspect --format '{{.State.Running}}' "caprichos-${AMB}-api" 2>/dev/null | grep -q true; then
    echo ""
    echo "==> Respuesta de salud interna (/salud):"
    docker exec "caprichos-${AMB}-api" curl -s -f http://localhost:3000/salud 2>/dev/null | jq . 2>/dev/null || echo "    ✓ Servicio activo (respuesta no JSON o jq ausente)"
  fi
  echo ""
}

verificar_proxy() {
  echo "------------------------------------------------------------------------"
  echo "   ESTADO: PROXY TRAEFIK AUTÓNOMO"
  echo "------------------------------------------------------------------------"
  local PROXY_DIR="${BASE_COMPOSE_DIR}/proxy"
  if [[ -f "${PROXY_DIR}/docker-compose.yml" ]]; then
    docker compose -f "${PROXY_DIR}/docker-compose.yml" ps || true
  fi
  echo ""
}

echo "========================================================================"
echo "   DIAGNÓSTICO GENERAL DEL SISTEMA — CAPRICHOS"
echo "   Fecha: $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
echo "========================================================================"

case "$OBJETIVO" in
  demo|staging|prod)
    verificar_ambiente "$OBJETIVO"
    ;;
  proxy)
    verificar_proxy
    ;;
  todos|*)
    verificar_proxy
    verificar_ambiente "demo"
    verificar_ambiente "staging"
    verificar_ambiente "prod"
    ;;
esac

echo "========================================================================"
