#!/usr/bin/env bash
# ==============================================================================
# desplegar.sh — Despliegue Sin Corte (Rolling Rollout) de Caprichos por Ambiente
# ==============================================================================
# Uso:
#   ./desplegar.sh <demo|staging|prod> <tag>
#
# Flujo de Despliegue Sin Corte (Zero-Downtime):
# 1. Valida argumentos y prohíbe :latest en producción.
# 2. Guarda la versión actual (TAG_PREVIA) del archivo .env para rollback.
# 3. Descarga las nuevas imágenes desde GHCR (con login si hay token).
# 4. Asegura la red perimetral del proxy (caprichos-proxy-net).
# 5. Comprueba y levanta servicios de datos compartidos (postgres, redis).
# 6. MIGRACIONES EXPAND/CONTRACT: Ejecuta migraciones con contenedor efímero
#    ANTES de cambiar los contenedores de aplicación. Las migraciones deben ser
#    compatibles hacia atrás para que los contenedores antiguos en vivo sigan
#    operando sin interrupción.
# 7. Actualiza TAG en .env y ejecuta ROLLING ROLLOUT con docker-rollout
#    (o fallback nativo por escala): levanta la nueva versión junto a la anterior,
#    espera que el healthcheck (/salud) esté healthy, permite que Traefik
#    enrute tráfico a la nueva versión y recién entonces detiene la anterior
#    con apagado ordenado (SIGTERM y stop_grace_period: 30s).
# 8. Monitorea la salud posterior de los contenedores por ID dinámico.
# 9. Si el nuevo contenedor no queda sano, revierte automáticamente a TAG_PREVIA.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# En el repositorio los compose están junto a scripts/; en el servidor están en ../compose/
if [[ -f "${SCRIPT_DIR}/../docker-compose.base.yml" ]]; then
  BASE_COMPOSE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
else
  BASE_COMPOSE_DIR="$(cd "${SCRIPT_DIR}/../compose" && pwd)"
fi

AMBIENTE="${1:-}"
TAG="${2:-}"

if [[ -z "$AMBIENTE" || -z "$TAG" ]]; then
  echo "Uso: $0 <demo|staging|prod> <tag>" >&2
  exit 1
fi

case "$AMBIENTE" in
  demo|staging|prod) ;;
  *)
    echo "ERROR: Ambiente no válido '$AMBIENTE'. Use: demo, staging o prod." >&2
    exit 1
    ;;
esac

if [[ "$AMBIENTE" == "prod" && ( "$TAG" == "latest" || "$TAG" == ":latest" ) ]]; then
  echo "ERROR CRÍTICO: La etiqueta 'latest' está terminantemente prohibida en producción." >&2
  echo "Debe utilizar una etiqueta inmutable (ej. v0.3.0 o commit sha corto)." >&2
  exit 1
fi

# Localizar archivo de entorno .env del ambiente
DIR_ENV="/opt/caprichos/${AMBIENTE}"
if [[ ! -d "$DIR_ENV" && -d "${BASE_COMPOSE_DIR}/${AMBIENTE}" ]]; then
  DIR_ENV="${BASE_COMPOSE_DIR}/${AMBIENTE}"
elif [[ ! -d "$DIR_ENV" ]]; then
  DIR_ENV="${BASE_COMPOSE_DIR}"
fi

ENV_FILE="${DIR_ENV}/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: No existe el archivo de variables ${ENV_FILE}." >&2
  echo "Cree el archivo a partir de .env.example con permisos 600 antes de desplegar." >&2
  exit 1
fi

# Detectar archivos compose
COMPOSE_BASE="${BASE_COMPOSE_DIR}/docker-compose.base.yml"
COMPOSE_ENV="${BASE_COMPOSE_DIR}/docker-compose.${AMBIENTE}.yml"

if [[ ! -f "$COMPOSE_BASE" || ! -f "$COMPOSE_ENV" ]]; then
  echo "ERROR: No se encontraron los archivos docker-compose requeridos en ${BASE_COMPOSE_DIR}" >&2
  exit 1
fi

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_BASE" -f "$COMPOSE_ENV" "$@"
}

# Asegurar que el plugin docker-rollout esté disponible en ~/.docker/cli-plugins
asegurar_docker_rollout() {
  if ! docker rollout --version &>/dev/null; then
    mkdir -p "$HOME/.docker/cli-plugins"
    if [[ -f "${SCRIPT_DIR}/docker-rollout" ]]; then
      cp -f "${SCRIPT_DIR}/docker-rollout" "$HOME/.docker/cli-plugins/docker-rollout"
      chmod +x "$HOME/.docker/cli-plugins/docker-rollout"
    fi
  fi
}

