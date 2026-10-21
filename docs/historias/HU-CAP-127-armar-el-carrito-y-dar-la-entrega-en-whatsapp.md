---
id: HU-CAP-127
tipo: hu
titulo: "Armar el carrito y dar la entrega en WhatsApp"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-014, FT-BOT-01, RQ-BOT-01-03, RQ-BOT-01-04, RQ-BOT-01-09, RQ-BOT-01-10, HU-CAP-126, HU-CAP-128, HU-CAP-129, ADR-001, ADR-011, ADR-014, ADR-007, ADR-009, DEP-02, DEP-06, R-01, R-07]
tags: [hu, chatbot, capa-a, ft-bot-01, media, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-127 | Título | Armar el carrito y dar la entrega en WhatsApp |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-014 · FT-BOT-01 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Media | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-006** Clientes | armar el carrito y dar la entrega en WhatsApp | pedir varios productos y decir dónde los quiero, desde WhatsApp |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-BOT-01 «Pedido por botones» (Debería tener, épica EP-CAP-014). Cubre los requerimientos: **RQ-BOT-01-03** El bot arma un carrito con varios productos, muestra el resumen y permite quitar o seguir pidiendo. **RQ-BOT-01-04** El bot pide modalidad, ubicación o dirección y calcula el envío por zona. | **Alcance.**<br>• El bot arma un carrito con varios productos, muestra el resumen y permite quitar o seguir pidiendo.<br>• El bot pide modalidad, ubicación o dirección y calcula el envío por zona. |
| **Problema.** Atender por WhatsApp sin errores de precios ni cobros olvidados (el bot actual a veces omite el delivery, R-07). | **Fuera de alcance.**<br>• HU-CAP-126: Elegir productos y opciones con botones en WhatsApp.<br>• HU-CAP-128: Enviar el pedido del bot a caja.<br>• HU-CAP-129: Pasar a una persona cuando el bot no entiende.<br>• Pago por WhatsApp: FT-BOT-02.<br>• IA para dudas: FT-BOT-03.<br>• Consola de chats: FT-ATN-01.<br>• Preferencias guardadas del cliente en el bot (horizonte futuro). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | dos productos agregados | el cliente pide «Ver carrito» | ve los dos con su total y botones «Agregar más», «Quitar» y «Terminar» (RQ-BOT-01-03) |
| CA-2 | un delivery | el cliente comparte su ubicación de WhatsApp | el bot calcula el envío; si escribe solo la dirección, el envío queda por calcular para el asesor (RQ-BOT-01-04) |
| CA-3 | un enlace de Google Maps con coordenadas | el cliente lo manda por WhatsApp | el pedido guarda el punto y la zona, y el bot responde con el costo de envío (RQ-BOT-01-09) |
| CA-4 | un enlace sin coordenadas o solo texto | el cliente lo manda | el bot pide la ubicación con el clip de WhatsApp y no calcula el envío; si no la manda, el asesor ubica el pedido (RQ-BOT-01-10) |

Origen: criterios de verificación de FT-BOT-01 (RQ-BOT-01-03, RQ-BOT-01-04, RQ-BOT-01-09, RQ-BOT-01-10); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-005) El chatbot ofrece las mismas opciones, precios y reglas que la carta.<br>**RB-02** (RN-CAP-049) La IA consulta la disponibilidad para recomendar; el pedido siempre va por botones.<br>**RB-03** (RN-CAP-076) El chatbot no pide pagar ni enviar capturas al hacer el pedido.<br>**RNF aplicables:** RNF-CAP-016, RNF-CAP-015, RNF-CAP-011, RNF-CAP-003. | `Conversacion` (teléfono, dueño bot o persona, estado) · `MensajeChat` · `CarritoBot` · `SolicitudReserva` · `ComprobantePago` (imagen, pedido, estado) · `UsoIA` y `UsoPlantilla` (costo).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** montos en soles con dos decimales. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-126** (Elegir productos y opciones con botones en WhatsApp) va antes, dentro de la misma feature.<br>• FT-DEL-01.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01, R-07 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Chatbot ▸ simulador de WhatsApp (`Chatbot.dc.html` o tablero del bot del mockup); `legacy/capri-bot/` (bot actual).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-BOT-01 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-007, ADR-009.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-BOT-01 (requerimientos RQ-BOT-01-03, RQ-BOT-01-04, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
