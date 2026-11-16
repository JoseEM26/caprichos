#!/usr/bin/env bash
# ==============================================================================
# instalar-evolution.sh — Levanta Evolution API (WhatsApp no oficial) en la DEMO o en PRODUCCIÓN
# ==============================================================================
# Uso (los números de prueba viajan por la entrada estándar, nunca como argumentos):
#   printf '%s\n' "WHATSAPP_SOLO_NUMEROS=51987654321,51955000111" | ./instalar-evolution.sh demo
#   printf '%s\n' "WHATSAPP_SOLO_NUMEROS=" | ./instalar-evolution.sh prod     (prod: SIN lista blanca, responde a todos)
# Demo y prod no comparten nada: carpeta (evolution / evolution-prod), proyecto compose
# (caprichos-evolution / caprichos-evolution-prod), volúmenes, claves y red interna propios.
#
# Qué hace:
#   1. Crea (si no existe) /opt/caprichos/evolution/evolution.env (0600, fuera de Git) con claves aleatorias:
#      base y Redis propios de Evolution, API key y token del webhook. Nunca se imprimen.
#   2. Comprueba la memoria libre del VPS (Evolution suma 1.4 GB de límite: no se suben límites).
#   3. Levanta `docker compose -p caprichos-evolution -f docker-compose.evolution.yml`, conectado a la red
#      interna del ambiente (caprichos-<ambiente>_red_interna). Sin puertos publicados: no se expone a Internet.
#   4. Crea la instancia de WhatsApp (Baileys) dentro de Evolution si no existe.
#   5. Copia EVOLUTION_API_URL / EVOLUTION_API_KEY / EVOLUTION_INSTANCE / EVOLUTION_WEBHOOK_TOKEN al .env del ambiente
#      y guarda WHATSAPP_SOLO_NUMEROS (lista blanca: con celulares reales en la base, solo escribe a esos números).
#   6. Redespliega el ambiente con el MISMO TAG y comprueba /salud. Si falla, restaura el .env.
# Muestra al final solo el estado de los contenedores. Pruebas: CAPRICHOS_RAIZ, EVOLUCION_REINTENTOS/PAUSA.
# ==============================================================================

set -euo pipefail
umask 077
export LC_ALL=C

AMBIENTE="${1:-demo}"
case "$AMBIENTE" in
  demo|prod) ;;
  *) echo "ERROR: ambiente '${AMBIENTE}' no válido (use demo o prod)." >&2; exit 1 ;;
esac
RAIZ="${CAPRICHOS_RAIZ:-/opt/caprichos}"
REINTENTOS="${EVOLUCION_REINTENTOS:-30}"
PAUSA="${EVOLUCION_PAUSA:-4}"
MEMORIA_MIN_MB="${EVOLUCION_MEMORIA_MIN_MB:-1500}"
INSTANCIA="caprichos"
RED_API="caprichos-${AMBIENTE}_red_interna"
if [[ "$AMBIENTE" == "prod" ]]; then
  SUFIJO="-prod"; VOLUMENES="caprichos_evolution_prod"
else
  SUFIJO=""; VOLUMENES="caprichos_evolution"
fi
PROYECTO="caprichos-evolution${SUFIJO}"

ENV_FILE="${RAIZ}/${AMBIENTE}/.env"
EVO_DIR="${RAIZ}/evolution${SUFIJO}"
EVO_ENV="${EVO_DIR}/evolution.env"
COMPOSE_DIR="${RAIZ}/compose"
EVO_COMPOSE="${COMPOSE_DIR}/docker-compose.evolution.yml"
DESPLEGAR="${RAIZ}/scripts/desplegar.sh"

