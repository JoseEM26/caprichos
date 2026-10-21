---
id: RB-CAP-003
tipo: runbook
titulo: "Runbook: un servicio se cayó"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [FT-PLA-04, HU-CAP-186, HU-CAP-187, ADR-011, ADR-012, RB-CAP-001, RB-CAP-002]
tags: [runbook, incidente, vigilancia, devops]
---

# RB-CAP-003 — Un servicio se cayó

| Campo | Valor |
|---|---|
| Cuándo usarlo | Llega un aviso de Uptime Kuma, o el local avisa que la carta, la caja, la cocina, el bot o la impresión no funcionan |
| Tiempo esperado | Diagnóstico: 5 a 10 minutos · Solución: según la causa |
| Quién lo ejecuta | Quien está de turno con los avisos (hoy, José) |
| Feature | FT-PLA-04 (HU-CAP-186, HU-CAP-187) · ADR-011 · ADR-012 |

## 1. Qué está caído

Abre Uptime Kuma y mira qué monitor está en rojo:

| Monitor en rojo | Qué significa | Ve a |
|---|---|---|
| Carta y API a la vez | El VPS, Dokploy o Cloudflare | 2.A |
| Solo API (`/salud` 503) | La API o su base o Redis | 2.B |
| Solo WebSocket | Socket.IO o Redis | 2.B |
| Webhook de WhatsApp | La API o la cuenta de Meta | 2.C |
| Agente de impresión | La PC de caja o su red | 2.D |
| Copia del día | La copia de las 03:00 falló | 2.E |

## 2. Diagnóstico y solución

### A. Cae todo
1. ¿Responde el VPS? `ssh deploy@<vps>`. Si no: revisa el panel del proveedor (estado, consola). Si el VPS está perdido → RB-CAP-004 y RB-CAP-002.
2. ¿Está Cloudflare con incidentes? Revisa su página de estado.
3. En el VPS: `df -h` (disco lleno), `free -m` (memoria), `docker ps` (contenedores caídos).
   - Disco lleno: borra imágenes viejas `docker image prune -a --filter "until=168h"` y revisa la rotación de registros.
   - Memoria: apaga el ambiente de pruebas en Dokploy (libera cerca de 1 GB).
4. Reinicia el servicio caído desde Dokploy.

### B. Cae la API o el tiempo real
1. Dokploy → `api` de producción → *Logs*. Busca el error al arrancar.
2. GlitchTip → proyecto `api` → errores de los últimos 15 minutos.
3. ¿Coincide con una publicación reciente? → vuelve atrás con **RB-CAP-001 C**.
4. ¿La base o Redis no responden? Reinícialos en Dokploy; si la base no arranca por datos dañados → RB-CAP-002.

### C. Cae el webhook de WhatsApp
1. Si la API está bien: revisa en Meta (WhatsApp Manager) si el número o el token tienen problemas.
2. Si el token venció o se revocó → RB-CAP-005 (rotar la clave de WhatsApp).
3. Mientras tanto, caja confirma los pedidos escribiendo a mano por WhatsApp (FT-CAJ-01).

### D. Cae el agente de impresión
1. En el local: ¿la PC de caja está encendida y con red?
2. Reinicia el servicio del agente en la PC.
3. Mientras tanto, cocina trabaja con las pantallas y caja reimprime cuando vuelva (RN-CAP-021).

### E. Falló la copia del día
1. Revisa el registro de la tarea: `journalctl -u caprichos-backup --since today`.
2. Causas típicas: credenciales del almacenamiento vencidas, disco lleno, base apagada.
3. Corre la copia a mano: `sudo systemctl start caprichos-backup` y confirma el monitor en verde.

## 3. Avisar y cerrar

- Caída de más de 5 minutos en horario de atención: avisa a Kevin qué falló, cuánto duró y si se perdió algo.
- Anota el incidente abajo. Si la causa se puede evitar, abre un issue.

| Fecha y hora | Qué cayó | Duración | Causa | Solución | Issue |
|---|---|---|---|---|---|
| | | | | | |

---

Generado por IA: runbook propuesto desde ADR-011, ADR-012 y FT-PLA-04; nombres de servicios y unidades systemd se ajustan al construir — Revisado por: (pendiente)
