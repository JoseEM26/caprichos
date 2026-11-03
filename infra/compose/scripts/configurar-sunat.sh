#!/usr/bin/env bash
# ==============================================================================
# configurar-sunat.sh — Guarda las credenciales de SUNAT directo (SEE) en el .env del ambiente
# ==============================================================================
# Uso (los valores viajan por la entrada estándar, nunca como argumento; una línea cada uno, en este orden):
#   printf '%s\n%s\n%s\n%s\n%s\n' "$AMBIENTE" "$USUARIO" "$CLAVE" "$P12_B64" "$CLAVE_P12" | ./configurar-sunat.sh <demo|prod>
#
# Solo toca estas variables de /opt/caprichos/<ambiente>/.env:
#   SUNAT_AMBIENTE='beta|prod'
#   SUNAT_SOL_USUARIO='<RUC><usuario SOL>'   (beta: 20000000001MODDATOS)
#   SUNAT_SOL_CLAVE='<clave SOL>'            (beta: moddatos)
#   SUNAT_CERT_P12_B64='<base64 del .p12>'
#   SUNAT_CERT_CLAVE='<clave del .p12>'
# Flujo: copia fechada del .env (600) -> cambia esas variables -> redespliega con el MISMO TAG
# (desplegar.sh) -> comprueba que la API responde /salud y recibe las variables (solo longitudes)
# -> si algo falla, restaura la copia y vuelve a desplegar.
# Nunca imprime los valores, el certificado ni el .env: solo longitudes.
# Pruebas: CAPRICHOS_RAIZ apunta a otra raíz; SUNAT_REINTENTOS y SUNAT_PAUSA ajustan la espera.
# ==============================================================================

set -euo pipefail
umask 077

AMBIENTE="${1:-}"
RAIZ="${CAPRICHOS_RAIZ:-/opt/caprichos}"
REINTENTOS="${SUNAT_REINTENTOS:-20}"
PAUSA="${SUNAT_PAUSA:-3}"

case "$AMBIENTE" in
  demo|prod) ;;
  *) echo "ERROR: ambiente '${AMBIENTE}' no válido (use demo o prod)." >&2; exit 1 ;;
esac

ENV_FILE="${RAIZ}/${AMBIENTE}/.env"
DESPLEGAR="${RAIZ}/scripts/desplegar.sh"
COMPOSE_DIR="${RAIZ}/compose"

