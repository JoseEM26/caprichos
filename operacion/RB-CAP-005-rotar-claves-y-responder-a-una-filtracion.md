---
id: RB-CAP-005
tipo: runbook
titulo: "Runbook: rotar claves y responder a una filtración"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [FT-PLA-05, HU-CAP-189, ADR-005, ADR-008, ADR-014, DT-43, INV-CAP-001, SEC-CAP-001]
tags: [runbook, seguridad, secretos, incidente, devops]
---

# RB-CAP-005 — Rotar claves y responder a una filtración

| Campo | Valor |
|---|---|
| Cuándo usarlo | Una clave se expuso (en un chat, un commit, una captura), una persona con acceso deja el proyecto, rotación programada, o hay sospecha de acceso indebido |
| Tiempo esperado | Rotar una clave: menos de 30 minutos · Responder a una filtración: 1 a 3 horas |
| Quién lo ejecuta | El responsable técnico (TL) |
| Feature | FT-PLA-05 (HU-CAP-189) · ADR-005 · ADR-008 · ADR-014 · DT-43 |

## A. Claves y dónde se rotan

Los valores nunca se escriben aquí. La lista completa con su ubicación está en INV-CAP-001.

| Clave | Dónde se genera la nueva | Dónde se cambia | Qué hay que reiniciar |
|---|---|---|---|
| OpenAI | Panel de OpenAI → API keys | Dokploy (`api`, producción y pruebas por separado) | `api` |
| WhatsApp Cloud API (token) | Meta → usuario del sistema → generar token | Dokploy (`api`) | `api` |
| Google Maps (Places) | Google Cloud → credenciales (con restricción de dominio e IP) | Dokploy (`api`) y `web` | `api`, `web` |
| Almacenamiento de copias (B2 o R2) | Panel del proveedor | VPS (variables de la tarea de copia) y gestor de contraseñas | Tarea de copia |
| Clave de restic | `restic key add` y luego `restic key remove <vieja>` | Gestor de contraseñas y VPS | Tarea de copia |
| Firma de JWT | Generar 64 bytes al azar | Dokploy (`api`) | `api` (cierra todas las sesiones) |
| PostgreSQL | `ALTER ROLE caprichos PASSWORD ...` | Dokploy (`api`) | `api` |
| GitHub (GHCR, Actions) | GitHub → tokens | GitHub Secrets y Dokploy | — |
| Llave SSH del VPS | `ssh-keygen` | `~/.ssh/authorized_keys` del usuario `deploy` (vía Ansible) | — |

## B. Rotar una clave (sin cortar la atención)

1. Genera la clave nueva **sin revocar todavía la vieja**.
2. Cámbiala en Dokploy (o donde diga la tabla) en **pruebas** y comprueba que funciona.
3. Cámbiala en **producción** y reinicia el servicio fuera de hora punta.
4. Comprueba: `/salud` en `200`, un mensaje de prueba del bot, una búsqueda de dirección, Uptime Kuma en verde.
5. **Revoca la clave vieja** en su proveedor.
6. Actualiza la fecha de rotación en INV-CAP-001.

> **Pendiente ya identificado:** las claves de OpenAI y WhatsApp del bot actual y una llave SSH estuvieron en texto plano en la carpeta del proyecto. Rotarlas antes del piloto (FT-PLA-05).

## C. Responder a una filtración o acceso indebido

1. **Contener (primeros 15 minutos).**
   - Rota la clave expuesta (B) o, si no sabes cuál, la firma de JWT y la contraseña de PostgreSQL.
   - Revoca sesiones: rotar la firma de JWT cierra todas; para una persona, desactiva su usuario (FT-USR-01).
   - Si el acceso fue al servidor: cambia la llave SSH y revisa `last`, `/var/log/auth.log` y fail2ban.
2. **Entender qué pasó.**
   - Revisa el **Historial de acciones** (FT-USR-04): filtra por las fechas, la persona y las IP sospechosas.
   - Verifica la cadena de auditoría (no debe tener eslabones rotos).
   - Revisa GitHub (commits, Actions, tokens) y el panel de Dokploy.
3. **Datos personales (Ley 29733).** Si pudieron verse datos de clientes o del personal (DNI, teléfonos, direcciones, comprobantes):
   - Anota qué datos, de cuántas personas y desde cuándo.
   - Consulta con el asesor legal si corresponde avisar a la Autoridad Nacional de Protección de Datos Personales y a los afectados, y en qué plazo según el reglamento vigente (DEP-09).
4. **Avisar.** Informa a Kevin qué pasó, qué se hizo y qué falta.
5. **Cerrar.** Registra el incidente abajo y abre issues para las causas.

| Fecha | Qué se expuso | Cómo se detectó | Qué se rotó | Datos personales afectados | Aviso legal | Cerrado |
|---|---|---|---|---|---|---|
| | | | | | | |

## Rotaciones programadas

| Clave | Frecuencia propuesta | Última rotación |
|---|---|---|
| Firma de JWT, PostgreSQL | Cada 6 meses | — |
| OpenAI, Google, almacenamiento de copias | Cada 12 meses o al salir una persona con acceso | — |
| Token de WhatsApp | Al salir una persona con acceso | — |

---

Generado por IA: runbook propuesto desde ADR-005, ADR-008, ADR-014, DT-43 y FT-PLA-05; los plazos legales de aviso se confirman con el asesor legal — Revisado por: (pendiente)
