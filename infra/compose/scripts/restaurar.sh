#!/usr/bin/env bash
# ==============================================================================
# restaurar.sh — Restauración de Base de Datos y Uploads con Modo Seguro
# ==============================================================================
# Uso:
#   ./restaurar.sh <demo|staging|prod> <archivo_dump.sql.gz> [archivo_uploads.tar.gz] [--confirmar]
#
# Para probar la restauración en un contenedor efímero aislado (sin tocar datos):
#   ./restaurar.sh <demo|staging|prod> <archivo_dump.sql.gz> --prueba-local
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
ARCHIVO_DB="${2:-}"
PARAM3="${3:-}"
PARAM4="${4:-}"

if [[ -z "$AMBIENTE" || -z "$ARCHIVO_DB" ]]; then
  echo "Uso:"
  echo "  $0 <demo|staging|prod> <archivo_db.sql.gz> [--confirmar]"
  echo "  $0 <demo|staging|prod> <archivo_db.sql.gz> <archivo_uploads.tar.gz> [--confirmar]"
  echo "  $0 <demo|staging|prod> <archivo_db.sql.gz> --prueba-local"
  exit 1
fi

case "$AMBIENTE" in
  demo|staging|prod) ;;
  *)
    echo "ERROR: Ambiente no válido '$AMBIENTE'. Use: demo, staging o prod." >&2
    exit 1
    ;;
esac

if [[ ! -f "$ARCHIVO_DB" ]]; then
  echo "ERROR: No existe el archivo de volcado '${ARCHIVO_DB}'." >&2
  exit 1
fi

ARCHIVO_UPLOADS=""
CONFIRMAR=0
PRUEBA_LOCAL=0

for arg in "$PARAM3" "$PARAM4"; do
  if [[ "$arg" == "--confirmar" ]]; then
    CONFIRMAR=1
  elif [[ "$arg" == "--prueba-local" ]]; then
    PRUEBA_LOCAL=1
  elif [[ -n "$arg" && -f "$arg" ]]; then
    ARCHIVO_UPLOADS="$arg"
  fi
done

# --- MODO PRUEBA LOCAL ---
if [[ $PRUEBA_LOCAL -eq 1 ]]; then
  echo "========================================================================"
  echo "   INICIANDO PRUEBA LOCAL DE RESTAURACIÓN (AISLADA)"
  echo "   Archivo: ${ARCHIVO_DB}"
  echo "========================================================================"
  CONTENEDOR_TEST="caprichos-restore-test-$(date +%s)"
  echo "==> Levantando contenedor PostgreSQL temporal (${CONTENEDOR_TEST})..."
  docker run -d --name "$CONTENEDOR_TEST" \
    -e POSTGRES_PASSWORD=test_restore_pwd \
    -e POSTGRES_DB=caprichos_test \
    -e POSTGRES_USER=caprichos_test \
    postgres:16-alpine > /dev/null

  # Esperar a que PostgreSQL esté listo
  for ((i = 0; i < 30; i++)); do
    if docker exec "$CONTENEDOR_TEST" pg_isready -U caprichos_test -d caprichos_test &>/dev/null; then
      break
    fi
    sleep 1
  done

  echo "==> Restaurando volcado en el contenedor temporal..."
  if gzip -dc "$ARCHIVO_DB" | docker exec -i "$CONTENEDOR_TEST" psql -U caprichos_test -d caprichos_test > /dev/null 2>&1; then
    TABLAS=$(docker exec "$CONTENEDOR_TEST" psql -U caprichos_test -d caprichos_test -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")
    echo "    ✓ Restauración exitosa. Número de tablas en el esquema público: $(echo "$TABLAS" | tr -d ' ')"
  else
    echo "    ✗ Falló la restauración en el contenedor de prueba." >&2
    docker rm -f "$CONTENEDOR_TEST" > /dev/null
    exit 1
  fi

  echo "==> Limpiando contenedor de prueba..."
  docker rm -f "$CONTENEDOR_TEST" > /dev/null
  echo "========================================================================"
  echo "   PRUEBA DE RESTAURACIÓN COMPLETADA: EL VOLCADO ES VÁLIDO"
  echo "========================================================================"
  exit 0
fi

# --- RESTAURACIÓN EN EL AMBIENTE REAL ---
if [[ $CONFIRMAR -ne 1 ]]; then
  echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
  echo "ATENCIÓN: Esta operación SOBREESCRIBIRÁ la base de datos de [${AMBIENTE^^}]."
  echo "Para proceder, debe agregar el parámetro --confirmar al final del comando."
  echo "Ejemplo:"
  echo "  $0 $AMBIENTE $ARCHIVO_DB --confirmar"
  echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
  exit 1
fi

DIR_ENV="/opt/caprichos/${AMBIENTE}"
if [[ ! -d "$DIR_ENV" && -d "${BASE_COMPOSE_DIR}/${AMBIENTE}" ]]; then
  DIR_ENV="${BASE_COMPOSE_DIR}/${AMBIENTE}"
elif [[ ! -d "$DIR_ENV" ]]; then
  DIR_ENV="${BASE_COMPOSE_DIR}"
fi

ENV_FILE="${DIR_ENV}/.env"
COMPOSE_BASE="${BASE_COMPOSE_DIR}/docker-compose.base.yml"
COMPOSE_ENV="${BASE_COMPOSE_DIR}/docker-compose.${AMBIENTE}.yml"

DB_USER=$(grep -E "^POSTGRES_USER=" "$ENV_FILE" 2>/dev/null | cut -d= -f2 || echo "caprichos_${AMBIENTE}")
DB_NAME=$(grep -E "^POSTGRES_DB=" "$ENV_FILE" 2>/dev/null | cut -d= -f2 || echo "caprichos_${AMBIENTE}")

echo "==> [1/3] Generando respaldo de seguridad previo antes de sobreescribir..."
"${SCRIPT_DIR}/respaldar.sh" "$AMBIENTE"

echo "==> [2/3] Restaurando base de datos en 'caprichos-${AMBIENTE}-postgres'..."
if ! gzip -dc "$ARCHIVO_DB" | docker exec -i "caprichos-${AMBIENTE}-postgres" psql -U "$DB_USER" -d "$DB_NAME"; then
  echo "ERROR CRÍTICO: Falló la inyección del volcado de base de datos." >&2
  exit 1
fi
echo "    ✓ Base de datos restaurada correctamente."

if [[ -n "$ARCHIVO_UPLOADS" && -f "$ARCHIVO_UPLOADS" ]]; then
  echo "==> [3/3] Restaurando archivos y fotos en volumen 'caprichos_${AMBIENTE}_uploads_data'..."
  docker run --rm \
    -v "caprichos_${AMBIENTE}_uploads_data:/datos" \
    -v "$(dirname "$ARCHIVO_UPLOADS"):/backup:ro" \
    alpine tar -xzf "/backup/$(basename "$ARCHIVO_UPLOADS")" -C /datos
  echo "    ✓ Archivos restaurados en el volumen de uploads."
else
  echo "==> [3/3] No se especificó archivo de uploads; solo se restauró la base de datos."
fi

echo "========================================================================"
echo "   RESTAURACIÓN FINALIZADA CON ÉXITO [${AMBIENTE^^}]"
echo "========================================================================"
