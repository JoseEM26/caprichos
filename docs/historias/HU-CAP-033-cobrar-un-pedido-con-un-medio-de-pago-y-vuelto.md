---
id: HU-CAP-033
tipo: hu
titulo: "Cobrar un pedido con un medio de pago y vuelto"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-004, FT-CAJ-02, RQ-CAJ-02-01, RQ-CAJ-02-02, RQ-CAJ-02-05, RQ-CAJ-02-06, RQ-CAJ-02-11, HU-CAP-034, HU-CAP-035, HU-CAP-036, ADR-001, ADR-011, ADR-014, ADR-003, ADR-006, ADR-007, ADR-008, ADR-010, ADR-012, DEP-02, DEP-06, R-01]
tags: [hu, caja, capa-a, ft-caj-02, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-033 | Título | Cobrar un pedido con un medio de pago y vuelto |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-004 · FT-CAJ-02 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-002** Cajero/a | cobrar un pedido con un medio de pago y vuelto | cobrar rápido y dar el vuelto exacto |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-CAJ-02 «Cobro con medios de pago y pago mixto» (Debe tener, épica EP-CAP-004). Cubre los requerimientos: **RQ-CAJ-02-01** El cajero cobra eligiendo uno de los medios activos: efectivo, Yape, Plin, transferencia o tarjeta. **RQ-CAJ-02-02** Con efectivo, el cajero anota con cuánto paga el cliente y ve el vuelto. **RQ-CAJ-02-05** El mozo saca la precuenta y no puede cobrar. **RQ-CAJ-02-06** Al cobrar un pedido de salón se liberan su mesa o sus mesas. **RQ-CAJ-02-11** No se puede cobrar con la caja cerrada. | **Alcance.**<br>• El cajero cobra eligiendo uno de los medios activos: efectivo, Yape, Plin, transferencia o tarjeta.<br>• Con efectivo, el cajero anota con cuánto paga el cliente y ve el vuelto.<br>• El mozo saca la precuenta y no puede cobrar.<br>• Al cobrar un pedido de salón se liberan su mesa o sus mesas.<br>• No se puede cobrar con la caja cerrada. |
| **Problema.** Cobros exactos por medio de pago que cuadran con el cierre del día, sin cuentas hechas a mano. | **Fuera de alcance.**<br>• HU-CAP-034: Cobrar con pago mixto.<br>• HU-CAP-035: Elegir comprobante y cobrar a crédito del personal.<br>• HU-CAP-036: Anular un pedido con motivo y PIN.<br>• Apertura y cierre de caja: FT-CIE-01 y FT-CIE-02.<br>• Emisión electrónica de boleta y factura (DT-11, D-07).<br>• Pago en línea con pasarela (DT-11).<br>• Devolución de un cobro ya cerrado (pendiente de Kevin, RN-CAP-096). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un pedido de S/ 42 | el cajero elige «Plin» y confirma | el pedido queda cobrado con Plin S/ 42, su autor y hora (RQ-CAJ-02-01) |
| CA-2 | un total de S/ 42 | el cajero escribe S/ 100 en efectivo | ve vuelto S/ 58,00; con S/ 40 no puede cobrar (RQ-CAJ-02-02) |
| CA-3 | un usuario mozo con una mesa ocupada | abre el pedido | puede imprimir la precuenta y no ve el botón «Cobrar» (RQ-CAJ-02-05) |
| CA-4 | un pedido que ocupa las mesas 4 y 5 | se cobra | ambas quedan libres en el plano (RQ-CAJ-02-06) |
| CA-5 | la caja del día sin abrir | el cajero intenta cobrar | ve «Abre la caja para cobrar» (RQ-CAJ-02-11) |

Origen: criterios de verificación de FT-CAJ-02 (RQ-CAJ-02-01, RQ-CAJ-02-02, RQ-CAJ-02-05, RQ-CAJ-02-06, RQ-CAJ-02-11); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-011) Medios admitidos: efectivo (con monto para vuelto), Yape, Plin, transferencia y tarjeta.<br>**RB-02** (RN-CAP-030) El mozo no cobra: saca la precuenta y el cajero cobra.<br>**RB-03** (RN-CAP-054) Una mesa se libera al cobrar y también a mano.<br>**RNF aplicables:** RNF-CAP-011, RNF-CAP-009, RNF-CAP-007, RNF-CAP-012, RNF-CAP-014. | `Pedido` (estado: por confirmar, confirmado, en cocina, listo, entregado, cobrado, rechazado, anulado) · `Confirmacion` (autor, hora, medio, comprobante de pago, código de operación) · `Cobro` y `PagoCobro` (medio, monto, recibido, vuelto) · `Anulacion` (motivo, autor, PIN validado).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** sin borrado físico: se desactiva o anula (RN-CAP-014); cada cambio guarda autor y fecha; montos en soles con dos decimales. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • FT-CFG-02.<br>• FT-SAL-02.<br>• FT-CIE-01.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Pedidos y caja ▸ Cobrar, pago mixto, vuelto, comprobante, anular (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-CAJ-02 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-006, ADR-007, ADR-008, ADR-010, ADR-012.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-CAJ-02 (requerimientos RQ-CAJ-02-01, RQ-CAJ-02-02, RQ-CAJ-02-05, RQ-CAJ-02-06, RQ-CAJ-02-11, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
