---
id: HU-CAP-042
tipo: hu
titulo: "Ver ventas por medio y registrar ingresos y egresos"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-005, FT-CIE-01, RQ-CIE-01-03, RQ-CIE-01-04, RQ-CIE-01-05, RQ-CIE-01-06, HU-CAP-041, HU-CAP-043, ADR-001, ADR-011, ADR-014, ADR-003, ADR-008, DEP-02, DEP-06, R-01]
tags: [hu, cierre-caja, capa-a, ft-cie-01, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-042 | Título | Ver ventas por medio y registrar ingresos y egresos |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-005 · FT-CIE-01 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-002** Cajero/a | ver ventas por medio y registrar ingresos y egresos | saber en todo momento cuánto efectivo debería haber |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-CIE-01 «Apertura, movimientos y liquidación de repartidores» (Debe tener, épica EP-CAP-005). Cubre los requerimientos: **RQ-CIE-01-03** Durante el turno, solo el administrador ve en vivo las ventas por medio de pago; el cajero ve sus cobros uno por uno, sin totales. **RQ-CIE-01-04** El cajero registra ingresos y egresos de caja con monto, motivo y autor. **RQ-CIE-01-05** Un movimiento de caja no se edita ni se borra: se anula con motivo. **RQ-CIE-01-06** El efectivo esperado se calcula como apertura + ventas en efectivo + ingresos − egresos, y solo lo ve el administrador. | **Alcance.**<br>• Durante el turno, solo el administrador ve en vivo las ventas por medio de pago; el cajero ve sus cobros uno por uno, sin totales.<br>• El cajero registra ingresos y egresos de caja con monto, motivo y autor.<br>• Un movimiento de caja no se edita ni se borra: se anula con motivo.<br>• El efectivo esperado se calcula como apertura + ventas en efectivo + ingresos − egresos, y solo lo ve el administrador. |
| **Problema.** Saber en cualquier momento cuánto efectivo debería haber, y que el efectivo de los repartidores no se pierda entre turnos. | **Fuera de alcance.**<br>• HU-CAP-041: Abrir la caja del día.<br>• HU-CAP-043: Liquidar el efectivo de un repartidor.<br>• Arqueo, cierre e historial: FT-CIE-02.<br>• Varias cajas o varios turnos al día (un solo local, una caja). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | cobros con efectivo, Yape y tarjeta | el administrador abre el resumen | ve el total de cada medio y del día; cuando lo abre el cajero, ve la lista de cobros sin sumas por medio ni efectivo esperado, y el servidor no le entrega esos totales (RQ-CIE-01-03) |
| CA-2 | un egreso de S/ 15 por «compra de hielo» | el cajero lo registra con Sí/No | baja el efectivo esperado en S/ 15 y queda en la lista con su autor y hora (RQ-CIE-01-04) |
| CA-3 | un ingreso mal registrado | el cajero lo anula con motivo | deja de sumar y sigue visible tachado con su motivo (RQ-CIE-01-05) |
| CA-4 | apertura S/ 50, ventas en efectivo S/ 300, ingresos S/ 20 y egresos S/ 15 | se consulta | el efectivo esperado es S/ 355,00 (RQ-CIE-01-06) |
| CA-5 | la confirmación Sí/No de la acción | quien la hace responde «No» | no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) |

Origen: criterios de verificación de FT-CIE-01 (RQ-CIE-01-03, RQ-CIE-01-04, RQ-CIE-01-05, RQ-CIE-01-06); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-079) Efectivo esperado = apertura + ventas en efectivo + ingresos − egresos.<br>**RNF aplicables:** RNF-CAP-011, RNF-CAP-009, RNF-CAP-014, RNF-CAP-019. | `Caja` (fecha, apertura, estado abierta o cerrada, autor) · `MovimientoCaja` (ingreso o egreso, monto, motivo, anulado) · `Liquidacion` (repartidor, esperado, entregado, diferencia) · `Arqueo` (conteo por denominación) · `CierreMedio` (medio, sistema, visto, diferencia).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** sin borrado físico: se desactiva o anula (RN-CAP-014); cada cambio guarda autor y fecha; montos en soles con dos decimales. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-041** (Abrir la caja del día) va antes, dentro de la misma feature.<br>• FT-CAJ-02.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Cierre de caja ▸ apertura, resumen por medio, ingresos y egresos, liquidación de repartidores (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-CIE-01 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-008.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-CIE-01 (requerimientos RQ-CIE-01-03, RQ-CIE-01-04, RQ-CIE-01-05, RQ-CIE-01-06, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
