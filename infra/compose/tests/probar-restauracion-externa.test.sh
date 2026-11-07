#!/usr/bin/env bash
# Prueba de probar-restauracion-externa.sh con un docker simulado (restic y PostgreSQL falsos, sin servidor real).
# Uso: bash infra/compose/tests/probar-restauracion-externa.test.sh
set -u
AQUI="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$AQUI/../scripts/probar-restauracion-externa.sh"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
fallos=0
ok()  { echo "ok   - $1"; }
mal() { echo "FALLA - $1"; fallos=$((fallos+1)); }

PW=ClaveRestic123; AK=LlaveAcceso456; SK=LlaveSecreta789
printf 'RESTIC_REPOSITORY=s3:https://s3.example/bucket\nRESTIC_PASSWORD=%s\nAWS_ACCESS_KEY_ID=%s\nAWS_SECRET_ACCESS_KEY=%s\n' "$PW" "$AK" "$SK" > "$T/restic.env"

mkdir -p "$T/bin"
cat > "$T/bin/docker" <<'X'
#!/usr/bin/env bash
echo "$*" >> "$LOG_DOCKER"
case "$1" in
  rm) echo "RM $*" >> "$LOG_DOCKER" ;;
  run)
    if [[ "$*" == *restic/restic* ]]; then
      for a in "$@"; do [[ "$a" == *:/restore ]] && echo "${a%%:*}" > "$LOG_DOCKER.tmp"; done
      case "$*" in
        *" snapshots "*)
          [[ "${RESTIC_FALLA:-0}" == 1 ]] && { echo "Fatal: wrong password ${RESTIC_PASSWORD_ECO:-} key ${AK_ECO:-}"; exit 1; }
          echo "[{\"time\":\"${HORA_SNAP}\",\"short_id\":\"abc12345\"}]" ;;
        *" check"*) echo "no errors were found" ;;
        *" restore "*) d=$(cat "$LOG_DOCKER.tmp"); mkdir -p "$d/opt/r/prod"; printf 'x' | gzip > "$d/opt/r/prod/db_${AMB_SNAP:-prod}_1.sql.gz" ;;
      esac
    fi ;;
  exec) cat >/dev/null 2>&1 <&0 || true; [[ "$*" == *count* ]] && echo 3; exit 0 ;;
esac
exit 0
X
chmod +x "$T/bin/docker"
export PATH="$T/bin:$PATH" LOG_DOCKER="$T/docker.log" CAPRICHOS_RESTIC_ENV="$T/restic.env"
ahora() { date -u -d "$1" +%Y-%m-%dT%H:%M:%SZ; }
correr() { : > "$LOG_DOCKER"; bash "$SCRIPT" "$@" > "$T/out" 2>&1; }

# 1. Argumentos
correr; [[ $? -ne 0 ]] && grep -q "Uso:" "$T/out" && ok "sin ambiente: uso y error" || mal "sin ambiente"
correr dev; [[ $? -ne 0 ]] && grep -q "Uso:" "$T/out" && ok "ambiente inválido: error" || mal "ambiente inválido"

# 2. Sin restic.env
CAPRICHOS_RESTIC_ENV="$T/no-existe" correr prod
[[ $? -ne 0 ]] && grep -q "no existe" "$T/out" && ! grep -q docker "$LOG_DOCKER" && ok "sin restic.env: mensaje claro y sin tocar docker" || mal "sin restic.env"

# 3. Camino feliz con snapshot reciente
export HORA_SNAP; HORA_SNAP=$(ahora "2 hours ago")
correr prod
[[ $? -eq 0 ]] && grep -q "^OK:" "$T/out" && grep -q "^Snapshot: abc12345" "$T/out" && grep -q "^Tablas" "$T/out" && grep -q "^Filas en pedido: 3" "$T/out" && ok "camino feliz con resumen" || { mal "camino feliz"; cat "$T/out"; }
grep -q AVISO "$T/out" && mal "snapshot reciente sin aviso" || ok "snapshot reciente sin aviso"
grep -q "^RM " "$LOG_DOCKER" && ok "borra el contenedor" || mal "borra el contenedor"
[[ ! -e "$(cat "$LOG_DOCKER.tmp")" ]] && ok "borra el directorio temporal" || mal "directorio temporal"

# 4. Snapshot viejo avisa
HORA_SNAP=$(ahora "5 days ago"); correr prod
grep -q "^AVISO" "$T/out" && ok "avisa si pasa de 48 h" || mal "aviso 48 h"

# 5. Snapshot sin volcado del ambiente: falla y limpia
HORA_SNAP=$(ahora "1 hour ago"); AMB_SNAP=demo correr prod
[[ $? -ne 0 ]] && grep -q "^FALLA" "$T/out" && ok "sin volcado del ambiente: falla" || mal "sin volcado"
unset AMB_SNAP

# 6. Falla de restic: los secretos salen tapados
RESTIC_FALLA=1 RESTIC_PASSWORD_ECO=$PW AK_ECO=$SK correr prod
[[ $? -ne 0 ]] && grep -q "^FALLA" "$T/out" && ok "falla de restic detectada" || mal "falla de restic"
if grep -qE "$PW|$AK|$SK" "$T/out"; then mal "imprime secretos"; else ok "no imprime secretos"; fi
grep -q '\*\*\*' "$T/out" && ok "secretos tapados con ***" || mal "tapado"

for s in "$AQUI"/../scripts/*.sh; do bash -n "$s" || mal "bash -n $s"; done
echo; [[ $fallos -eq 0 ]] && echo "TODO OK" || { echo "$fallos fallos"; exit 1; }
