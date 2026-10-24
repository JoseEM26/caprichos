#!/usr/bin/env bash
# ==============================================================================
# respaldar.sh — Copia de Seguridad Local (PostgreSQL + Uploads) y Restic (ADR-012)
# ==============================================================================
# Uso:
#   ./respaldar.sh <demo|staging|prod>
#
# Flujo:
# 1. Aplica umask 077 para proteger datos personales de clientes.
# 2. Genera volcado pg_dump comprimido con gzip de la base de datos del ambiente.
# 3. Empaqueta el volumen de uploads correspondiente.
# 4. Aplica rotación local: purga respaldos locales con más de 7 días de antigüedad.
# 5. Si existe /opt/caprichos/restic.env o variables de entorno de restic, envía
#    la copia de manera cifrada a Cloudflare R2 / Backblaze B2 (ADR-012).
# ==============================================================================

set -euo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_COMPOSE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

AMBIENTE="${1:-}"

if [[ -z "$AMBIENTE" ]]; then
  echo "Uso: $0 <demo|staging|prod>" >&2
  exit 1
fi

case "$AMBIENTE" in
  demo|staging|prod) ;;
  *)
    echo "ERROR: Ambiente no válido '$AMBIENTE'. Use: demo, staging o prod." >&2
    exit 1
    ;;
esac

DIR_RESPALDOS="/opt/caprichos/respaldos/${AMBIENTE}"
if [[ ! -d "/opt/caprichos/respaldos" ]]; then
  DIR_RESPALDOS="${BASE_COMPOSE_DIR}/respaldos/${AMBIENTE}"
fi
mkdir -p "$DIR_RESPALDOS"

DIR_ENV="/opt/caprichos/${AMBIENTE}"
if [[ ! -d "$DIR_ENV" && -d "${BASE_COMPOSE_DIR}/${AMBIENTE}" ]]; then
  DIR_ENV="${BASE_COMPOSE_DIR}/${AMBIENTE}"
elif [[ ! -d "$DIR_ENV" ]]; then
  DIR_ENV="${BASE_COMPOSE_DIR}"
fi

ENV_FILE="${DIR_ENV}/.env"
COMPOSE_BASE="${BASE_COMPOSE_DIR}/docker-compose.base.yml"
COMPOSE_ENV="${BASE_COMPOSE_DIR}/docker-compose.${AMBIENTE}.yml"

if [[ ! -f "$COMPOSE_ENV" ]]; then
  echo "ERROR: No se encontró la definición de compose para '${AMBIENTE}'." >&2
  exit 1
fi

compose() {
  if [[ -f "$ENV_FILE" ]]; then
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_BASE" -f "$COMPOSE_ENV" "$@"
  else
    docker compose -f "$COMPOSE_BASE" -f "$COMPOSE_ENV" "$@"
  fi
}

FECHA="$(date +%Y%m%d_%H%M%S)"
ARCHIVO_DB="${DIR_RESPALDOS}/db_${AMBIENTE}_${FECHA}.sql.gz"
ARCHIVO_UPLOADS="${DIR_RESPALDOS}/uploads_${AMBIENTE}_${FECHA}.tar.gz"

echo "========================================================================"
echo "   COPIA DE SEGURIDAD — CAPRICHOS [${AMBIENTE^^}]"
echo "   Fecha: ${FECHA}"
echo "========================================================================"

# 1. Determinar usuario y base de datos
DB_USER=$(grep -E "^POSTGRES_USER=" "$ENV_FILE" 2>/dev/null | cut -d= -f2 || echo "caprichos_${AMBIENTE}")
DB_NAME=$(grep -E "^POSTGRES_DB=" "$ENV_FILE" 2>/dev/null | cut -d= -f2 || echo "caprichos_${AMBIENTE}")

# 2. Volcado de PostgreSQL
echo "==> [1/3] Generando volcado comprimido de PostgreSQL..."
if ! compose exec -T postgres pg_dump -U "$DB_USER" "$DB_NAME" | gzip -9 > "$ARCHIVO_DB"; then
  echo "ERROR: Falló la generación del volcado de base de datos." >&2
  rm -f "$ARCHIVO_DB"
  exit 1
