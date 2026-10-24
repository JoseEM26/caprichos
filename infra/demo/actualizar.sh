#!/usr/bin/env bash
# ==============================================================================
# actualizar.sh — Actualización con migraciones y rollback automático
# ==============================================================================
# 1. Guarda la versión actual en ejecución.
# 2. Ejecuta migraciones de base de datos con prisma migrate deploy.
# 3. Despliega la nueva versión de los contenedores api y web.
# 4. Monitorea la verificación de salud interna.
# 5. Si la verificación de salud falla, realiza ROLLBACK automático a la versión
#    anterior inmediatamente para evitar tiempo de inactividad.
#
# Uso:
#   ./actualizar.sh [NUEVA_TAG]
#   Ejemplo: ./actualizar.sh 8a1b2c3
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

NUEVA_TAG="${1:-demo}"

echo "========================================================================"
echo "   ACTUALIZACIÓN DE DEMOSTRACIÓN — CAPRICHOS"
echo "   Objetivo: ${NUEVA_TAG}"
echo "========================================================================"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: No se encontró el archivo ${ENV_FILE}. Ejecute desplegar.sh primero." >&2
  exit 1
fi

# 1. Guardar tag previa para permitir rollback
TAG_PREVIA=$(grep "^TAG=" "$ENV_FILE" | cut -d= -f2 || echo "demo")
echo "==> Versión actual: ${TAG_PREVIA}"
echo "==> Nueva versión:   ${NUEVA_TAG}"

if [[ "$TAG_PREVIA" == "$NUEVA_TAG" ]]; then
  echo "AVISO: La nueva tag es idéntica a la actual. Se recrearán los contenedores con la imagen actualizada."
fi

# 2. Correr migraciones de base de datos antes de cambiar contenedores
echo "==> [1/4] Aplicando migraciones de base de datos (prisma migrate deploy)..."
# Actualizar temporalmente TAG para que el contenedor efímero use la nueva imagen
export TAG="$NUEVA_TAG"
if ! docker compose -f "$COMPOSE_FILE" run --rm api prisma migrate deploy --schema=prisma/schema.prisma; then
  echo "ERROR CRÍTICO: Fallaron las migraciones de base de datos." >&2
  echo "La actualización se cancela sin tocar los contenedores en producción." >&2
  exit 1
fi
echo "    ✓ Migraciones aplicadas exitosamente."

# 3. Actualizar .env con la nueva tag
sed -i "s|^TAG=.*|TAG=${NUEVA_TAG}|" "$ENV_FILE"

# 4. Recrear contenedores api y web
echo "==> [2/4] Desplegando nuevos contenedores api y web..."
docker compose -f "$COMPOSE_FILE" up -d --no-deps api web

# 5. Esperar verificación de salud
echo "==> [3/4] Verificando salud de la nueva versión..."
INTENTOS=0
MAX_INTENTOS=20
SALUDABLE=false

while [[ $INTENTOS -lt $MAX_INTENTOS ]]; do
  ESTADO_API=$(docker inspect --format='{{json .State.Health.Status}}' caprichos-demo-api 2>/dev/null || echo "\"starting\"")
  ESTADO_WEB=$(docker inspect --format='{{json .State.Health.Status}}' caprichos-demo-web 2>/dev/null || echo "\"starting\"")
  
  if [[ "$ESTADO_API" == "\"healthy\"" && "$ESTADO_WEB" == "\"healthy\"" ]]; then
    SALUDABLE=true
    break
  elif [[ "$ESTADO_API" == "\"unhealthy\"" || "$ESTADO_WEB" == "\"unhealthy\"" ]]; then
    echo "¡ALERTA! Contenedor reportó estado 'unhealthy'."
    break
  fi

  INTENTOS=$((INTENTOS + 1))
  sleep 2
done

# 6. Decisión: Éxito o Rollback
if [[ "$SALUDABLE" == "true" ]]; then
  echo "==> [4/4] Verificación de salud exitosa (HTTP 200)."
  echo "========================================================================"
  echo "   ACTUALIZACIÓN COMPLETADA CON ÉXITO"
  echo "   Versión activa: ${NUEVA_TAG}"
  echo "========================================================================"
  docker compose -f "$COMPOSE_FILE" ps
  exit 0
else
  echo ""
  echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
  echo "   ERROR: La nueva versión falló la verificación de salud."
  echo "   Iniciando ROLLBACK AUTOMÁTICO a la versión anterior (${TAG_PREVIA})..."
  echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
  
  # Restaurar .env a la versión anterior
  sed -i "s|^TAG=.*|TAG=${TAG_PREVIA}|" "$ENV_FILE"
  export TAG="$TAG_PREVIA"
  
  # Recrear con versión anterior
  docker compose -f "$COMPOSE_FILE" up -d --no-deps api web
  
  echo "Rollback completado. Contenedores restaurados a la versión previa ${TAG_PREVIA}."
  echo "Revise los registros con ./logs.sh para diagnosticar el problema."
  exit 1
fi
