---
id: HU-CAP-150
tipo: hu
titulo: "Publicar o descartar los cambios"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-016, FT-CON-02, RQ-CON-02-06, RQ-CON-02-07, RQ-CON-02-08, HU-CAP-148, HU-CAP-149, ADR-001, ADR-011, ADR-014, ADR-003, ADR-012, DEP-02, DEP-06, R-01]
tags: [hu, contenidos, capa-a, ft-con-02, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-150 | Título | Publicar o descartar los cambios |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-016 · FT-CON-02 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-001** Kevin Rosales, dueño y administrador | publicar o descartar los cambios | que el cliente vea los cambios solo cuando yo lo decida |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-CON-02 «Diseñador de la carta y decoración» (Debería tener, épica EP-CAP-016). Cubre los requerimientos: **RQ-CON-02-06** Activa una decoración festiva con su paleta solo mientras está activa. **RQ-CON-02-07** Los cambios se publican con una acción explícita y Sí/No; antes, la carta del cliente no cambia. **RQ-CON-02-08** Se pueden descartar los cambios pendientes. | **Alcance.**<br>• Activa una decoración festiva con su paleta solo mientras está activa.<br>• Los cambios se publican con una acción explícita y Sí/No; antes, la carta del cliente no cambia.<br>• Se pueden descartar los cambios pendientes. |
| **Problema.** Cambiar la carta sin formularios técnicos y sin errores visibles para el cliente hasta publicar. | **Fuera de alcance.**<br>• HU-CAP-148: Editar la carta en la vista del cliente.<br>• HU-CAP-149: Elegir organización y decoración festiva.<br>• Crear productos y opciones: FT-CON-01.<br>• Novedades y destacadas: FT-CON-03. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | la decoración de Navidad | se activa y publica | la carta usa su paleta; al quitarla y publicar, vuelve la paleta de la marca (RQ-CON-02-06) |
| CA-2 | cambios pendientes | un cliente abre la carta | ve la versión anterior; al publicar, ve la nueva (RQ-CON-02-07) |
| CA-3 | cambios pendientes | el administrador toca «Descartar» con Sí/No | el diseñador vuelve a la versión publicada (RQ-CON-02-08) |
| CA-4 | la confirmación Sí/No de la acción | quien la hace responde «No» | no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) |

Origen: criterios de verificación de FT-CON-02 (RQ-CON-02-06, RQ-CON-02-07, RQ-CON-02-08); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-018) Los cambios de la carta se publican con una acción explícita.<br>**RNF aplicables:** RNF-CAP-012, RNF-CAP-009, RNF-CAP-001. | `Producto` · `Categoria` (lleva opciones o fija, oculta) · `Lista`/`ElementoLista` (por categoría, sin repetir) · `GrupoOpciones` (alcance por producto o categoría) · `VersionCarta` (borrador, publicada, organización, decoración) · `Novedad` (tipo, tema, fotos, vigencia, orden) · `Destacada` (fotos, portada, archivada).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** cada cambio guarda autor y fecha. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-149** (Elegir organización y decoración festiva) va antes, dentro de la misma feature.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Diseño de la carta (vista del cliente, decoración, publicar) (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-CON-02 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-012.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-CON-02 (requerimientos RQ-CON-02-06, RQ-CON-02-07, RQ-CON-02-08, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
