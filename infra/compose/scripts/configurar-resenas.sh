#!/usr/bin/env bash
# ==============================================================================
# configurar-resenas.sh — Guarda la clave de OpenWebNinja (reseñas de Google) en el .env del ambiente
# ==============================================================================
# Uso (la clave viaja por la entrada estándar, nunca como argumento):
#   printf '%s' "$CLAVE" | ./configurar-resenas.sh <demo|prod>
#
# Solo toca estas dos variables de /opt/caprichos/<ambiente>/.env:
#   OPENWEBNINJA_API_KEY=<clave>
#   RESENAS_ACTUALIZAR_AUTO=si   (solo prod; en demo queda en no)
# Flujo: copia fechada del .env (600) -> cambia esas variables -> redespliega con el MISMO TAG
# (desplegar.sh) -> comprueba que la API responde /salud y que recibe la clave -> si algo falla,
# restaura la copia y vuelve a desplegar.
# Nunca imprime la clave ni el .env: solo su longitud.
# Pruebas: CAPRICHOS_RAIZ apunta a otra raíz; RESENAS_REINTENTOS y RESENAS_PAUSA ajustan la espera.
# ==============================================================================

set -euo pipefail
umask 077

AMBIENTE="${1:-}"
RAIZ="${CAPRICHOS_RAIZ:-/opt/caprichos}"
REINTENTOS="${RESENAS_REINTENTOS:-20}"
PAUSA="${RESENAS_PAUSA:-3}"

case "$AMBIENTE" in
  demo|prod) ;;
  *) echo "ERROR: ambiente '${AMBIENTE}' no válido (use demo o prod)." >&2; exit 1 ;;
esac

ENV_FILE="${RAIZ}/${AMBIENTE}/.env"
DESPLEGAR="${RAIZ}/scripts/desplegar.sh"
COMPOSE_DIR="${RAIZ}/compose"

# La clave llega por stdin: no queda en la línea de comandos ni en los procesos del servidor
# Se lee entera (el sufijo x evita que $(...) quite saltos de línea finales)
CLAVE=$(cat; printf x)
CLAVE="${CLAVE%x}"

# Normaliza: quita espacios, tabuladores, \r y \n de los extremos y, si la clave va entre comillas, las quita
recortar() {
  local v="$1"
  v="${v#"${v%%[![:space:]]*}"}"
  v="${v%"${v##*[![:space:]]}"}"
  printf '%s' "$v"
}
CLAVE=$(recortar "$CLAVE")
if (( ${#CLAVE} >= 2 )) && { [[ "$CLAVE" == \"*\" ]] || [[ "$CLAVE" == \'*\' ]]; }; then
  CLAVE="${CLAVE:1:${#CLAVE}-2}"
  CLAVE=$(recortar "$CLAVE")
fi
LONG=${#CLAVE}

# Solo caracteres que no necesitan comillas en el .env ni interpolación en docker compose
RE_CLAVE='^[A-Za-z0-9._~+/=-]+$'
if [[ -z "$CLAVE" ]]; then
  echo "ERROR: no llegó ninguna clave por la entrada estándar (¿el secreto OPENWEBNINJA_API_KEY está vacío?)." >&2
  exit 1
fi
if (( LONG < 10 || LONG > 200 )) || [[ ! "$CLAVE" =~ $RE_CLAVE ]]; then
  # Diagnóstico sin revelar la clave: solo longitud y tipo de problema
  echo "ERROR: la clave no tiene formato válido (${LONG} caracteres tras quitar espacios y comillas de los extremos):" >&2
  if (( LONG < 10 )); then echo "  - muy corta: mínimo 10 caracteres" >&2; fi
  if (( LONG > 200 )); then echo "  - muy larga: máximo 200 caracteres" >&2; fi
  if [[ "$CLAVE" == *[[:space:]]* ]]; then
    ESP="${CLAVE//[^[:space:]]/}"
    echo "  - tiene espacios, tabuladores o saltos de línea en medio (${#ESP} caracteres de separación)" >&2
  fi
  OTROS="${CLAVE//[A-Za-z0-9._~+\/=-]/}"
  OTROS="${OTROS//[[:space:]]/}"
  if [[ -n "$OTROS" ]]; then
    echo "  - tiene caracteres fuera de A-Za-z0-9._~+/=- (${#OTROS} caracteres)" >&2
  fi
  echo "Permitido: letras, números y . _ ~ + / = -, de 10 a 200 caracteres." >&2
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

AUTO=no
[[ "$AMBIENTE" == "prod" ]] && AUTO=si

echo "== Reseñas de Google (${AMBIENTE}) =="
echo "OPENWEBNINJA_API_KEY: configurada (${LONG} caracteres)"
echo "RESENAS_ACTUALIZAR_AUTO=${AUTO}"
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

if ! { fijar OPENWEBNINJA_API_KEY "$CLAVE" && fijar RESENAS_ACTUALIZAR_AUTO "$AUTO"; }; then
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
  codigo=$(docker exec "$cid" sh -c 'printf %s "${OPENWEBNINJA_API_KEY:-}" | wc -c' 2>/dev/null | tr -d ' ' || true)
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

echo "OK: reseñas configuradas en ${AMBIENTE} (TAG ${TAG})."
echo "OPENWEBNINJA_API_KEY: configurada (${LONG} caracteres)"
echo "RESENAS_ACTUALIZAR_AUTO=${AUTO}"
echo "Copia previa del .env: ${COPIA}"
