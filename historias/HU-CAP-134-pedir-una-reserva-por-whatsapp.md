---
id: HU-CAP-134
tipo: hu
titulo: "Pedir una reserva por WhatsApp"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-014, FT-BOT-03, RQ-BOT-03-05, HU-CAP-133, HU-CAP-135, ADR-001, ADR-011, ADR-014, ADR-007, ADR-009, DEP-02, DEP-06, R-01]
tags: [hu, chatbot, capa-a, ft-bot-03, media, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-134 | Título | Pedir una reserva por WhatsApp |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-014 · FT-BOT-03 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Media | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-006** Clientes | pedir una reserva por WhatsApp | reservar una mesa sin llamar |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-BOT-03 «IA para dudas y recomendaciones» (Debería tener, épica EP-CAP-014). Cubre el requerimiento: **RQ-BOT-03-05** El bot toma solicitudes de reserva que un mozo o cajero aprueba. | **Alcance.**<br>• El bot toma solicitudes de reserva que un mozo o cajero aprueba. |
| **Problema.** Respuestas rápidas y correctas sin el costo ni los errores del bot actual (casi US$ 10 en 3 días, R-07). | **Fuera de alcance.**<br>• HU-CAP-133: Preguntar una duda al bot.<br>• HU-CAP-135: Pedir hablar con una persona.<br>• Pedido: FT-BOT-01.<br>• Consola de chats: FT-ATN-01.<br>• Elección del modelo y proveedor de IA: ADR en el Bloque 4. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | «reserva para 6 a las 8» | el cliente confirma | queda una solicitud en el administrativo; al aprobarla, se crea la reserva (FT-SAL-03) y el bot avisa al cliente (RQ-BOT-03-05) |

Origen: criterios de verificación de FT-BOT-03 (RQ-BOT-03-05); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-047) Una reserva por WhatsApp es una solicitud que aprueba un mozo o cajero.<br>**RNF aplicables:** RNF-CAP-015, RNF-CAP-016, RNF-CAP-008. | `Conversacion` (teléfono, dueño bot o persona, estado) · `MensajeChat` · `CarritoBot` · `SolicitudReserva` · `ComprobantePago` (imagen, pedido, estado) · `UsoIA` y `UsoPlantilla` (costo).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** datos personales solo con aceptación registrada. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-133** (Preguntar una duda al bot) va antes, dentro de la misma feature.<br>• FT-SAL-03.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Chatbot ▸ simulador (dudas, reserva, hablar con una persona); administrativo ▸ avisos (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-BOT-03 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-007, ADR-009.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-BOT-03 (requerimientos RQ-BOT-03-05, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