# Lista blanca de números de prueba (opcional): 51XXXXXXXXX separados por comas
NUMEROS=""
while IFS= read -r linea || [[ -n "$linea" ]]; do
  [[ -z "${linea//[[:space:]]/}" ]] && continue
  k="${linea%%=*}"
  v="${linea#*=}"
  if [[ "$linea" != *=* || "$k" != "WHATSAPP_SOLO_NUMEROS" ]]; then
    echo "ERROR: solo se admite la línea WHATSAPP_SOLO_NUMEROS=51XXXXXXXXX,..." >&2
    exit 1
  fi
  v="${v//[[:space:]]/}"
  if [[ "$AMBIENTE" == "prod" && -n "$v" ]]; then
    echo "ERROR: en producción no hay lista blanca: WHATSAPP_SOLO_NUMEROS debe ir vacío." >&2
    exit 1
  fi
  if [[ -n "$v" && ! "$v" =~ ^51[0-9]{9}(,51[0-9]{9})*$ ]]; then
    echo "ERROR: WHATSAPP_SOLO_NUMEROS debe ser una lista de celulares 51XXXXXXXXX separados por comas (sin espacios ni signos)." >&2
    exit 1
  fi
  NUMEROS="$v"
done

for f in "$ENV_FILE" "$EVO_COMPOSE" "$DESPLEGAR"; do
  [[ -e "$f" ]] || { echo "ERROR: no existe ${f}." >&2; exit 1; }
done
[[ -x "$DESPLEGAR" ]] || { echo "ERROR: ${DESPLEGAR} no es ejecutable." >&2; exit 1; }

leer() { # $1 = archivo, $2 = clave; sin comillas
  local v
  v=$(grep -E "^$2=" "$1" | tail -1 || true)
  v="${v#*=}"; v="${v%\"}"; v="${v#\"}"; v="${v%\'}"; v="${v#\'}"
  printf '%s' "$v"
}

# Reescribe (o agrega) una variable de un archivo; el valor pasa por el entorno de awk, no por argv
fijar() { # $1 = archivo, $2 = clave, $3 = valor
  local tmp
  tmp=$(mktemp "$1.tmp.XXXXXX")
  chmod 600 "$tmp"
  NUEVO_VALOR="$3" awk -v clave="$2" '
    BEGIN { encontrada = 0 }
    index($0, clave "=") == 1 { print clave "=" ENVIRON["NUEVO_VALOR"]; encontrada = 1; next }
    { print }
    END { if (!encontrada) print clave "=" ENVIRON["NUEVO_VALOR"] }
  ' "$1" > "$tmp" || { rm -f "$tmp"; return 1; }
  mv -f "$tmp" "$1"
  chmod 600 "$1"
}

TAG=$(leer "$ENV_FILE" TAG)
[[ -n "$TAG" ]] || { echo "ERROR: el .env de ${AMBIENTE} no tiene TAG; no se puede redesplegar con seguridad." >&2; exit 1; }

echo "== Evolution API (${AMBIENTE}) =="
echo "TAG=${TAG} (no cambia)"

# 1. Red interna del ambiente
if ! docker network inspect "$RED_API" >/dev/null 2>&1; then
  echo "ERROR: no existe la red ${RED_API}; el ambiente ${AMBIENTE} debe estar desplegado antes." >&2
  exit 1
fi

# 2. Memoria: lo que ya corre + los límites de Evolution (512M + 128M + 768M)
DISPONIBLE_MB=$(awk '/^MemAvailable:/ { printf "%d", $2 / 1024 }' /proc/meminfo)
echo "Memoria disponible: ${DISPONIBLE_MB} MB (mínimo ${MEMORIA_MIN_MB} MB; Evolution limita 1408 MB entre sus 3 contenedores)"
if (( DISPONIBLE_MB < MEMORIA_MIN_MB )); then
  echo "ERROR: no hay memoria suficiente en el servidor para Evolution; no se instala (no se suben límites)." >&2
  exit 1
fi

# 3. evolution.env: se crea una sola vez, con claves aleatorias que no se imprimen
mkdir -p "$EVO_DIR"
chmod 700 "$EVO_DIR"
if [[ ! -f "$EVO_ENV" ]]; then
  {
    echo "EVOLUTION_DB_USER=evolution"
    echo "EVOLUTION_DB_PASSWORD=$(openssl rand -hex 24)"
    echo "EVOLUTION_REDIS_PASSWORD=$(openssl rand -hex 24)"
    echo "EVOLUTION_API_KEY=$(openssl rand -hex 32)"
    echo "EVOLUTION_WEBHOOK_TOKEN=$(openssl rand -hex 24)"
  } > "$EVO_ENV"
  chmod 600 "$EVO_ENV"
  echo "evolution.env: creado (0600, claves aleatorias; no se muestran)"
