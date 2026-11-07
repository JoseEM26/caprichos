#!/usr/bin/env bash
# ==============================================================================
# copiar-ia-a-prod.sh — Copia la clave de la IA (OpenAI) de la DEMO al .env de PRODUCCIÓN, en el servidor
# ==============================================================================
# Uso (en el VPS):  ./copiar-ia-a-prod.sh
# Lee OPENAI_API_KEY (y OPENAI_MODEL si existe) de /opt/caprichos/demo/.env y los escribe en /opt/caprichos/prod/.env.
# La clave nunca sale del servidor ni se imprime: solo su longitud. Flujo: copia fechada del .env de prod (600) ->
# escribe las variables -> redespliega prod con el MISMO TAG -> comprueba /salud y que el contenedor recibe la clave ->
# si algo falla, restaura la copia y vuelve a desplegar.
# Pruebas: CAPRICHOS_RAIZ apunta a otra raíz; IA_REINTENTOS y IA_PAUSA ajustan la espera.
# ==============================================================================
set -euo pipefail
umask 077
export LC_ALL=C

AMBIENTE="prod"
ORIGEN_AMBIENTE="demo"
RAIZ="${CAPRICHOS_RAIZ:-/opt/caprichos}"
REINTENTOS="${IA_REINTENTOS:-20}"
PAUSA="${IA_PAUSA:-3}"

ENV_FILE="${RAIZ}/${AMBIENTE}/.env"
ENV_ORIGEN="${RAIZ}/${ORIGEN_AMBIENTE}/.env"
DESPLEGAR="${RAIZ}/scripts/desplegar.sh"
COMPOSE_DIR="${RAIZ}/compose"

# Lee una variable de un .env (sin comillas)
leer_de() {
  local archivo="$1" clave="$2" v
  v=$(grep -E "^${clave}=" "$archivo" | tail -1 || true)
  v="${v#*=}"
  v="${v%\"}"; v="${v#\"}"
  v="${v%\'}"; v="${v#\'}"
  printf '%s' "$v"
}

if [[ ! -f "$ENV_ORIGEN" ]]; then
  echo "ERROR: no existe ${ENV_ORIGEN} (la demo no tiene .env en este servidor)." >&2
  exit 1
fi
CLAVE=$(leer_de "$ENV_ORIGEN" OPENAI_API_KEY | tr -d '[:space:]')
MODELO=$(leer_de "$ENV_ORIGEN" OPENAI_MODEL | tr -d '[:space:]')
LONG=${#CLAVE}
if [[ -z "$CLAVE" ]]; then
  echo "ERROR: la demo no tiene OPENAI_API_KEY en su .env: no hay clave que copiar." >&2
  exit 1
fi
if (( LONG < 10 || LONG > 300 )) || [[ "$CLAVE" == *"'"* ]] || [[ ! "$CLAVE" =~ ^[[:graph:]]+$ ]]; then
  echo "ERROR: la clave de la demo no tiene formato válido (${LONG} caracteres)." >&2
  exit 1
fi
if [[ -n "$MODELO" ]] && { [[ "$MODELO" == *"'"* ]] || [[ ! "$MODELO" =~ ^[[:graph:]]+$ ]]; }; then
  echo "AVISO: OPENAI_MODEL de la demo no tiene formato válido: no se copia el modelo." >&2
  MODELO=""
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: no existe ${ENV_FILE}." >&2
  exit 1
fi
if [[ ! -x "$DESPLEGAR" ]]; then
  echo "ERROR: no existe o no es ejecutable ${DESPLEGAR}." >&2
  exit 1
fi

# Lee una variable del .env (solo las que este script necesita), sin comillas
leer() { leer_de "$ENV_FILE" "$1"; }

TAG=$(leer TAG)
if [[ -z "$TAG" ]]; then
  echo "ERROR: el .env no tiene TAG; no se puede redesplegar con seguridad." >&2
  exit 1
fi

echo "== Clave de la IA: demo -> prod =="
echo "OPENAI_API_KEY: copiada (${LONG} caracteres)"
echo "TAG=${TAG} (no cambia)"

COPIA="${ENV_FILE}.bak-$(date +%Y%m%d-%H%M%S)"
cp -p "$ENV_FILE" "$COPIA"
chmod 600 "$COPIA"
echo "Copia del .env: ${COPIA}"

# Reescribe (o agrega) una sola variable. El valor pasa por el entorno de awk, no por sed ni por argv.
fijar() {
  local clave="$1" valor="$2" tmp
  tmp=$(mktemp "${ENV_FILE}.tmp.XXXXXX")
  chmod 600 "$tmp"
  NUEVO_VALOR="$valor" awk -v clave="$clave" '
    BEGIN { encontrada = 0 }
    index($0, clave "=") == 1 { print clave "=" ENVIRON["NUEVO_VALOR"]; encontrada = 1; next }
    { print }
    END { if (!encontrada) print clave "=" ENVIRON["NUEVO_VALOR"] }
  ' "$ENV_FILE" > "$tmp" || { rm -f "$tmp"; return 1; }
  mv -f "$tmp" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
}

restaurar() {
  cp -p "$COPIA" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo "Se restauró ${COPIA}. Volviendo a desplegar con la configuración anterior..."
  "$DESPLEGAR" "$AMBIENTE" "$TAG" || echo "AVISO: el redespliegue de restauración falló; revisar a mano."
}

# Entre comillas simples: bash (source) y docker compose v2 la leen literal
if ! { fijar OPENAI_API_KEY "'${CLAVE}'" && { [[ -z "$MODELO" ]] || fijar OPENAI_MODEL "'${MODELO}'"; }; }; then
  echo "ERROR: no se pudo escribir el .env." >&2
  restaurar
  exit 1
fi

echo "==> Redesplegando ${AMBIENTE} con el mismo tag (${TAG})..."
if ! "$DESPLEGAR" "$AMBIENTE" "$TAG"; then
  echo "ERROR: falló el redespliegue." >&2
  restaurar
  exit 1
fi

# La API responde /salud y el contenedor ve la clave con la misma longitud (sin mostrarla)
comprobar_api() {
  local cid codigo
  cid=$(docker compose --env-file "$ENV_FILE" -f "${COMPOSE_DIR}/docker-compose.base.yml" \
        -f "${COMPOSE_DIR}/docker-compose.${AMBIENTE}.yml" ps -q api 2>/dev/null | head -n 1 || true)
  [[ -n "$cid" ]] || return 1
  docker exec "$cid" curl -s -f --max-time 5 http://localhost:3000/salud >/dev/null 2>&1 || return 1
  codigo=$(docker exec "$cid" sh -c 'printf %s "${OPENAI_API_KEY:-}" | wc -c' 2>/dev/null | tr -d ' ' || true)
  [[ "$codigo" == "$LONG" ]]
}

echo "==> Comprobando que la API responde y recibe la clave..."
OK=0
for _ in $(seq 1 "$REINTENTOS"); do
  if comprobar_api; then
    OK=1
    break
  fi
  sleep "$PAUSA"
done

if [[ "$OK" -ne 1 ]]; then
  echo "ERROR: la API no respondió /salud o no recibió la clave." >&2
  restaurar
  exit 1
fi

echo "OK: IA configurada en ${AMBIENTE} con la clave de la demo (TAG ${TAG})."
echo "OPENAI_API_KEY: copiada (${LONG} caracteres)"
echo "Copia previa del .env: ${COPIA}"
