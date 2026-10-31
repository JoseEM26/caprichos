#!/usr/bin/env bash
# ==============================================================================
# consultar-pedido.sh — Dónde quedó un pedido (SOLO LECTURA)
# ==============================================================================
# Uso (en el VPS):  ./consultar-pedido.sh <demo|prod> <codigo>      p. ej.  ./consultar-pedido.sh demo CP-W014
# Muestra el estado actual, el recorrido de estados y los comprobantes del pedido, y los pedidos con un
# código parecido. No cambia nada; el teléfono sale enmascarado y no se imprime la dirección.
# ==============================================================================
set -uo pipefail

AMB="${1:-}"
COD="${2:-}"
case "$AMB" in demo|prod) ;; *) echo "Uso: $0 <demo|prod> <codigo>" >&2; exit 1 ;; esac
[[ "$COD" =~ ^[A-Za-z0-9-]{3,24}$ ]] || { echo "ERROR: código de pedido no válido." >&2; exit 1; }
COD=$(echo "$COD" | tr '[:lower:]' '[:upper:]')

C="caprichos-${AMB}-postgres"
docker ps --format '{{.Names}}' | grep -qx "$C" || { echo "ERROR: no encuentro ${C}." >&2; exit 1; }

q() { docker exec "$C" sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -P pager=off -v ON_ERROR_STOP=1 -c "$1"' _ "$1" 2>&1; }

echo "== Pedido ${COD} (${AMB}) =="
q "SELECT codigo, canal, modalidad, estado, pago_estado, pago_metodo, pago_preferido, total,
          to_char(creado_en AT TIME ZONE 'America/Lima','YYYY-MM-DD HH24:MI') AS creado,
          to_char(confirmado_en AT TIME ZONE 'America/Lima','YYYY-MM-DD HH24:MI') AS confirmado,
          to_char(anulado_en AT TIME ZONE 'America/Lima','YYYY-MM-DD HH24:MI') AS anulado,
          motivo_anulacion,
          left(coalesce(cliente_nombre,''),22) AS cliente,
          '*****'||right(coalesce(cliente_telefono,''),3) AS tel
   FROM pedido WHERE codigo = '${COD}'"
echo "== Recorrido de estados =="
q "SELECT to_char(h.en AT TIME ZONE 'America/Lima','MM-DD HH24:MI') AS cuando, h.estado_anterior, h.estado_nuevo, left(coalesce(h.motivo,''),50) AS motivo
   FROM pedido_estado_historial h JOIN pedido p ON p.id=h.pedido_id WHERE p.codigo='${COD}' ORDER BY h.en"
echo "== Comprobantes =="
q "SELECT v.id, v.origen, v.medio, v.semaforo,
          CASE WHEN v.retirado THEN 'RETIRADO' WHEN v.reemplazado_en IS NOT NULL THEN 'REEMPLAZADO' ELSE 'VIGENTE' END AS estado,
          to_char(v.creado_en AT TIME ZONE 'America/Lima','MM-DD HH24:MI') AS subido
   FROM voucher_pago v JOIN pedido p ON p.id=v.pedido_id WHERE p.codigo='${COD}' ORDER BY v.id"
echo "== Pedidos con código parecido =="
q "SELECT codigo, estado, canal, pago_estado, total, to_char(creado_en AT TIME ZONE 'America/Lima','MM-DD HH24:MI') AS creado
   FROM pedido WHERE codigo ILIKE '%'||right('${COD}',3)||'%' OR codigo ILIKE '${COD}%' ORDER BY creado_en DESC LIMIT 8"
echo "== Pedidos de hoy por estado (demo) =="
q "SELECT estado, count(*) FROM pedido WHERE creado_en >= date_trunc('day', now() AT TIME ZONE 'America/Lima') GROUP BY estado ORDER BY 2 DESC"
echo "OK: consulta terminada (solo lectura)."
