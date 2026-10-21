---
id: HU-CAP-147
tipo: hu
titulo: "Gestionar tipos con sabores"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-016, FT-CON-01, RQ-CON-01-07, HU-CAP-144, HU-CAP-145, HU-CAP-146, ADR-001, ADR-011, ADR-014, ADR-003, ADR-012, DEP-02, DEP-06, R-01]
tags: [hu, contenidos, capa-a, ft-con-01, media, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-147 | Título | Gestionar tipos con sabores |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-016 · FT-CON-01 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Media | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-001** Kevin Rosales, dueño y administrador | gestionar tipos con sabores | agregar o quitar sabores sin crear productos nuevos |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-CON-01 «Productos, listas y categorías» (Debería tener, épica EP-CAP-016). Cubre el requerimiento: **RQ-CON-01-07** Los productos con variantes son tipos con sabores que se crean, editan y desactivan. | **Alcance.**<br>• Los productos con variantes son tipos con sabores que se crean, editan y desactivan. |
| **Problema.** Que el dueño mantenga la carta sin depender de un programador (NEC-CAP-082). | **Fuera de alcance.**<br>• HU-CAP-144: Crear un producto en una categoría fija o con opciones.<br>• HU-CAP-145: Gestionar opciones y tamaños en un solo lugar.<br>• HU-CAP-146: Gestionar listas y categorías.<br>• Orden, fotos y publicación de la carta: FT-CON-02.<br>• Recetas del producto: FT-STK-02.<br>• Combos: FT-OFE-01. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | el tipo «Donas» | se agrega el sabor «Pistacho» | aparece en la carta y en las promociones que piden donas (RQ-CON-01-07) |

Origen: criterios de verificación de FT-CON-01 (RQ-CON-01-07); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-026) Las listas no se eliminan: se crean, editan y desactivan.<br>**RB-02** (RN-CAP-086 (2.ª)) Las opciones no se eliminan; un cambio en un grupo vale para todos sus productos (id repetido, O1).<br>**RB-03** (RN-CAP-128) Tamaños y opciones se eligen de listas; se crean o corrigen ahí mismo; no se repiten.<br>**RNF aplicables:** RNF-CAP-014, RNF-CAP-009, RNF-CAP-012. | `Producto` · `Categoria` (lleva opciones o fija, oculta) · `Lista`/`ElementoLista` (por categoría, sin repetir) · `GrupoOpciones` (alcance por producto o categoría) · `VersionCarta` (borrador, publicada, organización, decoración) · `Novedad` (tipo, tema, fotos, vigencia, orden) · `Destacada` (fotos, portada, archivada).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** sin borrado físico: se desactiva o anula (RN-CAP-014); cada cambio guarda autor y fecha. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-146** (Gestionar listas y categorías) va antes, dentro de la misma feature.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Productos, Opciones y tamaños, Listas y categorías (`Admin.dc.html`); `analisis/combos-y-opciones.md`.<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-CON-01 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-012.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-CON-01 (requerimientos RQ-CON-01-07, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
