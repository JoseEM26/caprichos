---
id: HU-CAP-037
tipo: hu
titulo: "Armar un pedido para un cliente en Nuevo pedido"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-004, FT-CAJ-03, RQ-CAJ-03-01, RQ-CAJ-03-07, RQ-CAJ-03-09, HU-CAP-038, HU-CAP-039, HU-CAP-040, ADR-001, ADR-011, ADR-014, ADR-003, ADR-006, ADR-007, ADR-008, ADR-010, ADR-012, DEP-02, DEP-06, R-01]
tags: [hu, caja, capa-a, ft-caj-03, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-037 | Título | Armar un pedido para un cliente en Nuevo pedido |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-004 · FT-CAJ-03 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-002** Cajero/a | armar un pedido para un cliente en Nuevo pedido | registrar pedidos de mostrador o teléfono con las mismas reglas de la carta |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-CAJ-03 «Nuevo pedido desde caja y call center» (Debe tener, épica EP-CAP-004). Cubre los requerimientos: **RQ-CAJ-03-01** Nuevo pedido usa el mismo catálogo y reglas de opciones que la carta, con o sin imágenes. **RQ-CAJ-03-07** Un pedido por teléfono para delivery o recojo entra «por confirmar». **RQ-CAJ-03-09** Anular un pedido exige motivo y queda en el historial. | **Alcance.**<br>• Nuevo pedido usa el mismo catálogo y reglas de opciones que la carta, con o sin imágenes.<br>• Un pedido por teléfono para delivery o recojo entra «por confirmar».<br>• Anular un pedido exige motivo y queda en el historial. |
| **Problema.** Que los pedidos por teléfono y WhatsApp se registren rápido y con los mismos datos que los de la carta. | **Fuera de alcance.**<br>• HU-CAP-038: Recordar, ubicar y repetir el pedido de un cliente por teléfono.<br>• HU-CAP-039: Aplicar promociones, descuentos y cupón en Nuevo pedido.<br>• HU-CAP-040: Registrar el pedido del personal.<br>• El pedido del mozo en mesa: FT-SAL-02.<br>• Confirmar y cobrar: FT-CAJ-01 y FT-CAJ-02.<br>• Creación de ofertas y cupones: FT-OFE-01 a FT-OFE-03. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un producto con grupo obligatorio | el cajero lo agrega sin elegir | no puede; puede alternar la vista con o sin imágenes (RQ-CAJ-03-01) |
| CA-2 | un pedido tomado por teléfono | el call center lo guarda | entra a la cola «por confirmar» con canal «Teléfono» (RQ-CAJ-03-07) |
| CA-3 | un pedido guardado sin cobrar | el call center lo anula con motivo | queda anulado con su autor y motivo (RQ-CAJ-03-09) |
| CA-4 | un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor) | intenta hacerla desde el menú o escribiendo la dirección de la pantalla | se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) |

Origen: criterios de verificación de FT-CAJ-03 (RQ-CAJ-03-01, RQ-CAJ-03-07, RQ-CAJ-03-09); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-027) El pedido del administrativo usa el mismo catálogo y reglas que la carta.<br>**RNF aplicables:** RNF-CAP-004, RNF-CAP-008, RNF-CAP-011, RNF-CAP-006. | `Pedido` (estado: por confirmar, confirmado, en cocina, listo, entregado, cobrado, rechazado, anulado) · `Confirmacion` (autor, hora, medio, comprobante de pago, código de operación) · `Cobro` y `PagoCobro` (medio, monto, recibido, vuelto) · `Anulacion` (motivo, autor, PIN validado).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** montos en soles con dos decimales; datos personales solo con aceptación registrada. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • FT-CAR-01.<br>• FT-CAJ-01.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Nuevo pedido: cliente, catálogo con o sin imágenes, mapa, ofertas, cupón, pedido del personal (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-CAJ-03 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-006, ADR-007, ADR-008, ADR-010, ADR-012.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-CAJ-03 (requerimientos RQ-CAJ-03-01, RQ-CAJ-03-07, RQ-CAJ-03-09, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
