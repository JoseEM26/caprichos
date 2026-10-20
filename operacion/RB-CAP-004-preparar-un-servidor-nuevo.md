---
id: RB-CAP-004
tipo: runbook
titulo: "Runbook: preparar un servidor nuevo"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [FT-PLA-02, HU-CAP-181, HU-CAP-182, HU-CAP-183, ADR-011, DT-30, DT-40, DT-42, DT-43, INV-CAP-001]
tags: [runbook, ansible, servidor, devops]
---

# RB-CAP-004 — Preparar un servidor nuevo

| Campo | Valor |
|---|---|
| Cuándo usarlo | Primera instalación, cambio de proveedor, o el VPS se perdió |
| Tiempo esperado | 30 a 45 minutos sin contar la restauración de datos |
| Quién lo ejecuta | Quien tenga acceso al repositorio, al proveedor del VPS, a Cloudflare y al gestor de contraseñas |
| Feature | FT-PLA-02 (HU-CAP-181 a HU-CAP-183) · ADR-011 · DT-30 · DT-40 · DT-42 · DT-43 |

## Antes de empezar

- [ ] VPS nuevo creado (Ubuntu LTS, 8 GB, 100 GB; DT-30) con tu llave SSH pública cargada.
- [ ] Ansible instalado en tu equipo y el repositorio clonado.
- [ ] Acceso a Cloudflare, a GitHub y al gestor de contraseñas (secretos de producción).

## Pasos

1. **Inventario.** Edita `infra/ansible/inventario.ini` con la IP nueva del VPS en el grupo correspondiente (`prod`).
2. **Preparar el servidor.**
   ```bash
   cd infra/ansible
   ansible-playbook -i inventario.ini site.yml --limit prod
   ```
   Deja: usuario `deploy` sin root, SSH solo con llave, zona horaria `America/Lima`, UFW (22 y 80/443 solo desde Cloudflare), fail2ban, parches automáticos, Docker, Dokploy y la tarea de copia.
3. **Comprobar que se puede repetir.** Corre el mismo comando otra vez: no debe cambiar nada (`changed=0`).
4. **Dokploy.** Entra al panel por túnel SSH la primera vez (`ssh -L 3000:localhost:3000 deploy@<vps>`), crea el usuario administrador y conecta GHCR (lectura de imágenes).
5. **Servicios.** Crea por ambiente (producción y pruebas, en redes separadas): `postgres`, `redis`, `api`, `web`, `uptime-kuma` y `glitchtip`, con las variables de **INV-CAP-001** (los valores salen del gestor de contraseñas; nunca del repositorio).
6. **Datos.** Si viene de un servidor anterior, restaura con **RB-CAP-002 C**. Si es la primera vez, corre las migraciones y la carga inicial (carta, usuarios, plano, zonas).
7. **Cloudflare.** Cambia los registros `A` de `caprichos.pe`, `admin.`, `api.`, `staging.` y `panel.` a la IP nueva (con proxy activo). Protege `panel.` con Cloudflare Access.
8. **Certificado de origen.** Instala en el VPS el certificado de origen de Cloudflare (HTTPS de punta a punta).
9. **Vigilancia.** En Uptime Kuma, crea los 6 monitores (carta, `/salud`, WebSocket, webhook de WhatsApp, latido del agente, copia del día) y el aviso al celular.
10. **Webhook de WhatsApp.** Si cambió la URL, actualízala en Meta.
11. **Inventario.** Actualiza INV-CAP-001 (IP, fecha, proveedor).

## Comprobar

| Comprobación | Resultado esperado |
|---|---|
| `ssh root@<vps>` | Rechazado |
| `ssh -o PreferredAuthentications=password deploy@<vps>` | Rechazado |
| `curl http://<ip-del-vps>` | Sin respuesta (solo entra Cloudflare) |
| `https://caprichos.pe` y `https://api.caprichos.pe/salud` | Responden con HTTPS válido |
| Uptime Kuma | 6 monitores en verde |
| Segunda corrida de Ansible | `changed=0` |

## Pruebas de este runbook

| Fecha | Quién lo siguió | Resultado | Tiempo |
|---|---|---|---|
| *(pendiente: primera instalación)* | | | |

---

Generado por IA: runbook propuesto desde ADR-011, DT-30, DT-40, DT-42, DT-43 y FT-PLA-02; los nombres de roles y archivos se ajustan al escribir el playbook — Revisado por: (pendiente)
