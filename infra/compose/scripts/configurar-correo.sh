#!/usr/bin/env bash
# ==============================================================================
# configurar-correo.sh — Guarda la clave de Resend (avisos por correo) en el .env del ambiente
# ==============================================================================
# Uso (la clave viaja por la entrada estándar, nunca como argumento):
#   printf '%s' "$CLAVE" | ./configurar-correo.sh <demo|prod>
#
# Solo toca RESEND_API_KEY en /opt/caprichos/<ambiente>/.env (entre comillas simples).
# Flujo: copia fechada del .env (600) -> cambia esa variable -> redespliega con el MISMO TAG
# (desplegar.sh) -> comprueba que la API responde /salud y que el contenedor recibe la clave -> si algo falla,
# restaura la copia y vuelve a desplegar.
# Nunca imprime la clave ni el .env: solo su longitud.
# Pruebas: CAPRICHOS_RAIZ apunta a otra raíz; CORREO_REINTENTOS y CORREO_PAUSA ajustan la espera.
# ==============================================================================

set -euo pipefail
umask 077
export LC_ALL=C

AMBIENTE="${1:-}"
RAIZ="${CAPRICHOS_RAIZ:-/opt/caprichos}"
REINTENTOS="${CORREO_REINTENTOS:-20}"
PAUSA="${CORREO_PAUSA:-3}"

case "$AMBIENTE" in
  demo|prod) ;;
  *) echo "ERROR: ambiente '${AMBIENTE}' no válido (use demo o prod)." >&2; exit 1 ;;
esac

ENV_FILE="${RAIZ}/${AMBIENTE}/.env"
DESPLEGAR="${RAIZ}/scripts/desplegar.sh"
COMPOSE_DIR="${RAIZ}/compose"

# La clave llega por stdin: no queda en la línea de comandos ni en los procesos del servidor
CLAVE=$(cat; printf x)
CLAVE="${CLAVE%x}"
# Una clave de API no lleva espacios: se quitan todos (saltos de línea y \r incluidos)
CLAVE=$(printf '%s' "$CLAVE" | tr -d '[:space:]')
LONG=${#CLAVE}

if [[ -z "$CLAVE" ]]; then
  echo "ERROR: no llegó ninguna clave por la entrada estándar (¿el secreto RESEND_API_KEY está vacío?)." >&2
  exit 1
fi
# ASCII imprimible sin espacios; la comilla simple se rechaza porque rompe el valor entre comillas del .env
if (( LONG < 10 || LONG > 200 )) || [[ "$CLAVE" == *"'"* ]] || [[ ! "$CLAVE" =~ ^[[:graph:]]+$ ]]; then
  echo "ERROR: la clave no tiene formato válido (${LONG} caracteres). Debe ser ASCII imprimible, sin espacios ni comilla simple, de 10 a 200 caracteres." >&2
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

# Lee una variable del .env (solo las que este script necesita), sin comillas
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

echo "== Correo por Resend (${AMBIENTE}) =="
echo "RESEND_API_KEY: configurada (${LONG} caracteres)"
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
if ! fijar RESEND_API_KEY "'${CLAVE}'"; then
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
  codigo=$(docker exec "$cid" sh -c 'printf %s "${RESEND_API_KEY:-}" | wc -c' 2>/dev/null | tr -d ' ' || true)
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

echo "OK: correo configurado en ${AMBIENTE} (TAG ${TAG})."
echo "RESEND_API_KEY: configurada (${LONG} caracteres)"
echo "Copia previa del .env: ${COPIA}"
