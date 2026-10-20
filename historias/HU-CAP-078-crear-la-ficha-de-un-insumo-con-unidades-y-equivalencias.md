---
id: HU-CAP-078
tipo: hu
titulo: "Crear la ficha de un insumo con unidades y equivalencias"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-009, FT-STK-01, RQ-STK-01-01, RQ-STK-01-02, RQ-STK-01-03, RQ-STK-01-08, HU-CAP-079, HU-CAP-080, ADR-001, ADR-011, ADR-014, ADR-003, ADR-007, D-15, DEP-02, DEP-06, DEP-10, R-01, R-02]
tags: [hu, stock, capa-a, ft-stk-01, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-078 | Título | Crear la ficha de un insumo con unidades y equivalencias |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-009 · FT-STK-01 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-005** Almacén | crear la ficha de un insumo con unidades y equivalencias | llevar cada insumo en la unidad correcta en compras, almacén y recetas |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-STK-01 «Insumos, unidades y niveles» (Debería tener, épica EP-CAP-009). Cubre los requerimientos: **RQ-STK-01-01** Un insumo tiene ficha con nombre, unidad de compra, de almacén y de receta con sus equivalencias. **RQ-STK-01-02** Los niveles mínimo, intermedio y máximo se editan por insumo. **RQ-STK-01-03** Cada insumo indica si vence; los perecibles exigen vencimiento al entrar. **RQ-STK-01-08** Un insumo no se elimina: se desactiva y sale de las listas de elección. | **Alcance.**<br>• Un insumo tiene ficha con nombre, unidad de compra, de almacén y de receta con sus equivalencias.<br>• Los niveles mínimo, intermedio y máximo se editan por insumo.<br>• Cada insumo indica si vence; los perecibles exigen vencimiento al entrar.<br>• Un insumo no se elimina: se desactiva y sale de las listas de elección. |
| **Problema.** Saber qué hay, dónde está y qué falta, con un vistazo. Base para OBJ-CAP-002 y OBJ-CAP-003. | **Fuera de alcance.**<br>• HU-CAP-079: Asignar proveedores y área a un insumo.<br>• HU-CAP-080: Ver el stock por lugar con semáforo y barra.<br>• Recetas y costos: FT-STK-02.<br>• Movimientos de almacén: FT-ALM-01.<br>• Varios almacenes (horizonte futuro). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | la leche con «caja de 12 L = 12 L» y «1 L = 1000 ml» | se registran 2 cajas | el almacén suma 24 L y una receta de 250 ml descuenta 0,25 L (RQ-STK-01-01) |
| CA-2 | la leche con mínimo 10 L | el administrador lo cambia a 12 L con Sí/No | el semáforo se recalcula con el nuevo mínimo (RQ-STK-01-02) |
| CA-3 | el pollo marcado perecible | se registra una entrada sin fecha de vencimiento | no se acepta (RQ-STK-01-03) |
| CA-4 | un insumo sin uso | se desactiva con Sí/No | deja de ofrecerse en recetas y movimientos y conserva su historial (RQ-STK-01-08) |
| CA-5 | la confirmación Sí/No de la acción | quien la hace responde «No» | no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) |

Origen: criterios de verificación de FT-STK-01 (RQ-STK-01-01, RQ-STK-01-02, RQ-STK-01-03, RQ-STK-01-08); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-041) Semáforo verde, naranja y rojo con mínimo, intermedio y máximo.<br>**RB-02** (RN-CAP-081 (2.ª)) Al registrar una compra se convierte a la unidad del almacén; los perecibles exigen vencimiento (id repetido, O1).<br>**RNF aplicables:** RNF-CAP-020, RNF-CAP-014, RNF-CAP-009, RNF-CAP-011. | `Insumo` (unidades de compra, almacén y receta, equivalencias, niveles, perecible, área, proveedores A/B/C) · `StockLugar` (insumo, lugar, cantidad) · `Receta`/`LineaReceta` (por producto y tamaño) · `AjusteOpcion` (suma, quita o reemplaza) · `MovimientoStock` (tipo, origen, pedido, cantidad, autor).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** sin borrado físico: se desactiva o anula (RN-CAP-014); cada cambio guarda autor y fecha; montos en soles con dos decimales. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • DEP-10 (D-15).<br>• FT-COM-03.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-02, R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Stock y recetas ▸ pestaña Insumos, ficha del insumo (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-STK-01 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-007.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; dependen de decisiones abiertas D-15 | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-STK-01 (requerimientos RQ-STK-01-01, RQ-STK-01-02, RQ-STK-01-03, RQ-STK-01-08, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
