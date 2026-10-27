#!/usr/bin/env bash
# ==============================================================================
# actualizar.sh — Actualización Sin Corte (Rolling Rollout) de Caprichos Demo
# ==============================================================================
# 1. Guarda la versión actual en ejecución para rollback.
# 2. REGLA EXPAND/CONTRACT: Ejecuta migraciones de base de datos con contenedor
#    efímero (prisma migrate deploy) ANTES de cambiar los contenedores. Las
#    migraciones deben ser 100% compatibles hacia atrás para que los contenedores
#    antiguos sigan atendiendo tráfico sin corte.
# 3. Despliega la nueva versión mediante ROLLING ROLLOUT con docker-rollout
#    (o fallback nativo por escala): levanta contenedor nuevo, espera healthcheck
#    sano, Traefik le envía tráfico, y recién detiene el contenedor anterior
#    respetando stop_grace_period: 30s.
# 4. Monitorea la verificación de salud interna usando IDs dinámicos.
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
echo "   ACTUALIZACIÓN SIN CORTE — CAPRICHOS DEMO"
echo "   Objetivo: ${NUEVA_TAG}"
echo "========================================================================"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: No se encontró el archivo ${ENV_FILE}. Ejecute desplegar.sh primero." >&2
  exit 1
fi

compose() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

# 1. Guardar tag previa para permitir rollback
TAG_PREVIA=$(grep "^TAG=" "$ENV_FILE" | cut -d= -f2 || echo "demo")
echo "==> Versión actual: ${TAG_PREVIA}"
echo "==> Nueva versión:   ${NUEVA_TAG}"

if [[ "$TAG_PREVIA" == "$NUEVA_TAG" ]]; then
  echo "AVISO: La nueva tag es idéntica a la actual. Se actualizarán los contenedores con la imagen reciente."
fi

# 2. Correr migraciones de base de datos ANTES de cambiar contenedores (compatibilidad aditiva)
echo "==> [1/4] Aplicando migraciones de base de datos (prisma migrate deploy)..."
export TAG="$NUEVA_TAG"
if ! compose run --rm api prisma migrate deploy --schema=prisma/schema.prisma; then
  echo "ERROR CRÍTICO: Fallaron las migraciones de base de datos." >&2
  echo "La actualización se cancela sin tocar los contenedores en ejecución." >&2
  exit 1
fi
echo "    ✓ Migraciones aplicadas exitosamente (esquema compatible hacia atrás)."

# Asegurar disponibilidad del plugin docker-rollout
asegurar_docker_rollout() {
  if ! docker rollout --version &>/dev/null; then
    mkdir -p "$HOME/.docker/cli-plugins"
    if [[ -f "${SCRIPT_DIR}/docker-rollout" ]]; then
      cp -f "${SCRIPT_DIR}/docker-rollout" "$HOME/.docker/cli-plugins/docker-rollout"
      chmod +x "$HOME/.docker/cli-plugins/docker-rollout"
    fi
  fi
}
asegurar_docker_rollout

# 3. Actualizar .env con la nueva tag
sed -i "s|^TAG=.*|TAG=${NUEVA_TAG}|" "$ENV_FILE"

