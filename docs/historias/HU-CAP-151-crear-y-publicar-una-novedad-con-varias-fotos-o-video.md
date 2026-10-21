---
id: HU-CAP-151
tipo: hu
titulo: "Crear y publicar una novedad con varias fotos o video"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-016, FT-CON-03, RQ-CON-03-01, RQ-CON-03-02, RQ-CON-03-10, RQ-CON-03-11, HU-CAP-152, HU-CAP-153, HU-CAP-154, ADR-001, ADR-011, ADR-014, ADR-003, ADR-012, DEP-02, DEP-06, R-01]
tags: [hu, contenidos, capa-a, ft-con-03, media, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-151 | Título | Crear y publicar una novedad con varias fotos o video |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-016 · FT-CON-03 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Media | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-001** Kevin Rosales, dueño y administrador | crear y publicar una novedad con varias fotos o video | mostrar promociones, eventos y fotos del local en la carta |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-CON-03 «Novedades y destacadas» (Debería tener, épica EP-CAP-016). Cubre los requerimientos: **RQ-CON-03-01** El administrador crea una novedad de tipo promoción, banner, video, fotos, evento o aviso, con tema y varias fotos. **RQ-CON-03-02** Un video se agrega con el enlace de TikTok, Instagram o YouTube. **RQ-CON-03-10** El título y el subtítulo de la sección Novedades de la carta son textos que el administrador edita. **RQ-CON-03-11** El espacio de publicidad «Caprichos del mes» se activa y desactiva. | **Alcance.**<br>• El administrador crea una novedad de tipo promoción, banner, video, fotos, evento o aviso, con tema y varias fotos.<br>• Un video se agrega con el enlace de TikTok, Instagram o YouTube.<br>• El título y el subtítulo de la sección Novedades de la carta son textos que el administrador edita.<br>• El espacio de publicidad «Caprichos del mes» se activa y desactiva. |
| **Problema.** Mostrar la vida del local y sus campañas en la carta, sin programador. | **Fuera de alcance.**<br>• HU-CAP-152: Ver la página Novedades con filtros y galería.<br>• HU-CAP-153: Gestionar destacadas con varias fotos y archivarlas.<br>• HU-CAP-154: Ver las destacadas como historias en la carta.<br>• Diseño general de la carta: FT-CON-02.<br>• Subir videos al servidor (solo enlaces). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | el tipo «Evento» | crea «Noche de jazz» con fecha, lugar, 3 fotos y tema «Aniversario» | queda como borrador (RQ-CON-03-01) |
| CA-2 | un enlace de TikTok válido | se pega | la vista previa lo muestra; un enlace de otro sitio no se acepta (RQ-CON-03-02) |
| CA-3 | el subtítulo «Lo nuevo en Caprichos» | el administrador lo cambia a «¡Feliz Navidad para todos!» y publica | la carta muestra el texto nuevo; no es una imagen (RQ-CON-03-10) |
| CA-4 | el espacio activo | el administrador lo desactiva y publica | deja de verse en la carta (RQ-CON-03-11) |

Origen: criterios de verificación de FT-CON-03 (RQ-CON-03-01, RQ-CON-03-02, RQ-CON-03-10, RQ-CON-03-11); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-063) Una novedad se muestra solo activa y vigente; no se elimina; se publica con Sí/No.<br>**RB-02** (RN-CAP-064) Una destacada solo muestra fotos; un círculo sin fotos no se ve; se publican con confirmación.<br>**RB-03** (DT-06) Excepción: un círculo de destacadas se puede eliminar.<br>**RNF aplicables:** RNF-CAP-001, RNF-CAP-012, RNF-CAP-019. | `Producto` · `Categoria` (lleva opciones o fija, oculta) · `Lista`/`ElementoLista` (por categoría, sin repetir) · `GrupoOpciones` (alcance por producto o categoría) · `VersionCarta` (borrador, publicada, organización, decoración) · `Novedad` (tipo, tema, fotos, vigencia, orden) · `Destacada` (fotos, portada, archivada).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)* |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Carta ▸ Novedades y círculos de destacadas; administrativo ▸ Novedades y publicidad, Destacadas de la carta (`Main.dc.html`, `Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-CON-03 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-012.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-CON-03 (requerimientos RQ-CON-03-01, RQ-CON-03-02, RQ-CON-03-10, RQ-CON-03-11, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
