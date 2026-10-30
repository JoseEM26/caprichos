#!/usr/bin/env bash
# ==============================================================================
# importar-datos-empresa.sh — Importa un paquete de datos de la empresa a PRODUCCIÓN
# ==============================================================================
# Uso (en el VPS):  ./importar-datos-empresa.sh prod <fecha|ruta> <simulacro|real>
#   <fecha>  : carpeta de /opt/caprichos/respaldos/datos-empresa/<fecha>/paquete (p. ej. 20261030_120000)
#   <ruta>   : ruta absoluta dentro de /opt/caprichos/respaldos/datos-empresa/
#   simulacro: muestra qué crearía/actualizaría/omitiría; no escribe (defecto del workflow).
#   real     : 1) respaldo completo de PRODUCCIÓN con respaldar.sh prod (si falla, no se importa)
#              2) importación en UNA transacción, sin borrar nada, idempotente.
# Solo existe el ambiente prod. Lo invoca el job importar-datos-produccion de deploy.yml,
# que exige tag en main, confirmación PRODUCCION y la frase IMPORTAR DATOS DE LA EMPRESA.
# No imprime secretos. El importador exige ENTORNO_DATOS=prod e IMPORTAR_PRODUCCION=SI (segunda barrera).
# ==============================================================================
set -euo pipefail
umask 077

AMBIENTE="${1:-}"
PAQUETE_ARG="${2:-}"
MODO="${3:-simulacro}"

uso() { echo "Uso: $0 prod <fecha|ruta> <simulacro|real>" >&2; exit 1; }
[[ "$AMBIENTE" == "prod" ]] || { echo "ERROR: la importación de datos solo se hace a producción (prod)." >&2; uso; }
case "$MODO" in simulacro|real) ;; *) uso ;; esac
[[ -n "$PAQUETE_ARG" ]] || uso
if [[ ! "$PAQUETE_ARG" =~ ^[A-Za-z0-9_./-]+$ ]] || [[ "$PAQUETE_ARG" == *".."* ]]; then
  echo "ERROR: el paquete debe ser una fecha o una ruta simple (sin espacios ni '..')." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "${SCRIPT_DIR}/../docker-compose.base.yml" ]]; then
  BASE_COMPOSE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
else
  BASE_COMPOSE_DIR="$(cd "${SCRIPT_DIR}/../compose" && pwd)"
fi

RAIZ="/opt/caprichos/respaldos/datos-empresa"
[[ -d "/opt/caprichos" ]] || RAIZ="${BASE_COMPOSE_DIR}/respaldos/datos-empresa"

if [[ "$PAQUETE_ARG" == */* ]]; then DIR_PAQUETE="$PAQUETE_ARG"; else DIR_PAQUETE="${RAIZ}/${PAQUETE_ARG}/paquete"; fi
DIR_PAQUETE="$(readlink -f "$DIR_PAQUETE" || true)"
[[ -n "$DIR_PAQUETE" && "$DIR_PAQUETE" == "$RAIZ"/* ]] || { echo "ERROR: el paquete debe estar dentro de ${RAIZ}." >&2; exit 1; }
[[ -f "${DIR_PAQUETE}/manifiesto.json" && -f "${DIR_PAQUETE}/datos.json" ]] || { echo "ERROR: ${DIR_PAQUETE} no es un paquete (falta manifiesto.json o datos.json)." >&2; exit 1; }

ENV_FILE="/opt/caprichos/prod/.env"
[[ -f "$ENV_FILE" ]] || { echo "ERROR: No existe ${ENV_FILE}." >&2; exit 1; }

compose() {
  docker compose --env-file "$ENV_FILE" -f "${BASE_COMPOSE_DIR}/docker-compose.base.yml" -f "${BASE_COMPOSE_DIR}/docker-compose.prod.yml" "$@"
}

echo "==> Paquete: ${DIR_PAQUETE}"
echo "==> Modo: ${MODO}"

ARGS=(--paquete=/paquete)
if [[ "$MODO" == "real" ]]; then
  echo "==> [1/2] Respaldo completo de PRODUCCIÓN antes de importar (respaldar.sh prod)"
  "${SCRIPT_DIR}/respaldar.sh" prod
  echo "==> [2/2] Importación real (una transacción; no borra nada)"
  ARGS+=(--confirmar="IMPORTAR DATOS DE LA EMPRESA" --sin-respaldo)
else
  echo "==> Simulacro (no escribe). Para importar de verdad: modo real, con la frase en el workflow."
fi

compose run --rm -T \
  -e ENTORNO_DATOS=prod \
  -e IMPORTAR_PRODUCCION=SI \
  -e HOME=/tmp \
  -v "${DIR_PAQUETE}:/paquete:ro" \
  api tsx prisma/migracion-datos/importar.ts "${ARGS[@]}"

if [[ "$MODO" == "real" ]]; then
  echo "==> Listo. El personal entra con clave inicial: el administrador genera la de cada cuenta"
  echo "    con datos:clave-inicial (ver docs/operacion/migrar-datos-empresa.md)."
fi
