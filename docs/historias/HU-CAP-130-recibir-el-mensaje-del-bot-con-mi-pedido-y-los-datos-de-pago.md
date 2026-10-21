---
id: HU-CAP-130
tipo: hu
titulo: "Recibir el mensaje del bot con mi pedido y los datos de pago"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-014, FT-BOT-02, RQ-BOT-02-01, RQ-BOT-02-02, HU-CAP-131, HU-CAP-132, ADR-001, ADR-011, ADR-014, ADR-007, ADR-009, D-08, DEP-02, DEP-06, DEP-12, R-01, R-04]
tags: [hu, chatbot, capa-a, ft-bot-02, media, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-130 | Título | Recibir el mensaje del bot con mi pedido y los datos de pago |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-014 · FT-BOT-02 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Media | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-006** Clientes | recibir del bot el resumen de mi pedido y los datos para pagarlo | saber cuánto y cómo pagar mi pedido de la carta |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-BOT-02 «Pago por WhatsApp con aprobación» (Debería tener, épica EP-CAP-014). Cubre los requerimientos: **RQ-BOT-02-01** Al llegar un pedido de la carta, el bot escribe al cliente con el resumen y le pregunta cómo paga. **RQ-BOT-02-02** El bot envía los datos de pago del medio elegido y el monto. | **Alcance.**<br>• Al llegar un pedido de la carta, el bot escribe al cliente con el resumen y le pregunta cómo paga.<br>• El bot envía los datos de pago del medio elegido y el monto. |
| **Problema.** Confirmar pagos sin que caja escriba cada mensaje a mano, y sin que el bot decida solo. | **Fuera de alcance.**<br>• HU-CAP-131: Enviar mi captura y esperar la aprobación.<br>• HU-CAP-132: Aprobar o rechazar un pago desde la consola.<br>• Verificación automática del pago con Yape o el banco (no hay integración, DT-11).<br>• Consola de chats: FT-ATN-01. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un pedido de la carta | entra | el cliente recibe la plantilla con productos, opciones, entrega y total, y botones de medios de pago (RQ-BOT-02-01) |
| CA-2 | Yape elegido | el cliente toca «Yape» | recibe el número, el nombre del titular y el monto a pagar, leídos de Configuración del local (RQ-BOT-02-02) |

Origen: criterios de verificación de FT-BOT-02 (RQ-BOT-02-01, RQ-BOT-02-02); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-043) Al entrar un pedido web, el chatbot escribe al teléfono del cliente.<br>**RNF aplicables:** RNF-CAP-015, RNF-CAP-016, RNF-CAP-009, RNF-CAP-008. | `Conversacion` (teléfono, dueño bot o persona, estado) · `MensajeChat` · `CarritoBot` · `SolicitudReserva` · `ComprobantePago` (imagen, pedido, estado) · `UsoIA` y `UsoPlantilla` (costo).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** cada cambio guarda autor y fecha; datos personales solo con aceptación registrada. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • DEP-12 (D-08).<br>• FT-CFG-02.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-04, R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Chatbot ▸ simulador; administrativo ▸ Mensajes ▸ «Validar pago» (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-BOT-02 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-007, ADR-009.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; dependen de decisiones abiertas D-08 | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-BOT-02 (requerimientos RQ-BOT-02-01, RQ-BOT-02-02, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
