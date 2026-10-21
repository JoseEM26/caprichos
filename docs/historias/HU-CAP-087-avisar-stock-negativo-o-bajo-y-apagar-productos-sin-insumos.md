---
id: HU-CAP-087
tipo: hu
titulo: "Avisar stock negativo o bajo y apagar productos sin insumos"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-009, FT-STK-03, RQ-STK-03-06, RQ-STK-03-07, HU-CAP-085, HU-CAP-086, ADR-001, ADR-011, ADR-014, ADR-003, ADR-007, DEP-02, DEP-06, R-01]
tags: [hu, stock, capa-a, ft-stk-03, media, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-087 | Título | Avisar stock negativo o bajo y apagar productos sin insumos |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-009 · FT-STK-03 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Media | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-005** Almacén | avisar stock negativo o bajo y apagar productos sin insumos | reponer a tiempo y no ofrecer lo que no se puede preparar |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-STK-03 «Descuento por venta y disponibilidad» (Debería tener, épica EP-CAP-009). Cubre los requerimientos: **RQ-STK-03-06** Un producto cuya receta tiene un insumo en cero o menos se muestra agotado en la carta. **RQ-STK-03-07** Al bajar del mínimo, se notifica a almacén y al administrador. | **Alcance.**<br>• Un producto cuya receta tiene un insumo en cero o menos se muestra agotado en la carta.<br>• Al bajar del mínimo, se notifica a almacén y al administrador. |
| **Problema.** Stock al día sin conteos manuales, y no ofrecer lo que no hay (OBJ-CAP-002). | **Fuera de alcance.**<br>• HU-CAP-085: Descontar insumos al pasar un pedido a cocina.<br>• HU-CAP-086: Devolver insumos al anular un pedido.<br>• Producción y su descuento de materia prima: FT-ALM-02.<br>• Traslados entre almacén y áreas: FT-ALM-01. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | el café en cero en Barra | el cliente abre la carta | los productos con café se ven agotados hasta que entre café a Barra (RQ-STK-03-06) |
| CA-2 | un mínimo de 10 L | una venta deja la leche en 9 L | almacén y el administrador reciben «Leche por debajo del mínimo» (RQ-STK-03-07) |

Origen: criterios de verificación de FT-STK-03 (RQ-STK-03-06, RQ-STK-03-07); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-003) Solo se ofrece lo disponible según el stock.<br>**RNF aplicables:** RNF-CAP-020, RNF-CAP-002, RNF-CAP-011. | `Insumo` (unidades de compra, almacén y receta, equivalencias, niveles, perecible, área, proveedores A/B/C) · `StockLugar` (insumo, lugar, cantidad) · `Receta`/`LineaReceta` (por producto y tamaño) · `AjusteOpcion` (suma, quita o reemplaza) · `MovimientoStock` (tipo, origen, pedido, cantidad, autor).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** montos en soles con dos decimales. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-086** (Devolver insumos al anular un pedido) va antes, dentro de la misma feature.<br>• FT-CAR-02.<br>• FT-INF-03.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Stock y recetas (movimientos por venta), notificaciones de stock bajo (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-STK-03 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-007.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-STK-03 (requerimientos RQ-STK-03-06, RQ-STK-03-07, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
