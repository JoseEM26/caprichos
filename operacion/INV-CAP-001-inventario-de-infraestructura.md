---
id: INV-CAP-001
tipo: inventario
titulo: "Inventario de infraestructura de Caprichos"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-021, ADR-011, ADR-012, DT-30, DT-42, DT-43, RB-CAP-004, RB-CAP-005, COS-CAP-001, PCN-CAP-001]
tags: [inventario, infraestructura, devops]
---

# INV-CAP-001 — Inventario de infraestructura

> Qué hay, dónde está y quién lo maneja. **No contiene valores de secretos**: solo dónde viven. Se actualiza en el mismo PR que cambia la infraestructura. Hoy es la **propuesta**: nada está creado todavía.

## 1. Servidor

| Campo | Valor |
|---|---|
| Proveedor | *(por definir: el VPS de US$ 7,27/mes de DT-30)* |
| Recursos | 8 vCPU, 8 GB RAM, 100 GB SSD, 200 Mbit/s, tráfico ilimitado, Auto Backup y 1 snapshot |
| Sistema | Ubuntu LTS |
| IP pública | *(al crear el VPS)* — no se publica en el DNS: solo Cloudflare la conoce |
| Acceso | SSH con llave, usuario `deploy` (RB-CAP-004) |
| Preparado con | `infra/ansible/site.yml` |

## 2. Servicios (Dokploy)

| Servicio | Ambiente | Imagen | RAM aprox. | Expuesto en |
|---|---|---|---|---|
| `api` | producción | `ghcr.io/joseem26/caprichos-api` | 300–500 MB | `api.caprichos.pe` |
| `web` | producción | `ghcr.io/joseem26/caprichos-web` | ~30 MB | `caprichos.pe`, `admin.caprichos.pe` |
| `postgres` | producción | `postgres:16` | 1–1,5 GB | Solo red interna |
| `redis` | producción | `redis:7` | 50–100 MB | Solo red interna |
| `api`, `web`, `postgres`, `redis` | pruebas | Las mismas | ~1 GB en total | `staging.caprichos.pe` |
| `uptime-kuma` | compartido | `louislam/uptime-kuma` | ~100 MB | Vía `panel.` (Access) |
| `glitchtip` | compartido | `glitchtip/glitchtip` | ~500 MB | Vía `panel.` (Access) |
| Dokploy | servidor | — | ~400 MB | `panel.caprichos.pe` (Access) |
| Agente de impresión | local (PC de caja) | `apps/agente-local` | — | Sale por WebSocket; no abre puertos |

**RAM total estimada:** 4 a 4,5 GB de 8.

## 3. Dominios y red

| Nombre | Apunta a | Proxy | Notas |
|---|---|---|---|
| `caprichos.pe` | VPS | Sí | Carta. Dominio registrado en punto.pe; DNS en Cloudflare |
| `admin.caprichos.pe` | VPS | Sí | Administrativo |
| `api.caprichos.pe` | VPS | Sí | API y WebSocket |
| `staging.caprichos.pe` | VPS | Sí | Ambiente de pruebas |
| `panel.caprichos.pe` | VPS | Sí + Access | Dokploy, Uptime Kuma, GlitchTip |

Firewall (UFW): 22 (SSH con llave) y 80/443 solo desde los rangos de Cloudflare.

## 4. Cuentas externas

| Servicio | Para qué | Cuenta a nombre de | Administra | Costo |
|---|---|---|---|---|
| Proveedor del VPS | Servidor | *(por definir)* | José | US$ 7,27/mes (detalle de todos los costos en COS-CAP-001) |
| punto.pe | Registro de `caprichos.pe` | *(por confirmar con Kevin)* | Kevin | Renovación anual |
| Cloudflare | DNS, proxy, HTTPS, Access | *(por definir)* | José | Gratis |
| GitHub (JoseEM26) | Código, CI, GHCR | José | José | Gratis (cuota de Actions) |
| Meta (WhatsApp Cloud API) | Bot y mensajes | Negocio de Kevin (DEP-12) | Kevin y José | Por conversación (D-08) |
| OpenAI | IA del bot | *(por definir)* | José | Por uso, con tope |
| Google Cloud | Places y mapa | *(por definir)* | José | Dentro de la cuota gratis, con tope |
| Backblaze B2 o Cloudflare R2 | Copias | *(por definir)* | José | Menos de US$ 1/mes |
| Telegram | Avisos de Uptime Kuma | José | José | Gratis |

## 5. Secretos (solo ubicación)

| Secreto | Dónde vive | Ambientes | Última rotación |
|---|---|---|---|
| `DATABASE_URL` | Dokploy | prod y pruebas por separado | — |
| `REDIS_URL` | Dokploy | prod y pruebas | — |
| `JWT_SECRET` | Dokploy | prod y pruebas | — |
| `OPENAI_API_KEY` | Dokploy | prod y pruebas (tope bajo en pruebas) | — |
| `WHATSAPP_TOKEN`, `WHATSAPP_APP_SECRET` | Dokploy | prod (número real) y pruebas (número de prueba) | — |
| `GOOGLE_MAPS_KEY` | Dokploy | prod y pruebas | — |
| `GLITCHTIP_DSN` | Dokploy | prod y pruebas | — |
| Credenciales de B2/R2 y clave de restic | VPS (tarea de copia) y gestor de contraseñas | — | — |
| `GHCR_TOKEN`, acceso a Dokploy | GitHub Secrets | CI | — |

Rotación: RB-CAP-005.

## 6. Tareas programadas

| Tarea | Dónde | Cuándo |
|---|---|---|
| Copia diaria (restic) | VPS (systemd) | 03:00 Lima |
| Verificación de la cadena de auditoría | API (BullMQ) | 03:30 Lima |
| Parches de seguridad | VPS (unattended-upgrades) | Diario |
| Renovate | GitHub | Semanal |
| Prueba de restauración | Persona responsable | Primer lunes del trimestre |

---

Generado por IA: inventario propuesto desde DT-30, DT-35 a DT-47, ADR-011 y ADR-012; se completa al crear cada recurso — Revisado por: (pendiente)
