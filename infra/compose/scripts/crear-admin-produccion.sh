#!/usr/bin/env bash
# ==============================================================================
# crear-admin-produccion.sh — Crea los roles y el primer ADMIN de PRODUCCIÓN
# ==============================================================================
# Uso (en el VPS):  ./crear-admin-produccion.sh <dni_8_digitos>
# Corre prisma/seed.ts (idempotente). La clave inicial aleatoria NO se imprime:
# se guarda en /opt/caprichos/prod/admin-inicial.txt (600) para leerla por SSH y borrarla.
# Requiere que producción ya esté desplegada (migraciones aplicadas).
# ==============================================================================
set -euo pipefail
umask 077

DNI="${1:-}"
[[ "$DNI" =~ ^[0-9]{8}$ ]] || { echo "ERROR: el DNI debe tener exactamente 8 dígitos." >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "${SCRIPT_DIR}/../docker-compose.base.yml" ]]; then
  BASE_COMPOSE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
else
  BASE_COMPOSE_DIR="$(cd "${SCRIPT_DIR}/../compose" && pwd)"
fi
ENV_FILE="/opt/caprichos/prod/.env"
SALIDA="/opt/caprichos/prod/admin-inicial.txt"
[[ -f "$ENV_FILE" ]] || { echo "ERROR: No existe ${ENV_FILE}." >&2; exit 1; }

TAG=$(grep -E '^TAG=' "$ENV_FILE" | tail -1 | cut -d= -f2)
[[ -n "$TAG" && "$TAG" != "inicial" ]] || { echo "ERROR: producción todavía no está desplegada (TAG=${TAG:-vacío})." >&2; exit 1; }

echo "==> Ejecutando el seed de producción (roles y administrador inicial)..."
SALIDA_SEED=$(docker compose --env-file "$ENV_FILE" -f "${BASE_COMPOSE_DIR}/docker-compose.base.yml" -f "${BASE_COMPOSE_DIR}/docker-compose.prod.yml" \
  run --rm -T -e SEED_ADMIN_DNI="$DNI" -e HOME=/tmp api tsx prisma/seed.ts 2>&1) || { echo "ERROR: falló el seed." >&2; echo "$SALIDA_SEED" | grep -v 'Contraseña' | tail -15 >&2; exit 1; }

CLAVE=$(printf '%s\n' "$SALIDA_SEED" | sed -n 's/^Contraseña: //p' | head -1)
if [[ -n "$CLAVE" ]]; then
  printf 'DNI: %s\nClave inicial: %s\nCámbiela al ingresar y borre este archivo.\n' "$DNI" "$CLAVE" > "$SALIDA"
  chmod 600 "$SALIDA"
  echo "OK: administrador creado (DNI ${DNI}). La clave inicial quedó en ${SALIDA} (600); léala por SSH y bórrela."
else
  echo "OK: el administrador ya existía; no se cambió ninguna clave."
fi
