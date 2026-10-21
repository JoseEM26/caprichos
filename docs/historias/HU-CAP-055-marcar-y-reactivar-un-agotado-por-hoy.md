---
id: HU-CAP-055
tipo: hu
titulo: "Marcar y reactivar un agotado por hoy"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-006, FT-COC-03, RQ-COC-03-01, RQ-COC-03-02, RQ-COC-03-03, RQ-COC-03-04, HU-CAP-056, HU-CAP-057, ADR-001, ADR-011, ADR-014, ADR-002, ADR-006, ADR-007, DEP-02, DEP-06, R-01]
tags: [hu, cocina, capa-a, ft-coc-03, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-055 | Título | Marcar y reactivar un agotado por hoy |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-006 · FT-COC-03 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-003** Cocina y barra | marcar y reactivar un agotado por hoy | dejar de recibir pedidos de lo que se acabó hoy |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-COC-03 «Agotado por hoy y alta demanda» (Debe tener, épica EP-CAP-006). Cubre los requerimientos: **RQ-COC-03-01** Cocina marca un producto, sabor u opción como agotado por hoy con Sí/No. **RQ-COC-03-02** Un agotado se apaga al momento en la carta, Nuevo pedido y el chatbot. **RQ-COC-03-03** El agotado por hoy vuelve solo al cambiar el día en Lima. **RQ-COC-03-04** Cocina puede volver a ofrecer un agotado antes del día siguiente. | **Alcance.**<br>• Cocina marca un producto, sabor u opción como agotado por hoy con Sí/No.<br>• Un agotado se apaga al momento en la carta, Nuevo pedido y el chatbot.<br>• El agotado por hoy vuelve solo al cambiar el día en Lima.<br>• Cocina puede volver a ofrecer un agotado antes del día siguiente. |
| **Problema.** Evita prometer lo que no hay y tiempos que no se cumplen en hora punta. | **Fuera de alcance.**<br>• HU-CAP-056: Agotar un producto desde Productos.<br>• HU-CAP-057: Activar Alta demanda y pausar pedidos.<br>• Agotado automático por stock: FT-STK-03.<br>• Cómo la carta muestra agotados y pausa: FT-CAR-02. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | el frappé de fresa | Bebidas lo marca agotado por hoy y confirma | queda en la lista de agotados con autor y hora (RQ-COC-03-01) |
| CA-2 | un producto recién agotado | un cliente tiene la carta abierta | lo ve apagado sin recargar; el chatbot ya no lo ofrece (RQ-COC-03-02) |
| CA-3 | un producto agotado por hoy | pasan las 00:00 de Lima | vuelve a ofrecerse sin que nadie lo active (RQ-COC-03-03) |
| CA-4 | un producto agotado por hoy | Bebidas lo reactiva con Sí/No | vuelve a la carta al momento (RQ-COC-03-04) |
| CA-5 | la confirmación Sí/No de la acción | quien la hace responde «No» | no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) |

Origen: criterios de verificación de FT-COC-03 (RQ-COC-03-01, RQ-COC-03-02, RQ-COC-03-03, RQ-COC-03-04); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-017) Un producto agotado deja de ofrecerse en la carta y el chatbot.<br>**RB-02** (RN-CAP-085 (1.ª)) Agotado por hoy vence al cambiar la fecha; agotado desde Productos dura hasta reactivarlo (id repetido, O1).<br>**RNF aplicables:** RNF-CAP-002, RNF-CAP-019, RNF-CAP-009, RNF-CAP-012. | `AreaCocina` (nombre, activa, propia, máximo 4 propias) · `Categoria.area` · `ComandaArea` (pedido, área, estado, horas) · `Agotado` (producto, sabor u opción, alcance hoy o indefinido, autor) · `AltaDemanda` (minutos, pausa) · `Impresion` (tipo, área, estado, intentos) · `LlaveTV`.<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** cada cambio guarda autor y fecha. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • FT-CAR-02 · FT-BOT-01.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Cocina ▸ Agotados y Alta demanda; Productos ▸ agotado (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-COC-03 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-002, ADR-006, ADR-007.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-COC-03 (requerimientos RQ-COC-03-01, RQ-COC-03-02, RQ-COC-03-03, RQ-COC-03-04, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
