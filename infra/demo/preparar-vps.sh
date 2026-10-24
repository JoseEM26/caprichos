#!/usr/bin/env bash
# ==============================================================================
# preparar-vps.sh — Verifica (y opcionalmente completa) lo que la demo necesita del VPS
# ==============================================================================
# El VPS ya lo aprovisionó Ansible (infra/ansible): usuario deploy, SSH con llave,
# Docker, Dokploy, fail2ban y UFW. Este script NO reinicia SSH ni reinicia UFW.
#
# Lo único que la demo necesita de UFW, además de lo de Ansible:
#   - 80 y 443 abiertos a cualquiera (Let's Encrypt y el sitio público). Ansible
#     hoy los deja solo a Cloudflare.
#   - «route» hacia los contenedores en 80 y 443: el tráfico que entra a un
#     contenedor publicado pasa por la cadena DOCKER-USER, que Ansible filtra.
#     Sin esta regla dokploy-traefik no recibe tráfico desde internet.
#
# Uso:
#   ./preparar-vps.sh            # solo comprueba y muestra lo que falta
#   sudo ./preparar-vps.sh --aplicar   # agrega las reglas que falten (no quita nada)
# ==============================================================================

set -euo pipefail

APLICAR=0
[[ "${1:-}" == "--aplicar" ]] && APLICAR=1

FALTA=0
ok()    { echo "    ✓ $1"; }
falta() { echo "    ✗ $1"; FALTA=1; }

echo "==> Docker y Dokploy"
if docker info &>/dev/null; then ok "Docker activo"; else falta "Docker no responde (¿usuario deploy en el grupo docker?)"; fi
if docker network inspect dokploy-network &>/dev/null; then ok "red dokploy-network"; else falta "no existe dokploy-network (Dokploy no instalado)"; fi
if [[ "$(docker inspect --format '{{.State.Running}}' dokploy-traefik 2>/dev/null || echo false)" == "true" ]]; then
  ok "dokploy-traefik en ejecución"
else
  falta "dokploy-traefik no está en ejecución"
fi

echo "==> UFW (reglas de la demo)"
ESTADO_UFW="$(sudo ufw status 2>/dev/null || true)"
REGLAS_NUEVAS=()
if grep -qE '^80/tcp +ALLOW +Anywhere' <<<"$ESTADO_UFW"; then ok "80/tcp abierto a cualquiera"; else falta "80/tcp no está abierto a cualquiera"; REGLAS_NUEVAS+=("ufw allow 80/tcp"); fi
if grep -qE '^443/tcp +ALLOW +Anywhere' <<<"$ESTADO_UFW"; then ok "443/tcp abierto a cualquiera"; else falta "443/tcp no está abierto a cualquiera"; REGLAS_NUEVAS+=("ufw allow 443/tcp"); fi
if sudo ufw status 2>/dev/null | grep -qE 'ALLOW FWD +Anywhere.*(80|443)'; then
  ok "route permitido hacia contenedores en 80/443"
else
  falta "falta ufw route hacia contenedores en 80/443 (sin esto Traefik no recibe tráfico)"
  REGLAS_NUEVAS+=("ufw route allow proto tcp from any to any port 80,443")
fi

if [[ $FALTA -eq 0 ]]; then
  echo "==> Todo listo para la demo."
  exit 0
fi

if [[ $APLICAR -eq 1 ]]; then
  for REGLA in "${REGLAS_NUEVAS[@]}"; do
    echo "==> Aplicando: sudo ${REGLA}"
    # shellcheck disable=SC2086
    sudo ${REGLA}
  done
  echo "==> Reglas aplicadas. Compruebe con: sudo ufw status"
  exit 0
fi

echo ""
echo "Faltan elementos. Para agregar solo las reglas de la demo (no quita nada), ejecute:"
for REGLA in "${REGLAS_NUEVAS[@]}"; do
  echo "    sudo ${REGLA}"
done
echo "O bien: sudo ./preparar-vps.sh --aplicar"
exit 1
