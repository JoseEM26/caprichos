---
id: HU-CAP-036
tipo: hu
titulo: "Anular un pedido con motivo y el PIN de la supervisora"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-004, FT-CAJ-02, RQ-CAJ-02-09, RQ-CAJ-02-10, RQ-CAJ-02-12, HU-CAP-033, HU-CAP-034, HU-CAP-035, ADR-001, ADR-011, ADR-014, ADR-003, ADR-006, ADR-007, ADR-008, ADR-010, ADR-012, DEP-02, DEP-06, R-01, R-11]
tags: [hu, caja, capa-a, ft-caj-02, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-036 | Título | Anular un pedido con motivo y el PIN de la supervisora |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-004 · FT-CAJ-02 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-002** Cajero/a | anular un pedido con motivo y el PIN de la supervisora | corregir un pedido equivocado sin que nadie anule sin autorización |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-CAJ-02 «Cobro con medios de pago y pago mixto» (Debe tener, épica EP-CAP-004). Cubre los requerimientos: **RQ-CAJ-02-09** El cajero anula un pedido con motivo obligatorio y el PIN de 6 dígitos de la supervisora (rol administrador), escrito en persona en la caja; un cobrado, solo si el cobro sigue en la caja abierta. **RQ-CAJ-02-10** Toda anulación guarda quién la pidió, quién la aprobó con su PIN y el motivo. **RQ-CAJ-02-12** Tras 3 PIN incorrectos seguidos, la aprobación se bloquea 5 minutos y queda registrado. | **Alcance.**<br>• El cajero anula un pedido con motivo obligatorio y el PIN de 6 dígitos de la supervisora (rol administrador), escrito en persona en la caja; un cobrado, solo si el cobro sigue en la caja abierta.<br>• Toda anulación guarda quién la pidió, quién la aprobó con su PIN y el motivo.<br>• Tras 3 PIN incorrectos seguidos, la aprobación se bloquea 5 minutos y queda registrado. |
| **Problema.** Cobros exactos por medio de pago que cuadran con el cierre del día, sin cuentas hechas a mano. | **Fuera de alcance.**<br>• HU-CAP-033: Cobrar un pedido con un medio de pago y vuelto.<br>• HU-CAP-034: Cobrar con pago mixto.<br>• HU-CAP-035: Elegir comprobante y cobrar a crédito del personal.<br>• Apertura y cierre de caja: FT-CIE-01 y FT-CIE-02.<br>• Emisión electrónica de boleta y factura (DT-11, D-07).<br>• Pago en línea con pasarela (DT-11).<br>• Devolución de un cobro ya cerrado (pendiente de Kevin, RN-CAP-096). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un cobro de la caja abierta | el cajero elige el motivo y la supervisora escribe su PIN de 6 dígitos en la pantalla de caja | el pedido queda anulado y el cobro sale de los totales; sin motivo o con un PIN de 4 dígitos no se acepta; con la caja ya cerrada, no se permite; no existe aprobación por notificación (RQ-CAJ-02-09) |
| CA-2 | un pedido anulado por el cajero Luis con el PIN de la supervisora Ana | se revisa el Historial de acciones | aparece «ANULAR · CP-0098 · pidió Luis · aprobó Ana · motivo: cliente no pagó» (RQ-CAJ-02-10) |
| CA-3 | 3 PIN erróneos en una anulación | se intenta un cuarto | se rechaza con «Espera 5 minutos» y el Historial de acciones registra los 3 intentos con la caja y la hora (RQ-CAJ-02-12) |

Origen: criterios de verificación de FT-CAJ-02 (RQ-CAJ-02-09, RQ-CAJ-02-10, RQ-CAJ-02-12); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-089) Anular exige motivo y queda en el historial; solo se anulan pedidos sin cobrar.<br>**RB-02** (RN-CAP-094) Anular por otro rol exige el PIN del administrador.<br>**RB-03** (RN-CAP-096) Anular un cobrado exige motivo y PIN, solo admin y cajero, solo con el cobro en la caja abierta.<br>**RB-04** (DT-61) El cajero anula con motivo y el PIN de 6 dígitos de la supervisora, en persona; cierre de caja ciego.<br>**RNF aplicables:** RNF-CAP-011, RNF-CAP-009, RNF-CAP-007, RNF-CAP-012, RNF-CAP-014. | `Pedido` (estado: por confirmar, confirmado, en cocina, listo, entregado, cobrado, rechazado, anulado) · `Confirmacion` (autor, hora, medio, comprobante de pago, código de operación) · `Cobro` y `PagoCobro` (medio, monto, recibido, vuelto) · `Anulacion` (motivo, autor, PIN validado).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** sin borrado físico: se desactiva o anula (RN-CAP-014); cada cambio guarda autor y fecha; montos en soles con dos decimales. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-035** (Elegir comprobante y cobrar a crédito del personal) va antes, dentro de la misma feature.<br>• FT-CIE-02.<br>• FT-USR-04.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01, R-11 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Pedidos y caja ▸ Cobrar, pago mixto, vuelto, comprobante, anular (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-CAJ-02 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-006, ADR-007, ADR-008, ADR-010, ADR-012.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-CAJ-02 (requerimientos RQ-CAJ-02-09, RQ-CAJ-02-10, RQ-CAJ-02-12, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