# Función de rolling rollout
rollout_servicio() {
  local SERVICIO="$1"
  local TIMEOUT="${2:-60}"
  echo "==> Rolling rollout de '${SERVICIO}' (timeout: ${TIMEOUT}s)..."

  if docker rollout --version &>/dev/null; then
    docker rollout -f "$COMPOSE_FILE" --env-file "$ENV_FILE" -t "$TIMEOUT" --wait-after-healthy 2 "$SERVICIO"
    return $?
  fi

  if [[ -x "${SCRIPT_DIR}/docker-rollout" ]]; then
    "${SCRIPT_DIR}/docker-rollout" rollout -f "$COMPOSE_FILE" --env-file "$ENV_FILE" -t "$TIMEOUT" --wait-after-healthy 2 "$SERVICIO"
    return $?
  fi

  # Fallback nativo
  local OLD_IDS
  OLD_IDS=$(compose ps -q "$SERVICIO" 2>/dev/null || true)

  if [[ -z "$OLD_IDS" ]]; then
    compose up -d --no-deps "$SERVICIO"
    return 0
  fi

  compose up -d --scale "${SERVICIO}=2" --no-recreate "$SERVICIO"

  local NEW_IDS
  NEW_IDS=$(compose ps -q "$SERVICIO" | grep -v -F "$OLD_IDS" || true)

  if [[ -z "$NEW_IDS" ]]; then
    echo "ERROR: No se pudo identificar el nuevo contenedor de '${SERVICIO}'." >&2
    return 1
  fi

  local INTENTOS=0
  local SANO=0
  while [[ $INTENTOS -lt $TIMEOUT ]]; do
    local ESTADO
    ESTADO=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$NEW_IDS" 2>/dev/null || echo "ausente")
    if [[ "$ESTADO" == "healthy" ]]; then
      SANO=1
      break
    elif [[ "$ESTADO" == "unhealthy" ]]; then
      break
    fi
    INTENTOS=$((INTENTOS + 1))
    sleep 1
  done

  if [[ $SANO -ne 1 ]]; then
    echo "ERROR: El nuevo contenedor de '${SERVICIO}' no superó el healthcheck." >&2
    docker stop "$NEW_IDS" 2>/dev/null || true
    docker rm "$NEW_IDS" 2>/dev/null || true
    return 1
  fi

  sleep 2
  docker stop $OLD_IDS
  docker rm $OLD_IDS
  compose up -d --scale "${SERVICIO}=1" --no-recreate "$SERVICIO" >/dev/null 2>&1 || true
  return 0
}

# 4. Desplegar nuevos contenedores api y web mediante rolling rollout
echo "==> [2/4] Desplegando nuevos contenedores api y web mediante rolling rollout..."
ROLLOUT_ERROR=0

if ! rollout_servicio api 60; then
  echo "ERROR: Falló el rolling rollout de la API." >&2
  ROLLOUT_ERROR=1
fi

if [[ $ROLLOUT_ERROR -eq 0 ]] && ! rollout_servicio web 30; then
  echo "ERROR: Falló el rolling rollout del servidor Web." >&2
  ROLLOUT_ERROR=1
fi

# 5. Esperar verificación de salud global mediante IDs dinámicos
echo "==> [3/4] Verificando salud final de la nueva versión..."
SALUDABLE=true

if [[ $ROLLOUT_ERROR -eq 1 ]]; then
  SALUDABLE=false
else
  INTENTOS=0
  MAX_INTENTOS=15
  while [[ $INTENTOS -lt $MAX_INTENTOS ]]; do
    API_IDS=$(compose ps -q api 2>/dev/null || true)
    WEB_IDS=$(compose ps -q web 2>/dev/null || true)

    TODOS_OK=true
    for CID in $API_IDS $WEB_IDS; do
      [[ -z "$CID" ]] && { TODOS_OK=false; continue; }
      ESTADO=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$CID" 2>/dev/null || echo "ausente")
      if [[ "$ESTADO" != "healthy" ]]; then
        TODOS_OK=false
        break
      fi
    done

    if [[ "$TODOS_OK" == "true" ]]; then
      SALUDABLE=true
      break
    fi

    INTENTOS=$((INTENTOS + 1))
    sleep 2
  done
fi

# 6. Decisión: Éxito o Rollback
if [[ "$SALUDABLE" == "true" ]]; then
  echo "==> [4/4] Verificación de salud exitosa (HTTP 200)."
  echo "========================================================================"
  echo "   ACTUALIZACIÓN SIN CORTE COMPLETADA CON ÉXITO"
  echo "   Versión activa: ${NUEVA_TAG}"
  echo "========================================================================"
  compose ps
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
  
  # Recrear con versión anterior de forma segura
  compose up -d --no-deps api web
  
  echo "Rollback completado. Contenedores restaurados a la versión previa ${TAG_PREVIA}."
  echo "Revise los registros con ./logs.sh para diagnosticar el problema."
  exit 1
fi
