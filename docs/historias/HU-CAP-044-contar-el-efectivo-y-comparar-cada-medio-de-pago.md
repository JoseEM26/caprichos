---
id: HU-CAP-044
tipo: hu
titulo: "Contar el efectivo y comparar cada medio de pago"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-005, FT-CIE-02, RQ-CIE-02-01, RQ-CIE-02-02, RQ-CIE-02-03, RQ-CIE-02-04, HU-CAP-045, HU-CAP-046, ADR-001, ADR-011, ADR-014, ADR-003, ADR-008, DEP-02, DEP-06, R-01]
tags: [hu, cierre-caja, capa-a, ft-cie-02, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-044 | Título | Contar el efectivo y comparar cada medio de pago |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-005 · FT-CIE-02 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-002** Cajero/a | contar el efectivo y comparar cada medio de pago | cerrar el día sabiendo si cada medio de pago cuadra |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-CIE-02 «Arqueo y cierre con historial» (Debe tener, épica EP-CAP-005). Cubre los requerimientos: **RQ-CIE-02-01** El cajero cuenta el efectivo por billetes y monedas y el sistema suma el total. **RQ-CIE-02-02** Mientras cuenta, el cajero ve lo esperado por el sistema. **RQ-CIE-02-03** Para Yape, Plin, transferencia y tarjeta, el cajero anota lo que ve fuera del sistema y se compara con lo vendido. **RQ-CIE-02-04** La diferencia de cada medio se clasifica como cuadrado, sobrante o faltante y se registra siempre. | **Alcance.**<br>• El cajero cuenta el efectivo por billetes y monedas y el sistema suma el total.<br>• Mientras cuenta, el cajero ve lo esperado por el sistema.<br>• Para Yape, Plin, transferencia y tarjeta, el cajero anota lo que ve fuera del sistema y se compara con lo vendido.<br>• La diferencia de cada medio se clasifica como cuadrado, sobrante o faltante y se registra siempre. |
| **Problema.** Un cierre del día ordenado y verificable por medio de pago, con un historial que el dueño puede revisar siempre. | **Fuera de alcance.**<br>• HU-CAP-045: Cerrar la caja con sus validaciones.<br>• HU-CAP-046: Consultar e imprimir el historial de cierres.<br>• Apertura, movimientos y liquidación: FT-CIE-01.<br>• Verificar los pagos en la cuenta de Yape o Plin desde el sistema (se hace fuera, RN-CAP-078).<br>• Informes de ventas: FT-INF-01. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | 3 billetes de 100, 2 de 20 y 5 monedas de 1 | el cajero los anota | el contado es S/ 345,00 (RQ-CIE-02-01) |
| CA-2 | el arqueo abierto | el cajero cuenta | ve a la par el efectivo esperado y la diferencia que va quedando (RQ-CIE-02-02) |
| CA-3 | Yape vendido S/ 210 | el cajero anota S/ 200 visto en el celular | el medio Yape queda con faltante S/ 10,00 (RQ-CIE-02-03) |
| CA-4 | efectivo esperado S/ 355 y contado S/ 360 | se cierra | queda «Sobrante S/ 5,00»; no se pide justificar a nadie, solo una nota opcional (RQ-CIE-02-04) |

Origen: criterios de verificación de FT-CIE-02 (RQ-CIE-02-01, RQ-CIE-02-02, RQ-CIE-02-03, RQ-CIE-02-04); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-078) El cajero ve lo esperado mientras cuenta; las billeteras se verifican fuera del sistema.<br>**RB-02** (RN-CAP-080) La diferencia se registra siempre; no se asignan culpables; los cierres no se editan ni eliminan.<br>**RNF aplicables:** RNF-CAP-011, RNF-CAP-014, RNF-CAP-009, RNF-CAP-012. | `Caja` (fecha, apertura, estado abierta o cerrada, autor) · `MovimientoCaja` (ingreso o egreso, monto, motivo, anulado) · `Liquidacion` (repartidor, esperado, entregado, diferencia) · `Arqueo` (conteo por denominación) · `CierreMedio` (medio, sistema, visto, diferencia).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** sin borrado físico: se desactiva o anula (RN-CAP-014); cada cambio guarda autor y fecha; montos en soles con dos decimales. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Cierre de caja ▸ arqueo por denominación, comparación por medio, historial de cierres (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-CIE-02 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-008.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-CIE-02 (requerimientos RQ-CIE-02-01, RQ-CIE-02-02, RQ-CIE-02-03, RQ-CIE-02-04, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