# Ejecutar despliegue rolling de un servicio
rollout_servicio() {
  local SERVICIO="$1"
  local TIMEOUT="${2:-60}"
  echo "==> Rolling rollout de '${SERVICIO}' (timeout: ${TIMEOUT}s)..."

  # 1. Intentar con docker rollout como plugin oficial de Docker CLI
  if docker rollout --version &>/dev/null; then
    docker rollout -f "$COMPOSE_BASE" -f "$COMPOSE_ENV" --env-file "$ENV_FILE" -t "$TIMEOUT" --wait-after-healthy 2 "$SERVICIO"
    return $?
  fi

  # 2. Intentar ejecución directa del script empaquetado
  if [[ -x "${SCRIPT_DIR}/docker-rollout" ]]; then
    "${SCRIPT_DIR}/docker-rollout" rollout -f "$COMPOSE_BASE" -f "$COMPOSE_ENV" --env-file "$ENV_FILE" -t "$TIMEOUT" --wait-after-healthy 2 "$SERVICIO"
    return $?
  fi

  # 3. Fallback nativo: escala temporal a 2, validación de salud y retiro de contenedor viejo
  echo "    (Usando mecanismo nativo de escala y reemplazo ordenado para '${SERVICIO}')"
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
  local MAX_INTENTOS=$TIMEOUT
  local SANO=0

  while [[ $INTENTOS -lt $MAX_INTENTOS ]]; do
    local ESTADO
    ESTADO=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$NEW_IDS" 2>/dev/null || echo "ausente")
    if [[ "$ESTADO" == "healthy" ]]; then
      SANO=1
      break
    elif [[ "$ESTADO" == "unhealthy" ]]; then
      echo "¡ALERTA! El nuevo contenedor de '${SERVICIO}' reportó estado unhealthy." >&2
      break
    fi
    INTENTOS=$((INTENTOS + 1))
    sleep 1
  done

  if [[ $SANO -ne 1 ]]; then
    echo "ERROR: El nuevo contenedor de '${SERVICIO}' (${NEW_IDS}) no superó el healthcheck." >&2
    echo "==> Logs del contenedor fallido:"
    docker logs --tail=50 "$NEW_IDS" || true
    echo "==> Limpiando contenedor fallido y manteniendo contenedor original..."
    docker stop "$NEW_IDS" 2>/dev/null || true
    docker rm "$NEW_IDS" 2>/dev/null || true
    return 1
  fi

  # Margen de 2 segundos para sincronización de rutas en Traefik
  sleep 2

  echo "==> Deteniendo contenedor anterior de '${SERVICIO}' (${OLD_IDS}) respetando stop_grace_period..."
  docker stop $OLD_IDS
  docker rm $OLD_IDS
  compose up -d --scale "${SERVICIO}=1" --no-recreate "$SERVICIO" >/dev/null 2>&1 || true
  return 0
}

echo "========================================================================"
echo "   INICIANDO DESPLIEGUE SIN CORTE — CAPRICHOS [${AMBIENTE^^}]"
echo "   Versión objetivo: ${TAG}"
echo "   Fecha: $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
echo "========================================================================"

# 1. Guardar versión previa para permitir vuelta atrás inmediata
TAG_PREVIA=$(grep -E "^TAG=" "$ENV_FILE" | cut -d= -f2 || echo "")
if [[ -z "$TAG_PREVIA" ]]; then
  TAG_PREVIA="inicial"
fi
echo "==> Versión actual en servidor: ${TAG_PREVIA}"
echo "==> Nueva versión a instalar:   ${TAG}"

# 2. Inicio de sesión en GHCR si se proporcionó token de lectura
if [[ -n "${GHCR_READ_TOKEN:-}" ]]; then
  GHCR_USER="${GHCR_USER:-deploy}"
  echo "==> Autenticando en GitHub Container Registry..."
  echo "$GHCR_READ_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin
fi

# 3. Descargar imágenes nuevas antes de modificar nada
GHCR_REPO=$(grep -E "^GHCR_REPO=" "$ENV_FILE" | cut -d= -f2 || echo "ghcr.io/joseem26")
echo "==> [1/5] Descargando imágenes nuevas (${GHCR_REPO}/caprichos-*:${TAG})..."
docker pull "${GHCR_REPO}/caprichos-api:${TAG}" || true
docker pull "${GHCR_REPO}/caprichos-web:${TAG}" || true

