---
id: HU-CAP-086
tipo: hu
titulo: "Devolver insumos al anular un pedido"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-009, FT-STK-03, RQ-STK-03-04, RQ-STK-03-05, RQ-STK-03-08, HU-CAP-085, HU-CAP-087, ADR-001, ADR-011, ADR-014, ADR-003, ADR-007, DEP-02, R-01, R-02]
tags: [hu, stock, capa-a, ft-stk-03, media]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-086 | Título | Devolver insumos al anular un pedido |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-009 · FT-STK-03 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Media | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-001** Kevin Rosales, dueño y administrador | que al anular un pedido se devuelvan los insumos que se habían descontado | que un pedido anulado no deje el stock descuadrado |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-STK-03 «Descuento por venta y disponibilidad» (Debería tener, épica EP-CAP-009). Cubre los requerimientos: **RQ-STK-03-04** Un pedido rechazado no descuenta y una anulación devuelve lo descontado. **RQ-STK-03-05** Si un insumo no alcanza, se avisa y se deja vender. **RQ-STK-03-08** Cada descuento por venta queda como movimiento con pedido, área, insumo y cantidad. | **Alcance.**<br>• Un pedido rechazado no descuenta y una anulación devuelve lo descontado.<br>• Si un insumo no alcanza, se avisa y se deja vender.<br>• Cada descuento por venta queda como movimiento con pedido, área, insumo y cantidad. |
| **Problema.** Stock al día sin conteos manuales, y no ofrecer lo que no hay (OBJ-CAP-002). | **Fuera de alcance.**<br>• HU-CAP-085: Descontar insumos al pasar un pedido a cocina.<br>• HU-CAP-087: Avisar stock negativo o bajo y apagar productos sin insumos.<br>• Producción y su descuento de materia prima: FT-ALM-02.<br>• Traslados entre almacén y áreas: FT-ALM-01. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un pedido anulado después de pasar a cocina | se anula | se registra un movimiento de devolución por las mismas cantidades, salvo lo que se marque como merma (RQ-STK-03-04) |
| CA-2 | 100 ml de leche en Barra | se vende un capuchino de 200 ml | la venta procede, Barra queda en −100 ml y aparece una alerta «Stock negativo en Barra: leche» (RQ-STK-03-05) |
| CA-3 | un día de ventas | almacén abre el historial y filtra «Venta» | ve cada movimiento con su pedido (RQ-STK-03-08) |

Origen: criterios de verificación de FT-STK-03 (RQ-STK-03-04, RQ-STK-03-05, RQ-STK-03-08); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-003) Solo se ofrece lo disponible según el stock.<br>**RB-02** (RN-CAP-039) Al vender se descuentan los insumos por receta; los de lote entran desde la producción.<br>**RB-03** (RN-CAP-085 (2.ª)) Al vender un combo se descuenta cada producto por separado y se registra el combo (id repetido, O1).<br>**RNF aplicables:** RNF-CAP-020, RNF-CAP-002, RNF-CAP-011. | `Insumo` (unidades de compra, almacén y receta, equivalencias, niveles, perecible, área, proveedores A/B/C) · `StockLugar` (insumo, lugar, cantidad) · `Receta`/`LineaReceta` (por producto y tamaño) · `AjusteOpcion` (suma, quita o reemplaza) · `MovimientoStock` (tipo, origen, pedido, cantidad, autor).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** montos en soles con dos decimales. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-085** (Descontar insumos al pasar un pedido a cocina) va antes, dentro de la misma feature.<br>• FT-ALM-01.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• Riesgos: R-01, R-02 (roadmap PLT-01). | • Mockup: no aplica (proceso del sistema, sin pantalla propia).<br>• Contrato: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md` (borrador, G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-007. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-STK-03 (requerimientos RQ-STK-03-04, RQ-STK-03-05, RQ-STK-03-08, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
