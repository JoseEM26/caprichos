#!/usr/bin/env bash
# ==============================================================================
# programar-respaldos.sh — Deja los respaldos automáticos funcionando en el VPS
# ==============================================================================
# Uso (en el VPS):  ./programar-respaldos.sh <simulacro|real>   (lee por STDIN líneas CLAVE=valor)
# Claves aceptadas por stdin: RESTIC_REPOSITORY, RESTIC_PASSWORD, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
# KUMA_PUSH_PROD, KUMA_PUSH_DEMO. Las vacías se ignoran. Nunca se imprimen.
#   simulacro: dice qué instalaría (qué claves llegaron, sin valores); no escribe.
#   real     : guarda /opt/caprichos/restic.env y kuma.env (600), instala el cron del usuario
#              (prod todos los días 3:00; demo domingos 4:00), inicia el repositorio restic si falta
#              y ejecuta un respaldo de producción ahora mismo.
# ==============================================================================
set -euo pipefail
umask 077

MODO="${1:-simulacro}"
case "$MODO" in simulacro|real) ;; *) echo "Uso: $0 <simulacro|real>" >&2; exit 1 ;; esac

declare -A V
PERMITIDAS="RESTIC_REPOSITORY RESTIC_PASSWORD AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY KUMA_PUSH_PROD KUMA_PUSH_DEMO"
while IFS='=' read -r k v; do
  [[ -z "${k:-}" || -z "${v:-}" ]] && continue
  for p in $PERMITIDAS; do [[ "$k" == "$p" ]] && V["$k"]="$v"; done
done

echo "== Programar respaldos =="
for p in $PERMITIDAS; do
  echo "  ${p}: $([[ -n "${V[$p]:-}" ]] && echo 'recibida' || echo 'no enviada')"
done
if [[ -n "${V[RESTIC_REPOSITORY]:-}" ]]; then
  for p in RESTIC_PASSWORD AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY; do
    [[ -n "${V[$p]:-}" ]] || { echo "ERROR: con RESTIC_REPOSITORY hace falta ${p}." >&2; exit 1; }
  done
  [[ "${V[RESTIC_REPOSITORY]}" == s3:* ]] || { echo "ERROR: RESTIC_REPOSITORY debe empezar con s3:" >&2; exit 1; }
fi
for p in RESTIC_PASSWORD AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY KUMA_PUSH_PROD KUMA_PUSH_DEMO; do
  [[ "${V[$p]:-}" =~ ^[A-Za-z0-9:/._-]*$ ]] || { echo "ERROR: ${p} tiene caracteres no permitidos (solo letras, números y : / . _ -)." >&2; exit 1; }
done

if [[ "$MODO" == "simulacro" ]]; then
  echo "Cron que se instalaría: prod 03:00 diario · demo domingo 04:00"
  echo "Simulacro: no se escribió nada."
  exit 0
fi

mkdir -p /opt/caprichos/respaldos
if [[ -n "${V[RESTIC_REPOSITORY]:-}" ]]; then
  {
    echo "RESTIC_REPOSITORY=${V[RESTIC_REPOSITORY]}"
    echo "RESTIC_PASSWORD=${V[RESTIC_PASSWORD]}"
    echo "AWS_ACCESS_KEY_ID=${V[AWS_ACCESS_KEY_ID]}"
    echo "AWS_SECRET_ACCESS_KEY=${V[AWS_SECRET_ACCESS_KEY]}"
  } > /opt/caprichos/restic.env
  chmod 600 /opt/caprichos/restic.env
  echo "restic.env guardado (600)."
fi
if [[ -n "${V[KUMA_PUSH_PROD]:-}${V[KUMA_PUSH_DEMO]:-}" ]]; then
  {
    [[ -n "${V[KUMA_PUSH_PROD]:-}" ]] && echo "KUMA_PUSH_PROD=${V[KUMA_PUSH_PROD]}"
    [[ -n "${V[KUMA_PUSH_DEMO]:-}" ]] && echo "KUMA_PUSH_DEMO=${V[KUMA_PUSH_DEMO]}"
  } > /opt/caprichos/respaldos/kuma.env
  chmod 600 /opt/caprichos/respaldos/kuma.env
  echo "kuma.env guardado (600)."
fi

# Cron del usuario actual, sin duplicar (se reemplazan las líneas marcadas)
MARCA="# caprichos-respaldo"
( crontab -l 2>/dev/null | grep -v "$MARCA" || true
  echo "0 3 * * * /opt/caprichos/scripts/respaldo-programado.sh prod $MARCA"
  echo "0 4 * * 0 /opt/caprichos/scripts/respaldo-programado.sh demo $MARCA"
) | crontab -
echo "Cron instalado:"; crontab -l | grep "$MARCA" | sed 's/^/  /'

# Repositorio restic: se inicia una sola vez
if [[ -f /opt/caprichos/restic.env ]]; then
  if docker run --rm --env-file /opt/caprichos/restic.env restic/restic:0.17.3 snapshots >/dev/null 2>&1; then
    echo "Repositorio restic ya existe."
  else
    docker run --rm --env-file /opt/caprichos/restic.env restic/restic:0.17.3 init 2>&1 | grep -vi "password\|key" | sed 's/^/  /' || true
    docker run --rm --env-file /opt/caprichos/restic.env restic/restic:0.17.3 snapshots >/dev/null 2>&1 \
      && echo "Repositorio restic iniciado." || { echo "ERROR: no se pudo iniciar el repositorio restic (revise credenciales y bucket)." >&2; exit 1; }
  fi
fi

echo "==> Respaldo de producción ahora mismo..."
/opt/caprichos/scripts/respaldo-programado.sh prod && echo "OK: primer respaldo de producción completado." || { echo "ERROR: el respaldo falló; vea /opt/caprichos/respaldos/respaldo-prod.log" >&2; exit 1; }
