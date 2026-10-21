---
id: HU-CAP-144
tipo: hu
titulo: "Crear un producto en una categoría fija o con opciones"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-016, FT-CON-01, RQ-CON-01-01, RQ-CON-01-02, RQ-CON-01-08, RQ-CON-01-09, HU-CAP-145, HU-CAP-146, HU-CAP-147, ADR-001, ADR-011, ADR-014, ADR-003, ADR-012, DEP-02, DEP-06, R-01]
tags: [hu, contenidos, capa-a, ft-con-01, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-144 | Título | Crear un producto en una categoría fija o con opciones |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-016 · FT-CON-01 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-001** Kevin Rosales, dueño y administrador | crear un producto en una categoría fija o con opciones | agregar productos nuevos a la carta sin programador |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-CON-01 «Productos, listas y categorías» (Debería tener, épica EP-CAP-016). Cubre los requerimientos: **RQ-CON-01-01** El administrador crea un producto con nombre, descripción, foto, categoría y precio. **RQ-CON-01-02** Una categoría se crea indicando si sus productos llevan tamaños y opciones o son fijos. **RQ-CON-01-08** Productos, opciones y categorías no se eliminan: se ocultan o desactivan. **RQ-CON-01-09** Los cambios de precio se conservan y quedan en el historial. | **Alcance.**<br>• El administrador crea un producto con nombre, descripción, foto, categoría y precio.<br>• Una categoría se crea indicando si sus productos llevan tamaños y opciones o son fijos.<br>• Productos, opciones y categorías no se eliminan: se ocultan o desactivan.<br>• Los cambios de precio se conservan y quedan en el historial. |
| **Problema.** Que el dueño mantenga la carta sin depender de un programador (NEC-CAP-082). | **Fuera de alcance.**<br>• HU-CAP-145: Gestionar opciones y tamaños en un solo lugar.<br>• HU-CAP-146: Gestionar listas y categorías.<br>• HU-CAP-147: Gestionar tipos con sabores.<br>• Orden, fotos y publicación de la carta: FT-CON-02.<br>• Recetas del producto: FT-STK-02.<br>• Combos: FT-OFE-01. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | la categoría Pizzas (fija) | crea «Pizza Americana» a S/ 25 con foto | queda oculta hasta publicar la carta (FT-CON-02) (RQ-CON-01-01) |
| CA-2 | la categoría nueva «Hamburguesas» con opciones | se crea un producto en ella | se abre «Opciones y tamaños» (RQ-CON-01-02) |
| CA-3 | un producto | el administrador busca «Eliminar» | solo hay «Ocultar»; sus ventas pasadas se conservan (RQ-CON-01-08) |
| CA-4 | un cambio de precio | se publica | el historial muestra precio anterior, nuevo, autor y fecha, y los pedidos pasados mantienen su precio (RQ-CON-01-09) |

Origen: criterios de verificación de FT-CON-01 (RQ-CON-01-01, RQ-CON-01-02, RQ-CON-01-08, RQ-CON-01-09); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-086 (2.ª)) Las opciones no se eliminan; un cambio en un grupo vale para todos sus productos (id repetido, O1).<br>**RB-02** (RN-CAP-130) Categorías gestionables con o sin tamaños y opciones; se ocultan, no se eliminan.<br>**RNF aplicables:** RNF-CAP-014, RNF-CAP-009, RNF-CAP-012. | `Producto` · `Categoria` (lleva opciones o fija, oculta) · `Lista`/`ElementoLista` (por categoría, sin repetir) · `GrupoOpciones` (alcance por producto o categoría) · `VersionCarta` (borrador, publicada, organización, decoración) · `Novedad` (tipo, tema, fotos, vigencia, orden) · `Destacada` (fotos, portada, archivada).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** sin borrado físico: se desactiva o anula (RN-CAP-014); cada cambio guarda autor y fecha. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Productos, Opciones y tamaños, Listas y categorías (`Admin.dc.html`); `analisis/combos-y-opciones.md`.<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-CON-01 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-012.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-CON-01 (requerimientos RQ-CON-01-01, RQ-CON-01-02, RQ-CON-01-08, RQ-CON-01-09, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
