---
name: aybar-devops-operacion
description: Use cuando el trabajo es de DevOps, plataforma, infraestructura, costos de operación, plan de respaldo o continuidad (VPS, servidor, Ansible, Docker, Dokploy, Cloudflare, dominio, CI/CD, GitHub Actions, despliegue, rollback, ambientes, secretos, copias de seguridad, restauración, monitoreo, alertas, parches, seguridad de salida) o cuando hay que crear o actualizar un runbook, un plan de release, una revisión de seguridad, el inventario de infraestructura, los costos o el plan de continuidad del paquete Aybar.
---

# Aybar · DevOps y documentos de operación

> **REGLA DE TRABAJO (innegociable): un documento a la vez, aprobado por el usuario antes del siguiente.** Salvo que el usuario pida explícitamente generar varios de corrido.

> **CARPETA DESTINO (fija): `<paquete>/operacion/`.** Índice en `operacion/README.md`. Si la carpeta no existe, créala con ese nombre al guardar el primer documento.

## 1. Cuándo aplica

Cualquier pedido que toque **cómo se publica, se vigila, se protege o se recupera** el sistema, y no **qué hace** para el usuario de negocio. Señales: VPS, servidor, Ansible, Docker, Dokploy, Cloudflare, DNS, HTTPS, firewall, CI/CD, GitHub Actions, GHCR, tag, despliegue, rollback, ambientes (pruebas, staging, producción), secretos, `.env`, copias, restic, restauración, Uptime Kuma, GlitchTip, registros, parches, Renovate, Trivy, rotar claves, filtración, salida a producción.

## 2. Dónde va cada cosa

| Qué | Dónde | Skill que lo redacta |
|---|---|---|
| El trabajo de plataforma como valor entregable | **Épica habilitadora** (en Caprichos, EP-CAP-021) con features `FT-PLA-##` | `aybar-epica`, `aybar-feature` |
| Historias de plataforma | HU con actor «equipo de desarrollo y operación» (`DEV`), sin pantalla de negocio | `aybar-historia-usuario` |
| Decisiones de infraestructura | ADR (G3) | `aybar-adr` |
| Tareas de plataforma | `backlog/tareas/<épica habilitadora>.json`, capas `infrastructure`, `boot` y `docs`; actividades `DESPLIEGUE`, `DOCUMENTACION` y `PRUEBAS` | `aybar-tareas-json` |
| **Runbook** `RB-<DOM>-###` | `operacion/` | **esta skill** |
| **Plan de release** `REL-<DOM>-###` (G8) | `operacion/` | **esta skill** (criterios: `aybar-release`) |
| **Revisión de seguridad** `SEC-<DOM>-###` (G7) | `operacion/` | **esta skill** (controles: `aybar-seguridad`, `aybar-secretos`) |
| **Inventario de infraestructura** `INV-<DOM>-###` | `operacion/` | **esta skill** |
| **Costos de operación** `COS-<DOM>-###` | `operacion/` | **esta skill** |
| **Plan de continuidad y respaldo** `PCN-<DOM>-###` (G8) | `operacion/` | **esta skill** |

**Nunca** cuelgues tareas de plataforma de una historia de negocio: van en la épica habilitadora. Cuando una HU de negocio dependa de la plataforma, su primera tarea depende de la tarea base de la épica habilitadora.

## 3. Frontmatter (igual que el resto del paquete)

```yaml
---
id: RB-CAP-006            # o REL-, SEC-, INV-, COS-, PCN-
tipo: runbook             # runbook | release | seguridad | inventario | costos | continuidad
titulo: "Runbook: <tarea o incidente>"
estado: draft
producto: <producto>
version: "1.0"
owner: "<responsable técnico>"
aprobadores: []
fecha: AAAA-MM-DD
relacionados: [FT-PLA-##, HU-<DOM>-###, ADR-###, ...]
tags: [runbook, devops, <tema>]
---
```

## 4. Plantillas (secciones en este orden)

### Runbook `RB-`
1. Tabla de cabecera: **Cuándo usarlo · Tiempo esperado · Quién lo ejecuta · Riesgo · Feature/ADR**.
2. **Antes de empezar** (lista con casillas): accesos, copia verificada, horario.
3. **Pasos** numerados con los **comandos exactos** en bloques de código.
4. **Comprobar** (tabla: comprobación, cómo, resultado esperado).
5. **Volver atrás** si el paso falla.
6. **Avisar** (a quién y cuándo).
7. Tabla de **registro** (incidentes o ejecuciones) y tabla de **pruebas del runbook** (fecha, quién lo siguió, resultado, tiempo).

Un runbook **no vale hasta que alguien distinto de quien lo escribió lo sigue sin ayuda**: queda anotado en su tabla de pruebas.

Runbooks mínimos de un sistema en producción: publicar y volver atrás · restaurar una copia · un servicio se cayó · preparar un servidor nuevo · rotar claves y responder a una filtración.

### Plan de release `REL-` (G8)
1. **Qué sale** (versión, fecha, ventana, alcance por épica, fuera de alcance, responsables).
2. **Requisitos para salir (go/no-go)**: G0–G4 aprobados, QA ciclos 0–3 y UAT, revisión de seguridad sin críticos, runbooks probados, restauración probada, vigilancia en verde, carga inicial revisada, capacitación, claves rotadas.
3. **Pasos del día de salida** (tabla: hora, paso, quién, comprobación).
4. **Carga inicial de datos** (dato, fuente, quién revisa).
5. **Comunicación y capacitación**, incluida la convivencia con el sistema anterior.
6. **Cómo se vuelve atrás** (situación → acción, con runbook).
7. **Después de salir (G9)**: acompañamiento, medición de KPI, cierre.
8. **Firmas** (PO, TL y, en T3, Stakeholder) con Go / No-go.

