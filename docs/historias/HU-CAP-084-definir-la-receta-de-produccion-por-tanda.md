---
id: HU-CAP-084
tipo: hu
titulo: "Definir la receta de producción por tanda"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-009, FT-STK-02, RQ-STK-02-07, HU-CAP-081, HU-CAP-082, HU-CAP-083, ADR-001, ADR-011, ADR-014, ADR-003, ADR-007, DEP-02, DEP-06, R-01]
tags: [hu, stock, capa-a, ft-stk-02, media, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-084 | Título | Definir la receta de producción por tanda |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-009 · FT-STK-02 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Media | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **Producción, encargada de la mañana (aún sin código ACT en el BRD)** | definir la receta de producción por tanda | registrar lo que produzco con la receta correcta |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-STK-02 «Recetas, costo y margen» (Debería tener, épica EP-CAP-009). Cubre el requerimiento: **RQ-STK-02-07** Los productos por lote tienen receta de producción por tanda. | **Alcance.**<br>• Los productos por lote tienen receta de producción por tanda. |
| **Problema.** Que el dueño sepa cuánto gana por plato y pueda corregir precios. Es el objetivo OBJ-CAP-003. | **Fuera de alcance.**<br>• HU-CAP-081: Definir la receta de un producto por tamaño.<br>• HU-CAP-082: Definir cómo las opciones cambian la receta.<br>• HU-CAP-083: Ver el costo y el margen de cada plato.<br>• Descontar el stock al vender: FT-STK-03.<br>• Registrar la producción: FT-ALM-02.<br>• Costeo por lote de compra (PEPS/promedio): se decide en G3. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | la receta de donas | se define que una tanda usa 1 kg de harina y rinde 24 donas | la producción la usa (FT-ALM-02) (RQ-STK-02-07) |
| CA-2 | un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor) | intenta hacerla desde el menú o escribiendo la dirección de la pantalla | se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) |

Origen: criterios de verificación de FT-STK-02 (RQ-STK-02-07); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-039) Al vender un producto al momento se descuentan sus insumos por receta; los de lote entran desde la producción.<br>**RNF aplicables:** RNF-CAP-011, RNF-CAP-009, RNF-CAP-006. | `Insumo` (unidades de compra, almacén y receta, equivalencias, niveles, perecible, área, proveedores A/B/C) · `StockLugar` (insumo, lugar, cantidad) · `Receta`/`LineaReceta` (por producto y tamaño) · `AjusteOpcion` (suma, quita o reemplaza) · `MovimientoStock` (tipo, origen, pedido, cantidad, autor).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** cada cambio guarda autor y fecha; montos en soles con dos decimales. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-083** (Ver el costo y el margen de cada plato) va antes, dentro de la misma feature.<br>• FT-ALM-02.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Stock y recetas ▸ pestaña Recetas, costo y margen (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-STK-02 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-007.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-STK-02 (requerimientos RQ-STK-02-07, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