else
  chmod 600 "$EVO_ENV"
  echo "evolution.env: ya existía (se conserva)"
fi
fijar "$EVO_ENV" EVOLUTION_RED_API "$RED_API"
fijar "$EVO_ENV" EVOLUTION_VOLUMEN_PREFIJO "$VOLUMENES"
fijar "$EVO_ENV" EVOLUTION_WEBHOOK_URL "http://api:3000/whatsapp/evolution/webhook"
for k in EVOLUTION_DB_PASSWORD EVOLUTION_REDIS_PASSWORD EVOLUTION_API_KEY EVOLUTION_WEBHOOK_TOKEN; do
  [[ -n "$(leer "$EVO_ENV" "$k")" ]] || { echo "ERROR: evolution.env no tiene ${k}." >&2; exit 1; }
done

compose_evo() { docker compose -p "$PROYECTO" --env-file "$EVO_ENV" -f "$EVO_COMPOSE" "$@"; }

# 4. Levantar Evolution (imagen de versión fija; sin puertos publicados)
echo "==> Levantando Evolution (proyecto ${PROYECTO})..."
compose_evo up -d >/dev/null

estado_evo() { # healthy cuando los 3 contenedores lo están
  local n
  n=$(compose_evo ps --format '{{.Health}}' 2>/dev/null | grep -c '^healthy$' || true)
  [[ "$n" == "3" ]]
}
OK=0
for _ in $(seq 1 "$REINTENTOS"); do
  if estado_evo; then OK=1; break; fi
  sleep "$PAUSA"
done
if [[ "$OK" -ne 1 ]]; then
  echo "ERROR: Evolution no quedó saludable a tiempo." >&2
  compose_evo ps --format 'table {{.Service}}\t{{.Status}}' >&2 || true
  exit 1
fi

# 5. Instancia de WhatsApp (Baileys). Se crea desde dentro del contenedor con su propia clave: no sale nada a la red.
echo "==> Creando la instancia '${INSTANCIA}' si no existe..."
CREAR_JS='
const k = process.env.AUTHENTICATION_API_KEY, n = process.argv[1];
const h = { "Content-Type": "application/json", apikey: k };
(async () => {
  const e = await fetch("http://127.0.0.1:8080/instance/fetchInstances", { headers: h }).then((r) => r.json()).catch(() => null);
  const lista = Array.isArray(e) ? e : [];
  if (lista.some((x) => (x.name || x.instance?.instanceName) === n)) { console.log("EXISTE"); return; }
  const r = await fetch("http://127.0.0.1:8080/instance/create", { method: "POST", headers: h, body: JSON.stringify({ instanceName: n, integration: "WHATSAPP-BAILEYS", qrcode: false }) });
  console.log(r.ok ? "CREADA" : "ERROR_" + r.status);
})().catch(() => console.log("ERROR_RED"));
'
RES=$(compose_evo exec -T evolution-api node -e "$CREAR_JS" "$INSTANCIA" 2>/dev/null | tail -1 || true)
case "$RES" in
  EXISTE) echo "Instancia ${INSTANCIA}: ya existía" ;;
  CREADA) echo "Instancia ${INSTANCIA}: creada" ;;
  *) echo "ERROR: no se pudo crear la instancia (${RES:-sin respuesta})." >&2; exit 1 ;;
esac

# 6. .env de la demo (con copia para volver atrás)
COPIA="${ENV_FILE}.bak-$(date +%Y%m%d-%H%M%S)"
cp -p "$ENV_FILE" "$COPIA"
chmod 600 "$COPIA"
echo "Copia del .env de ${AMBIENTE}: ${COPIA}"

restaurar() {
  cp -p "$COPIA" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo "Se restauró ${COPIA}. Volviendo a desplegar con la configuración anterior..."
  "$DESPLEGAR" "$AMBIENTE" "$TAG" || echo "AVISO: el redespliegue de restauración falló; revisar a mano."
}

