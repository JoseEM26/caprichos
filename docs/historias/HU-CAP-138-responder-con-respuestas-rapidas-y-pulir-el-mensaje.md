---
id: HU-CAP-138
tipo: hu
titulo: "Responder con respuestas rápidas y pulir el mensaje"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-015, FT-ATN-01, RQ-ATN-01-05, RQ-ATN-01-06, RQ-ATN-01-07, RQ-ATN-01-08, HU-CAP-136, HU-CAP-137, ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, ADR-009, DEP-02, DEP-06, R-01, R-07]
tags: [hu, atencion, capa-a, ft-atn-01, media, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-138 | Título | Responder con respuestas rápidas y pulir el mensaje |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-015 · FT-ATN-01 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Media | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-002** Cajero/a | responder con respuestas rápidas y pulir el mensaje | responder rápido y con buena ortografía |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-ATN-01 «Consola de chats con dueño único» (Debería tener, épica EP-CAP-015). Cubre los requerimientos: **RQ-ATN-01-05** Un aviso urgente pasa el chat a una persona al instante. **RQ-ATN-01-06** Hay respuestas rápidas y botones para copiar productos y el celular. **RQ-ATN-01-07** «Pulir mensaje» mejora tono y ortografía con vista previa y nunca envía solo. **RQ-ATN-01-08** Desde la consola se registra o rechaza el pago coordinado de un pedido que ya está en cocina. | **Alcance.**<br>• Un aviso urgente pasa el chat a una persona al instante.<br>• Hay respuestas rápidas y botones para copiar productos y el celular.<br>• «Pulir mensaje» mejora tono y ortografía con vista previa y nunca envía solo.<br>• Desde la consola se registra o rechaza el pago coordinado de un pedido que ya está en cocina. |
| **Problema.** Que el bot y las personas no se pisen y que ningún cliente quede sin respuesta. | **Fuera de alcance.**<br>• HU-CAP-136: Ver y filtrar los chats en la consola.<br>• HU-CAP-137: Tomar, soltar y marcar atendido un chat.<br>• Cambios después del pedido: FT-ATN-02.<br>• Encuesta posventa: FT-ATN-03.<br>• Varias cuentas de WhatsApp (un solo número). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un cliente que escribe «urgente» | llega el mensaje | el chat pasa a «Urgente», el bot calla y suena un aviso en el administrativo (RQ-ATN-01-05) |
| CA-2 | un chat | el cajero elige la respuesta rápida «Datos de Yape» | se escribe en el cuadro para revisarla y enviarla (RQ-ATN-01-06) |
| CA-3 | un texto con faltas | el cajero toca «Pulir» | ve la versión mejorada y decide si usarla; no se envía hasta que toque «Enviar» (RQ-ATN-01-07) |
| CA-4 | un chat en «Validar pago» | el cajero registra el pago | el pedido queda pagado y no se reenvía a cocina (FT-BOT-02) (RQ-ATN-01-08) |

Origen: criterios de verificación de FT-ATN-01 (RQ-ATN-01-05, RQ-ATN-01-06, RQ-ATN-01-07, RQ-ATN-01-08); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-111) Pulir mensaje es opcional, con vista previa, nunca envía solo; con IA real tiene costo.<br>**RNF aplicables:** RNF-CAP-010, RNF-CAP-002, RNF-CAP-008, RNF-CAP-015. | `Conversacion` (dueño, tomado por, desde, urgente, atendido) · `RespuestaRapida` · `SolicitudCambio` (pedido, tipo, estado, decisión) · `Encuesta` (pedido, nota, comentario, derivada).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** bloqueo en el servidor ante dos acciones simultáneas sobre el mismo registro; datos personales solo con aceptación registrada. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-137** (Tomar, soltar y marcar atendido un chat) va antes, dentro de la misma feature.<br>• FT-INF-03.<br>• FT-BOT-02.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01, R-07 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Mensajes (consola tipo WhatsApp) (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-ATN-01 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, ADR-009.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-ATN-01 (requerimientos RQ-ATN-01-05, RQ-ATN-01-06, RQ-ATN-01-07, RQ-ATN-01-08, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
