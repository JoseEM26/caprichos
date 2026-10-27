#!/usr/bin/env bash
# ==============================================================================
# volver-atras.sh — Vuelta Atrás (Rollback) Inmediata a una Versión Anterior
# ==============================================================================
# Uso:
#   ./volver-atras.sh <demo|staging|prod> [tag_objetivo]
#
# Si no se especifica tag_objetivo, intenta leer la última versión estable registrada
# o solicita ingresar el tag de versión al operador.
# Emplea rolling rollout para restaurar la versión anterior sin interrumpir tráfico.
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

# 2. Restaurar api y web con rolling rollout hacia la versión previa (sin cortar tráfico)
rollout_restauracion() {
  local SERVICIO="$1"
  local TIMEOUT="${2:-60}"
  echo "==> Restaurando '${SERVICIO}' a la versión ${TAG_DESTINO} mediante rolling rollout..."

  chmod +x "${SCRIPT_DIR}/docker-rollout" 2>/dev/null || true
  if [[ -x "${SCRIPT_DIR}/docker-rollout" ]]; then
    if "${SCRIPT_DIR}/docker-rollout" rollout -f "$COMPOSE_BASE" -f "$COMPOSE_ENV" --env-file "$ENV_FILE" -t "$TIMEOUT" --wait-after-healthy 2 "$SERVICIO"; then
      return 0
    fi
    echo "AVISO: Falló el rolling rollout de vuelta atrás para '${SERVICIO}'. Recreando como último recurso..." >&2
  else
    echo "AVISO: ${SCRIPT_DIR}/docker-rollout no disponible. Recreando contenedor..." >&2
  fi

  compose up -d --no-deps "$SERVICIO"
}

rollout_restauracion api 60
rollout_restauracion web 30

# 3. Comprobar salud tras la restauración mediante IDs dinámicos
echo "==> Verificando salud de los contenedores restaurados..."
INTENTOS=0
MAX_INTENTOS=25
SALUDABLE=0

while [[ $INTENTOS -lt $MAX_INTENTOS ]]; do
  API_IDS=$(compose ps -q api 2>/dev/null || true)
  WEB_IDS=$(compose ps -q web 2>/dev/null || true)

  TODOS_OK=1
  for CID in $API_IDS $WEB_IDS; do
    [[ -z "$CID" ]] && { TODOS_OK=0; continue; }
    STATUS=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$CID" 2>/dev/null || echo "ausente")
    if [[ "$STATUS" != "healthy" ]]; then
      TODOS_OK=0
      break
    fi
  done

  if [[ $TODOS_OK -eq 1 ]]; then
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
  # NOTA DE SEGURIDAD: En vuelta atrás (rollback) NO se ejecuta limpieza automática de imágenes
  # para preservar los artefactos de la versión previa y fallida para diagnóstico forense.
  compose ps
  exit 0
else
  echo "ERROR: La versión restaurada ${TAG_DESTINO} no alcanzó estado saludable." >&2
  echo "Revise los registros con ./logs.sh ${AMBIENTE}" >&2
  exit 1
fi
