---
id: HU-CAP-153
tipo: hu
titulo: "Gestionar destacadas con varias fotos y archivarlas"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-016, FT-CON-03, RQ-CON-03-05, HU-CAP-151, HU-CAP-152, HU-CAP-154, ADR-001, ADR-011, ADR-014, ADR-003, ADR-012, DEP-02, DEP-06, R-01]
tags: [hu, contenidos, capa-a, ft-con-03, media, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-153 | Título | Gestionar destacadas con varias fotos y archivarlas |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-016 · FT-CON-03 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Media | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-001** Kevin Rosales, dueño y administrador | gestionar destacadas con varias fotos y archivarlas | mantener al día los Momentos Caprichos |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-CON-03 «Novedades y destacadas» (Debería tener, épica EP-CAP-016). Cubre el requerimiento: **RQ-CON-03-05** La página Novedades tiene portada con banners, filtros por tipo, galería y datos útiles. | **Alcance.**<br>• La página Novedades tiene portada con banners, filtros por tipo, galería y datos útiles. |
| **Problema.** Mostrar la vida del local y sus campañas en la carta, sin programador. | **Fuera de alcance.**<br>• HU-CAP-151: Crear y publicar una novedad con varias fotos o video.<br>• HU-CAP-152: Ver la página Novedades con filtros y galería.<br>• HU-CAP-154: Ver las destacadas como historias en la carta.<br>• Diseño general de la carta: FT-CON-02.<br>• Subir videos al servidor (solo enlaces). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | novedades de varios tipos | el cliente filtra «Eventos» | solo ve eventos; al tocar una con fotos, abre la galería (RQ-CON-03-05) |

Origen: criterios de verificación de FT-CON-03 (RQ-CON-03-05); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-063) Una novedad se muestra solo activa y vigente; no se elimina; se publica con Sí/No.<br>**RB-02** (RN-CAP-064) Una destacada solo muestra fotos; un círculo sin fotos no se ve; se publican con confirmación.<br>**RB-03** (DT-06) Excepción: un círculo de destacadas se puede eliminar.<br>**RNF aplicables:** RNF-CAP-001, RNF-CAP-012, RNF-CAP-019. | `Producto` · `Categoria` (lleva opciones o fija, oculta) · `Lista`/`ElementoLista` (por categoría, sin repetir) · `GrupoOpciones` (alcance por producto o categoría) · `VersionCarta` (borrador, publicada, organización, decoración) · `Novedad` (tipo, tema, fotos, vigencia, orden) · `Destacada` (fotos, portada, archivada).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)* |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-152** (Ver la página Novedades con filtros y galería) va antes, dentro de la misma feature.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Carta ▸ Novedades y círculos de destacadas; administrativo ▸ Novedades y publicidad, Destacadas de la carta (`Main.dc.html`, `Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-CON-03 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-012.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-CON-03 (requerimientos RQ-CON-03-05, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
