#!/usr/bin/env bash
# ==============================================================================
# crear-usuarios-demo.sh — Generación única de accesos iniciales por rol
# ==============================================================================
# Crea o restablece un usuario por cada rol operativo del negocio:
#   1. ADMIN       (Administrador General)
#   2. CAJERO      (Cajero de turno)
#   3. MOZO        (Mozo de salón / tablet)
#   4. COCINA      (Cocinero / pantalla de comandas)
#   5. ALMACEN     (Encargado de almacén y stock)
#   6. REPARTIDOR  (Repartidor / motorizado de delivery)
#
# Genera contraseñas aleatorias de 16 caracteres criptográficamente seguras con
# OpenSSL/Node.js crypto, aplica hash argon2id y activa la bandera debeCambiar=true
# para exigir el cambio de clave al primer ingreso.
#
# Las credenciales se muestran UNA SOLA VEZ en la terminal del operador y NUNCA
# se guardan en archivos del servidor, ni en el repositorio, ni en informes.
#
# Uso:
#   ./crear-usuarios-demo.sh
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="docker-compose.demo.yml"
if [[ ! -f "$COMPOSE_FILE" && -f "${SCRIPT_DIR}/docker-compose.demo.yml" ]]; then
  COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.demo.yml"
fi

echo "==> Generando usuarios de demostración en el contenedor API..."
docker compose -f "$COMPOSE_FILE" exec -T api tsx prisma/seed-usuarios-demo.ts
