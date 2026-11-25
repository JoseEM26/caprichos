#!/usr/bin/env bash
# ==============================================================================
# diagnostico-servidor.sh — Consumo del VPS y estado de respaldos (SOLO LECTURA)
# ==============================================================================
# Uso (en el VPS):  ./diagnostico-servidor.sh
# No cambia nada y no imprime secretos: solo cifras de CPU, memoria, disco, contenedores,
# tamaño de las bases y fecha de los últimos respaldos y tareas programadas.
# ==============================================================================
set -uo pipefail

linea() { echo "------------------------------------------------------------------------"; }

echo "== SERVIDOR =="
echo "Hora: $(date '+%F %T %Z') · Encendido hace: $(uptime -p)"
echo "CPUs: $(nproc) · Carga (1/5/15 min): $(cut -d' ' -f1-3 /proc/loadavg)"
free -h | awk 'NR==1{print "Memoria:   "$0} NR==2{print "           "$0} NR==3{print "Swap:      "$0}'
linea
echo "== DISCO =="
df -h / | awk 'NR==1||NR==2'
echo "Respaldos locales: $(du -sh /opt/caprichos/respaldos 2>/dev/null | cut -f1)"
echo "Docker (imágenes, volúmenes, caché):"
docker system df 2>/dev/null | sed 's/^/  /'
linea
echo "== CONTENEDORES (CPU y memoria ahora) =="
docker stats --no-stream --format '{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}' 2>/dev/null | column -t -s $'\t' | sed 's/^/  /'
echo ""
echo "Reinicios de contenedores (si alguno sube, algo se está cayendo):"
docker ps -a --format '{{.Names}}' 2>/dev/null | while read -r n; do
  r=$(docker inspect -f '{{.RestartCount}}' "$n" 2>/dev/null || echo "?")
  e=$(docker inspect -f '{{.State.Status}}' "$n" 2>/dev/null || echo "?")
  echo "  $n: estado=$e reinicios=$r"
