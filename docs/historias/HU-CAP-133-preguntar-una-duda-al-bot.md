---
id: HU-CAP-133
tipo: hu
titulo: "Preguntar una duda al bot"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-014, FT-BOT-03, RQ-BOT-03-01, RQ-BOT-03-02, RQ-BOT-03-03, RQ-BOT-03-04, HU-CAP-134, HU-CAP-135, ADR-001, ADR-011, ADR-014, ADR-007, ADR-009, DEP-02, DEP-06, DEP-12, R-01, R-04, R-07]
tags: [hu, chatbot, capa-a, ft-bot-03, media, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-133 | Título | Preguntar una duda al bot |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-014 · FT-BOT-03 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Media | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-006** Clientes | preguntar una duda al bot | resolver mis dudas al instante |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-BOT-03 «IA para dudas y recomendaciones» (Debería tener, épica EP-CAP-014). Cubre los requerimientos: **RQ-BOT-03-01** La IA responde dudas sobre productos, horario y ubicación con datos del sistema. **RQ-BOT-03-02** La IA recomienda solo productos disponibles. **RQ-BOT-03-03** La IA no toma pedidos: lleva al flujo de botones. **RQ-BOT-03-04** La IA no inventa precios ni promociones: los toma del sistema o dice que no sabe. | **Alcance.**<br>• La IA responde dudas sobre productos, horario y ubicación con datos del sistema.<br>• La IA recomienda solo productos disponibles.<br>• La IA no toma pedidos: lleva al flujo de botones.<br>• La IA no inventa precios ni promociones: los toma del sistema o dice que no sabe. |
| **Problema.** Respuestas rápidas y correctas sin el costo ni los errores del bot actual (casi US$ 10 en 3 días, R-07). | **Fuera de alcance.**<br>• HU-CAP-134: Pedir una reserva por WhatsApp.<br>• HU-CAP-135: Pedir hablar con una persona.<br>• Pedido: FT-BOT-01.<br>• Consola de chats: FT-ATN-01.<br>• Elección del modelo y proveedor de IA: ADR en el Bloque 4. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | «¿el frappé de Oreo lleva café?» | el cliente pregunta | la IA responde según la descripción del producto en la carta (RQ-BOT-03-01) |
| CA-2 | un producto agotado | el cliente pide una recomendación | la IA no lo menciona (RQ-BOT-03-02) |
| CA-3 | «quiero 2 frappés» | lo escribe el cliente | la IA responde con el botón «Hacer pedido» y no arma el carrito (RQ-BOT-03-03) |
| CA-4 | una pregunta por una promoción que no existe | el cliente la hace | la IA dice que no hay esa promoción y muestra las vigentes (RQ-BOT-03-04) |

Origen: criterios de verificación de FT-BOT-03 (RQ-BOT-03-01, RQ-BOT-03-02, RQ-BOT-03-03, RQ-BOT-03-04); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-049) La IA consulta disponibilidad para recomendar; el pedido va por botones.<br>**RB-02** (DT-18) IA solo para dudas y recomendaciones.<br>**RNF aplicables:** RNF-CAP-015, RNF-CAP-016, RNF-CAP-008. | `Conversacion` (teléfono, dueño bot o persona, estado) · `MensajeChat` · `CarritoBot` · `SolicitudReserva` · `ComprobantePago` (imagen, pedido, estado) · `UsoIA` y `UsoPlantilla` (costo).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** datos personales solo con aceptación registrada. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • DEP-12.<br>• FT-CAR-02.<br>• FT-BOT-01.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-07, R-01, R-04 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Chatbot ▸ simulador (dudas, reserva, hablar con una persona); administrativo ▸ avisos (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-BOT-03 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-007, ADR-009.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-BOT-03 (requerimientos RQ-BOT-03-01, RQ-BOT-03-02, RQ-BOT-03-03, RQ-BOT-03-04, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
