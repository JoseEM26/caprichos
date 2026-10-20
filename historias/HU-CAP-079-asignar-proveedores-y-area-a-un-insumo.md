---
id: HU-CAP-079
tipo: hu
titulo: "Asignar proveedores y área a un insumo"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-009, FT-STK-01, RQ-STK-01-04, RQ-STK-01-05, RQ-STK-01-09, HU-CAP-078, HU-CAP-080, ADR-001, ADR-011, ADR-014, ADR-003, ADR-007, DEP-02, DEP-06, R-01]
tags: [hu, stock, capa-a, ft-stk-01, media, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-079 | Título | Asignar proveedores y área a un insumo |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-009 · FT-STK-01 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Media | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-005** Almacén | asignar proveedores y área a un insumo | saber a quién comprar cada insumo y desde dónde se descuenta |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-STK-01 «Insumos, unidades y niveles» (Debería tener, épica EP-CAP-009). Cubre los requerimientos: **RQ-STK-01-04** Un insumo tiene proveedores A, B y C elegidos del directorio, sin repetir. **RQ-STK-01-05** El stock se lleva por lugar: almacén central y cada área. **RQ-STK-01-09** Se asigna el área de cada insumo (dónde se guarda y desde dónde se descuenta). | **Alcance.**<br>• Un insumo tiene proveedores A, B y C elegidos del directorio, sin repetir.<br>• El stock se lleva por lugar: almacén central y cada área.<br>• Se asigna el área de cada insumo (dónde se guarda y desde dónde se descuenta). |
| **Problema.** Saber qué hay, dónde está y qué falta, con un vistazo. Base para OBJ-CAP-002 y OBJ-CAP-003. | **Fuera de alcance.**<br>• HU-CAP-078: Crear la ficha de un insumo con unidades y equivalencias.<br>• HU-CAP-080: Ver el stock por lugar con semáforo y barra.<br>• Recetas y costos: FT-STK-02.<br>• Movimientos de almacén: FT-ALM-01.<br>• Varios almacenes (horizonte futuro). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un insumo | el administrador elige el mismo proveedor como A y B | no se acepta (RQ-STK-01-04) |
| CA-2 | la leche con 20 L en almacén y 3 L en barra | se abre la ficha | se ven las dos cantidades por separado y el total (RQ-STK-01-05) |
| CA-3 | el café asignado a Barra | se vende un capuchino | el café se descuenta del stock de Barra (RQ-STK-01-09) |

Origen: criterios de verificación de FT-STK-01 (RQ-STK-01-04, RQ-STK-01-05, RQ-STK-01-09); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-082 (2.ª)) Proveedor desactivado no se elige; A, B y C no se repiten (id repetido, O1).<br>**RB-02** (RN-CAP-127) Stock por área: almacén central y cocina o barra, cada uno con su stock.<br>**RNF aplicables:** RNF-CAP-020, RNF-CAP-014, RNF-CAP-009, RNF-CAP-011. | `Insumo` (unidades de compra, almacén y receta, equivalencias, niveles, perecible, área, proveedores A/B/C) · `StockLugar` (insumo, lugar, cantidad) · `Receta`/`LineaReceta` (por producto y tamaño) · `AjusteOpcion` (suma, quita o reemplaza) · `MovimientoStock` (tipo, origen, pedido, cantidad, autor).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** sin borrado físico: se desactiva o anula (RN-CAP-014); cada cambio guarda autor y fecha; montos en soles con dos decimales. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-078** (Crear la ficha de un insumo con unidades y equivalencias) va antes, dentro de la misma feature.<br>• FT-COM-01.<br>• FT-STK-03.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Stock y recetas ▸ pestaña Insumos, ficha del insumo (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-STK-01 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-007.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-STK-01 (requerimientos RQ-STK-01-04, RQ-STK-01-05, RQ-STK-01-09, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
