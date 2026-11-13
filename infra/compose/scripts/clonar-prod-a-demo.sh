#!/usr/bin/env bash
# ==============================================================================
# clonar-prod-a-demo.sh — Deja la DEMO (preproduccion) igual que PRODUCCION
# ==============================================================================
# Uso (en el VPS):  ./clonar-prod-a-demo.sh [--aplicar]
# Sin --aplicar solo muestra que haria (simulacro). Con --aplicar:
#   1. Respalda la demo actual (para poder volver).
#   2. Toma el ultimo respaldo nocturno de produccion (db_prod_*.sql.gz). Produccion solo se LEE.
#   3. Detiene la API de la demo, vacia SOLO la base de la demo y restaura el volcado.
#   4. Copia las fotos y comprobantes del volumen de produccion al de la demo.
#   5. Apaga los avisos automaticos de WhatsApp de la demo y descarta su cola, para no escribir a clientes reales.
#   6. Vacia el Redis de la demo (sesiones y codigos) y levanta la API.
# No imprime datos de clientes, solo conteos.
# ==============================================================================
set -euo pipefail
umask 077

APLICAR=0; [[ "${1:-}" == "--aplicar" ]] && APLICAR=1
DIR_PROD="/opt/caprichos/respaldos/prod"
DUMP=$(ls -1t "${DIR_PROD}"/db_prod_*.sql.gz 2>/dev/null | head -1 || true)
[[ -n "$DUMP" ]] || { echo "ERROR: no hay respaldos db_prod_*.sql.gz en ${DIR_PROD}." >&2; exit 1; }
EDAD_H=$(( ( $(date +%s) - $(stat -c %Y "$DUMP") ) / 3600 ))
echo "== Clonar PRODUCCION -> DEMO =="
echo "Respaldo de produccion: $(basename "$DUMP") · $(du -h "$DUMP" | cut -f1) · hace ${EDAD_H} h"
[[ "$EDAD_H" -le 48 ]] || { echo "ERROR: el respaldo tiene mas de 48 horas; no se clona algo tan viejo." >&2; exit 1; }
gzip -t "$DUMP" || { echo "ERROR: el respaldo esta danado." >&2; exit 1; }

ENV_DEMO="/opt/caprichos/demo/.env"
DB_USER=$(grep -E "^POSTGRES_USER=" "$ENV_DEMO" | cut -d= -f2)
DB_NAME=$(grep -E "^POSTGRES_DB=" "$ENV_DEMO" | cut -d= -f2)
PROD_USER=$(gzip -dc "$DUMP" | grep -m1 -oE 'OWNER TO [A-Za-z0-9_]+' | awk '{print $3}' || true)
echo "Base de la demo: ${DB_NAME} (usuario ${DB_USER}) · dueno en el volcado: ${PROD_USER:-?}"
PSQL=(docker exec -i caprichos-demo-postgres psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME")

if [[ $APLICAR -ne 1 ]]; then
  echo "SIMULACRO: no se cambio nada. Para aplicar, lanzar la accion con aplicar_clon=true."
  exit 0
fi

echo "==> [1/6] Respaldo de la demo actual..."
/opt/caprichos/scripts/respaldar.sh demo >/dev/null
API=$(docker ps --filter "name=caprichos-demo-api" --format '{{.Names}}')
echo "==> [2/6] Deteniendo la API de la demo (${API:-ninguna})..."
[[ -z "$API" ]] || docker stop $API >/dev/null
reiniciar() { [[ -z "${API:-}" ]] || docker start $API >/dev/null 2>&1 || true; }
trap reiniciar EXIT

echo "==> [3/6] Restaurando la base de produccion en la demo..."
"${PSQL[@]}" -q -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" >/dev/null
# El volcado nombra al dueno de produccion; en la demo es otro usuario
gzip -dc "$DUMP" | sed "s/${PROD_USER}/${DB_USER}/g" | "${PSQL[@]}" -q >/dev/null
echo "    tablas: $("${PSQL[@]}" -tA -c "select count(*) from information_schema.tables where table_schema='public'")"
echo "    pedidos: $("${PSQL[@]}" -tA -c 'select count(*) from pedido') · usuarios: $("${PSQL[@]}" -tA -c 'select count(*) from user_account')"

echo "==> [4/6] Copiando fotos y comprobantes..."
if docker volume inspect caprichos_prod_uploads_data >/dev/null 2>&1 && docker volume inspect caprichos_demo_uploads_data >/dev/null 2>&1; then
  docker run --rm -v caprichos_prod_uploads_data:/origen:ro -v caprichos_demo_uploads_data:/destino alpine \
    sh -c 'rm -rf /destino/* /destino/.[!.]* 2>/dev/null; cp -a /origen/. /destino/'
  echo "    ✓ archivos copiados"
else
  echo "    Aviso: falta uno de los volumenes de archivos; se omitio."
fi

echo "==> [5/6] La demo no debe escribirle a clientes reales..."
"${PSQL[@]}" -q -c "UPDATE parametro SET valor='\"no\"'::jsonb WHERE clave LIKE 'whatsapp\_aviso\_%\_activo';" >/dev/null
"${PSQL[@]}" -q -c "UPDATE saliente_whatsapp SET estado='DESCARTADO', descartado_en=now(), descartado_por='clonar-prod-a-demo', motivo_descarte='Clon de produccion a la demo' WHERE estado IN ('PENDIENTE','ENVIANDO');" >/dev/null
echo "    avisos apagados: $("${PSQL[@]}" -tA -c "select count(*) from parametro where clave like 'whatsapp\_aviso\_%\_activo' and valor='\"no\"'::jsonb")"

echo "==> [6/6] Vaciando Redis de la demo y levantando la API..."
docker exec caprichos-demo-redis sh -c 'redis-cli ${REDIS_PASSWORD:+-a "$REDIS_PASSWORD"} FLUSHALL' >/dev/null 2>&1 || echo "    Aviso: no se pudo vaciar Redis (revisar su clave)."
reiniciar; trap - EXIT
echo "OK: la demo quedo igual que produccion (respaldo $(basename "$DUMP")). Los avisos de WhatsApp de la demo quedaron apagados."