API_KEY=$(leer "$EVO_ENV" EVOLUTION_API_KEY)
WEBHOOK_TOKEN=$(leer "$EVO_ENV" EVOLUTION_WEBHOOK_TOKEN)
declare -A NUEVAS=(
  [EVOLUTION_API_URL]="http://evolution-api:8080"
  [EVOLUTION_API_KEY]="$API_KEY"
  [EVOLUTION_INSTANCE]="$INSTANCIA"
  [EVOLUTION_WEBHOOK_TOKEN]="$WEBHOOK_TOKEN"
)
[[ -n "$NUMEROS" ]] && NUEVAS[WHATSAPP_SOLO_NUMEROS]="$NUMEROS"
# Producción: el bot responde a todos (sin lista blanca) y a quienes llegan solo como @lid
[[ "$AMBIENTE" == "prod" ]] && NUEVAS[WHATSAPP_PERMITIR_LID_SIN_NUMERO]="si"
for k in "${!NUEVAS[@]}"; do
  if ! fijar "$ENV_FILE" "$k" "'${NUEVAS[$k]}'"; then
    echo "ERROR: no se pudo escribir el .env de ${AMBIENTE}." >&2
    restaurar
    exit 1
  fi
done
echo "EVOLUTION_API_URL / KEY / INSTANCE / WEBHOOK_TOKEN: guardadas en el .env de ${AMBIENTE}"
if [[ "$AMBIENTE" == "prod" ]]; then
  # Sin lista blanca: vacía = sin restricción (el compose de prod ni siquiera la pasa a la API)
  fijar "$ENV_FILE" WHATSAPP_SOLO_NUMEROS "''"
  echo "WHATSAPP_SOLO_NUMEROS: vacía (producción responde a todos); WHATSAPP_PERMITIR_LID_SIN_NUMERO=si"
elif [[ -n "$NUMEROS" ]]; then
  echo "WHATSAPP_SOLO_NUMEROS: guardada ($(( $(printf '%s' "$NUMEROS" | tr -cd ',' | wc -c) + 1 )) número(s) de prueba)"
elif [[ -z "$(leer "$ENV_FILE" WHATSAPP_SOLO_NUMEROS)" ]]; then
  echo "AVISO: no hay números de prueba; la demo no enviará ningún WhatsApp (WHATSAPP_SOLO_NUMEROS queda como «ninguno»)."
else
  echo "WHATSAPP_SOLO_NUMEROS: se conserva el valor que ya tenía el .env"
fi

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

# La API responde /salud, ve las variables (misma longitud, sin mostrarlas) y alcanza a Evolution por la red interna
comprobar_api() {
  local cid k largo
  cid=$(cid_api)
  [[ -n "$cid" ]] || return 1
  docker exec "$cid" curl -s -f --max-time 5 http://localhost:3000/salud >/dev/null 2>&1 || return 1
  for k in EVOLUTION_API_URL EVOLUTION_API_KEY EVOLUTION_INSTANCE EVOLUTION_WEBHOOK_TOKEN; do
    largo=$(docker exec "$cid" sh -c "printf %s \"\${${k}:-}\" | wc -c" 2>/dev/null | tr -d ' ' || true)
    [[ "$largo" == "${#NUEVAS[$k]}" ]] || return 1
  done
  docker exec "$cid" curl -s --max-time 5 -o /dev/null http://evolution-api:8080/ >/dev/null 2>&1
}

echo "==> Comprobando que la API responde y alcanza a Evolution..."
OK=0
for _ in $(seq 1 "$REINTENTOS"); do
  if comprobar_api; then OK=1; break; fi
  sleep "$PAUSA"
done
if [[ "$OK" -ne 1 ]]; then
  echo "ERROR: la API no respondió /salud, no recibió los valores o no alcanza a Evolution." >&2
  restaurar
  exit 1
fi

echo "OK: Evolution instalado en ${AMBIENTE} (TAG ${TAG}). El proveedor sigue en META: Configuración > WhatsApp > escanear el QR y luego elegir Evolution."
echo "Estado de los contenedores:"
compose_evo ps --format 'table {{.Service}}\t{{.Status}}'
