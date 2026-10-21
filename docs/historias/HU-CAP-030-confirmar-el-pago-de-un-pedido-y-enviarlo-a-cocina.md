---
id: HU-CAP-030
tipo: hu
titulo: "Confirmar el pago de un pedido y enviarlo a cocina"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-004, FT-CAJ-01, RQ-CAJ-01-03, RQ-CAJ-01-04, RQ-CAJ-01-05, RQ-CAJ-01-10, HU-CAP-029, HU-CAP-031, HU-CAP-032, ADR-001, ADR-011, ADR-014, ADR-003, ADR-006, ADR-007, ADR-008, ADR-010, ADR-012, DEP-02, DEP-06, R-01, R-09]
tags: [hu, caja, capa-a, ft-caj-01, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-030 | Título | Confirmar el pago de un pedido y enviarlo a cocina |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-004 · FT-CAJ-01 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-002** Cajero/a | confirmar el pago de un pedido y enviarlo a cocina | que solo se cocinen pedidos con el pago verificado |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-CAJ-01 «Cola de pedidos por confirmar» (Debe tener, épica EP-CAP-004). Cubre los requerimientos: **RQ-CAJ-01-03** Confirmar exige elegir el medio de pago y, si es Yape, Plin o transferencia, subir el comprobante. **RQ-CAJ-01-04** Con efectivo o tarjeta, que se cobran al entregar o recoger, se confirma sin comprobante. **RQ-CAJ-01-05** Al confirmar, el pedido pasa a cocina, se imprimen su comanda y sus etiquetas y empieza su tiempo. **RQ-CAJ-01-10** Dos personas no pueden confirmar el mismo pedido a la vez. | **Alcance.**<br>• Confirmar exige elegir el medio de pago y, si es Yape, Plin o transferencia, subir el comprobante.<br>• Con efectivo o tarjeta, que se cobran al entregar o recoger, se confirma sin comprobante.<br>• Al confirmar, el pedido pasa a cocina, se imprimen su comanda y sus etiquetas y empieza su tiempo.<br>• Dos personas no pueden confirmar el mismo pedido a la vez. |
| **Problema.** Que ningún pedido de fuera se cocine sin pago verificado y que ninguno se pierda entre canales. Contribuye a OBJ-CAP-001 y NEC-CAP-001. | **Fuera de alcance.**<br>• HU-CAP-029: Ver y abrir la cola de pedidos por confirmar.<br>• HU-CAP-031: Ubicar en el mapa un delivery sin ubicación.<br>• HU-CAP-032: Rechazar un pedido con motivo.<br>• El cobro con medios de pago y el pago mixto: FT-CAJ-02.<br>• La aprobación del comprobante desde la consola de WhatsApp: FT-BOT-02 y FT-ATN-01.<br>• Pedidos que toma caja o el call center: FT-CAJ-03. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un pedido con Yape | el cajero intenta confirmar sin comprobante | no puede; con la imagen del comprobante y Sí/No, el pedido queda confirmado con su autor y hora (RQ-CAJ-01-03) |
| CA-2 | un delivery con efectivo y vuelto de S/ 50 | el cajero confirma | no se pide comprobante y el pedido conserva con cuánto paga el cliente (RQ-CAJ-01-04) |
| CA-3 | un pedido confirmado | termina la confirmación | aparece en las pantallas de sus áreas con el cronómetro en cero y se envía a sus ticketeras (RQ-CAJ-01-05) |
| CA-4 | un pedido abierto por el cajero | el call center intenta confirmarlo al mismo tiempo | solo una confirmación vale y la otra ve «Este pedido ya lo confirmó …» (RQ-CAJ-01-10) |
| CA-5 | un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor) | intenta hacerla desde el menú o escribiendo la dirección de la pantalla | se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) |
| CA-6 | la confirmación Sí/No de la acción | quien la hace responde «No» | no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) |

Origen: criterios de verificación de FT-CAJ-01 (RQ-CAJ-01-03, RQ-CAJ-01-04, RQ-CAJ-01-05, RQ-CAJ-01-10); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-075) Con Yape, Plin o transferencia se sube el comprobante; con efectivo o tarjeta no; se guarda quién y cuándo.<br>**RNF aplicables:** RNF-CAP-002, RNF-CAP-006, RNF-CAP-009, RNF-CAP-010, RNF-CAP-012. | `Pedido` (estado: por confirmar, confirmado, en cocina, listo, entregado, cobrado, rechazado, anulado) · `Confirmacion` (autor, hora, medio, comprobante de pago, código de operación) · `Cobro` y `PagoCobro` (medio, monto, recibido, vuelto) · `Anulacion` (motivo, autor, PIN validado).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** cada cambio guarda autor y fecha; bloqueo en el servidor ante dos acciones simultáneas sobre el mismo registro. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-029** (Ver y abrir la cola de pedidos por confirmar) va antes, dentro de la misma feature.<br>• FT-COC-01 · FT-COC-02.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01, R-09 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Pedidos y caja ▸ «Por confirmar», detalle del pedido, ubicar en el mapa, subir comprobante (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-CAJ-01 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-006, ADR-007, ADR-008, ADR-010, ADR-012.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-CAJ-01 (requerimientos RQ-CAJ-01-03, RQ-CAJ-01-04, RQ-CAJ-01-05, RQ-CAJ-01-10, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
