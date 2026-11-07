#!/usr/bin/env bash
# ==============================================================================
# probar-restauracion-externa.sh — Comprueba que el respaldo EXTERNO (restic en Backblaze B2) sirve
# ==============================================================================
# Uso (en el VPS):  ./probar-restauracion-externa.sh <demo|prod>
# Demuestra que si se pierde el servidor, el respaldo fuera de él se recupera: con /opt/caprichos/restic.env
#   1. lista los snapshots del ambiente (etiqueta = ambiente) y avisa si el último tiene más de 48 h;
#   2. corre `restic check` (rápido: estructura e índices; NO relee todos los datos);
#   3. restaura el volcado db_<ambiente>_*.sql.gz del snapshot más reciente que lo tenga, en /tmp (umask 077);
#   4. lo restaura en un PostgreSQL temporal y aislado y cuenta tablas y filas clave.
# Costo en Backblaze: solo lecturas (list/get de índices y de los paquetes del volcado, ~ tamaño del .sql.gz).
# Siempre se borran el contenedor y el directorio temporal. Nunca imprime secretos ni filas, solo conteos.
# ==============================================================================
set -euo pipefail
umask 077

AMBIENTE="${1:-}"
case "$AMBIENTE" in demo|prod) ;; *) echo "Uso: $0 <demo|prod>" >&2; exit 1 ;; esac

ENV_FILE="${CAPRICHOS_RESTIC_ENV:-/opt/caprichos/restic.env}"
[[ -f "$ENV_FILE" ]] || { echo "ERROR: no existe ${ENV_FILE}: el respaldo externo no está configurado (use la acción programar-respaldos)." >&2; exit 1; }
IMAGEN="restic/restic:0.17.3"

valor() { grep -m1 "^$1=" "$ENV_FILE" | cut -d= -f2- || true; }
SECRETOS=("$(valor RESTIC_PASSWORD)" "$(valor AWS_ACCESS_KEY_ID)" "$(valor AWS_SECRET_ACCESS_KEY)")
# Tapa los secretos en todo lo que se imprima de restic.
tapar() {
  local l s
  while IFS= read -r l; do
    for s in "${SECRETOS[@]}"; do [[ -n "$s" ]] && l="${l//"$s"/***}"; done
    printf '%s\n' "$l"
  done
}

TMP=$(mktemp -d /tmp/restauracion-externa.XXXXXX)
C="caprichos-restore-ext-$(date +%s)"
limpiar() { docker rm -f "$C" >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap limpiar EXIT

# Corre como el usuario actual (para poder borrar lo restaurado) y sin caché.
restic_cmd() {
  docker run --rm --user "$(id -u):$(id -g)" --env-file "$ENV_FILE" -v "${TMP}:/restore" "$IMAGEN" --no-cache "$@" 2>&1 | tapar
}

echo "== Prueba de restauración EXTERNA (${AMBIENTE}) =="
JSON=$(restic_cmd snapshots --tag "$AMBIENTE" --json || true)
# Pares "hora id" en orden cronológico; se recorren del más nuevo al más viejo.
mapfile -t PARES < <(printf '%s' "$JSON" | grep -oE '"time":"[^"]+"|"short_id":"[^"]+"' | sed -E 's/^"[a-z_]+":"([^"]+)"$/\1/' | paste -d' ' - - | tac)
if [[ ${#PARES[@]} -eq 0 ]]; then
  echo "FALLA: no se pudo listar snapshots con la etiqueta ${AMBIENTE} (credenciales, bucket o sin respaldos)." >&2
  printf '%s\n' "$JSON" | head -n 5 | cut -c1-300 >&2
  exit 1
fi
echo "Snapshots con etiqueta ${AMBIENTE}: ${#PARES[@]}"

CHECK=$(restic_cmd check || true)
if ! printf '%s\n' "$CHECK" | grep -q "no errors were found"; then
  echo "FALLA: restic check reportó problemas. Primeras líneas:" >&2
  printf '%s\n' "$CHECK" | head -n 8 | cut -c1-300 >&2
  exit 1
fi
echo "Check del repositorio: sin errores"

DUMP=""; HORA=""; ID=""
for par in "${PARES[@]:0:5}"; do
  HORA="${par% *}"; ID="${par##* }"
  rm -rf "${TMP:?}"/*
  restic_cmd restore "$ID" --target /restore --include "**/db_${AMBIENTE}_*.sql.gz" >/dev/null || true
  DUMP=$(find "$TMP" -name "db_${AMBIENTE}_*.sql.gz" -type f 2>/dev/null | sort | tail -1)
  [[ -n "$DUMP" ]] && break
done
[[ -n "$DUMP" ]] || { echo "FALLA: ninguno de los últimos snapshots contiene db_${AMBIENTE}_*.sql.gz." >&2; exit 1; }

EDAD_H=$(( ( $(date +%s) - $(date -d "$HORA" +%s) ) / 3600 ))
echo "Snapshot: ${ID} · $(basename "$DUMP") · $(du -h "$DUMP" | cut -f1) · hace ${EDAD_H} h"
[[ "$EDAD_H" -le 48 ]] || echo "AVISO: el snapshot más reciente tiene más de 48 horas."

source "$(dirname "$0")/lib-restauracion.sh"
pg_temporal_iniciar "$C"
pg_temporal_restaurar "$C" "$DUMP" || exit 1
pg_temporal_resumen "$C"
echo "OK: el respaldo externo se restaura sin errores. La base y los archivos temporales se eliminaron."
