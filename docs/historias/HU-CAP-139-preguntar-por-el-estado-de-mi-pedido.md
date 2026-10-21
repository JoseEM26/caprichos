---
id: HU-CAP-139
tipo: hu
titulo: "Preguntar por el estado de mi pedido"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-015, FT-ATN-02, RQ-ATN-02-01, HU-CAP-140, HU-CAP-141, ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, ADR-009, DEP-02, DEP-06, R-01]
tags: [hu, atencion, capa-a, ft-atn-02, media, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-139 | Título | Preguntar por el estado de mi pedido |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-015 · FT-ATN-02 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Media | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-006** Clientes | preguntar por el estado de mi pedido | saber cuánto falta para mi pedido sin llamar |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-ATN-02 «Cambios después del pedido y derivación» (Debería tener, épica EP-CAP-015). Cubre el requerimiento: **RQ-ATN-02-01** El cliente pregunta cuánto falta y el bot responde según el estado del pedido. | **Alcance.**<br>• El cliente pregunta cuánto falta y el bot responde según el estado del pedido. |
| **Problema.** Que el cliente sepa cómo va su pedido sin llamar, y que los cambios no se pierdan. | **Fuera de alcance.**<br>• HU-CAP-140: Pedir un cambio y que lo decida un asesor.<br>• HU-CAP-141: Derivar a una persona un mensaje no entendido.<br>• Cancelar un pedido desde el bot (propuesta: también como solicitud).<br>• Consola: FT-ATN-01. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un pedido en cocina hace 8 minutos con tiempo prometido de 13 | el cliente pregunta | el bot dice «Está en preparación, unos 5 minutos» (RQ-ATN-02-01) |

Origen: criterios de verificación de FT-ATN-02 (RQ-ATN-02-01); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-105) El chatbot no cambia pedidos: registra y avisa; en camino no se cambia la dirección y el aviso es urgente.<br>**RNF aplicables:** RNF-CAP-016, RNF-CAP-009. | `Conversacion` (dueño, tomado por, desde, urgente, atendido) · `RespuestaRapida` · `SolicitudCambio` (pedido, tipo, estado, decisión) · `Encuesta` (pedido, nota, comentario, derivada).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** cada cambio guarda autor y fecha. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Chatbot ▸ simulador (estado, cambio, persona); administrativo ▸ Mensajes y Pedidos (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-ATN-02 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, ADR-009.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-ATN-02 (requerimientos RQ-ATN-02-01, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
