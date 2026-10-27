#!/usr/bin/env bash
# ==============================================================================
# desplegar.sh — Despliegue de la versión de demostración de Caprichos
# ==============================================================================
# La demo convive con Dokploy: su Traefik (dokploy-traefik) ocupa 80 y 443 y enruta
# por la red «dokploy-network». Este script NO levanta ningún proxy propio.
#
# 1. Genera el archivo .env con secretos aleatorios (openssl) si no existe.
# 2. Comprueba que existan dokploy-network y el contenedor dokploy-traefik.
# 3. Levanta PostgreSQL y Redis y espera a que estén sanos.
# 4. Aplica las migraciones con `prisma migrate deploy`.
# 5. Aplica la semilla limpia de demostración (prisma/seed-demo.ts).
# 6. Levanta web y API (enrutadas por Traefik) y prueba la demo por HTTPS.
#
# Variables:
#   DOMINIO_BASE: host de la demo, p. ej. 207-244-232-127.sslip.io (por defecto: localhost)
#   TAG:          etiqueta de caprichos-api/caprichos-web (por defecto: demo)
#   HTTPS_PORT:   solo para pruebas locales con un Traefik en otro puerto (por defecto: 443)
#   SSH_HOST, SSH_USER (deploy), SSH_PORT (22), SSH_KEY: solo con --remote
#
# Uso en el VPS (dentro de /opt/caprichos-demo):
#   DOMINIO_BASE=207-244-232-127.sslip.io ./desplegar.sh
#
# Uso remoto desde tu equipo (copia los archivos y ejecuta aquí):
#   SSH_HOST=207.244.232.127 SSH_KEY=~/.ssh/id_ed25519_caprichos_vps \
#     DOMINIO_BASE=207-244-232-127.sslip.io ./desplegar.sh --remote
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIR_VPS="/opt/caprichos-demo"

# --- Modo remoto: copia los archivos y ejecuta este mismo script en el VPS ---
if [[ "${1:-}" == "--remote" ]]; then
  : "${SSH_HOST:?Debe definir SSH_HOST (ej. export SSH_HOST=207.244.232.127)}"
  : "${DOMINIO_BASE:?Debe definir DOMINIO_BASE (ej. export DOMINIO_BASE=207-244-232-127.sslip.io)}"
  SSH_USER="${SSH_USER:-deploy}"
  SSH_PORT="${SSH_PORT:-22}"
  OPCIONES_SSH=(-p "$SSH_PORT")
  OPCIONES_SCP=(-P "$SSH_PORT")
  if [[ -n "${SSH_KEY:-}" ]]; then
    OPCIONES_SSH+=(-i "$SSH_KEY")
    OPCIONES_SCP+=(-i "$SSH_KEY")
  fi

  echo "==> Copiando archivos de despliegue a ${SSH_USER}@${SSH_HOST}:${DIR_VPS}..."
  ssh "${OPCIONES_SSH[@]}" "${SSH_USER}@${SSH_HOST}" "mkdir -p ${DIR_VPS}"
  scp "${OPCIONES_SCP[@]}" \
    "${SCRIPT_DIR}/docker-compose.demo.yml" \
    "${SCRIPT_DIR}/desplegar.sh" \
    "${SCRIPT_DIR}/actualizar.sh" \
    "${SCRIPT_DIR}/docker-rollout" \
    "${SCRIPT_DIR}/respaldar.sh" \
    "${SCRIPT_DIR}/logs.sh" \
    "${SCRIPT_DIR}/estado.sh" \
    "${SCRIPT_DIR}/crear-usuarios-demo.sh" \
    "${SSH_USER}@${SSH_HOST}:${DIR_VPS}/"
  ssh "${OPCIONES_SSH[@]}" "${SSH_USER}@${SSH_HOST}" \
    "chmod +x ${DIR_VPS}/*.sh ${DIR_VPS}/docker-rollout 2>/dev/null || chmod +x ${DIR_VPS}/*"

  echo "==> Ejecutando despliegue en el VPS..."
  ssh "${OPCIONES_SSH[@]}" "${SSH_USER}@${SSH_HOST}" \
    "cd ${DIR_VPS} && DOMINIO_BASE='${DOMINIO_BASE}' TAG='${TAG:-demo}' ./desplegar.sh"
  exit 0
fi

# --- Ejecución en el VPS (o en una prueba local con la misma forma) ---
COMPOSE_FILE="docker-compose.demo.yml"
if [[ ! -f "$COMPOSE_FILE" && -f "${SCRIPT_DIR}/docker-compose.demo.yml" ]]; then
  COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.demo.yml"
fi
compose() { docker compose -f "$COMPOSE_FILE" "$@"; }

DOMINIO_BASE="${DOMINIO_BASE:-localhost}"
TAG="${TAG:-demo}"
HTTPS_PORT="${HTTPS_PORT:-443}"
ENV_FILE="$(dirname "$COMPOSE_FILE")/.env"

echo "========================================================================"
echo "   INICIANDO DESPLIEGUE — CAPRICHOS DEMO (${DOMINIO_BASE})"
echo "========================================================================"

