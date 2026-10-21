---
id: HU-CAP-192
tipo: hu
titulo: "Comentar una iniciativa"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-022, FT-INI-01, RQ-INI-01-07, HU-CAP-190, HU-CAP-191, HU-CAP-193, HU-CAP-194, ADR-001, ADR-011, ADR-014, ADR-003, ADR-008, ADR-012, DEP-02, DEP-06, R-01]
tags: [hu, iniciativas, capa-a, ft-ini-01, media, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-192 | Título | Comentar una iniciativa |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-022 · FT-INI-01 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Media | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **Cualquier persona del equipo con usuario (administrador, cajero, mozo, cocina, call center, almacén, producción o repartidor)** | comentar una iniciativa | aportar a una iniciativa de otra persona |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-INI-01 «Iniciativas del equipo» (Debería tener, épica EP-CAP-022). Cubre el requerimiento: **RQ-INI-01-07** Cualquier persona con usuario comenta una iniciativa (hasta 400 caracteres); el comentario muestra su autor y fecha y no se edita ni se borra. | **Alcance.**<br>• Cualquier persona con usuario comenta una iniciativa (hasta 400 caracteres); el comentario muestra su autor y fecha y no se edita ni se borra. |
| **Problema.** Que las quejas y las ideas del equipo no se pierdan y que el dueño sepa quién las dijo y qué se hizo. | **Fuera de alcance.**<br>• HU-CAP-190: Subir una iniciativa con captura.<br>• HU-CAP-191: Ver, buscar y filtrar las iniciativas del equipo.<br>• HU-CAP-193: Cambiar el estado de una iniciativa.<br>• HU-CAP-194: Dejar cada acción en el Historial de acciones.<br>• Subir de forma anónima: siempre se muestra quién la subió.<br>• Votos, puntos o premios por iniciativa.<br>• Aviso por WhatsApp o correo: solo el número en el menú.<br>• Convertir una iniciativa en tarea o en pedido de cambio: se hace fuera del sistema. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | una iniciativa abierta | el cocinero escribe un comentario y pulsa «Comentar» | aparece al final con su nombre y su rol; un comentario vacío muestra «Escribe tu comentario» (RQ-INI-01-07) |

Origen: criterios de verificación de FT-INI-01 (RQ-INI-01-07); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (DT-53) Todo el personal ve y comenta; solo el administrador cambia el estado; siempre se muestra quién la subió.<br>**RB-02** (RN-CAP-014) Nada se borra ni se edita.<br>**RNF aplicables:** RNF-CAP-004, RNF-CAP-005, RNF-CAP-009, RNF-CAP-012, RNF-CAP-014. | `Iniciativa` (código IN-NNNN, tipo queja, mejora o idea, área, título, detalle, captura opcional, estado, autor y fecha) · `IniciativaComentario` (texto, autor, fecha). Las capturas van a `Archivo` privado.<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** sin borrado físico: se desactiva o anula (RN-CAP-014); cada cambio guarda autor y fecha. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-191** (Ver, buscar y filtrar las iniciativas del equipo) va antes, dentro de la misma feature.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Iniciativas (menú Operación, para todos los roles) y el cuadro «Nueva iniciativa»; en el Historial de acciones aparece el módulo «iniciativas».<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-INI-01 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-008, ADR-012.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-INI-01 (requerimientos RQ-INI-01-07, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
