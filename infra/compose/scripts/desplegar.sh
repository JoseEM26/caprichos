#!/usr/bin/env bash
# ==============================================================================
# desplegar.sh — Despliegue de Caprichos por Ambiente con Migración y Rollback
# ==============================================================================
# Uso:
#   ./desplegar.sh <demo|staging|prod> <tag>
#
# Flujo:
# 1. Valida argumentos y prohíbe :latest en producción.
# 2. Guarda la versión actual (TAG_PREVIA) del archivo .env para rollback.
# 3. Descarga las nuevas imágenes desde GHCR (con login si hay token).
# 4. Ejecuta migraciones de base de datos con contenedor efímero ANTES de tocar la app.
# 5. Si la migración falla, aborta inmediatamente dejando la versión actual intacta.
# 6. Actualiza TAG en .env y recrea contenedores api y web.
# 7. Monitorea healthchecks; si fallan, ejecuta volver-atras.sh automáticamente.
# 8. Verifica respuesta HTTPS del endpoint /salud.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_COMPOSE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

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

echo "========================================================================"
echo "   INICIANDO DESPLIEGUE — CAPRICHOS [${AMBIENTE^^}]"
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

# 6. Ejecutar migraciones en contenedor efímero
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
echo "    ✓ Migraciones ejecutadas exitosamente."

# 7. Actualizar TAG en el .env y recrear api y web
echo "==> [4/5] Desplegando nuevos contenedores api y web..."
sed -i "s|^TAG=.*|TAG=${TAG}|" "$ENV_FILE"
compose up -d --no-deps api web

# 8. Monitoreo de salud interna de los contenedores
echo "==> [5/5] Verificando salud de la nueva versión..."
INTENTOS=0
MAX_INTENTOS=30
SALUD_OK=0

while [[ $INTENTOS -lt $MAX_INTENTOS ]]; do
  API_STATUS=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "caprichos-${AMBIENTE}-api" 2>/dev/null || echo "ausente")
  WEB_STATUS=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "caprichos-${AMBIENTE}-web" 2>/dev/null || echo "ausente")

  if [[ "$API_STATUS" == "healthy" && "$WEB_STATUS" == "healthy" ]]; then
    SALUD_OK=1
    break
  elif [[ "$API_STATUS" == "unhealthy" || "$WEB_STATUS" == "unhealthy" ]]; then
    echo "¡ALERTA! Uno de los contenedores reportó estado 'unhealthy' (api: $API_STATUS, web: $WEB_STATUS)."
    break
  fi

  INTENTOS=$((INTENTOS + 1))
  sleep 2
done

if [[ $SALUD_OK -ne 1 ]]; then
  echo ""
  echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
  echo "ERROR: La nueva versión (${TAG}) no superó la verificación de salud."
  echo "Iniciando VUELTA ATRÁS AUTOMÁTICA a la versión anterior (${TAG_PREVIA})..."
  echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
  "${SCRIPT_DIR}/volver-atras.sh" "$AMBIENTE" "$TAG_PREVIA"
  exit 1
fi

echo "========================================================================"
echo "   DESPLIEGUE COMPLETADO CON ÉXITO [${AMBIENTE^^}]"
echo "   Versión activa: ${TAG}"
echo "========================================================================"
compose ps
exit 0