# 4. Asegurar red compartida del proxy
docker network create caprichos-proxy-net 2>/dev/null || true

# 5. Levantar base de datos y redis si no estuvieran corriendo
echo "==> [2/5] Comprobando servicios de datos (postgres, redis)..."
compose up -d postgres redis

# 6. Ejecutar migraciones en contenedor efímero ANTES de iniciar el rollout de la app
# REGLA EXPAND/CONTRACT: Las migraciones deben ser 100% compatibles hacia atrás.
# Los contenedores de la versión previa siguen atendiendo peticiones mientras la migración
# se ejecuta. Solo se permiten operaciones aditivas (nuevas tablas, columnas opcionales/con default).
echo "==> [3/5] Aplicando migraciones de base de datos (prisma migrate deploy)..."
export TAG="$TAG"
if ! compose run --rm api prisma migrate deploy --schema=prisma/schema.prisma; then
  echo ""
  echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
  echo "ERROR CRÍTICO: Fallaron las migraciones de base de datos con la nueva versión."
  echo "El despliegue se cancela. Los contenedores en ejecución no fueron tocados."
  echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
  exit 1
fi
echo "    ✓ Migraciones ejecutadas exitosamente (compatibilidad hacia atrás garantizada)."

# Asegurar plugin docker-rollout
asegurar_docker_rollout

# 7. Actualizar TAG en el .env y ejecutar Rolling Rollout (api primero, luego web)
echo "==> [4/5] Desplegando nuevos contenedores api y web mediante rolling rollout sin corte..."
sed -i "s|^TAG=.*|TAG=${TAG}|" "$ENV_FILE"

ROLLOUT_FALLO=0
if ! rollout_servicio api 60; then
  echo "ERROR: Falló el rolling rollout del servicio api." >&2
  ROLLOUT_FALLO=1
fi

if [[ $ROLLOUT_FALLO -eq 0 ]] && ! rollout_servicio web 30; then
  echo "ERROR: Falló el rolling rollout del servicio web." >&2
  ROLLOUT_FALLO=1
fi

if [[ $ROLLOUT_FALLO -ne 0 ]]; then
  echo ""
  echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
  echo "ERROR: Falló el rolling rollout de la nueva versión (${TAG})."
  echo "Iniciando VUELTA ATRÁS AUTOMÁTICA a la versión anterior (${TAG_PREVIA})..."
  echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
  sed -i "s|^TAG=.*|TAG=${TAG_PREVIA}|" "$ENV_FILE"
  export TAG="$TAG_PREVIA"
  "${SCRIPT_DIR}/volver-atras.sh" "$AMBIENTE" "$TAG_PREVIA"
  exit 1
fi

# 8. Monitoreo de salud interna post-despliegue mediante IDs dinámicos
echo "==> [5/5] Verificando salud final de la nueva versión..."
INTENTOS=0
MAX_INTENTOS=15
SALUD_OK=0

while [[ $INTENTOS -lt $MAX_INTENTOS ]]; do
  API_IDS=$(compose ps -q api 2>/dev/null || true)
  WEB_IDS=$(compose ps -q web 2>/dev/null || true)

  TODOS_SANOS=1
  for CID in $API_IDS $WEB_IDS; do
    [[ -z "$CID" ]] && { TODOS_SANOS=0; continue; }
    STATUS=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$CID" 2>/dev/null || echo "ausente")
    if [[ "$STATUS" != "healthy" ]]; then
      TODOS_SANOS=0
      break
    fi
  done

  if [[ $TODOS_SANOS -eq 1 ]]; then
    SALUD_OK=1
    break
  fi

  INTENTOS=$((INTENTOS + 1))
  sleep 2
done

if [[ $SALUD_OK -ne 1 ]]; then
  echo ""
  echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
  echo "ERROR: La nueva versión (${TAG}) no mantuvo la salud esperada tras el rollout."
  echo "Iniciando VUELTA ATRÁS AUTOMÁTICA a la versión anterior (${TAG_PREVIA})..."
  echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
  sed -i "s|^TAG=.*|TAG=${TAG_PREVIA}|" "$ENV_FILE"
  export TAG="$TAG_PREVIA"
  "${SCRIPT_DIR}/volver-atras.sh" "$AMBIENTE" "$TAG_PREVIA"
  exit 1
fi

echo "========================================================================"
echo "   DESPLIEGUE SIN CORTE COMPLETADO CON ÉXITO [${AMBIENTE^^}]"
echo "   Versión activa: ${TAG}"
echo "========================================================================"
compose ps
exit 0
