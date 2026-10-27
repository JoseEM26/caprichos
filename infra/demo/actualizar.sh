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
# 6. LIMPIEZA AUTOMÁTICA: Tras una actualización exitosa, elimina imágenes antiguas
#    de la aplicación preservando las en uso, TAG actual, TAG previa y las 5 más recientes.
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

# 3. Actualizar .env con la nueva tag
sed -i "s|^TAG=.*|TAG=${NUEVA_TAG}|" "$ENV_FILE"

# Función de rolling rollout llamando directamente al script empaquetado
rollout_servicio() {
  local SERVICIO="$1"
  local TIMEOUT="${2:-60}"
  echo "==> Rolling rollout de '${SERVICIO}' (timeout: ${TIMEOUT}s)..."

  chmod +x "${SCRIPT_DIR}/docker-rollout" 2>/dev/null || true
  if [[ ! -x "${SCRIPT_DIR}/docker-rollout" ]]; then
    echo "ERROR: No se encontró o no es ejecutable: ${SCRIPT_DIR}/docker-rollout" >&2
    return 1
  fi

  "${SCRIPT_DIR}/docker-rollout" rollout -f "$COMPOSE_FILE" --env-file "$ENV_FILE" -t "$TIMEOUT" --wait-after-healthy 2 "$SERVICIO"
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

  # Limpieza automática de imágenes viejas (solo tras actualización exitosa)
  echo "==> Ejecutando limpieza automática de imágenes antiguas..."
  if [[ -f "${SCRIPT_DIR}/limpiar-imagenes.sh" ]]; then
    source "${SCRIPT_DIR}/limpiar-imagenes.sh"
    limpiar_imagenes_viejas "$NUEVA_TAG" "$TAG_PREVIA" "${IMAGENES_CONSERVAR:-5}" || {
      echo "AVISO: La limpieza de imágenes no finalizó con éxito, pero la actualización está completada." >&2
    }
  fi

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
  
  echo "==> Ejecutando rolling rollout de vuelta atrás a la versión previa (${TAG_PREVIA})..."
  chmod +x "${SCRIPT_DIR}/docker-rollout" 2>/dev/null || true
  ROLLBACK_FALLO=0
  if [[ -x "${SCRIPT_DIR}/docker-rollout" ]]; then
    if ! "${SCRIPT_DIR}/docker-rollout" rollout -f "$COMPOSE_FILE" --env-file "$ENV_FILE" -t 60 --wait-after-healthy 2 api; then
      echo "AVISO: Falló el rolling rollout de vuelta atrás para api. Recreando como último recurso..." >&2
      compose up -d --no-deps api || ROLLBACK_FALLO=1
    fi
    if ! "${SCRIPT_DIR}/docker-rollout" rollout -f "$COMPOSE_FILE" --env-file "$ENV_FILE" -t 30 --wait-after-healthy 2 web; then
      echo "AVISO: Falló el rolling rollout de vuelta atrás para web. Recreando como último recurso..." >&2
      compose up -d --no-deps web || ROLLBACK_FALLO=1
    fi
  else
    echo "AVISO: ${SCRIPT_DIR}/docker-rollout no disponible. Recreando contenedores..." >&2
    compose up -d --no-deps api web || ROLLBACK_FALLO=1
  fi

  if [[ $ROLLBACK_FALLO -eq 0 ]]; then
    echo "Rollback completado sin corte. Contenedores restaurados a la versión previa ${TAG_PREVIA}."
  else
    echo "ERROR: Falló la restauración de algunos contenedores a la versión previa ${TAG_PREVIA}." >&2
  fi
  echo "Revise los registros con ./logs.sh para diagnosticar el problema."
  exit 1
fi
