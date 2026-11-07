#!/usr/bin/env bash
# ==============================================================================
# configurar-whatsapp.sh — Guarda los datos de WhatsApp (Meta) en el .env del ambiente
# ==============================================================================
# Uso (los valores viajan por la entrada estándar, nunca como argumentos):
#   printf '%s\n' "WHATSAPP_TOKEN=${T}" "WHATSAPP_PHONE_ID=${P}" | ./configurar-whatsapp.sh <demo|prod>
#
# Claves permitidas (cualquier otra se rechaza): WHATSAPP_VERIFY_TOKEN, WHATSAPP_PHONE_ID,
# WHATSAPP_TOKEN, WHATSAPP_APP_SECRET. Solo se escriben las que lleguen NO vacías; las demás
# quedan como están en /opt/caprichos/<ambiente>/.env (entre comillas simples).
# Flujo: copia fechada del .env (600) -> cambia esas variables -> redespliega con el MISMO TAG
# (desplegar.sh) -> comprueba /salud y que el contenedor recibe cada variable con la misma longitud
# -> si se escribió el verify token, prueba la verificación del webhook de Meta en local
# -> si algo falla, restaura la copia y vuelve a desplegar.
# Nunca imprime valores ni el .env: solo longitudes.
# Pruebas: CAPRICHOS_RAIZ apunta a otra raíz; WHATSAPP_REINTENTOS y WHATSAPP_PAUSA ajustan la espera.
# ==============================================================================

set -euo pipefail
umask 077
export LC_ALL=C

AMBIENTE="${1:-}"
RAIZ="${CAPRICHOS_RAIZ:-/opt/caprichos}"
REINTENTOS="${WHATSAPP_REINTENTOS:-20}"
PAUSA="${WHATSAPP_PAUSA:-3}"

case "$AMBIENTE" in
  demo|prod) ;;
  *) echo "ERROR: ambiente '${AMBIENTE}' no válido (use demo o prod)." >&2; exit 1 ;;
esac

ENV_FILE="${RAIZ}/${AMBIENTE}/.env"
DESPLEGAR="${RAIZ}/scripts/desplegar.sh"
COMPOSE_DIR="${RAIZ}/compose"

# Formato por clave: mínimo, máximo y patrón (ASCII imprimible sin espacios; la comilla simple
# se rechaza aparte porque rompe el valor entre comillas del .env)
declare -A MIN=( [WHATSAPP_VERIFY_TOKEN]=16 [WHATSAPP_PHONE_ID]=10 [WHATSAPP_TOKEN]=40  [WHATSAPP_APP_SECRET]=16 )
declare -A MAX=( [WHATSAPP_VERIFY_TOKEN]=128 [WHATSAPP_PHONE_ID]=20 [WHATSAPP_TOKEN]=512 [WHATSAPP_APP_SECRET]=128 )
declare -A PAT=(
  [WHATSAPP_VERIFY_TOKEN]='^[[:graph:]]+$'
  [WHATSAPP_PHONE_ID]='^[0-9]+$'
  [WHATSAPP_TOKEN]='^[[:graph:]]+$'
  [WHATSAPP_APP_SECRET]='^[A-Za-z0-9]+$'
)
ORDEN=(WHATSAPP_VERIFY_TOKEN WHATSAPP_PHONE_ID WHATSAPP_TOKEN WHATSAPP_APP_SECRET)

# Los valores llegan por stdin: no quedan en la línea de comandos ni en los procesos del servidor
declare -A VAL=()
while IFS= read -r linea || [[ -n "$linea" ]]; do
  [[ -z "${linea//[[:space:]]/}" ]] && continue
  if [[ "$linea" != *=* ]]; then
    echo "ERROR: una línea de la entrada no tiene el formato CLAVE=valor." >&2
    exit 1
  fi
  k="${linea%%=*}"
  v="${linea#*=}"
  if [[ -z "${MIN[$k]:-}" ]]; then
    echo "ERROR: clave no permitida '${k}'. Solo: ${ORDEN[*]}." >&2
    exit 1
  fi
  if [[ "$v" == *$'\r'* ]]; then
    echo "ERROR: ${k} lleva un salto de línea (CR); revise el secreto." >&2
    exit 1
  fi
  [[ -n "$v" ]] && VAL[$k]="$v"
done

