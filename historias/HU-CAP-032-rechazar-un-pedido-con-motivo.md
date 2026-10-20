---
id: HU-CAP-032
tipo: hu
titulo: "Rechazar un pedido con motivo"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-004, FT-CAJ-01, RQ-CAJ-01-09, HU-CAP-029, HU-CAP-030, HU-CAP-031, ADR-001, ADR-011, ADR-014, ADR-003, ADR-006, ADR-007, ADR-008, ADR-010, ADR-012, DEP-02, DEP-06, R-01]
tags: [hu, caja, capa-a, ft-caj-01, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-032 | Título | Rechazar un pedido con motivo |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-004 · FT-CAJ-01 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-002** Cajero/a | rechazar un pedido con motivo | sacar de la cola un pedido que no procede dejando el motivo |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-CAJ-01 «Cola de pedidos por confirmar» (Debe tener, épica EP-CAP-004). Cubre el requerimiento: **RQ-CAJ-01-09** Rechazar un pedido exige motivo; un pedido rechazado no va a cocina ni se imprime. | **Alcance.**<br>• Rechazar un pedido exige motivo; un pedido rechazado no va a cocina ni se imprime. |
| **Problema.** Que ningún pedido de fuera se cocine sin pago verificado y que ninguno se pierda entre canales. Contribuye a OBJ-CAP-001 y NEC-CAP-001. | **Fuera de alcance.**<br>• HU-CAP-029: Ver y abrir la cola de pedidos por confirmar.<br>• HU-CAP-030: Confirmar el pago de un pedido y enviarlo a cocina.<br>• HU-CAP-031: Ubicar en el mapa un delivery sin ubicación.<br>• El cobro con medios de pago y el pago mixto: FT-CAJ-02.<br>• La aprobación del comprobante desde la consola de WhatsApp: FT-BOT-02 y FT-ATN-01.<br>• Pedidos que toma caja o el call center: FT-CAJ-03. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un pedido por confirmar | el cajero lo rechaza con el motivo «Cliente no responde» y Sí/No | sale de la cola, queda en el historial con su motivo y no llega a cocina (RQ-CAJ-01-09) |
| CA-2 | un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor) | intenta hacerla desde el menú o escribiendo la dirección de la pantalla | se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) |
| CA-3 | la confirmación Sí/No de la acción | quien la hace responde «No» | no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) |

Origen: criterios de verificación de FT-CAJ-01 (RQ-CAJ-01-09); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-089) Anular exige motivo y queda en el historial.<br>**RNF aplicables:** RNF-CAP-002, RNF-CAP-006, RNF-CAP-009, RNF-CAP-010, RNF-CAP-012. | `Pedido` (estado: por confirmar, confirmado, en cocina, listo, entregado, cobrado, rechazado, anulado) · `Confirmacion` (autor, hora, medio, comprobante de pago, código de operación) · `Cobro` y `PagoCobro` (medio, monto, recibido, vuelto) · `Anulacion` (motivo, autor, PIN validado).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** cada cambio guarda autor y fecha; bloqueo en el servidor ante dos acciones simultáneas sobre el mismo registro. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-031** (Ubicar en el mapa un delivery sin ubicación) va antes, dentro de la misma feature.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Pedidos y caja ▸ «Por confirmar», detalle del pedido, ubicar en el mapa, subir comprobante (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-CAJ-01 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-006, ADR-007, ADR-008, ADR-010, ADR-012.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-CAJ-01 (requerimientos RQ-CAJ-01-09, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
