---
id: HU-CAP-034
tipo: hu
titulo: "Cobrar con pago mixto"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-004, FT-CAJ-02, RQ-CAJ-02-03, RQ-CAJ-02-04, HU-CAP-033, HU-CAP-035, HU-CAP-036, ADR-001, ADR-011, ADR-014, ADR-003, ADR-006, ADR-007, ADR-008, ADR-010, ADR-012, DEP-02, DEP-06, R-01]
tags: [hu, caja, capa-a, ft-caj-02, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-034 | Título | Cobrar con pago mixto |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-004 · FT-CAJ-02 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-002** Cajero/a | cobrar con pago mixto | cobrar cuando el cliente paga con dos medios a la vez |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-CAJ-02 «Cobro con medios de pago y pago mixto» (Debe tener, épica EP-CAP-004). Cubre los requerimientos: **RQ-CAJ-02-03** El cajero divide el pago entre varios medios y los montos deben sumar el total. **RQ-CAJ-02-04** En un pago mixto, el vuelto se calcula solo sobre la parte en efectivo. | **Alcance.**<br>• El cajero divide el pago entre varios medios y los montos deben sumar el total.<br>• En un pago mixto, el vuelto se calcula solo sobre la parte en efectivo. |
| **Problema.** Cobros exactos por medio de pago que cuadran con el cierre del día, sin cuentas hechas a mano. | **Fuera de alcance.**<br>• HU-CAP-033: Cobrar un pedido con un medio de pago y vuelto.<br>• HU-CAP-035: Elegir comprobante y cobrar a crédito del personal.<br>• HU-CAP-036: Anular un pedido con motivo y PIN.<br>• Apertura y cierre de caja: FT-CIE-01 y FT-CIE-02.<br>• Emisión electrónica de boleta y factura (DT-11, D-07).<br>• Pago en línea con pasarela (DT-11).<br>• Devolución de un cobro ya cerrado (pendiente de Kevin, RN-CAP-096). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un total de S/ 42 | el cajero pone S/ 20 Yape y S/ 20 efectivo | ve «Faltan S/ 2,00» y no puede cobrar; con S/ 22 en efectivo, sí (RQ-CAJ-02-03) |
| CA-2 | un total de S/ 42 con S/ 30 Yape y efectivo por S/ 12 entregado con S/ 20 | se cobra | el vuelto es S/ 8,00 (RQ-CAJ-02-04) |

Origen: criterios de verificación de FT-CAJ-02 (RQ-CAJ-02-03, RQ-CAJ-02-04); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-082 (1.ª)) Los montos de un pago mixto suman el total; el vuelto se calcula sobre el efectivo (id repetido, O1).<br>**RNF aplicables:** RNF-CAP-011, RNF-CAP-009, RNF-CAP-007, RNF-CAP-012, RNF-CAP-014. | `Pedido` (estado: por confirmar, confirmado, en cocina, listo, entregado, cobrado, rechazado, anulado) · `Confirmacion` (autor, hora, medio, comprobante de pago, código de operación) · `Cobro` y `PagoCobro` (medio, monto, recibido, vuelto) · `Anulacion` (motivo, autor, PIN validado).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** sin borrado físico: se desactiva o anula (RN-CAP-014); cada cambio guarda autor y fecha; montos en soles con dos decimales. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-033** (Cobrar un pedido con un medio de pago y vuelto) va antes, dentro de la misma feature.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Pedidos y caja ▸ Cobrar, pago mixto, vuelto, comprobante, anular (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-CAJ-02 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-006, ADR-007, ADR-008, ADR-010, ADR-012.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-CAJ-02 (requerimientos RQ-CAJ-02-03, RQ-CAJ-02-04, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
