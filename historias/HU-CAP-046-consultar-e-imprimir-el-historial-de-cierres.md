---
id: HU-CAP-046
tipo: hu
titulo: "Consultar e imprimir el historial de cierres"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-005, FT-CIE-02, RQ-CIE-02-07, RQ-CIE-02-08, RQ-CIE-02-09, HU-CAP-044, HU-CAP-045, ADR-001, ADR-011, ADR-014, ADR-003, ADR-008, DEP-02, DEP-06, R-01]
tags: [hu, cierre-caja, capa-a, ft-cie-02, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-046 | Título | Consultar e imprimir el historial de cierres |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-005 · FT-CIE-02 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-001** Kevin Rosales, dueño y administrador | consultar e imprimir el historial de cierres | revisar cualquier cierre pasado tal como quedó |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-CIE-02 «Arqueo y cierre con historial» (Debe tener, épica EP-CAP-005). Cubre los requerimientos: **RQ-CIE-02-07** Cerrar pide confirmación Sí/No y deja el cierre en el historial con autor y hora. **RQ-CIE-02-08** Un cierre no se edita ni se elimina. **RQ-CIE-02-09** El historial de cierres se filtra por fechas y se exporta. | **Alcance.**<br>• Cerrar pide confirmación Sí/No y deja el cierre en el historial con autor y hora.<br>• Un cierre no se edita ni se elimina.<br>• El historial de cierres se filtra por fechas y se exporta. |
| **Problema.** Un cierre del día ordenado y verificable por medio de pago, con un historial que el dueño puede revisar siempre. | **Fuera de alcance.**<br>• HU-CAP-044: Contar el efectivo y comparar cada medio de pago.<br>• HU-CAP-045: Cerrar la caja con sus validaciones.<br>• Apertura, movimientos y liquidación: FT-CIE-01.<br>• Verificar los pagos en la cuenta de Yape o Plin desde el sistema (se hace fuera, RN-CAP-078).<br>• Informes de ventas: FT-INF-01. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un arqueo completo | el cajero confirma el cierre | queda en el historial con fecha, autor, apertura, ventas por medio, movimientos, contado y diferencias (RQ-CIE-02-07) |
| CA-2 | un cierre del historial | cualquier usuario lo abre | solo puede verlo, imprimirlo o exportarlo (RQ-CIE-02-08) |
| CA-3 | cierres de octubre | el administrador filtra del 1 al 15 | ve esos cierres con sus diferencias y los descarga como CSV (RQ-CIE-02-09) |
| CA-4 | la confirmación Sí/No de la acción | quien la hace responde «No» | no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) |

Origen: criterios de verificación de FT-CIE-02 (RQ-CIE-02-07, RQ-CIE-02-08, RQ-CIE-02-09); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-080) La diferencia se registra siempre; no se asignan culpables; los cierres no se editan ni eliminan.<br>**RNF aplicables:** RNF-CAP-011, RNF-CAP-014, RNF-CAP-009, RNF-CAP-012. | `Caja` (fecha, apertura, estado abierta o cerrada, autor) · `MovimientoCaja` (ingreso o egreso, monto, motivo, anulado) · `Liquidacion` (repartidor, esperado, entregado, diferencia) · `Arqueo` (conteo por denominación) · `CierreMedio` (medio, sistema, visto, diferencia).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** sin borrado físico: se desactiva o anula (RN-CAP-014); cada cambio guarda autor y fecha; montos en soles con dos decimales. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-045** (Cerrar la caja con sus validaciones) va antes, dentro de la misma feature.<br>• FT-INF-01.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Cierre de caja ▸ arqueo por denominación, comparación por medio, historial de cierres (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-CIE-02 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-008.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-CIE-02 (requerimientos RQ-CIE-02-07, RQ-CIE-02-08, RQ-CIE-02-09, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
