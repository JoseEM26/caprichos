#!/usr/bin/env bash
# ==============================================================================
# respaldo-programado.sh — Lo que ejecuta el cron: respalda y avisa a Uptime Kuma
# ==============================================================================
# Uso (cron):  respaldo-programado.sh <prod|demo>
# Corre respaldar.sh (base + archivos + copia remota si está configurada). Al terminar manda un latido
# a Uptime Kuma (monitor «Push»): ok si salió bien, caído si falló. Si el cron no corre, Kuma avisa por falta de latido.
# La dirección del latido vive en /opt/caprichos/respaldos/kuma.env (KUMA_PUSH_PROD / KUMA_PUSH_DEMO), nunca en Git.
# ==============================================================================
set -uo pipefail
AMB="${1:-}"
case "$AMB" in prod|demo) ;; *) echo "Uso: $0 <prod|demo>" >&2; exit 1 ;; esac

LOG="/opt/caprichos/respaldos/respaldo-${AMB}.log"
mkdir -p /opt/caprichos/respaldos
{
  echo "=== $(date '+%F %T') respaldo ${AMB} ==="
  /opt/caprichos/scripts/respaldar.sh "$AMB"
} >> "$LOG" 2>&1
RC=$?
tail -n 2000 "$LOG" > "${LOG}.tmp" && mv "${LOG}.tmp" "$LOG"

URL=""
if [[ -f /opt/caprichos/respaldos/kuma.env ]]; then
  set -a; source /opt/caprichos/respaldos/kuma.env; set +a
  if [[ "$AMB" == "prod" ]]; then URL="${KUMA_PUSH_PROD:-}"; else URL="${KUMA_PUSH_DEMO:-}"; fi
fi
if [[ -n "$URL" ]]; then
  if [[ $RC -eq 0 ]]; then
    curl -fsS -m 15 "${URL}?status=up&msg=Respaldo%20OK" >/dev/null 2>&1 || true
  else
    curl -fsS -m 15 "${URL}?status=down&msg=Respaldo%20FALLO" >/dev/null 2>&1 || true
  fi
fi
exit $RC
