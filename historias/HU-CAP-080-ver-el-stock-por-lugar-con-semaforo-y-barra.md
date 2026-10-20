---
id: HU-CAP-080
tipo: hu
titulo: "Ver el stock por lugar con semáforo y barra"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-009, FT-STK-01, RQ-STK-01-06, RQ-STK-01-07, HU-CAP-078, HU-CAP-079, ADR-001, ADR-011, ADR-014, ADR-003, ADR-007, DEP-02, DEP-06, R-01]
tags: [hu, stock, capa-a, ft-stk-01, media, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-080 | Título | Ver el stock por lugar con semáforo y barra |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-009 · FT-STK-01 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Media | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-005** Almacén | ver el stock por lugar con semáforo y barra | ver de un vistazo qué falta en el almacén y en cada área |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-STK-01 «Insumos, unidades y niveles» (Debería tener, épica EP-CAP-009). Cubre los requerimientos: **RQ-STK-01-06** Cada insumo muestra semáforo, barra frente al máximo y estado en palabras. **RQ-STK-01-07** La lista de insumos se filtra por estado, lugar y búsqueda. | **Alcance.**<br>• Cada insumo muestra semáforo, barra frente al máximo y estado en palabras.<br>• La lista de insumos se filtra por estado, lugar y búsqueda. |
| **Problema.** Saber qué hay, dónde está y qué falta, con un vistazo. Base para OBJ-CAP-002 y OBJ-CAP-003. | **Fuera de alcance.**<br>• HU-CAP-078: Crear la ficha de un insumo con unidades y equivalencias.<br>• HU-CAP-079: Asignar proveedores y área a un insumo.<br>• Recetas y costos: FT-STK-02.<br>• Movimientos de almacén: FT-ALM-01.<br>• Varios almacenes (horizonte futuro). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un máximo de 40 y un mínimo de 10 | hay 8 | se ve rojo y «Poco»; con 0, «Agotado»; con 38, «Lleno» (RQ-STK-01-06) |
| CA-2 | 60 insumos | almacén filtra «Por acabarse» en Barra | solo ve esos (RQ-STK-01-07) |

Origen: criterios de verificación de FT-STK-01 (RQ-STK-01-06, RQ-STK-01-07); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-041) Semáforo verde, naranja y rojo con mínimo, intermedio y máximo.<br>**RB-02** (RN-CAP-118) Barra de llenado con marcas y estado en palabras.<br>**RNF aplicables:** RNF-CAP-020, RNF-CAP-014, RNF-CAP-009, RNF-CAP-011. | `Insumo` (unidades de compra, almacén y receta, equivalencias, niveles, perecible, área, proveedores A/B/C) · `StockLugar` (insumo, lugar, cantidad) · `Receta`/`LineaReceta` (por producto y tamaño) · `AjusteOpcion` (suma, quita o reemplaza) · `MovimientoStock` (tipo, origen, pedido, cantidad, autor).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** sin borrado físico: se desactiva o anula (RN-CAP-014); cada cambio guarda autor y fecha; montos en soles con dos decimales. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-079** (Asignar proveedores y área a un insumo) va antes, dentro de la misma feature.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Stock y recetas ▸ pestaña Insumos, ficha del insumo (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-STK-01 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-007.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-STK-01 (requerimientos RQ-STK-01-06, RQ-STK-01-07, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