ESCRIBIR=()
for k in "${ORDEN[@]}"; do
  [[ -n "${VAL[$k]:-}" ]] || continue
  v="${VAL[$k]}"
  n=${#v}
  if (( n < MIN[$k] || n > MAX[$k] )) || [[ "$v" == *"'"* ]] || [[ ! "$v" =~ ${PAT[$k]} ]]; then
    echo "ERROR: ${k} no tiene formato válido (${n} caracteres; se esperan ${MIN[$k]} a ${MAX[$k]}, sin espacios ni comilla simple$([[ $k == WHATSAPP_PHONE_ID ]] && echo ', solo dígitos')$([[ $k == WHATSAPP_APP_SECRET ]] && echo ', solo letras y números'))." >&2
    exit 1
  fi
  ESCRIBIR+=("$k")
done

if (( ${#ESCRIBIR[@]} == 0 )); then
  echo "ERROR: no llegó ningún valor por la entrada estándar (¿los secretos de WhatsApp están vacíos?)." >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: no existe ${ENV_FILE}." >&2
  exit 1
fi
if [[ ! -x "$DESPLEGAR" ]]; then
  echo "ERROR: no existe o no es ejecutable ${DESPLEGAR}." >&2
  exit 1
fi

# Lee una variable del .env (solo TAG), sin comillas
leer() {
  local v
  v=$(grep -E "^$1=" "$ENV_FILE" | tail -1 || true)
  v="${v#*=}"
  v="${v%\"}"; v="${v#\"}"
  v="${v%\'}"; v="${v#\'}"
  printf '%s' "$v"
}

TAG=$(leer TAG)
if [[ -z "$TAG" ]]; then
  echo "ERROR: el .env no tiene TAG; no se puede redesplegar con seguridad." >&2
  exit 1
fi

echo "== WhatsApp (${AMBIENTE}) =="
for k in "${ESCRIBIR[@]}"; do
  echo "${k}: configurada (${#VAL[$k]} caracteres)"
done
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

# Entre comillas simples: bash (source) y docker compose v2 las leen literal
for k in "${ESCRIBIR[@]}"; do
  if ! fijar "$k" "'${VAL[$k]}'"; then
    echo "ERROR: no se pudo escribir el .env." >&2
    restaurar
    exit 1
  fi
done

echo "==> Redesplegando ${AMBIENTE} con el mismo tag (${TAG})..."
if ! "$DESPLEGAR" "$AMBIENTE" "$TAG"; then
  echo "ERROR: falló el redespliegue." >&2
  restaurar
  exit 1
fi

cid_api() {
  docker compose --env-file "$ENV_FILE" -f "${COMPOSE_DIR}/docker-compose.base.yml" \
    -f "${COMPOSE_DIR}/docker-compose.${AMBIENTE}.yml" ps -q api 2>/dev/null | head -n 1 || true
}

# La API responde /salud y el contenedor ve cada variable con la misma longitud (sin mostrarla)
comprobar_api() {
  local cid k largo
  cid=$(cid_api)
  [[ -n "$cid" ]] || return 1
  docker exec "$cid" curl -s -f --max-time 5 http://localhost:3000/salud >/dev/null 2>&1 || return 1
  for k in "${ESCRIBIR[@]}"; do
    # $k sale de la lista fija de claves permitidas
    largo=$(docker exec "$cid" sh -c "printf %s \"\${${k}:-}\" | wc -c" 2>/dev/null | tr -d ' ' || true)
    [[ "$largo" == "${#VAL[$k]}" ]] || return 1
  done
}

echo "==> Comprobando que la API responde y recibe los valores..."
OK=0
for _ in $(seq 1 "$REINTENTOS"); do
  if comprobar_api; then
    OK=1
    break
  fi
  sleep "$PAUSA"
done

if [[ "$OK" -ne 1 ]]; then
  echo "ERROR: la API no respondió /salud o no recibió los valores." >&2
  restaurar
  exit 1
fi

# Verificación del webhook de Meta en local: GET con la frase leída DENTRO del contenedor (nunca se imprime)
probar_webhook() {
  local cid reto resp
  cid=$(cid_api)
  [[ -n "$cid" ]] || return 1
  reto="reto$(od -An -N8 -tx1 /dev/urandom | tr -d ' \n')"
  resp=$(docker exec "$cid" sh -c 'curl -s --max-time 5 -w "\n%{http_code}" -G http://localhost:3000/whatsapp/webhook --data-urlencode "hub.mode=subscribe" --data-urlencode "hub.verify_token=${WHATSAPP_VERIFY_TOKEN}" --data-urlencode "hub.challenge='"$reto"'"' 2>/dev/null || true)
  [[ "$resp" == "${reto}"$'\n'"200" ]]
}

if [[ -n "${VAL[WHATSAPP_VERIFY_TOKEN]:-}" ]]; then
  echo "==> Probando la verificación del webhook..."
  if probar_webhook; then
    echo "Webhook: OK (el servidor valida el token)"
  else
    echo "AVISO: el servidor no valida el token"
  fi
fi

echo "OK: WhatsApp configurado en ${AMBIENTE} (TAG ${TAG})."
for k in "${ESCRIBIR[@]}"; do
  echo "${k}: configurada (${#VAL[$k]} caracteres)"
done
echo "Copia previa del .env: ${COPIA}"