# 1. Archivo .env con secretos
echo "==> [1/6] Archivo de entorno (.env)..."
if [[ ! -f "$ENV_FILE" ]]; then
  if docker volume inspect caprichos_demo_postgres_data &>/dev/null; then
    echo "ERROR: existe el volumen de PostgreSQL pero no el .env. Sin el .env las claves no" >&2
    echo "       coinciden con la base de datos. Restaure el .env desde su copia de respaldo." >&2
    exit 1
  fi
  PG_PASS="$(openssl rand -hex 24)"
  REDIS_PASS="$(openssl rand -hex 24)"
  JWT_SEC="$(openssl rand -hex 32)"
  umask 077
  cat << EOF > "$ENV_FILE"
# Generado por desplegar.sh. Permisos 600. Nunca al repositorio ni a un chat.
DOMINIO_BASE=${DOMINIO_BASE}
TAG=${TAG}

POSTGRES_DB=caprichos_demo
POSTGRES_USER=caprichos_demo
POSTGRES_PASSWORD=${PG_PASS}

REDIS_PASSWORD=${REDIS_PASS}
JWT_SECRET=${JWT_SEC}

APP_VERSION=0.1.0
EOF
  chmod 600 "$ENV_FILE"
  echo "    ✓ .env generado (secretos nuevos, permisos 600)."
else
  sed -i "s|^DOMINIO_BASE=.*|DOMINIO_BASE=${DOMINIO_BASE}|; s|^TAG=.*|TAG=${TAG}|" "$ENV_FILE"
  echo "    ✓ .env existente: se conservan los secretos."
fi

# 2. Red y Traefik de Dokploy (la demo no publica puertos propios)
echo "==> [2/6] Comprobando dokploy-network y dokploy-traefik..."
if ! docker network inspect dokploy-network &>/dev/null; then
  echo "ERROR: no existe la red dokploy-network. Dokploy debe estar instalado en este host." >&2
  exit 1
fi
if [[ "$(docker inspect --format '{{.State.Running}}' dokploy-traefik 2>/dev/null || echo false)" != "true" ]]; then
  echo "ERROR: dokploy-traefik no está en ejecución; sin él la demo no recibe tráfico." >&2
  exit 1
fi
echo "    ✓ dokploy-network y dokploy-traefik activos."

# 3. Bases de datos
echo "==> [3/6] Levantando PostgreSQL y Redis..."
compose up -d postgres redis
for ((i = 0; i < 60; i++)); do
  if compose exec -T postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' &>/dev/null \
    && [[ "$(docker inspect --format '{{.State.Health.Status}}' caprichos-demo-redis)" == "healthy" ]]; then
    break
  fi
  sleep 2
done
echo "    ✓ PostgreSQL y Redis sanos."

# 4. Migraciones (si fallan, no se toca la aplicación)
echo "==> [4/6] Migraciones de base de datos (prisma migrate deploy)..."
compose run --rm api prisma migrate deploy --schema=prisma/schema.prisma

# 5. Semilla limpia (idempotente: usa upserts)
echo "==> [5/6] Semilla limpia de demostración (carta, zonas, insumos, plano, legal)..."
compose run --rm api tsx prisma/seed-demo.ts

# 6. Web y API, y prueba de extremo a extremo por HTTPS a través de Traefik
echo "==> [6/6] Levantando web y API..."
compose up -d

for ((i = 0; i < 60; i++)); do
  PENDIENTES=0
  CONTENEDORES=($(compose ps -q 2>/dev/null || true))
  if [[ ${#CONTENEDORES[@]} -eq 0 ]]; then
    PENDIENTES=1
  else
    for CID in "${CONTENEDORES[@]}"; do
      ESTADO="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$CID" 2>/dev/null || echo ausente)"
      [[ "$ESTADO" == "healthy" || "$ESTADO" == "running" ]] || PENDIENTES=1
    done
  fi
  [[ $PENDIENTES -eq 0 ]] && break
  sleep 3
done
if [[ $PENDIENTES -ne 0 ]]; then
  compose ps
  echo "ERROR: no todos los servicios quedaron sanos. Revise: ./logs.sh" >&2
  exit 1
fi

URL_BASE="https://${DOMINIO_BASE}"
[[ "$HTTPS_PORT" == "443" ]] || URL_BASE="https://${DOMINIO_BASE}:${HTTPS_PORT}"
echo "==> Probando la demo por HTTPS (Traefik + certificado)..."
PRUEBA_OK=0
for ((i = 0; i < 40; i++)); do
  # --resolve: el host se resuelve a este servidor aunque el DNS todavía no esté listo;
  # -k: el certificado Let's Encrypt puede tardar unos segundos en emitirse la primera vez.
  if curl -fsk --resolve "${DOMINIO_BASE}:${HTTPS_PORT}:127.0.0.1" "${URL_BASE}/salud" -o /dev/null; then
    PRUEBA_OK=1
    break
  fi
  sleep 3
done
if [[ $PRUEBA_OK -ne 1 ]]; then
  echo "ERROR: la demo no responde en ${URL_BASE}/salud. Revise: docker logs dokploy-traefik y ./logs.sh" >&2
  exit 1
fi

echo "========================================================================"
echo "   DESPLIEGUE DE DEMOSTRACIÓN COMPLETADO"
echo "========================================================================"
compose ps
echo "------------------------------------------------------------------------"
echo "  Carta virtual:        ${URL_BASE}/"
echo "  Panel administrativo: ${URL_BASE}/admin"
echo "  Salud:                ${URL_BASE}/salud"
echo "  Aviso de demo:        ${URL_BASE}/demo"
echo "------------------------------------------------------------------------"
echo "  Siguiente paso (una sola vez): ./crear-usuarios-demo.sh"
echo "========================================================================"
