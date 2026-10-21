---
id: HU-CAP-166
tipo: hu
titulo: "Recibir y abrir avisos en la campanita"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-018, FT-INF-03, RQ-INF-03-01, RQ-INF-03-02, RQ-INF-03-03, HU-CAP-167, ADR-001, ADR-011, ADR-014, ADR-006, ADR-012, DEP-02, DEP-06, R-01]
tags: [hu, informes, capa-a, ft-inf-03, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-166 | Título | Recibir y abrir avisos en la campanita |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-018 · FT-INF-03 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-002** Cajero/a | recibir y abrir avisos en la campanita | enterarme al instante de lo que necesita mi atención |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-INF-03 «Notificaciones» (Debería tener, épica EP-CAP-018). Cubre los requerimientos: **RQ-INF-03-01** La campanita muestra los avisos sin leer del rol y lleva a su pantalla con un toque. **RQ-INF-03-02** Cada rol recibe solo los avisos de su función. **RQ-INF-03-03** Los avisos importantes suenan. | **Alcance.**<br>• La campanita muestra los avisos sin leer del rol y lleva a su pantalla con un toque.<br>• Cada rol recibe solo los avisos de su función.<br>• Los avisos importantes suenan. |
| **Problema.** Que nada importante se pase por alto en hora punta. | **Fuera de alcance.**<br>• HU-CAP-167: Consultar la página de Notificaciones.<br>• Avisos por correo y WhatsApp a gerencia: FT-CAR-03 y FT-ATN-03.<br>• Notificaciones push del navegador (propuesta para después). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un pedido nuevo | el cajero toca su aviso | se abre el pedido y el aviso queda leído (RQ-INF-03-01) |
| CA-2 | un aviso de stock bajo | entra un mozo | no lo ve; almacén sí (RQ-INF-03-02) |
| CA-3 | un pedido nuevo o un urgente | llega | suena; un aviso de stock bajo no suena (RQ-INF-03-03) |
| CA-4 | un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor) | intenta hacerla desde el menú o escribiendo la dirección de la pantalla | se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) |

Origen: criterios de verificación de FT-INF-03 (RQ-INF-03-01, RQ-INF-03-02, RQ-INF-03-03); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-013) Cada rol ve solo lo de su función.<br>**RNF aplicables:** RNF-CAP-002, RNF-CAP-006. | Vistas de lectura sobre `Pedido`, `Cobro`, `CierreCaja`, `MovimientoStock`, `CuponEmitido` y `Entrega` · `Notificacion` (tipo, rol destino, leída, enlace).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)* |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • FT-USR-02.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ campanita y página Notificaciones (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-INF-03 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-006, ADR-012.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-INF-03 (requerimientos RQ-INF-03-01, RQ-INF-03-02, RQ-INF-03-03, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
