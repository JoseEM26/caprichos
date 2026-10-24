#!/usr/bin/env bash
# ==============================================================================
# volver-atras.sh — Vuelta Atrás (Rollback) Inmediata a una Versión Anterior
# ==============================================================================
# Uso:
#   ./volver-atras.sh <demo|staging|prod> [tag_objetivo]
#
# Si no se especifica tag_objetivo, intenta leer la última versión estable registrada
# o solicita ingresar el tag de versión al operador.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_COMPOSE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

AMBIENTE="${1:-}"
TAG_DESTINO="${2:-}"

if [[ -z "$AMBIENTE" ]]; then
  echo "Uso: $0 <demo|staging|prod> [tag_destino]" >&2
  exit 1
fi

case "$AMBIENTE" in
  demo|staging|prod) ;;
  *)
    echo "ERROR: Ambiente no válido '$AMBIENTE'. Use: demo, staging o prod." >&2
    exit 1
    ;;
esac

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
  exit 1
fi

COMPOSE_BASE="${BASE_COMPOSE_DIR}/docker-compose.base.yml"
COMPOSE_ENV="${BASE_COMPOSE_DIR}/docker-compose.${AMBIENTE}.yml"

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_BASE" -f "$COMPOSE_ENV" "$@"
}

TAG_ACTUAL=$(grep -E "^TAG=" "$ENV_FILE" | cut -d= -f2 || echo "desconocido")

if [[ -z "$TAG_DESTINO" || "$TAG_DESTINO" == "inicial" ]]; then
  echo "Versión actualmente configurada en .env: ${TAG_ACTUAL}"
  read -r -p "Ingrese la etiqueta de versión a la cual desea regresar: " TAG_DESTINO
  if [[ -z "$TAG_DESTINO" ]]; then
    echo "Operación cancelada. No se indicó versión destino." >&2
    exit 1
  fi
fi

echo "========================================================================"
echo "   EJECUTANDO VUELTA ATRÁS — CAPRICHOS [${AMBIENTE^^}]"
echo "   Versión actual:  ${TAG_ACTUAL}"
echo "   Versión destino: ${TAG_DESTINO}"
echo "========================================================================"

# 1. Actualizar .env a la versión destino
sed -i "s|^TAG=.*|TAG=${TAG_DESTINO}|" "$ENV_FILE"
export TAG="$TAG_DESTINO"

# 2. Recrear api y web con la versión previa
echo "==> Recreando contenedores api y web con la imagen ${TAG_DESTINO}..."
compose up -d --no-deps api web

# 3. Comprobar salud tras la restauración
echo "==> Verificando salud de los contenedores restaurados..."
INTENTOS=0
MAX_INTENTOS=25
SALUDABLE=0

while [[ $INTENTOS -lt $MAX_INTENTOS ]]; do
  API_STATUS=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "caprichos-${AMBIENTE}-api" 2>/dev/null || echo "ausente")
  WEB_STATUS=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "caprichos-${AMBIENTE}-web" 2>/dev/null || echo "ausente")

  if [[ "$API_STATUS" == "healthy" && "$WEB_STATUS" == "healthy" ]]; then
    SALUDABLE=1
    break
  fi
  INTENTOS=$((INTENTOS + 1))
  sleep 2
done

if [[ $SALUDABLE -eq 1 ]]; then
  echo "    ✓ Contenedores restaurados y en estado 'healthy'."
  echo "========================================================================"
  echo "   VUELTA ATRÁS EXITOSA [${AMBIENTE^^}]"
  echo "   Versión activa: ${TAG_DESTINO}"
  echo "========================================================================"
  compose ps
  exit 0
else
  echo "ERROR: La versión restaurada ${TAG_DESTINO} no alcanzó estado saludable." >&2
  echo "Revise los registros con ./logs.sh ${AMBIENTE}" >&2
  exit 1
fi