fi
TAM_DB=$(du -h "$ARCHIVO_DB" | cut -f1)
echo "    ✓ Base de datos respaldada: $(basename "$ARCHIVO_DB") (${TAM_DB})"

# 3. Respaldo del volumen de uploads
echo "==> [2/3] Respaldando volumen de subidas y comprobantes..."
VOL_UPLOADS="caprichos_${AMBIENTE}_uploads_data"
if docker volume inspect "$VOL_UPLOADS" &>/dev/null; then
  docker run --rm \
    -v "${VOL_UPLOADS}:/datos:ro" \
    -v "${DIR_RESPALDOS}:/backup" \
    alpine tar -czf "/backup/$(basename "$ARCHIVO_UPLOADS")" -C /datos .
  TAM_UPLOADS=$(du -h "$ARCHIVO_UPLOADS" | cut -f1)
  echo "    ✓ Volumen uploads respaldado: $(basename "$ARCHIVO_UPLOADS") (${TAM_UPLOADS})"
else
  echo "    Aviso: Volumen ${VOL_UPLOADS} no encontrado o vacío. Se omitió empaquetado."
fi

# 4. Rotación local de respaldos (retención de 7 días)
echo "==> [3/3] Aplicando rotación local de respaldos (retención de 7 días)..."
BORRADOS=0
while IFS= read -r archivo; do
  if [[ -n "$archivo" ]]; then
    rm -f "$archivo"
    BORRADOS=$((BORRADOS + 1))
  fi
done < <(find "$DIR_RESPALDOS" -name "*.gz" -type f -mtime +7)

if [[ $BORRADOS -gt 0 ]]; then
  echo "    ✓ Se eliminaron ${BORRADOS} archivos antiguos de respaldo (> 7 días)."
else
  echo "    ✓ No hay archivos antiguos que requieran purga."
fi

echo ""
echo "========================================================================"
echo "   RESPALDO LOCAL COMPLETADO CON ÉXITO"
echo "========================================================================"
echo "Directorio de almacenamiento: ${DIR_RESPALDOS}"
ls -lh "${DIR_RESPALDOS}" | tail -n 5

# 5. Integración remota con restic (ADR-012)
RESTIC_ENV_FILE="/opt/caprichos/restic.env"
if [[ -f "$RESTIC_ENV_FILE" ]]; then
  # shellcheck source=/dev/null
  source "$RESTIC_ENV_FILE"
fi

if command -v restic &>/dev/null && [[ -n "${RESTIC_REPOSITORY:-}" && -n "${RESTIC_PASSWORD:-}" ]]; then
  echo "------------------------------------------------------------------------"
  echo "==> Enviando respaldo cifrado fuera del VPS con Restic (ADR-012)..."
  restic backup "$DIR_RESPALDOS" --tag "$AMBIENTE"
  restic forget --keep-daily 30 --keep-monthly 6 --prune --tag "$AMBIENTE"
  echo "    ✓ Respaldo Restic completado exitosamente."
else
  echo "------------------------------------------------------------------------"
  echo "RESPALDO REMOTO CIFRADO (ADR-012):"
  echo "Para enviar estas copias fuera del VPS a Cloudflare R2 o Backblaze B2:"
  echo "1. Cree el archivo /opt/caprichos/restic.env con:"
  echo "     export RESTIC_REPOSITORY='s3:https://<cuenta>.r2.cloudflarestorage.com/caprichos-backups'"
  echo "     export RESTIC_PASSWORD='<clave_maestra_restic>'"
  echo "     export AWS_ACCESS_KEY_ID='<key_id_r2>'"
  echo "     export AWS_SECRET_ACCESS_KEY='<secret_key_r2>'"
  echo "2. Inicialice el repositorio una sola vez: restic init"
  echo "3. Este script detectará restic.env automáticamente en cada ejecución."
fi
echo "========================================================================"
