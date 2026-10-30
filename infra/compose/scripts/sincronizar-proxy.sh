#!/usr/bin/env bash
# ==============================================================================
# sincronizar-proxy.sh — Actualiza la configuración DINÁMICA de Traefik (middlewares)
# ==============================================================================
# Uso (en el VPS):  ./sincronizar-proxy.sh <simulacro|real>
# El workflow deja la versión nueva en /opt/caprichos/proxy-nuevo/dynamic/. Traefik vigila
# /opt/caprichos/proxy/dynamic y recarga solo, sin reiniciarse ni cortar nada.
#   simulacro: muestra la diferencia; no escribe.
#   real     : copia de la carpeta actual, aplica, espera y comprueba que la demo y producción responden;
#              si algo falla, restaura la copia. Solo toca middlewares dinámicos (no certificados ni rutas).
# ==============================================================================
set -euo pipefail
umask 022

MODO="${1:-simulacro}"
case "$MODO" in simulacro|real) ;; *) echo "Uso: $0 <simulacro|real>" >&2; exit 1 ;; esac

ACTUAL="/opt/caprichos/proxy/dynamic"
NUEVO="/opt/caprichos/proxy-nuevo/dynamic"
[[ -d "$ACTUAL" ]] || { echo "ERROR: no existe ${ACTUAL}." >&2; exit 1; }
[[ -d "$NUEVO" ]] || { echo "ERROR: no llegó la versión nueva (${NUEVO})." >&2; exit 1; }

echo "== Diferencia entre lo que hay y lo nuevo =="
if diff -ru "$ACTUAL" "$NUEVO"; then
  echo "Sin cambios: el proxy ya tiene esta configuración."
  exit 0
fi

if [[ "$MODO" == "simulacro" ]]; then
  echo "Simulacro: no se escribió nada."
  exit 0
fi

COPIA="/opt/caprichos/proxy/dynamic.bak-$(date +%Y%m%d-%H%M%S)"
cp -a "$ACTUAL" "$COPIA"
echo "Copia previa: ${COPIA}"

verificar() {
  local d codigo
  for d in demo.caprichos.pe caprichos.pe; do
    codigo=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 --resolve "${d}:443:127.0.0.1" -k "https://${d}/salud" || true)
    if [[ "$codigo" != "200" ]]; then
      echo "FALLA: ${d}/salud respondió ${codigo:-sin respuesta}" >&2
      return 1
    fi
  done
}

restaurar() {
  echo "Restaurando ${COPIA}..." >&2
  cp -a "${COPIA}/." "$ACTUAL/"
  sleep 5
}

# Se copian los archivos uno a uno sobre la carpeta vigilada (sin reemplazar la carpeta)
cp -a "${NUEVO}/." "$ACTUAL/"
sleep 8
if ! verificar; then
  restaurar
  verificar || echo "AVISO: tras restaurar tampoco responde; revisar el proxy a mano." >&2
  echo "ERROR: la configuración nueva no pasó la verificación y se restauró la anterior." >&2
  exit 1
fi
echo "OK: proxy actualizado y verificado (demo.caprichos.pe y caprichos.pe responden)."
