#!/usr/bin/env bash
# ==============================================================================
# configurar-dominios-demo.sh — Cambia los dominios de la DEMO (pre-producción)
# ==============================================================================
# Uso:
#   ./configurar-dominios-demo.sh <simulacro|real> <dominio_principal> [dominio_adicional]
#
# Ejemplo (la demo responde en demo.caprichos.pe y, por ahora, también en caprichos.pe):
#   ./configurar-dominios-demo.sh simulacro demo.caprichos.pe caprichos.pe
#
# Solo toca DOMINIO_DEMO, DOMINIO_ALT y DOMINIO_ALT2 de /opt/caprichos/demo/.env.
# - simulacro: muestra lo que hay y lo que quedaría; no escribe nada.
# - real: copia el .env con fecha, cambia las tres variables, vuelve a desplegar con el MISMO tag
#   (rolling, sin corte), espera que el proxy emita el certificado y comprueba que los dominios
#   respondan. Si algo falla, restaura la copia y vuelve a desplegar.
# Nunca imprime otras variables del .env (claves, secretos).
# ==============================================================================

set -euo pipefail
umask 077

MODO="${1:-simulacro}"
NUEVO="${2:-}"
ADICIONAL="${3:-}"
ENV_FILE="/opt/caprichos/demo/.env"
DESPLEGAR="/opt/caprichos/scripts/desplegar.sh"

case "$MODO" in
  simulacro|real) ;;
  *) echo "ERROR: modo '$MODO' no válido (use simulacro o real)." >&2; exit 1 ;;
esac

valida() { [[ "$1" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$ ]]; }

if [[ -z "$NUEVO" ]] || ! valida "$NUEVO"; then
  echo "ERROR: dominio principal no válido: '${NUEVO}'." >&2
  exit 1
fi
if [[ -n "$ADICIONAL" ]] && ! valida "$ADICIONAL"; then
  echo "ERROR: dominio adicional no válido: '${ADICIONAL}'." >&2
  exit 1
fi
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: no existe ${ENV_FILE}." >&2
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

ACT_DEMO=$(leer DOMINIO_DEMO)
ACT_ALT=$(leer DOMINIO_ALT)
ACT_ALT2=$(leer DOMINIO_ALT2)
TAG=$(leer TAG)

FIN_DEMO="$NUEVO"
FIN_ALT="$ADICIONAL"
FIN_ALT2=""
# Lo que ya atendía la demo no se pierde: el primero que no quede como principal ni adicional pasa a ALT2
for candidato in "$ACT_DEMO" "$ACT_ALT" "$ACT_ALT2"; do
  if [[ -n "$candidato" && "$candidato" != "$FIN_DEMO" && "$candidato" != "$FIN_ALT" ]]; then
    FIN_ALT2="$candidato"
    break
  fi
done

echo "== Dominios de la demo (pre-producción) =="
echo "Hoy:      DOMINIO_DEMO=${ACT_DEMO} DOMINIO_ALT=${ACT_ALT} DOMINIO_ALT2=${ACT_ALT2}  (TAG=${TAG})"
echo "Quedaría: DOMINIO_DEMO=${FIN_DEMO} DOMINIO_ALT=${FIN_ALT} DOMINIO_ALT2=${FIN_ALT2}"
for d in "$FIN_DEMO" "$FIN_ALT"; do
  [[ -z "$d" ]] && continue
  if getent hosts "$d" >/dev/null 2>&1; then
    echo "DNS: ${d} resuelve."
  else
    echo "AVISO: ${d} todavía no resuelve en DNS; el certificado no se podrá emitir hasta que exista el registro."
  fi
done

if [[ "$ACT_DEMO" == "$FIN_DEMO" && "$ACT_ALT" == "$FIN_ALT" && "$ACT_ALT2" == "$FIN_ALT2" ]]; then
  echo "Sin cambios: la demo ya tiene esa configuración."
  exit 0
fi

if [[ "$MODO" == "simulacro" ]]; then
  echo "Simulacro: no se escribió nada."
  exit 0
fi

if [[ -z "$TAG" ]]; then
  echo "ERROR: el .env no tiene TAG; no se puede redesplegar con seguridad." >&2
  exit 1
fi

COPIA="${ENV_FILE}.bak-$(date +%Y%m%d-%H%M%S)"
cp -p "$ENV_FILE" "$COPIA"
chmod 600 "$COPIA"
echo "Copia del .env: ${COPIA}"

fijar() {
  local clave="$1" valor="$2"
  if grep -qE "^${clave}=" "$ENV_FILE"; then
    sed -i "s|^${clave}=.*|${clave}=${valor}|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$clave" "$valor" >> "$ENV_FILE"
  fi
}

restaurar() {
  cp -p "$COPIA" "$ENV_FILE"
  echo "Se restauró ${COPIA}. Volviendo a desplegar con la configuración anterior..."
  "$DESPLEGAR" demo "$TAG" || echo "AVISO: el redespliegue de restauración falló; revisar a mano."
}

fijar DOMINIO_DEMO "$FIN_DEMO"
fijar DOMINIO_ALT "$FIN_ALT"
fijar DOMINIO_ALT2 "$FIN_ALT2"

echo "==> Redesplegando la demo con el mismo tag (${TAG})..."
if ! "$DESPLEGAR" demo "$TAG"; then
  echo "ERROR: falló el redespliegue." >&2
  restaurar
  exit 1
fi

# El proxy pide el certificado de cada dominio al recibir el primer pedido (Let's Encrypt, HTTP-01).
echo "==> Comprobando que los dominios respondan y tengan certificado (hasta 4 minutos)..."
comprobar() {
  local dominio="$1" codigo emisor
  codigo=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 --resolve "${dominio}:443:127.0.0.1" -k "https://${dominio}/salud" || true)
  emisor=$(echo | openssl s_client -connect 127.0.0.1:443 -servername "$dominio" 2>/dev/null | openssl x509 -noout -issuer 2>/dev/null || true)
  [[ "$codigo" == "200" && "$emisor" == *"Let's Encrypt"* ]]
}

DOMINIOS=("$FIN_DEMO")
[[ -n "$FIN_ALT" ]] && DOMINIOS+=("$FIN_ALT")

TODO_OK=0
for intento in $(seq 1 24); do
  FALTAN=()
  for d in "${DOMINIOS[@]}"; do
    comprobar "$d" || FALTAN+=("$d")
  done
  if [[ ${#FALTAN[@]} -eq 0 ]]; then
    TODO_OK=1
    break
  fi
  sleep 10
done

if [[ "$TODO_OK" -ne 1 ]]; then
  echo "ERROR: no respondieron con certificado válido: ${FALTAN[*]:-?}" >&2
  restaurar
  exit 1
fi

echo "OK: la demo responde en: ${DOMINIOS[*]}"
echo "Copia previa por si hace falta volver atrás: ${COPIA}"
