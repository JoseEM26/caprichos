#!/usr/bin/env bash
# ==============================================================================
# migrar-demo-actual.sh — Migración de la Demo de Dokploy al Nuevo Esquema
# ==============================================================================
# Migra la demo existente en /opt/caprichos-demo hacia /opt/caprichos/demo y
# el nuevo proxy autónomo en /opt/caprichos/proxy SIN PERDER DATOS.
#
# Pasos:
# 1. Respaldo previo obligatorio de base de datos y uploads.
# 2. Conservación de los volúmenes existentes (caprichos_demo_postgres_data, etc.).
# 3. Traslado seguro del archivo .env existente (claves idénticas a los datos).
# 4. Transición del proxy: detiene dokploy-traefik y levanta caprichos-proxy-traefik.
# 5. Detención limpia del compose antiguo (sin -v).
# 6. Arranque del nuevo compose con docker compose base + demo.
# 7. Verificación de salud y endpoints.
# 8. Si algo falla, procedimiento de vuelta atrás inmediato al estado anterior.
#
# Uso:
#   sudo ./migrar-demo-actual.sh           # Ejecuta la migración
#   sudo ./migrar-demo-actual.sh --rollback # Deshace la migración y regresa al esquema Dokploy
# ==============================================================================

set -euo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# En el repositorio los compose están junto a scripts/; en el servidor están en ../compose/
if [[ -f "${SCRIPT_DIR}/../docker-compose.base.yml" ]]; then
  BASE_COMPOSE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
else
  BASE_COMPOSE_DIR="$(cd "${SCRIPT_DIR}/../compose" && pwd)"
fi

DIR_ANTIGUO="/opt/caprichos-demo"
DIR_NUEVO_BASE="/opt/caprichos"
DIR_NUEVO_DEMO="/opt/caprichos/demo"
DIR_NUEVO_PROXY="/opt/caprichos/proxy"

# --- MODO ROLLBACK DE EMERGENCIA ---
if [[ "${1:-}" == "--rollback" ]]; then
  echo "========================================================================"
  echo "   INICIANDO VUELTA ATRÁS DE LA MIGRACIÓN DE LA DEMO"
  echo "========================================================================"
  echo "==> [1/4] Deteniendo nuevo compose de demo..."
  if [[ -f "${DIR_NUEVO_DEMO}/.env" ]]; then
    docker compose --env-file "${DIR_NUEVO_DEMO}/.env" \
      -f "${DIR_NUEVO_BASE}/compose/docker-compose.base.yml" \
      -f "${DIR_NUEVO_BASE}/compose/docker-compose.demo.yml" down || true
  fi

  echo "==> [2/4] Deteniendo proxy autónomo de Caprichos..."
  if [[ -f "${DIR_NUEVO_PROXY}/docker-compose.yml" ]]; then
    docker compose -f "${DIR_NUEVO_PROXY}/docker-compose.yml" down || true
  fi

  echo "==> [3/4] Reactivando dokploy-traefik..."
  docker start dokploy-traefik || true

  echo "==> [4/4] Levantando compose anterior en ${DIR_ANTIGUO}..."
  if [[ -d "$DIR_ANTIGUO" ]]; then
    cd "$DIR_ANTIGUO"
    docker compose -f docker-compose.demo.yml up -d
  fi

  echo "========================================================================"
  echo "   VUELTA ATRÁS COMPLETADA: DOKPLOY Y DEMO ANTERIOR RESTAURADOS"
  echo "========================================================================"
  exit 0
fi

echo "========================================================================"
echo "   MIGRACIÓN DE DEMO: DOKPLOY -> DOCKER COMPOSE AUTÓNOMO"
echo "   Fecha: $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
echo "========================================================================"

# 1. Comprobaciones de pre-requisitos
if [[ ! -d "$DIR_ANTIGUO" ]]; then
  echo "ERROR: No existe el directorio de la demo anterior (${DIR_ANTIGUO})." >&2
  exit 1
fi

if [[ ! -f "${DIR_ANTIGUO}/.env" ]]; then
  echo "ERROR: No se encontró ${DIR_ANTIGUO}/.env. Las credenciales de base de datos son indispensables." >&2
  exit 1
fi

# 2. RESPALDO PREVIO OBLIGATORIO
DIR_PRE_BACKUP="${DIR_NUEVO_BASE}/respaldos/pre-migracion-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$DIR_PRE_BACKUP"

echo "==> [1/7] Ejecutando RESPALDO PREVIO OBLIGATORIO antes de cualquier cambio..."
if docker ps --format '{{.Names}}' | grep -q "caprichos-demo-postgres"; then
  docker exec caprichos-demo-postgres pg_dump -U caprichos_demo caprichos_demo | gzip -9 > "${DIR_PRE_BACKUP}/db_pre_migracion.sql.gz"
  echo "    ✓ Base de datos respaldada en: ${DIR_PRE_BACKUP}/db_pre_migracion.sql.gz"
fi

if docker volume inspect caprichos_demo_uploads_data &>/dev/null; then
  docker run --rm \
    -v caprichos_demo_uploads_data:/datos:ro \
    -v "${DIR_PRE_BACKUP}:/backup" \
    alpine tar -czf "/backup/uploads_pre_migracion.tar.gz" -C /datos .
  echo "    ✓ Archivos uploads respaldados en: ${DIR_PRE_BACKUP}/uploads_pre_migracion.tar.gz"
fi

# Verificar integridad del respaldo
if [[ ! -s "${DIR_PRE_BACKUP}/db_pre_migracion.sql.gz" ]]; then
  echo "ERROR CRÍTICO: El archivo de respaldo de la base de datos está vacío o falló." >&2
  echo "Migración abortada para prevenir pérdida de información." >&2
  exit 1
