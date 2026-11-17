#!/usr/bin/env bash
# ==============================================================================
# crear-admin-demo.sh — Administrador de PRUEBA de la DEMO (solo demo, nunca producción)
# ==============================================================================
# Uso (en el VPS):  printf '%s\n' "<clave>" | ./crear-admin-demo.sh <dni_8_digitos>
#   o bien:         CLAVE_DEMO_ADMIN="<clave>" ./crear-admin-demo.sh <dni_8_digitos>
# La clave NUNCA va por argumento, no se imprime ni se guarda en archivos. Si viene por stdin
# (así la pasa el job crear-admin-demo de deploy.yml), la primera línea se lee como CLAVE_DEMO_ADMIN.
# Crea o actualiza (idempotente) el ADMIN con ese DNI: cambia la clave, lo deja activo y sin cambio obligatorio.
# Lo ejecuta apps/api/prisma/crear-admin-demo.ts dentro del contenedor api de la demo.
# ==============================================================================
set -euo pipefail
umask 077

DNI="${1:-}"
[[ "$DNI" =~ ^[0-9]{8}$ ]] || { echo "ERROR: el DNI debe tener exactamente 8 dígitos." >&2; exit 1; }

if [[ ! -t 0 && -z "${CLAVE_DEMO_ADMIN:-}" ]]; then
  IFS= read -r CLAVE_DEMO_ADMIN || true
fi
CLAVE_DEMO_ADMIN="${CLAVE_DEMO_ADMIN:-}"
(( ${#CLAVE_DEMO_ADMIN} >= 8 )) || { echo "ERROR: falta la clave (mínimo 8 caracteres); no se muestra." >&2; exit 1; }
export CLAVE_DEMO_ADMIN

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "${SCRIPT_DIR}/../docker-compose.base.yml" ]]; then
  BASE_COMPOSE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
else
  BASE_COMPOSE_DIR="$(cd "${SCRIPT_DIR}/../compose" && pwd)"
fi
ENV_FILE="/opt/caprichos/demo/.env"
[[ -f "$ENV_FILE" ]] || { echo "ERROR: No existe ${ENV_FILE}." >&2; exit 1; }

TAG=$(grep -E '^TAG=' "$ENV_FILE" | tail -1 | cut -d= -f2)
[[ -n "$TAG" && "$TAG" != "inicial" ]] || { echo "ERROR: la demo todavía no está desplegada (TAG=${TAG:-vacío})." >&2; exit 1; }

# Guarda de ambiente: el compose de demo fija AMBIENTE_DESPLIEGUE=demo y el script TS rechaza cualquier otra base.
echo "==> Creando/actualizando el administrador de prueba de la DEMO (DNI ${DNI})..."
SALIDA=$(docker compose --env-file "$ENV_FILE" -f "${BASE_COMPOSE_DIR}/docker-compose.base.yml" -f "${BASE_COMPOSE_DIR}/docker-compose.demo.yml" \
  run --rm -T -e DNI_ADMIN_DEMO="$DNI" -e CLAVE_DEMO_ADMIN -e HOME=/tmp api tsx prisma/crear-admin-demo.ts 2>&1) \
  || { echo "ERROR: falló crear el administrador de prueba." >&2; echo "$SALIDA" | tail -15 >&2; exit 1; }

echo "$SALIDA" | grep -E '^(OK|ERROR):' || true