### Revisión de seguridad `SEC-` (G7)
1. Escala: **Crítico** (bloquea la salida) · **Alto** · **Medio**.
2. Tablas por área: **acceso y sesiones · datos personales · aplicación · infraestructura · secretos**. Columnas: `#`, Control, Nivel, Evidencia (caso `SEC-##` del plan de pruebas, runbook, captura o commit), Estado.
3. **Resultado**: conteo de críticos y altos pendientes y la decisión (apto, apto con condiciones, no apto). El conteo se calcula de las tablas, no se escribe a mano.
4. **Firmas** del TL y de quien revise seguridad.

### Inventario de infraestructura `INV-`
1. Servidor (proveedor, recursos, sistema, acceso, cómo se prepara).
2. Servicios (servicio, ambiente, imagen, RAM, dónde se expone).
3. Dominios y red (nombre, destino, proxy, notas; reglas del firewall).
4. Cuentas externas (para qué, a nombre de quién, quién administra, costo).
5. **Secretos: solo nombre y ubicación**, nunca el valor; ambientes y última rotación.
6. Tareas programadas.

### Costos de operación `COS-`
1. **Resumen** por escenarios (bajo, medio, alto): fijo, variable, total mensual y anual, en la moneda del cliente y costo por pedido.
2. **Supuestos** (tipo de cambio, precios unitarios, volúmenes) con «por confirmar» donde no sean oficiales.
3. **Costos fijos** y **variables** (con la fórmula visible: volumen × precio unitario). Las sumas se calculan con un script, no a mano.
4. **Lo gratuito**: open source (costo cero, usa RAM) y planes gratuitos con su límite y qué pasa al pasarse.
5. **Topes y alertas** por servicio de pago por uso.
6. **Pagos únicos** (equipos): sin inventar precios, «por cotizar».
7. **Lo que el cliente ya paga y se reemplaza** (ahorro por completar con él), cuándo revisar los números y pendientes (a nombre de quién van las cuentas).
No incluye las horas de desarrollo. Nunca se inventan precios: lo que no consta queda «por confirmar con el proveedor».

### Plan de continuidad y respaldo `PCN-` (G8)
1. **Principios** (seguir vendiendo primero, datos en más de un lugar, cada falla con su runbook, avisar pronto).
2. **Qué se respalda**: tabla (qué, original, respaldo, frecuencia, retención, quién restaura, runbook).
3. **Metas de recuperación**: **RPO** (cuánto trabajo se puede perder) y **RTO** (cuánto tarda volver), más disponibilidad.
4. **Escenarios de falla** (internet, aplicación, servidor, proveedor, datos dañados, DNS o CDN, servicios externos, impresión, equipos, luz, copia, filtración, malware, dominio, persona clave): por cada uno, qué se nota, qué hace el **local**, qué hace el **técnico**, RTO y qué se puede perder.
5. **Modo manual** (kit en papel y reglas), cómo se avisa a los clientes, orden del técnico y **cómo se vuelve a cargar lo hecho en papel**.
6. **Quién avisa a quién** y contactos (sin claves).
7. **Mejoras opcionales con su costo** y su decisión `D-##`.
8. **Simulacros**: tabla con frecuencia y registro. Un plan no probado no cuenta.
9. Decisiones pendientes con recomendación.

## 5. Reglas que no se rompen

- **Ningún secreto en un documento ni en el repositorio.** Se escribe dónde vive y quién lo rota (`aybar-secretos`, `aybar-datos-que-no-salen`).
- Cada vez que cambia la infraestructura, el **inventario se actualiza en el mismo PR**.
- Cada ADR de infraestructura nombra los runbooks que obliga a escribir; cada runbook nombra su feature o HU.
- Las migraciones de base de datos son compatibles hacia atrás (expandir antes de contraer), para que volver atrás no exija revertirlas.
- Los documentos nacen en `draft`; la IA no firma ni marca `approved`.
- Lo que no tiene fuente queda como `(por definir)` o `(pendiente — D-xx)`, nunca inventado (cuentas, IP, proveedores).

## 6. Checklist final

1. [ ] Archivo en `operacion/` con prefijo correcto (`RB-`, `REL-`, `SEC-`, `INV-`) y fila agregada en `operacion/README.md`.
2. [ ] Frontmatter completo con `estado: draft` y `aprobadores: []`.
3. [ ] Secciones de la plantilla en orden; en costos, las sumas calculadas con script.
4. [ ] Sin valores de secretos (revisar con `grep` antes de guardar).
5. [ ] `relacionados` apunta a la feature, la HU y el ADR que lo originan.
6. [ ] Correr `python3 -I .claude/skills/aybar-siguiente-paso/scripts/estado.py .` (revisa también `operacion/`).

## 7. Modelos en el paquete

`operacion/RB-CAP-001-publicar-y-volver-atras.md`, `operacion/REL-CAP-001-plan-de-release-del-piloto.md`, `operacion/SEC-CAP-001-revision-de-seguridad.md`, `operacion/INV-CAP-001-inventario-de-infraestructura.md`, `operacion/COS-CAP-001-costos-de-operacion.md` y `operacion/PCN-CAP-001-plan-de-continuidad-y-respaldo.md`.
