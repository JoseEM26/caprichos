---
id: HU-CAP-043
tipo: hu
titulo: "Liquidar el efectivo de un repartidor"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-005, FT-CIE-01, RQ-CIE-01-07, RQ-CIE-01-08, HU-CAP-041, HU-CAP-042, ADR-001, ADR-011, ADR-014, ADR-003, ADR-008, DEP-02, DEP-06, R-01]
tags: [hu, cierre-caja, capa-a, ft-cie-01, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-043 | Título | Liquidar el efectivo de un repartidor |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-005 · FT-CIE-01 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-002** Cajero/a | liquidar el efectivo de un repartidor | recibir el efectivo de cada repartidor y que cuadre con lo que cobró |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-CIE-01 «Apertura, movimientos y liquidación de repartidores» (Debe tener, épica EP-CAP-005). Cubre los requerimientos: **RQ-CIE-01-07** El efectivo cobrado por un repartidor no cuenta en caja hasta liquidarlo. **RQ-CIE-01-08** Caja registra la liquidación de cada repartidor con lo que entrega. | **Alcance.**<br>• El efectivo cobrado por un repartidor no cuenta en caja hasta liquidarlo.<br>• Caja registra la liquidación de cada repartidor con lo que entrega. |
| **Problema.** Saber en cualquier momento cuánto efectivo debería haber, y que el efectivo de los repartidores no se pierda entre turnos. | **Fuera de alcance.**<br>• HU-CAP-041: Abrir la caja del día.<br>• HU-CAP-042: Ver ventas por medio y registrar ingresos y egresos.<br>• Arqueo, cierre e historial: FT-CIE-02.<br>• Varias cajas o varios turnos al día (un solo local, una caja). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un delivery cobrado en efectivo por el repartidor (S/ 40) | se consulta el efectivo esperado | no lo incluye y figura en «Por liquidar» a nombre del repartidor (RQ-CIE-01-07) |
| CA-2 | un repartidor con S/ 120 por liquidar | entrega S/ 120 y el cajero confirma | sube el efectivo esperado y su saldo por liquidar queda en cero; si entrega S/ 110, se registra la diferencia de S/ 10 (RQ-CIE-01-08) |

Origen: criterios de verificación de FT-CIE-01 (RQ-CIE-01-07, RQ-CIE-01-08); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-088) El efectivo del repartidor no cuenta en caja hasta la liquidación.<br>**RNF aplicables:** RNF-CAP-011, RNF-CAP-009, RNF-CAP-014, RNF-CAP-019. | `Caja` (fecha, apertura, estado abierta o cerrada, autor) · `MovimientoCaja` (ingreso o egreso, monto, motivo, anulado) · `Liquidacion` (repartidor, esperado, entregado, diferencia) · `Arqueo` (conteo por denominación) · `CierreMedio` (medio, sistema, visto, diferencia).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** sin borrado físico: se desactiva o anula (RN-CAP-014); cada cambio guarda autor y fecha; montos en soles con dos decimales. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-042** (Ver ventas por medio y registrar ingresos y egresos) va antes, dentro de la misma feature.<br>• FT-DEL-02.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Cierre de caja ▸ apertura, resumen por medio, ingresos y egresos, liquidación de repartidores (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-CIE-01 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-008.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-CIE-01 (requerimientos RQ-CIE-01-07, RQ-CIE-01-08, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
