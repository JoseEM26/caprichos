---
id: RB-CAP-004
tipo: runbook
titulo: "Runbook: preparar un servidor nuevo"
estado: draft
producto: caprichos
version: "2.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-24
relacionados: [FT-PLA-02, HU-CAP-181, HU-CAP-182, HU-CAP-183, ADR-011, ADR-012, ADR-015, DT-30, DT-40, DT-42, DT-43, INV-CAP-001, RB-CAP-005]
tags: [runbook, ansible, compose, traefik, servidor, devops]
---

# RB-CAP-004 — Preparar un servidor nuevo (Docker Compose + Traefik)

| Campo | Valor |
|---|---|
| Cuándo usarlo | Primera instalación, cambio de proveedor, o el VPS se perdió |
| Tiempo esperado | 25 a 35 minutos sin contar la restauración de datos |
| Quién lo ejecuta | Quien tenga acceso al repositorio, al proveedor del VPS, a Cloudflare y al gestor de contraseñas |
| Feature | FT-PLA-02 (HU-CAP-181 a HU-CAP-183) · ADR-011 · ADR-015 · DT-30 · DT-40 · DT-42 · DT-43 |

## Antes de empezar

- [ ] VPS nuevo creado (Ubuntu LTS, 6 vCPU, 12 GB RAM; DT-30) con tu llave SSH pública cargada.
- [ ] Ansible instalado en tu equipo y el repositorio clonado.
- [ ] Acceso a Cloudflare, a GitHub y al gestor de contraseñas (secretos de producción).

## Pasos

1. **Inventario.** Edita `infra/ansible/inventory.ini` con la IP nueva del VPS en el grupo correspondiente (`prod` o `vps`).
2. **Aprovisionamiento con Ansible.**
   ```bash
   cd infra/ansible
   ansible-playbook -i inventory.ini site.yml
   ```
   Aplica: usuario `deploy` sin root, SSH solo con llave, zona horaria `America/Lima`, UFW (puerto 22 limitado; 80/443 según `proxy_cloudflare`), fail2ban, parches automáticos, Docker CE y el rol `compose` que inicializa `/opt/caprichos` y la red perimetral `caprichos-proxy-net`.
3. **Comprobar idempotencia.** Corre el mismo comando otra vez: no debe cambiar nada (`changed=0`).
4. **Proxy Traefik Autónomo.**
   Copiar `infra/compose/proxy/` a `/opt/caprichos/proxy/` en el VPS.
   ```bash
   cd /opt/caprichos/proxy
   cp .env.example .env
   chmod 600 .env
   docker compose up -d
   ```
   Traefik queda listo para terminar HTTPS con Let's Encrypt o Certificado de Origen de Cloudflare.
5. **Configuración de Ambientes.**
   Copiar `infra/compose/` a `/opt/caprichos/compose/` y `infra/compose/scripts/` a `/opt/caprichos/scripts/`:
   ```bash
   mkdir -p /opt/caprichos/prod /opt/caprichos/staging /opt/caprichos/demo
   cp /opt/caprichos/compose/.env.example /opt/caprichos/prod/.env
   chmod 600 /opt/caprichos/prod/.env
   ```
   Rellenar contraseñas criptográficas seguras en `.env` (PostgreSQL, Redis, JWT) desde el gestor de contraseñas.
6. **Datos.** Si viene de un servidor anterior, restaura con `/opt/caprichos/scripts/restaurar.sh`. Si es instalación limpia, corre migraciones y semilla inicial con `/opt/caprichos/scripts/desplegar.sh prod <tag>`.
7. **Cloudflare.** Configurar registros DNS `A` apuntando a la IP pública del VPS (con proxy naranja activado) para `caprichos.pe`, `admin.caprichos.pe`, `api.caprichos.pe` y `staging.caprichos.pe`.
8. **Vigilancia.** En Uptime Kuma o monitoreo externo, verificar `/salud` y la carta virtual.
9. **Inventario.** Actualizar `INV-CAP-001` con la nueva IP, fecha y proveedor.

## Comprobar

| Comprobación | Resultado esperado |
|---|---|
| `ssh root@<vps>` | Rechazado |
| `ssh -o PreferredAuthentications=password deploy@<vps>` | Rechazado |
| `curl http://<ip-del-vps>` | Redirige a HTTPS o es filtrado si `proxy_cloudflare: true` |
| `https://caprichos.pe/salud` | HTTP 200 con JSON de salud válido |
| Puertos 5432 y 6379 | `nc -zv <ip-vps> 5432` da Connection Refused (seguro) |
| Segunda corrida de Ansible | `changed=0` |

---

*Actualizado a versión 2.0: Sustitución de Dokploy por Docker Compose nativo y Traefik perimetral autónomo (ADR-015).*
