---
id: HU-CAP-041
tipo: hu
titulo: "Abrir la caja del día"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-005, FT-CIE-01, RQ-CIE-01-01, RQ-CIE-01-02, HU-CAP-042, HU-CAP-043, ADR-001, ADR-011, ADR-014, ADR-003, ADR-008, DEP-02, DEP-06, R-01]
tags: [hu, cierre-caja, capa-a, ft-cie-01, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-041 | Título | Abrir la caja del día |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-005 · FT-CIE-01 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-002** Cajero/a | abrir la caja del día | empezar el día con la caja en cero y sin ventas del día anterior |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-CIE-01 «Apertura, movimientos y liquidación de repartidores» (Debe tener, épica EP-CAP-005). Cubre los requerimientos: **RQ-CIE-01-01** La caja se abre en cero, con monto de apertura editable, y las ventas del día empiezan vacías. **RQ-CIE-01-02** Solo hay una caja abierta a la vez. | **Alcance.**<br>• La caja se abre en cero, con monto de apertura editable, y las ventas del día empiezan vacías.<br>• Solo hay una caja abierta a la vez. |
| **Problema.** Saber en cualquier momento cuánto efectivo debería haber, y que el efectivo de los repartidores no se pierda entre turnos. | **Fuera de alcance.**<br>• HU-CAP-042: Ver ventas por medio y registrar ingresos y egresos.<br>• HU-CAP-043: Liquidar el efectivo de un repartidor.<br>• Arqueo, cierre e historial: FT-CIE-02.<br>• Varias cajas o varios turnos al día (un solo local, una caja). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | el día nuevo | el cajero abre la caja sin cambiar el monto | la apertura es S/ 0,00 y los totales del día están en cero; el día anterior queda en el historial (RQ-CIE-01-01) |
| CA-2 | una caja abierta | otro usuario intenta abrir otra | ve «Ya hay una caja abierta por …» (RQ-CIE-01-02) |

Origen: criterios de verificación de FT-CIE-01 (RQ-CIE-01-01, RQ-CIE-01-02); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-077) La caja se abre en cero (monto editable) y las ventas del día empiezan vacías.<br>**RNF aplicables:** RNF-CAP-011, RNF-CAP-009, RNF-CAP-014, RNF-CAP-019. | `Caja` (fecha, apertura, estado abierta o cerrada, autor) · `MovimientoCaja` (ingreso o egreso, monto, motivo, anulado) · `Liquidacion` (repartidor, esperado, entregado, diferencia) · `Arqueo` (conteo por denominación) · `CierreMedio` (medio, sistema, visto, diferencia).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** sin borrado físico: se desactiva o anula (RN-CAP-014); cada cambio guarda autor y fecha; montos en soles con dos decimales. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Cierre de caja ▸ apertura, resumen por medio, ingresos y egresos, liquidación de repartidores (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-CIE-01 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-008.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-CIE-01 (requerimientos RQ-CIE-01-01, RQ-CIE-01-02, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
