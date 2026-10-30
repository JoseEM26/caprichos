#!/usr/bin/env bash
# ==============================================================================
# preparar-produccion.sh — Crea /opt/caprichos/prod/.env (solo si no existe)
# ==============================================================================
# Uso (en el VPS):  ./preparar-produccion.sh <simulacro|real>
# Genera POSTGRES_PASSWORD, REDIS_PASSWORD y JWT_SECRET al azar EN EL SERVIDOR y
# nunca los imprime. No despliega, no toca la demo ni ninguna base. Si el .env ya
# existe, no lo modifica. WhatsApp/OpenAI quedan vacíos hasta conectar la app de Meta de producción.
# ==============================================================================
set -euo pipefail
umask 077

MODO="${1:-simulacro}"
case "$MODO" in simulacro|real) ;; *) echo "Uso: $0 <simulacro|real>" >&2; exit 1 ;; esac

DIR="/opt/caprichos/prod"
ENV_FILE="${DIR}/.env"
DEMO_ENV="/opt/caprichos/demo/.env"
DOMINIOS=(caprichos.pe admin.caprichos.pe api.caprichos.pe)

echo "== Preparar producción =="
for d in "${DOMINIOS[@]}"; do
  if getent hosts "$d" >/dev/null 2>&1; then echo "DNS: ${d} resuelve."; else echo "AVISO: ${d} no resuelve todavía en DNS."; fi
done

if [[ -f "$DEMO_ENV" ]] && grep -E '^DOMINIO_(DEMO|ALT|ALT2)=' "$DEMO_ENV" | grep -qE '=("|'"'"')?caprichos\.pe("|'"'"')?$'; then
  echo "AVISO: la demo todavía atiende caprichos.pe; hay que quitarlo (configurar-dominios-demo) antes del primer despliegue de producción."
fi

if [[ -f "$ENV_FILE" ]]; then
  echo "Ya existe ${ENV_FILE}: no se modifica."
  exit 0
fi

if [[ "$MODO" == "simulacro" ]]; then
  echo "Simulacro: crearía ${ENV_FILE} (600) con TAG=inicial, dominios de producción y claves aleatorias. No se escribió nada."
  exit 0
fi

command -v openssl >/dev/null || { echo "ERROR: falta openssl en el servidor." >&2; exit 1; }
mkdir -p "$DIR"
chmod 750 "$DIR"
{
  echo "TAG=inicial"
  echo "GHCR_REPO=ghcr.io/joseem26"
  echo "DOMINIO_PROD=caprichos.pe"
  echo "DOMINIO_ADMIN=admin.caprichos.pe"
  echo "DOMINIO_API=api.caprichos.pe"
  echo "CARTA_URL_PUBLICA=https://caprichos.pe"
  echo "POSTGRES_DB=caprichos_prod"
  echo "POSTGRES_USER=caprichos_prod"
  echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)"
  echo "REDIS_PASSWORD=$(openssl rand -hex 24)"
  echo "JWT_SECRET=$(openssl rand -hex 32)"
} > "$ENV_FILE"
chmod 600 "$ENV_FILE"
echo "OK: creado ${ENV_FILE} (600) con claves aleatorias. WhatsApp y OpenAI quedan vacíos."
