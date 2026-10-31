#!/usr/bin/env bash
# ==============================================================================
# configurar-resenas.sh — Guarda la clave de OpenWebNinja (reseñas de Google) en el .env del ambiente
# ==============================================================================
# Uso (la clave viaja por la entrada estándar, nunca como argumento):
#   printf '%s' "$CLAVE" | ./configurar-resenas.sh <demo|prod>
#
# Solo toca estas dos variables de /opt/caprichos/<ambiente>/.env:
#   OPENWEBNINJA_API_KEY='<clave>'   (entre comillas simples; la clave no puede llevar comilla simple)
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
# Todo en bytes: con LC_ALL=C, ${#v} cuenta bytes y los patrones actúan byte a byte
export LC_ALL=C

# Invisibles o espacios Unicode que una clave de API nunca lleva, en UTF-8 (bytes):
# U+00A0, U+200B, U+200C, U+200D, U+2060, U+FEFF, U+202F, U+3000, U+2028, U+2029
INVISIBLES=(
  $'\xc2\xa0'      # espacio duro
  $'\xe2\x80\x8b'  # espacio de ancho cero
  $'\xe2\x80\x8c'  # no unir
  $'\xe2\x80\x8d'  # unir
  $'\xe2\x81\xa0'  # unir sin separación
  $'\xef\xbb\xbf'  # BOM
  $'\xe2\x80\xaf'  # espacio estrecho de no separación
  $'\xe3\x80\x80'  # espacio ideográfico
  $'\xe2\x80\xa8'  # separador de línea
  $'\xe2\x80\xa9'  # separador de párrafo
)
QUITADOS=0
for inv in "${INVISIBLES[@]}"; do
  antes=${#CLAVE}
  CLAVE="${CLAVE//$inv/}"
  QUITADOS=$(( QUITADOS + (antes - ${#CLAVE}) / ${#inv} ))
done
NO_ASCII_N=$(printf '%s' "$CLAVE" | tr -d '\000-\177' | wc -c | tr -d ' ')

CLAVE=$(recortar "$CLAVE")
if (( ${#CLAVE} >= 2 )) && { [[ "$CLAVE" == \"*\" ]] || [[ "$CLAVE" == \'*\' ]]; }; then
  CLAVE="${CLAVE:1:${#CLAVE}-2}"
  CLAVE=$(recortar "$CLAVE")
fi
LONG=${#CLAVE}

NOTA_INVISIBLES=""
if (( QUITADOS > 0 )); then
  NOTA_INVISIBLES="se quitaron ${QUITADOS} caracteres invisibles (espacio duro/ancho cero/BOM)"
fi

# ASCII imprimible 0x21–0x7E ([:graph:] con LC_ALL=C), sin espacios; la comilla simple se rechaza aparte
# porque es la única que rompe el valor entre comillas simples que se guarda en el .env
RE_CLAVE='^[[:graph:]]+$'
if [[ -z "$CLAVE" ]]; then
  echo "ERROR: no llegó ninguna clave por la entrada estándar (¿el secreto OPENWEBNINJA_API_KEY está vacío?)." >&2
  exit 1
fi
if (( LONG < 10 || LONG > 200 )) || [[ "$CLAVE" == *"'"* ]] || [[ ! "$CLAVE" =~ $RE_CLAVE ]]; then
  # Diagnóstico sin revelar la clave: solo longitud y tipo de problema
  echo "ERROR: la clave no tiene formato válido (${LONG} caracteres tras quitar espacios y comillas de los extremos):" >&2
  if (( LONG < 10 )); then echo "  - muy corta: mínimo 10 caracteres" >&2; fi
  if (( LONG > 200 )); then echo "  - muy larga: máximo 200 caracteres" >&2; fi
  if (( QUITADOS > 0 )); then echo "  - ${NOTA_INVISIBLES}" >&2; fi
  if (( NO_ASCII_N > 0 )); then
    echo "  - tiene ${NO_ASCII_N} bytes no ASCII (letra con tilde u otro carácter Unicode)" >&2
  fi
  if [[ "$CLAVE" == *[[:space:]]* ]]; then
    ESP="${CLAVE//[^[:space:]]/}"
    echo "  - tiene espacios, tabuladores o saltos de línea en medio (${#ESP} caracteres de separación)" >&2
  fi
  if [[ "$CLAVE" == *"'"* ]]; then
    echo "  - tiene comilla simple, no permitida" >&2
  fi
  CONTROL_N=$(printf '%s' "$CLAVE" | tr -d '[:graph:][:space:]\200-\377' | wc -c | tr -d ' ')
  if (( CONTROL_N > 0 )); then
    echo "  - tiene ${CONTROL_N} caracteres de control (no imprimibles)" >&2
  fi
  echo "Permitido: caracteres ASCII imprimibles (letras, números y símbolos) sin espacios ni comilla simple, de 10 a 200 caracteres." >&2
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
if [[ -n "$NOTA_INVISIBLES" ]]; then echo "  ${NOTA_INVISIBLES}"; fi

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

# Entre comillas simples: bash (source) y docker compose v2 la leen literal ($, #, ", `, \ y ! incluidos)
if ! { fijar OPENWEBNINJA_API_KEY "'${CLAVE}'" && fijar RESENAS_ACTUALIZAR_AUTO "$AUTO"; }; then
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
