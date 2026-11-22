#!/usr/bin/env bash
# ==============================================================================
# exportar-chats.sh — Chats del bot de WhatsApp para analizarlos (SOLO LECTURA)
# ==============================================================================
# Uso (en el VPS):  ./exportar-chats.sh <demo|prod> <dias>
# Escribe en stdout un JSON por línea (chats, pedidos y envíos de WhatsApp de los últimos <dias>). Anonimizado:
# el chat va por número interno (sin teléfono), las cifras de 7 o más dígitos salen como [NUM] y los correos como
# [CORREO]; los pedidos van sin nombre, teléfono ni dirección. La acción de GitHub lo cifra antes de guardarlo.
# ==============================================================================
set -euo pipefail
AMB="${1:-}"; DIAS="${2:-14}"
case "$AMB" in demo|prod) ;; *) echo "Uso: $0 <demo|prod> <dias>" >&2; exit 1 ;; esac
[[ "$DIAS" =~ ^[0-9]{1,3}$ ]] || { echo "ERROR: dias no válido." >&2; exit 1; }
C="caprichos-${AMB}-postgres"
docker ps --format '{{.Names}}' | grep -qx "$C" || { echo "ERROR: no encuentro ${C}." >&2; exit 1; }
q() { docker exec "$C" sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -v ON_ERROR_STOP=1 -c "$1"' _ "$1"; }
LIMPIA="regexp_replace(regexp_replace(%s, '\\d{7,}', '[NUM]', 'g'), '[[:alnum:]._%%+-]+@[[:alnum:].-]+', '[CORREO]', 'g')"
txt() { printf "$LIMPIA" "$1"; }

q "SELECT json_build_object('t','msg','chat',m.conversacion_id,'en',to_char(m.en AT TIME ZONE 'America/Lima','YYYY-MM-DD HH24:MI:SS'),
     'dir',m.direccion,'autor',m.autor,'tipo',m.tipo,'c',$(txt 'm.contenido::text'))
   FROM mensaje_chat m WHERE m.en >= now() - interval '${DIAS} days' ORDER BY m.conversacion_id, m.id"
q "SELECT json_build_object('t','chat','chat',c.id,'duenio',c.duenio,'estado',c.estado,'tipo_id',c.identificador_tipo,
     'tiene_cliente',c.party_id IS NOT NULL,'celular_vinculado',c.celular_vinculado IS NOT NULL,'motivo',c.motivo_derivacion)
   FROM conversacion c WHERE c.ultima_actividad >= now() - interval '${DIAS} days'"
q "SELECT json_build_object('t','pedido','codigo',p.codigo,'canal',p.canal,'modalidad',p.modalidad,'estado',p.estado,
     'pago',p.pago_estado,'metodo',p.pago_metodo,'total',p.total,'en',to_char(p.creado_en AT TIME ZONE 'America/Lima','YYYY-MM-DD HH24:MI'),
     'tiene_tel',coalesce(p.cliente_telefono,'')<>'','motivo_anulacion',left(coalesce(p.motivo_anulacion,''),80))
   FROM pedido p WHERE p.creado_en >= now() - interval '${DIAS} days'"
q "SELECT json_build_object('t','envio','chat',w.conversacion_id,'pedido',p.codigo,'canal_pedido',p.canal,'dir',w.direccion,'tipo',w.tipo,
     'plantilla',w.plantilla,'estado',w.estado,'error',w.error_codigo,'detalle',left($(txt "coalesce(w.error_detalle,'')"),160),
     'en',to_char(w.creado_en AT TIME ZONE 'America/Lima','YYYY-MM-DD HH24:MI'))
   FROM whatsapp_mensaje w LEFT JOIN pedido p ON p.id=w.pedido_id WHERE w.creado_en >= now() - interval '${DIAS} days' ORDER BY w.id"
