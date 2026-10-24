#!/usr/bin/env bash
# ==============================================================================
# construir-y-enviar.sh — Construye las imágenes localmente y las envía por SSH
# ==============================================================================
# Construye las imágenes de la API y de la Web usando los Dockerfile del proyecto
# y las etiqueta con el commit actual (ej. 3a7b9c1) y con la etiqueta :demo.
# Si se provee SSH_HOST, las envía directamente al VPS por streaming (docker save | ssh docker load),
# sin necesidad de publicar en registros externos como GHCR ni Docker Hub.
#
# Variables de entorno opcionales:
#   SSH_HOST: IP o hostname del VPS (ej. 203.0.113.10)
#   SSH_USER: Usuario SSH en el VPS (por defecto: deploy)
#   SSH_PORT: Puerto SSH en el VPS (por defecto: 22)
#   SSH_KEY:  Ruta a la llave privada SSH (ej. ~/.ssh/id_ed25519)
#   TAG:      Etiqueta personalizada (por defecto: commit corto de git)
#
# Uso:
#   # Solo construir localmente:
#   ./construir-y-enviar.sh --local-only
#
#   # Construir y enviar al VPS:
#   SSH_HOST=203.0.113.10 ./construir-y-enviar.sh
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Determinar etiqueta de versión (commit o parámetro)
TAG="${TAG:-$(git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || echo "demo")}"

echo "========================================================================"
echo "   CONSTRUCCIÓN Y ENVÍO DE IMÁGENES — CAPRICHOS DEMO"
echo "   Tag: ${TAG}"
echo "========================================================================"

cd "$ROOT_DIR"

# 1. Construir imagen de la API
echo "==> [1/3] Construyendo imagen de la API (Dockerfile.api)..."
docker build \
  -f infra/docker/Dockerfile.api \
  -t "caprichos-api:${TAG}" \
  -t "caprichos-api:demo" \
  .

# 2. Construir imagen del Frontend Web
echo "==> [2/3] Construyendo imagen de la Web (Dockerfile.web)..."
docker build \
  -f infra/docker/Dockerfile.web \
  -t "caprichos-web:${TAG}" \
  -t "caprichos-web:demo" \
  .

echo "==> Imágenes construidas exitosamente en la máquina local:"
echo "    - caprichos-api:${TAG} y caprichos-api:demo"
echo "    - caprichos-web:${TAG} y caprichos-web:demo"

# 3. Enviar por SSH si se indicó SSH_HOST
if [[ "${1:-}" == "--local-only" ]]; then
  echo "==> Modo --local-only activado. No se transmitieron imágenes por SSH."
  exit 0
fi

if [[ -z "${SSH_HOST:-}" ]]; then
  echo "AVISO: No se definió SSH_HOST. Las imágenes quedaron listas en local."
  echo "Para enviarlas a un VPS remoto:"
  echo "  SSH_HOST=<IP_DEL_VPS> [SSH_USER=deploy] [SSH_KEY=~/.ssh/id_ed25519] $0"
  exit 0
fi

SSH_USER="${SSH_USER:-deploy}"
SSH_PORT="${SSH_PORT:-22}"
SSH_KEY_OPT=()
if [[ -n "${SSH_KEY:-}" ]]; then
  SSH_KEY_OPT=(-i "$SSH_KEY")
fi

echo "==> [3/3] Transfiriendo imágenes por streaming SSH a ${SSH_USER}@${SSH_HOST}:${SSH_PORT}..."
echo "    (Streaming mediante docker save | ssh docker load sin archivos temporales en disco)..."

docker save \
  "caprichos-api:${TAG}" \
  "caprichos-api:demo" \
  "caprichos-web:${TAG}" \
  "caprichos-web:demo" | \
  ssh -p "$SSH_PORT" "${SSH_KEY_OPT[@]}" "${SSH_USER}@${SSH_HOST}" "docker load"

echo "========================================================================"
echo "   ENVÍO COMPLETADO CON ÉXITO AL VPS (${SSH_HOST})"
echo "   Las imágenes están listas para ser desplegadas."
echo "========================================================================"