# Los valores llegan por stdin: no quedan en la línea de comandos ni en los procesos del servidor
ENTRADA=$(cat; printf x)
ENTRADA="${ENTRADA%x}"
linea() {
  local v
  v=$(printf '%s' "$ENTRADA" | sed -n "$1p" | tr -d '\r')
  v="${v#"${v%%[![:space:]]*}"}"; v="${v%"${v##*[![:space:]]}"}"
  printf '%s' "$v"
}
AMB_SUNAT=$(linea 1)
USUARIO=$(linea 2)
CLAVE=$(linea 3)
P12=$(linea 4)
CLAVE_P12=$(linea 5)

if [[ -z "$AMB_SUNAT" || -z "$USUARIO" || -z "$CLAVE" || -z "$P12" || -z "$CLAVE_P12" ]]; then
  echo "ERROR: faltan valores de SUNAT (¿los secretos SUNAT_* están vacíos en GitHub?)." >&2
  exit 1
fi
if [[ "$AMB_SUNAT" != "beta" && "$AMB_SUNAT" != "prod" ]]; then
  echo "ERROR: SUNAT_AMBIENTE debe ser beta o prod." >&2
  exit 1
fi
# Usuario SOL: RUC de 11 dígitos seguido del usuario secundario (alfanumérico)
if [[ ! "$USUARIO" =~ ^[0-9]{11}[A-Za-z0-9]{1,30}$ ]]; then
  echo "ERROR: SUNAT_SOL_USUARIO debe ser el RUC (11 dígitos) seguido del usuario SOL, sin espacios." >&2
  exit 1
fi
# Clave SOL: ASCII imprimible sin espacios ni comilla simple
if [[ ! "$CLAVE" =~ ^[[:graph:]]{1,100}$ ]] || [[ "$CLAVE" == *"'"* ]]; then
  echo "ERROR: SUNAT_SOL_CLAVE no tiene formato válido (ASCII sin espacios ni comilla simple, hasta 100 caracteres)." >&2
  exit 1
fi
# Certificado: base64 de un .p12 (un solo bloque, sin espacios)
LONG_P12=${#P12}
if (( LONG_P12 < 100 || LONG_P12 > 40000 )) || [[ ! "$P12" =~ ^[A-Za-z0-9+/=]+$ ]]; then
  echo "ERROR: SUNAT_CERT_P12_B64 no es un base64 válido (${LONG_P12} caracteres)." >&2
  exit 1
fi
if [[ ! "$CLAVE_P12" =~ ^[[:graph:]]{1,200}$ ]] || [[ "$CLAVE_P12" == *"'"* ]]; then
  echo "ERROR: SUNAT_CERT_CLAVE no tiene formato válido (ASCII sin espacios ni comilla simple)." >&2
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

# Lee una variable del .env, sin comillas
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

echo "== Facturación electrónica SUNAT directo (${AMBIENTE}) =="
echo "SUNAT_AMBIENTE: ${AMB_SUNAT}"
echo "SUNAT_SOL_USUARIO: configurado (${#USUARIO} caracteres)"
echo "SUNAT_SOL_CLAVE: configurada (${#CLAVE} caracteres)"
echo "SUNAT_CERT_P12_B64: configurado (${LONG_P12} caracteres)"
echo "SUNAT_CERT_CLAVE: configurada (${#CLAVE_P12} caracteres)"
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
if ! { fijar SUNAT_AMBIENTE "'${AMB_SUNAT}'" \
  && fijar SUNAT_SOL_USUARIO "'${USUARIO}'" \
  && fijar SUNAT_SOL_CLAVE "'${CLAVE}'" \
  && fijar SUNAT_CERT_P12_B64 "'${P12}'" \
  && fijar SUNAT_CERT_CLAVE "'${CLAVE_P12}'"; }; then
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

# La API responde /salud y el contenedor ve las variables con la misma longitud (sin mostrarlas)
comprobar_api() {
  local cid
  cid=$(docker compose --env-file "$ENV_FILE" -f "${COMPOSE_DIR}/docker-compose.base.yml" \
        -f "${COMPOSE_DIR}/docker-compose.${AMBIENTE}.yml" ps -q api 2>/dev/null | head -n 1 || true)
  [[ -n "$cid" ]] || return 1
  docker exec "$cid" curl -s -f --max-time 5 http://localhost:3000/salud >/dev/null 2>&1 || return 1
  local amb usr cla p12 cp12
  amb=$(docker exec "$cid" sh -c 'printf %s "${SUNAT_AMBIENTE:-}"' 2>/dev/null || true)
  usr=$(docker exec "$cid" sh -c 'printf %s "${SUNAT_SOL_USUARIO:-}" | wc -c' 2>/dev/null | tr -d ' ' || true)
  cla=$(docker exec "$cid" sh -c 'printf %s "${SUNAT_SOL_CLAVE:-}" | wc -c' 2>/dev/null | tr -d ' ' || true)
  p12=$(docker exec "$cid" sh -c 'printf %s "${SUNAT_CERT_P12_B64:-}" | wc -c' 2>/dev/null | tr -d ' ' || true)
  cp12=$(docker exec "$cid" sh -c 'printf %s "${SUNAT_CERT_CLAVE:-}" | wc -c' 2>/dev/null | tr -d ' ' || true)
  [[ "$amb" == "$AMB_SUNAT" && "$usr" == "${#USUARIO}" && "$cla" == "${#CLAVE}" && "$p12" == "$LONG_P12" && "$cp12" == "${#CLAVE_P12}" ]]
}

echo "==> Comprobando que la API responde y recibe las variables de SUNAT..."
OK=0
for _ in $(seq 1 "$REINTENTOS"); do
  if comprobar_api; then
    OK=1
    break
  fi
  sleep "$PAUSA"
done

if [[ "$OK" -ne 1 ]]; then
  echo "ERROR: la API no respondió /salud o no recibió la configuración de SUNAT." >&2
  restaurar
  exit 1
fi

echo "OK: SUNAT directo configurado en ${AMBIENTE} (TAG ${TAG}, ambiente ${AMB_SUNAT}). El proveedor se elige en Comprobantes > Electrónicos SUNAT."
echo "Copia previa del .env: ${COPIA}"
