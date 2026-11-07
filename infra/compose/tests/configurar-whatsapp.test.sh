#!/usr/bin/env bash
# Prueba de configurar-whatsapp.sh con un .env, un desplegar.sh y un docker simulados (sin servidor real).
# Uso: bash infra/compose/tests/configurar-whatsapp.test.sh
set -u
AQUI="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$AQUI/../scripts/configurar-whatsapp.sh"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
fallos=0
ok()   { echo "ok   - $1"; }
mal()  { echo "FALLA - $1"; fallos=$((fallos+1)); }

VT=$(printf 'f%.0s' {1..20}); PI=1486799844506773
TK=$(printf 'T%.0s' {1..60}); AS=$(printf 'a1%.0s' {1..16})

mkdir -p "$T/bin" "$T/scripts" "$T/prod" "$T/compose"
cat > "$T/scripts/desplegar.sh" <<'X'
#!/usr/bin/env bash
R="$(cd "$(dirname "$0")/.." && pwd)"
n=$(cat "$R/.n" 2>/dev/null || echo 0); echo $((n+1)) > "$R/.n"
if [[ "${FALLA_PRIMERO:-0}" == 1 && $n -eq 0 ]]; then exit 1; fi
cp "$R/$1/.env" "$R/$1/.deployed"
X
cat > "$T/bin/docker" <<'X'
#!/usr/bin/env bash
R="$CAPRICHOS_RAIZ"
case "$1" in
  compose) echo cid123 ;;
  exec)
    if [[ "$3" == curl ]]; then exit 0; fi
    s="$5"
    if [[ "$s" == *whatsapp/webhook* ]]; then
      reto=$(sed -n "s/.*hub.challenge=\([a-z0-9]*\).*/\1/p" <<<"$s")
      ( set -a; . "$R/prod/.deployed"; [[ "${WHATSAPP_VERIFY_TOKEN:-}" == "${WEBHOOK_ESPERADO:-$WHATSAPP_VERIFY_TOKEN}" ]] && printf '%s\n200' "$reto" || printf '\n403' )
    else
      ( set -a; . "$R/prod/.deployed"; sh -c "$s" )
    fi ;;
esac
X
chmod +x "$T/scripts/desplegar.sh" "$T/bin/docker"
export PATH="$T/bin:$PATH" CAPRICHOS_RAIZ="$T" WHATSAPP_REINTENTOS=2 WHATSAPP_PAUSA=0

nuevo_env() { printf "TAG=v1.2.3\nOTRA='dejame'\nWHATSAPP_PHONE_ID='111'\nWHATSAPP_TOKEN='viejo'\n" > "$T/prod/.env"; rm -f "$T/.n" "$T/prod/.deployed" "$T"/prod/.env.bak-*; }
correr() { printf '%s\n' "$@" | bash "$SCRIPT" prod > "$T/out" 2>&1; }

# 1. Solo escribe lo recibido y respeta lo demás
nuevo_env; correr "WHATSAPP_VERIFY_TOKEN=$VT" "WHATSAPP_PHONE_ID=" "WHATSAPP_APP_SECRET=$AS"
[[ $? -eq 0 ]] && ok "termina bien" || { mal "termina bien"; cat "$T/out"; }
grep -q "^WHATSAPP_VERIFY_TOKEN='$VT'$" "$T/prod/.env" && grep -q "^WHATSAPP_APP_SECRET='$AS'$" "$T/prod/.env" && ok "escribe las recibidas entre comillas simples" || mal "escribe las recibidas"
grep -q "^WHATSAPP_PHONE_ID='111'$" "$T/prod/.env" && grep -q "^WHATSAPP_TOKEN='viejo'$" "$T/prod/.env" && grep -q "^OTRA='dejame'$" "$T/prod/.env" && grep -q "^TAG=v1.2.3$" "$T/prod/.env" && ok "no toca las demás variables" || mal "no toca las demás"
grep -q "Webhook: OK" "$T/out" && ok "prueba del webhook" || mal "prueba del webhook"
grep -q "WHATSAPP_VERIFY_TOKEN: configurada (20 caracteres)" "$T/out" && ok "muestra solo longitudes" || mal "longitudes"
if grep -qE "$VT|$AS|$PI|$TK" "$T/out"; then mal "imprime valores"; else ok "no imprime valores"; fi
[[ "$(stat -c %a "$T/prod/.env")" == 600 ]] && ls "$T"/prod/.env.bak-* >/dev/null 2>&1 && ok "copia fechada y permisos 600" || mal "copia/permisos"

# 2. Sin verify token no se prueba el webhook
nuevo_env; correr "WHATSAPP_PHONE_ID=$PI"
grep -q "Webhook" "$T/out" && mal "omite webhook sin verify token" || ok "omite webhook sin verify token"

# 3. Aviso si el servidor no valida
nuevo_env; WEBHOOK_ESPERADO=otra correr "WHATSAPP_VERIFY_TOKEN=$VT"
grep -q "AVISO: el servidor no valida el token" "$T/out" && ok "avisa si no valida" || mal "avisa si no valida"

# 4. Rechazos (el .env no cambia)
for caso in "OTRA_CLAVE=$VT" "WHATSAPP_PHONE_ID=12ab5678901" "WHATSAPP_PHONE_ID=123" "WHATSAPP_VERIFY_TOKEN=corto" "WHATSAPP_VERIFY_TOKEN=${VT} con espacio" "WHATSAPP_TOKEN=${TK}'x" "WHATSAPP_APP_SECRET=${AS}-!" "WHATSAPP_TOKEN=corto"; do
  nuevo_env; antes=$(cat "$T/prod/.env"); correr "$caso"; rc=$?
  [[ $rc -ne 0 && "$(cat "$T/prod/.env")" == "$antes" && ! -f "$T/.n" ]] && ok "rechaza: ${caso:0:22}" || mal "rechaza: ${caso:0:22}"
done
nuevo_env; printf 'WHATSAPP_VERIFY_TOKEN=%s\r\n' "$VT" | bash "$SCRIPT" prod >/dev/null 2>&1 && mal "rechaza CR" || ok "rechaza CR"
nuevo_env; printf '' | bash "$SCRIPT" prod >/dev/null 2>&1 && mal "rechaza entrada vacía" || ok "rechaza entrada vacía"
nuevo_env; correr "WHATSAPP_VERIFY_TOKEN=$VT"; bash "$SCRIPT" otro </dev/null >/dev/null 2>&1 && mal "ambiente inválido" || ok "ambiente inválido"

# 5. Restaura si falla el redespliegue
nuevo_env; antes=$(cat "$T/prod/.env"); FALLA_PRIMERO=1 correr "WHATSAPP_TOKEN=$TK"; rc=$?
[[ $rc -ne 0 && "$(cat "$T/prod/.env")" == "$antes" && "$(cat "$T/.n")" == 2 ]] && ok "restaura y redespliega si falla" || mal "restaura si falla"
grep -q "Se restauró" "$T/out" && ! grep -q "$TK" "$T/out" && ok "restauración sin valores" || mal "restauración sin valores"

echo; [[ $fallos -eq 0 ]] && echo "TODO OK" || { echo "$fallos fallo(s)"; exit 1; }
