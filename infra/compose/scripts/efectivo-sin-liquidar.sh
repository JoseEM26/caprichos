#!/usr/bin/env bash
# ==============================================================================
# efectivo-sin-liquidar.sh — SOLO LECTURA: deliveries en efectivo que ninguna caja liquidó
# ==============================================================================
# Uso (en el VPS):  ./efectivo-sin-liquidar.sh <prod|demo> [dias=60]
# Un delivery contra entrega se liquida en la caja del día (Lima) en que se entregó. Si se entregó DESPUÉS de que
# esa caja cerró, o ese día no hubo caja, su efectivo no entró a ninguna liquidación. Este script los lista para
# revisarlos a mano. Corre dentro de una transacción READ ONLY: no cambia nada. Solo muestra código, montos y
# fechas (sin nombres, celulares ni documentos).
# ==============================================================================
set -euo pipefail
AMB="${1:-}"; DIAS="${2:-60}"
case "$AMB" in prod|demo) ;; *) echo "Uso: $0 <prod|demo> [dias]" >&2; exit 1 ;; esac
[[ "$DIAS" =~ ^[0-9]{1,3}$ ]] || { echo "dias debe ser un número (1-999)" >&2; exit 1; }
ENV_FILE="/opt/caprichos/${AMB}/.env"
DB_USER=$(grep -E "^POSTGRES_USER=" "$ENV_FILE" | cut -d= -f2)
DB_NAME=$(grep -E "^POSTGRES_DB=" "$ENV_FILE" | cut -d= -f2)

echo "== Efectivo de delivery sin liquidar (${AMB}, últimos ${DIAS} días) =="
docker exec -i "caprichos-${AMB}-postgres" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" -P pager=off <<SQL
BEGIN READ ONLY;
WITH entregas AS (
  SELECT p.id, p.codigo, p.total, p.pago_metodo, p.repartidor_party_id,
         p.entregado_en,
         (p.entregado_en AT TIME ZONE 'America/Lima')::date AS dia_lima
  FROM pedido p
  WHERE p.modalidad = 'DELIVERY' AND p.estado = 'ENTREGADO'
    AND p.repartidor_party_id IS NOT NULL
    AND p.entregado_en >= now() - interval '${DIAS} days'
    AND NOT EXISTS (SELECT 1 FROM cobro c WHERE c.pedido_id = p.id AND c.anulado_en IS NULL)
    AND (p.pago_metodo = 'EFECTIVO'
         OR EXISTS (SELECT 1 FROM pedido_pago_plan pp WHERE pp.pedido_id = p.id AND pp.medio = 'EFECTIVO'))
)
SELECT e.codigo,
       to_char(e.entregado_en AT TIME ZONE 'America/Lima', 'YYYY-MM-DD HH24:MI') AS entregado_lima,
       e.total,
       e.repartidor_party_id AS repartidor_id,
       COALESCE(to_char(k.cerrada_en AT TIME ZONE 'America/Lima', 'YYYY-MM-DD HH24:MI'), '-') AS caja_cerro,
       CASE WHEN k.id IS NULL THEN 'Ese día no hubo caja'
            WHEN k.cerrada_en IS NOT NULL AND e.entregado_en > k.cerrada_en THEN 'Entregado después del cierre'
       END AS motivo
FROM entregas e
LEFT JOIN caja k ON k.fecha = e.dia_lima
WHERE k.id IS NULL OR (k.cerrada_en IS NOT NULL AND e.entregado_en > k.cerrada_en)
ORDER BY e.entregado_en;
ROLLBACK;
SQL
echo "OK: consulta de solo lectura terminada. Revisa cada pedido en Caja antes de cobrarlo o justificarlo."
