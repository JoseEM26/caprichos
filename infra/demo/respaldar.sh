#!/usr/bin/env bash
# ==============================================================================
# respaldar.sh — Copia de seguridad local (PostgreSQL + Uploads) con rotación
# ==============================================================================
# 1. Genera volcado comprimido de PostgreSQL (pg_dump + gzip).
# 2. Empaqueta el volumen de fotos y comprobantes (uploads_data).
# 3. Aplica política de rotación: conserva los últimos 7 días de respaldos.
# 4. Informa el tamaño y estado de las copias generadas.
#
# Próximo paso para producción (ADR-012):
#   Configuración de restic hacia almacenamiento remoto compatible con S3
#   (Cloudflare R2 o Backblaze B2) mediante tarea programada en systemd/cron.
#
# Uso:
#   ./respaldar.sh
# ==============================================================================

set -euo pipefail
# Los volcados llevan datos personales de clientes: solo legibles por el usuario de despliegue
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIR_RESPALDOS="${SCRIPT_DIR}/respaldos"
mkdir -p "$DIR_RESPALDOS"

COMPOSE_FILE="docker-compose.demo.yml"
if [[ ! -f "$COMPOSE_FILE" && -f "${SCRIPT_DIR}/docker-compose.demo.yml" ]]; then
  COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.demo.yml"
fi

FECHA="$(date +%Y%m%d_%H%M%S)"
ARCHIVO_DB="${DIR_RESPALDOS}/db_caprichos_${FECHA}.sql.gz"
ARCHIVO_UPLOADS="${DIR_RESPALDOS}/uploads_caprichos_${FECHA}.tar.gz"

echo "========================================================================"
echo "   COPIA DE SEGURIDAD — CAPRICHOS DEMO"
echo "   Fecha: ${FECHA}"
echo "========================================================================"

# 1. Volcado de PostgreSQL
echo "==> [1/3] Generando volcado comprimido de PostgreSQL..."
if ! docker compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U caprichos_demo caprichos_demo | gzip -9 > "$ARCHIVO_DB"; then
  echo "ERROR: Falló la generación de la copia de seguridad de la base de datos." >&2
  rm -f "$ARCHIVO_DB"
  exit 1
fi

TAM_DB=$(du -h "$ARCHIVO_DB" | cut -f1)
echo "    ✓ Base de datos respaldada: $(basename "$ARCHIVO_DB") (${TAM_DB})"

# 2. Respaldo de archivos y fotos (uploads_data)
echo "==> [2/3] Respaldando volumen de fotos y archivos (uploads_data)..."
VOL_UPLOADS="caprichos_demo_uploads_data"
if docker volume inspect "$VOL_UPLOADS" &>/dev/null; then
  docker run --rm \
    -v "${VOL_UPLOADS}:/datos:ro" \
    -v "${DIR_RESPALDOS}:/backup" \
    alpine tar -czf "/backup/$(basename "$ARCHIVO_UPLOADS")" -C /datos .
  
  TAM_UPLOADS=$(du -h "$ARCHIVO_UPLOADS" | cut -f1)
  echo "    ✓ Volumen uploads respaldado: $(basename "$ARCHIVO_UPLOADS") (${TAM_UPLOADS})"
else
  echo "    AVISO: Volumen ${VOL_UPLOADS} no encontrado o vacío. Se omitió empaquetado."
fi

# 3. Rotación de respaldos antiguos (retener 7 días)
echo "==> [3/3] Aplicando rotación de respaldos (retención de 7 días)..."
BORRADOS=0
while IFS= read -r archivo; do
  if [[ -n "$archivo" ]]; then
    rm -f "$archivo"
    BORRADOS=$((BORRADOS + 1))
  fi
done < <(find "$DIR_RESPALDOS" -name "*.gz" -type f -mtime +7)

if [[ $BORRADOS -gt 0 ]]; then
  echo "    ✓ Se eliminaron ${BORRADOS} archivos de respaldo anteriores a 7 días."
else
  echo "    ✓ No hay respaldos antiguos que requieran purga."
fi

echo ""
echo "========================================================================"
echo "   RESPALDO COMPLETADO CON ÉXITO"
echo "========================================================================"
echo "Directorio de respaldos: ${DIR_RESPALDOS}"
ls -lh "${DIR_RESPALDOS}"
echo "------------------------------------------------------------------------"
echo "PRÓXIMO PASO PARA PRODUCCIÓN (ADR-012):"
echo "Para enviar estas copias fuera del VPS de manera cifrada a Cloudflare R2"
echo "o Backblaze B2, configurar restic mediante RB-CAP-002:"
echo "  restic -r s3:https://<account>.r2.cloudflarestorage.com/caprichos-backups backup ${DIR_RESPALDOS}"
echo "========================================================================"