fi
echo "    ✓ Integridad de respaldo comprobada exitosamente."

# 3. Preparar estructura de directorios nueva
echo "==> [2/7] Preparando estructura en ${DIR_NUEVO_BASE}..."
mkdir -p "${DIR_NUEVO_BASE}/compose" "${DIR_NUEVO_DEMO}" "${DIR_NUEVO_PROXY}" "${DIR_NUEVO_BASE}/scripts"

# Copiar archivos de compose y proxy
cp "${BASE_COMPOSE_DIR}/docker-compose.base.yml" "${DIR_NUEVO_BASE}/compose/"
cp "${BASE_COMPOSE_DIR}/docker-compose.demo.yml" "${DIR_NUEVO_BASE}/compose/"
cp "${BASE_COMPOSE_DIR}/docker-compose.staging.yml" "${DIR_NUEVO_BASE}/compose/"
cp "${BASE_COMPOSE_DIR}/docker-compose.prod.yml" "${DIR_NUEVO_BASE}/compose/"
cp -r "${BASE_COMPOSE_DIR}/proxy/"* "${DIR_NUEVO_PROXY}/"
cp "${SCRIPT_DIR}/"* "${DIR_NUEVO_BASE}/scripts/"
chmod +x "${DIR_NUEVO_BASE}/scripts/"*.sh

# 4. Migrar .env existente
echo "==> [3/7] Migrando .env conservando secretos y contraseñas..."
cp "${DIR_ANTIGUO}/.env" "${DIR_NUEVO_DEMO}/.env"
chmod 600 "${DIR_NUEVO_DEMO}/.env"
# El .env viejo usaba DOMINIO_BASE; el esquema nuevo usa DOMINIO_DEMO
if ! grep -q '^DOMINIO_DEMO=' "${DIR_NUEVO_DEMO}/.env"; then
  echo "DOMINIO_DEMO=$(grep '^DOMINIO_BASE=' "${DIR_NUEVO_DEMO}/.env" | cut -d= -f2-)" >> "${DIR_NUEVO_DEMO}/.env"
fi
# Las imágenes que ya están en este servidor se reutilizan con el nombre que espera el compose nuevo
TAG_ACTUAL="$(grep '^TAG=' "${DIR_NUEVO_DEMO}/.env" | cut -d= -f2-)"
for srv in api web; do
  if docker image inspect "caprichos-${srv}:${TAG_ACTUAL:-demo}" >/dev/null 2>&1; then
    docker tag "caprichos-${srv}:${TAG_ACTUAL:-demo}" "ghcr.io/joseem26/caprichos-${srv}:${TAG_ACTUAL:-demo}"
  fi
done
echo "    ✓ .env migrado a ${DIR_NUEVO_DEMO}/.env (permisos 600)."

# 5. Crear red perimetral
echo "==> [4/7] Configurando red externa caprichos-proxy-net..."
docker network create caprichos-proxy-net 2>/dev/null || true

# 6. Conmutar Proxy (Detener dokploy-traefik y arrancar proxy nuevo)
echo "==> [5/7] Conmutando de dokploy-traefik al Proxy Traefik Autónomo..."
if docker ps --format '{{.Names}}' | grep -q "^dokploy-traefik$"; then
  docker stop dokploy-traefik || true
fi
cd "${DIR_NUEVO_PROXY}"
docker compose up -d

# 7. Detener compose antiguo y arrancar nuevo compose
echo "==> [6/7] Migrando contenedores de la demo..."
cd "$DIR_ANTIGUO"
docker compose -f docker-compose.demo.yml down # SIN -v para conservar volúmenes intactos

echo "==> Levantando la demo con el nuevo esquema Compose..."
cd "${DIR_NUEVO_DEMO}"
docker compose --env-file "${DIR_NUEVO_DEMO}/.env" \
  -f "${DIR_NUEVO_BASE}/compose/docker-compose.base.yml" \
  -f "${DIR_NUEVO_BASE}/compose/docker-compose.demo.yml" up -d

# 8. Verificación de salud post-migración
echo "==> [7/7] Verificando salud del nuevo despliegue..."
INTENTOS=0
MAX_INTENTOS=30
MIGRACION_OK=0

while [[ $INTENTOS -lt $MAX_INTENTOS ]]; do
  API_STATUS=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' caprichos-demo-api 2>/dev/null || echo "ausente")
  WEB_STATUS=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' caprichos-demo-web 2>/dev/null || echo "ausente")

  if [[ "$API_STATUS" == "healthy" && "$WEB_STATUS" == "healthy" ]]; then
    MIGRACION_OK=1
    break
  fi
  INTENTOS=$((INTENTOS + 1))
  sleep 2
done

if [[ $MIGRACION_OK -eq 1 ]]; then
  echo ""
  echo "========================================================================"
  echo "   MIGRACIÓN DE LA DEMO COMPLETADA CON ÉXITO"
  echo "   - Datos preservados al 100% en sus volúmenes originales"
  echo "   - Proxy propio activo en 80/443"
  echo "   - Dokploy liberado de atender tráfico"
  echo "========================================================================"
  docker compose --env-file "${DIR_NUEVO_DEMO}/.env" \
    -f "${DIR_NUEVO_BASE}/compose/docker-compose.base.yml" \
    -f "${DIR_NUEVO_BASE}/compose/docker-compose.demo.yml" ps
  exit 0
else
  echo ""
  echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
  echo "ERROR: La nueva configuración no superó los healthchecks."
  echo "Iniciando vuelta atrás inmediata para restaurar la demo original..."
  echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
  "$0" --rollback
  exit 1
fi
