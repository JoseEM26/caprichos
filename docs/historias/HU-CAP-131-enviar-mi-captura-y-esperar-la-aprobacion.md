---
id: HU-CAP-131
tipo: hu
titulo: "Enviar mi captura y esperar la aprobación"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-014, FT-BOT-02, RQ-BOT-02-03, RQ-BOT-02-04, RQ-BOT-02-05, HU-CAP-130, HU-CAP-132, ADR-001, ADR-011, ADR-014, ADR-007, ADR-009, DEP-02, DEP-06, R-01]
tags: [hu, chatbot, capa-a, ft-bot-02, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-131 | Título | Enviar mi captura y esperar la aprobación |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-014 · FT-BOT-02 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-006** Clientes | enviar mi captura y esperar la aprobación | que confirmen mi pago y empiecen a preparar mi pedido |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-BOT-02 «Pago por WhatsApp con aprobación» (Debería tener, épica EP-CAP-014). Cubre los requerimientos: **RQ-BOT-02-03** El bot recibe la captura y deja el chat en «Validar pago». **RQ-BOT-02-04** Una persona registra o rechaza el comprobante; el bot nunca lo hace y el pedido no vuelve a cocina. **RQ-BOT-02-05** Un delivery sin ubicación se cocina, pero no sale a reparto hasta que caja lo ubique. | **Alcance.**<br>• El bot recibe la captura y deja el chat en «Validar pago».<br>• Una persona registra o rechaza el comprobante; el bot nunca lo hace y el pedido no vuelve a cocina.<br>• Un delivery sin ubicación se cocina, pero no sale a reparto hasta que caja lo ubique. |
| **Problema.** Confirmar pagos sin que caja escriba cada mensaje a mano, y sin que el bot decida solo. | **Fuera de alcance.**<br>• HU-CAP-130: Recibir el mensaje del bot con mi pedido y los datos de pago.<br>• HU-CAP-132: Aprobar o rechazar un pago desde la consola.<br>• Verificación automática del pago con Yape o el banco (no hay integración, DT-11).<br>• Consola de chats: FT-ATN-01. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | una imagen enviada por el cliente | llega | se adjunta al pedido y el chat aparece en «Validar pago» con aviso a caja (RQ-BOT-02-03) |
| CA-2 | un chat en «Validar pago» | el cajero registra el pago con Sí/No | el pedido queda pagado sin volver a cocina; si lo rechaza, el bot avisa el motivo y caja decide si anula con motivo y el PIN de la supervisora (RQ-BOT-02-04) |
| CA-3 | un delivery solo con dirección escrita | el repartidor intenta tomarlo | ve «Falta ubicar» y caja lo ubica en el mapa desde el chat (RQ-BOT-02-05) |
| CA-4 | la confirmación Sí/No de la acción | quien la hace responde «No» | no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) |

Origen: criterios de verificación de FT-BOT-02 (RQ-BOT-02-03, RQ-BOT-02-04, RQ-BOT-02-05); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-101) El bot no verifica comprobantes ni manda a cocina; un delivery sin ubicación no se aprueba.<br>**RNF aplicables:** RNF-CAP-015, RNF-CAP-016, RNF-CAP-009, RNF-CAP-008. | `Conversacion` (teléfono, dueño bot o persona, estado) · `MensajeChat` · `CarritoBot` · `SolicitudReserva` · `ComprobantePago` (imagen, pedido, estado) · `UsoIA` y `UsoPlantilla` (costo).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** cada cambio guarda autor y fecha; datos personales solo con aceptación registrada. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-130** (Recibir el mensaje del bot con mi pedido y los datos de pago) va antes, dentro de la misma feature.<br>• FT-ATN-01.<br>• FT-CAJ-01.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Chatbot ▸ simulador; administrativo ▸ Mensajes ▸ «Validar pago» (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-BOT-02 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-007, ADR-009.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-BOT-02 (requerimientos RQ-BOT-02-03, RQ-BOT-02-04, RQ-BOT-02-05, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