done
linea
echo "== BASES DE DATOS =="
for AMB in prod demo; do
  C="caprichos-${AMB}-postgres"
  if docker ps --format '{{.Names}}' | grep -qx "$C"; then
    TAM=$(docker exec "$C" sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT pg_size_pretty(pg_database_size(current_database()))"' 2>/dev/null || echo "?")
    CON=$(docker exec "$C" sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT count(*) FROM pg_stat_activity"' 2>/dev/null || echo "?")
    echo "  ${AMB}: tamaño=${TAM} · conexiones activas=${CON}"
  else
    echo "  ${AMB}: contenedor de base no encontrado"
  fi
done
linea
echo "== RESPALDOS =="
for AMB in prod demo; do
  echo "  ${AMB}: últimos 3 volcados de base"
  ls -1t /opt/caprichos/respaldos/${AMB}/db_${AMB}_*.sql.gz 2>/dev/null | head -3 | while read -r f; do
    echo "    $(basename "$f") · $(du -h "$f" | cut -f1) · $(date -r "$f" '+%F %H:%M')"
  done
  [[ -n "$(ls -1 /opt/caprichos/respaldos/${AMB}/db_${AMB}_*.sql.gz 2>/dev/null)" ]] || echo "    (ninguno)"
done
echo ""
echo "Copia fuera del servidor (restic): $( [[ -f /opt/caprichos/restic.env ]] && echo 'CONFIGURADA' || echo 'NO configurada' )"
echo "Tareas programadas de respaldo:"
{ crontab -l 2>/dev/null; sudo -n crontab -l 2>/dev/null; ls /etc/cron.d 2>/dev/null; systemctl list-timers --no-pager 2>/dev/null | grep -i "caprichos\|respald" ; } | grep -iE "respald|caprichos" | sed 's/^/  /' || true
[[ -n "$( { crontab -l 2>/dev/null; systemctl list-timers --no-pager 2>/dev/null; } | grep -iE 'respaldar|caprichos' )" ]] || echo "  (no se encontró ninguna tarea programada visible para este usuario)"
linea
# Solo lectura. En un repositorio público: se ocultan números (6+ dígitos), tokens y textos de mensajes.
ocultar() { sed -E 's/[0-9]{6,}/<num>/g; s/(token|apikey|key)=[^&" ]+/\1=<oculto>/Ig; s/"(conversation|text|body)":"[^"]*"/"\1":"<texto>"/g'; }
# $1 = demo|prod. Prod vive aparte: carpeta evolution-prod, proyecto caprichos-evolution-prod (claves nunca se imprimen).
evolucion_estado() {
  local amb="$1" sufijo="" EVO_DIR
  [[ "$amb" == "prod" ]] && sufijo="-prod"
  echo "== EVOLUTION (${amb}) =="
  EVO_DIR="/opt/caprichos/evolution${sufijo}"
  if [[ -f "$EVO_DIR/evolution.env" ]]; then
    evo() { docker compose -p "caprichos-evolution${sufijo}" --env-file "$EVO_DIR/evolution.env" -f /opt/caprichos/compose/docker-compose.evolution.yml "$@"; }
    evo ps --format 'table {{.Service}}\t{{.Image}}\t{{.Status}}' 2>&1 | ocultar
    DIAG_JS='
const k = process.env.AUTHENTICATION_API_KEY; const h = { apikey: k };
const j = (u) => fetch(u, { headers: h }).then(async (r) => r.status + " " + (await r.text()).slice(0, 600)).catch((e) => "ERR " + e.message);
(async () => {
  console.log("estado:", await j("http://127.0.0.1:8080/instance/connectionState/caprichos"));
  console.log("webhook instancia:", await j("http://127.0.0.1:8080/webhook/find/caprichos"));
  console.log("api salud desde evolution:", await fetch("http://api:3000/salud").then((r) => r.status).catch((e) => "ERR " + e.message));
  // Solo horas y tipo de los últimos mensajes recibidos (sin números ni textos): ¿Evolution sigue recibiendo?
  const m = await fetch("http://127.0.0.1:8080/chat/findMessages/caprichos", { method: "POST", headers: { ...h, "content-type": "application/json" }, body: JSON.stringify({ where: { key: { fromMe: false } }, page: 1, offset: 8 }) })
    .then((r) => r.json()).catch((e) => ({ error: e.message }));
  const lista = m?.messages?.records ?? (Array.isArray(m) ? m : []);
  console.log("ultimos recibidos (hora UTC, tipo):", lista.map((x) => new Date(Number(x.messageTimestamp) * 1000).toISOString() + " " + x.messageType).join(" | ") || JSON.stringify(m).slice(0, 200));
  console.log("webhook GLOBAL url:", (process.env.WEBHOOK_GLOBAL_URL || "").replace(/\?.*/, "?<oculto>"), "enabled:", process.env.WEBHOOK_GLOBAL_ENABLED);
})();'
    evo exec -T evolution-api node -e "$DIAG_JS" 2>&1 | ocultar
    echo "-- últimos registros de Evolution --"
    evo logs --no-color --tail 60 evolution-api 2>&1 | ocultar | tail -60
  else
    echo "  Evolution no instalado"
  fi
}
evolucion_estado demo
linea
evolucion_estado prod
for amb in demo prod; do
  API_C=$(docker ps --format '{{.Names}}' | grep -E "^caprichos-${amb}-api" | head -1)
  if [[ -n "$API_C" ]]; then
    echo "-- registros de la API ${amb} sobre WhatsApp/Evolution (2 h, sin el resumen del outbox) --"
    docker logs --since 2h "$API_C" 2>&1 | grep -iE "evolution|webhook|whatsapp|omit|descart|lista blanca|chatbot|outbox|conversaci|autorespuesta|error" | grep -v '"encolados\\":0' | ocultar | tail -80
  fi
done
linea
echo "== ENTRADA DE MENSAJES EN PRODUCCIÓN (solo lectura) =="
EVO_P=/opt/caprichos/evolution-prod
if [[ -f "$EVO_P/evolution.env" ]]; then
  echo "-- Evolution prod: eventos de las últimas 3 h sin volcados de sesión (hora UTC) --"
  docker compose -p caprichos-evolution-prod --env-file "$EVO_P/evolution.env" -f /opt/caprichos/compose/docker-compose.evolution.yml logs --no-color --timestamps --since 3h evolution-api 2>&1 \
    | sed -E 's/^evolution-api-1 *\| //' | grep -vE "^[0-9TZ:.-]+ +([ }]|\]|[a-zA-Z_]+: )" | grep -vE "SessionEntry|Buffer|_chains|chainKey|registrationId|ephemeral|rootKey|baseKey|preKey|indexInfo|pendingPreKey|remoteIdentity|previousCounter|lastRemote|currentRatchet|closed:|used:|created:|signedKeyId|^\s*$" \
    | ocultar | cut -c1-220 | tail -70
  echo "-- Evolution prod: errores (nivel 50) completos, 6 h --"
  docker compose -p caprichos-evolution-prod --env-file "$EVO_P/evolution.env" -f /opt/caprichos/compose/docker-compose.evolution.yml logs --no-color --timestamps --since 6h evolution-api 2>&1 \
    | grep -E '"level":(40|50|60)|stream:error|connection.update|CONNECTION|logout|decrypt|Bad MAC|No session|failed to' | ocultar | cut -c1-1500 | tail -20
  echo "-- Evolution prod: registros de webhook/mensajes (30 min) --"
  docker compose -p caprichos-evolution-prod --env-file "$EVO_P/evolution.env" -f /opt/caprichos/compose/docker-compose.evolution.yml logs --no-color --since 30m evolution-api 2>&1 \
    | grep -iE "webhook|upsert|messages\.|error|axios|ECONN|timeout|refused|status code|decrypt|bad mac|no session|no matching|retry|receipt|stream|conflict|logout|connection" | grep -v "Buffer\|npm error" | ocultar | tail -40
fi
if docker ps --format '{{.Names}}' | grep -q '^caprichos-prod-redis$'; then
  echo "-- cola whatsapp-webhooks (prod): esperando / activos / fallidos / completados / pausada --"
  API_P=$(docker ps --format '{{.Names}}' | grep -E "^caprichos-prod-api" | head -1)
  RP=$(docker exec "$API_P" printenv REDIS_PASSWORD 2>/dev/null || true)
  docker exec -e RP="$RP" caprichos-prod-redis sh -c 'A=""; [ -n "$RP" ] && A="-a $RP"; for k in wait active paused; do printf "%s=" $k; redis-cli $A --no-auth-warning LLEN bull:whatsapp-webhooks:$k; done; for k in failed completed delayed; do printf "%s=" $k; redis-cli $A --no-auth-warning ZCARD bull:whatsapp-webhooks:$k; done; printf "meta-paused="; redis-cli $A --no-auth-warning HGET bull:whatsapp-webhooks:meta paused; ult=$(redis-cli $A --no-auth-warning ZREVRANGE bull:whatsapp-webhooks:failed 0 0 | head -1); [ -n "$ult" ] && { printf "ultimo fallido: "; redis-cli $A --no-auth-warning HGET bull:whatsapp-webhooks:$ult failedReason | cut -c1-300; }' 2>&1 | ocultar
fi
if docker ps --format '{{.Names}}' | grep -q '^caprichos-prod-postgres$'; then
  docker exec -i caprichos-prod-postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -P pager=off' <<'SQL' 2>&1 | ocultar
SELECT 'mensajes de clientes por 10 min (últimas 3 h, hora Lima)' AS que;
SELECT to_char(date_trunc('hour', en AT TIME ZONE 'America/Lima') + floor(extract(minute FROM en AT TIME ZONE 'America/Lima')/10)*interval '10 min','HH24:MI') AS desde, count(*) FROM mensaje_chat WHERE direccion='ENTRA' AND en > now() - interval '3 hours' GROUP BY 1 ORDER BY 1;
SELECT 'whatsapp_mensaje ENTRANTE por estado (3 h)' AS que;
SELECT direccion, estado, max(creado_en) AT TIME ZONE 'America/Lima' AS ultimo, count(*) FROM whatsapp_mensaje WHERE creado_en > now() - interval '3 hours' GROUP BY 1,2 ORDER BY 1,2;
SQL
fi
linea
echo "== BOT PRODUCCIÓN: chats de las últimas 24 h (solo lectura, sin números ni textos) =="
if docker ps --format '{{.Names}}' | grep -q '^caprichos-prod-postgres$'; then
  docker exec -i caprichos-prod-postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -P pager=off' <<'SQL' 2>&1 | ocultar
SELECT 'mensajes por autor (24 h)' AS que;
SELECT direccion, autor, count(*) FROM mensaje_chat WHERE en > now() - interval '24 hours' GROUP BY 1,2 ORDER BY 1,2;
SELECT 'mensajes del BOT por día (7 días)' AS que;
SELECT (en AT TIME ZONE 'America/Lima')::date AS dia, count(*) FILTER (WHERE autor='BOT') AS bot, count(*) FILTER (WHERE autor='CLIENTE') AS cliente, count(*) FILTER (WHERE autor='PERSONA') AS persona FROM mensaje_chat WHERE en > now() - interval '7 days' GROUP BY 1 ORDER BY 1;
SELECT 'chats con actividad en 24 h por dueño' AS que;
SELECT duenio, estado, count(*) FROM conversacion WHERE ultima_actividad > now() - interval '24 hours' GROUP BY 1,2 ORDER BY 1,2;
SELECT 'últimos 15 chats: dueño, hora Lima del último mensaje del cliente y del bot' AS que;
SELECT c.id, c.duenio, c.estado, c.motivo_derivacion, c.tomado_en AT TIME ZONE 'America/Lima' AS tomado,
  (SELECT max(en) FROM mensaje_chat m WHERE m.conversacion_id=c.id AND m.autor='CLIENTE') AT TIME ZONE 'America/Lima' AS ult_cliente,
  (SELECT max(en) FROM mensaje_chat m WHERE m.conversacion_id=c.id AND m.autor='BOT') AT TIME ZONE 'America/Lima' AS ult_bot,
  (SELECT max(en) FROM mensaje_chat m WHERE m.conversacion_id=c.id AND m.autor='PERSONA') AT TIME ZONE 'America/Lima' AS ult_persona
FROM conversacion c ORDER BY c.ultima_actividad DESC LIMIT 15;
SELECT 'salientes WhatsApp 24 h por estado' AS que;
SELECT estado, coalesce(error_codigo,'-') AS error, count(*) FROM whatsapp_mensaje WHERE direccion='SALIENTE' AND creado_en > now() - interval '24 hours' GROUP BY 1,2 ORDER BY 3 DESC;
SELECT 'parámetros del bot' AS que;
SELECT clave, left(valor::text, 60) AS valor FROM parametro WHERE clave LIKE 'chatbot_funcion%' OR clave IN ('whatsapp_proveedor','evolution_pausado','evolution_pausa_auto','evolution_estado','chatbot_activo','chatbot_ia_activa') ORDER BY 1;
SQL
fi
linea
echo "OK: diagnóstico terminado (solo lectura)."
