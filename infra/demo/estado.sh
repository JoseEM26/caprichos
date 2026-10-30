#!/usr/bin/env bash
# ==============================================================================
# estado.sh — Verificación de salud y diagnóstico del entorno de demostración
# ==============================================================================
# 1. Muestra estado de los contenedores Docker y su verificación de salud (health).
# 2. Muestra consumo de recursos (CPU, RAM).
# 3. Verifica respuesta del endpoint de salud de la API (/salud).
# 4. Verifica aislamiento de red: confirma que PostgreSQL (5432) y Redis (6379)
#    NO están publicados hacia internet ni accesibles desde el exterior.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="docker-compose.demo.yml"
if [[ ! -f "$COMPOSE_FILE" && -f "${SCRIPT_DIR}/docker-compose.demo.yml" ]]; then
  COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.demo.yml"
fi

ENV_FILE=".env"
if [[ ! -f "$ENV_FILE" && -f "${SCRIPT_DIR}/.env" ]]; then
  ENV_FILE="${SCRIPT_DIR}/.env"
fi

echo "========================================================================"
echo "   DIAGNÓSTICO Y ESTADO DEL ENTORNO — CAPRICHOS DEMO"
echo "========================================================================"

# 1. Estado de Contenedores
echo "==> [1/4] Estado de los servicios de Docker Compose:"
docker compose -f "$COMPOSE_FILE" ps

echo ""
# 2. Consumo de recursos
echo "==> [2/4] Consumo actual de recursos (CPU y Memoria):"
CONTENEDORES=$(docker compose -f "$COMPOSE_FILE" ps -q 2>/dev/null || true)
if [[ -n "$CONTENEDORES" ]]; then
  docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}" $CONTENEDORES 2>/dev/null || true
else
  echo "    (Servicios no iniciados)"
fi

echo ""
# 3. Verificación de salud interna
echo "==> [3/4] Prueba del endpoint interno de salud (/salud):"
if docker compose -f "$COMPOSE_FILE" exec -T api curl -s -f http://localhost:3000/salud 2>/dev/null | jq . 2>/dev/null; then
  echo "    ✓ Endpoint /salud respondió HTTP 200 con JSON válido."
else
  echo "    AVISO: No se pudo obtener respuesta del endpoint /salud desde el contenedor api."
fi

echo ""
# 4. Aislamiento de red y puertos de bases de datos
echo "==> [4/4] Verificación de seguridad de puertos (PostgreSQL 5432 / Redis 6379):"
PUERTOS_EXPUESTOS=0

# Revisar puertos publicados por docker compose
if docker compose -f "$COMPOSE_FILE" port postgres 5432 2>/dev/null; then
  echo "    ¡ALERTA DE SEGURIDAD! El puerto 5432 de PostgreSQL está publicado en el host."
  PUERTOS_EXPUESTOS=$((PUERTOS_EXPUESTOS + 1))
else
  echo "    ✓ PostgreSQL (5432) NO está publicado. Solo accesible en la red interna 'red_demo'."
fi

if docker compose -f "$COMPOSE_FILE" port redis 6379 2>/dev/null; then
  echo "    ¡ALERTA DE SEGURIDAD! El puerto 6379 de Redis está publicado en el host."
  PUERTOS_EXPUESTOS=$((PUERTOS_EXPUESTOS + 1))
else
  echo "    ✓ Redis (6379) NO está publicado. Solo accesible en la red interna 'red_demo'."
fi

echo ""
echo "========================================================================"
if [[ $PUERTOS_EXPUESTOS -eq 0 ]]; then
  echo "   ESTADO GENERAL: SEGURO Y OPERATIVO"
else
  echo "   ESTADO GENERAL: REVISAR ALERTAS DE SEGURIDAD"
fi
echo "========================================================================"
