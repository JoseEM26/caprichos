#!/usr/bin/env bash
# ==============================================================================
# exportar-datos-empresa.sh — Exporta la configuración y el contenido de la DEMO a un paquete
# ==============================================================================
# Uso (en el VPS):  ./exportar-datos-empresa.sh [completo|solo-reporte]
# Solo lectura sobre la base de la DEMO. Solo existe el ambiente demo: nunca lee producción.
#   completo    : datos.json + archivos/ + manifiesto.json + reporte.md (+ .tar.gz)  [defecto]
#   solo-reporte: solo reporte.md (simulacro: qué saldría, sin datos ni archivos)
# El paquete queda en /opt/caprichos/respaldos/datos-empresa/<fecha>/ con permisos 0600.
# Variables opcionales: EXCLUIR_PRODUCTOS="NOMBRE1,NOMBRE2" (productos que no viajan) y SIN_PERSONAL=SI
# (no exporta cuentas del personal). El reporte se imprime (los DNI salen enmascarados). Nunca imprime secretos.
# Lo invoca el job exportar-datos-demo de .github/workflows/deploy.yml.
# ==============================================================================
set -euo pipefail
umask 077

MODO="${1:-completo}"
case "$MODO" in completo|solo-reporte) ;; *) echo "Uso: $0 [completo|solo-reporte]" >&2; exit 1 ;; esac

AMBIENTE="demo"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "${SCRIPT_DIR}/../docker-compose.base.yml" ]]; then
  BASE_COMPOSE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
else
  BASE_COMPOSE_DIR="$(cd "${SCRIPT_DIR}/../compose" && pwd)"
fi

DIR_ENV="/opt/caprichos/${AMBIENTE}"
[[ -d "$DIR_ENV" ]] || DIR_ENV="${BASE_COMPOSE_DIR}"
ENV_FILE="${DIR_ENV}/.env"
[[ -f "$ENV_FILE" ]] || { echo "ERROR: No existe ${ENV_FILE}." >&2; exit 1; }

compose() {
  docker compose --env-file "$ENV_FILE" -f "${BASE_COMPOSE_DIR}/docker-compose.base.yml" -f "${BASE_COMPOSE_DIR}/docker-compose.${AMBIENTE}.yml" "$@"
}

FECHA="$(date +%Y%m%d_%H%M%S)"
DIR_DATOS="/opt/caprichos/respaldos/datos-empresa"
[[ -d "/opt/caprichos" ]] || DIR_DATOS="${BASE_COMPOSE_DIR}/respaldos/datos-empresa"
DESTINO="${DIR_DATOS}/${FECHA}"
mkdir -p "$DESTINO"
chmod 700 "$DESTINO"

echo "==> Exportando la configuración y el contenido de la DEMO (solo lectura) [${MODO}]"
echo "    Carpeta: ${DESTINO}"

# La carpeta del host se monta en el contenedor; el usuario es el del host para que los ficheros no queden como root.
ARG_MODO=""
[[ "$MODO" == "solo-reporte" ]] && ARG_MODO="--solo-reporte"
compose run --rm -T \
  --user "$(id -u):$(id -g)" \
  -e ENTORNO_DATOS=demo \
  -e HOME=/tmp \
  -e EXCLUIR_PRODUCTOS="${EXCLUIR_PRODUCTOS:-}" \
  -e SIN_PERSONAL="${SIN_PERSONAL:-}" \
  -v "${DESTINO}:/salida" \
  api tsx prisma/migracion-datos/exportar.ts --salida=/salida/paquete ${ARG_MODO}

# Por si el contenedor dejó algún fichero con permisos laxos
find "$DESTINO" -type f -exec chmod 600 {} +
find "$DESTINO" -type d -exec chmod 700 {} +

echo "==> Paquete listo en ${DESTINO}/paquete (reporte: ${DESTINO}/paquete/reporte.md)"
echo "    Simulacro de importación a producción: ./importar-datos-empresa.sh prod ${FECHA} simulacro"
