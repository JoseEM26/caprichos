---
id: FT-BOT-02
tipo: spec
titulo: "Pago por WhatsApp con aprobación"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-014, FT-BOT-01, FT-PED-03, FT-CAJ-01, FT-ATN-01, ADR-001, ADR-011, ADR-014, ADR-007, ADR-009, NEC-CAP-090, RN-CAP-043, RN-CAP-100, RN-CAP-101]
tags: [chatbot, plt-03, ep-cap-014, ft-bot-02, deberia-tener]
---

# FT-BOT-02 — Pago por WhatsApp con aprobación

**PLT-03 · Feature · Catálogo de requerimientos** · Frente CHATBOT · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-BOT-02 | Pago por WhatsApp con aprobación | EP-CAP-014 Chatbot: pedido y pago por WhatsApp |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debería tener** (NEC-CAP-090) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H2 · 01/03/2027 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** Al llegar un pedido de la carta, el bot **escribe primero** al cliente con el **resumen del pedido**, le pregunta cómo paga, le envía los **datos de pago y el monto**, y espera la **captura** (NEC-CAP-090). Ese primer mensaje es una plantilla de WhatsApp y se cobra; las respuestas dentro de las 24 horas siguientes al mensaje del cliente son gratis (RN-CAP-100). El chat queda en **«Validar pago»** en la consola, y una persona (administrador, cajero, mozo o call center) **aprueba o rechaza** el comprobante; al aprobar, el pedido pasa a cocina (RN-CAP-101). El bot **no verifica** que un comprobante sea verdadero ni manda un pedido a cocina por sí solo. Un delivery sin ubicación no se puede aprobar. Con efectivo o tarjeta, el bot confirma el pedido para pagar al entregar o recoger, también con aprobación de una persona.

**Beneficio esperado.** Confirmar pagos sin que caja escriba cada mensaje a mano, y sin que el bot decida solo. Hipótesis medible: **0 pedidos pasados a cocina sin aprobación de una persona**; **tiempo de confirmación medio medido** (meta con D-05).

**Usuarios / roles.** Chatbot de WhatsApp, sistema (escribe, pide el pago y recibe la captura) · ACT-CAP-002 Cajero/a (aprueba o rechaza) · ACT-CAP-004 Mozos (aprueba o rechaza) · Call center (aún sin código ACT en el BRD) (aprueba o rechaza) · ACT-CAP-006 Clientes (paga y envía la captura).

**Pantallas de referencia.** Chatbot ▸ simulador; administrativo ▸ Mensajes ▸ «Validar pago» (`Admin.dc.html`) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-BOT-02-01 | Al llegar un pedido de la carta, el bot escribe al cliente con el resumen y le pregunta cómo paga. | Debería tener | NEC-CAP-090 · RN-CAP-043 · RN-CAP-081 (1.ª) | Dado un pedido de la carta, cuando entra, entonces el cliente recibe la plantilla con productos, opciones, entrega y total, y botones de medios de pago. | Propuesto |
| RQ-BOT-02-02 | El bot envía los datos de pago del medio elegido y el monto. | Debería tener | NEC-CAP-090 | Dado Yape elegido, cuando el cliente toca «Yape», entonces recibe el número, el nombre del titular y el monto a pagar, leídos de Configuración del local. | Propuesto |
| RQ-BOT-02-03 | El bot recibe la captura y deja el chat en «Validar pago». | Debería tener | NEC-CAP-090 | Dada una imagen enviada por el cliente, cuando llega, entonces se adjunta al pedido y el chat aparece en «Validar pago» con aviso a caja. | Propuesto |
| RQ-BOT-02-04 | Una persona aprueba o rechaza el comprobante; el bot nunca lo hace. | Debería tener | RN-CAP-101 | Dado un chat en «Validar pago», cuando el cajero aprueba con Sí/No, entonces el pedido pasa a cocina con el comprobante; al rechazar, el bot avisa al cliente el motivo. | Propuesto |
| RQ-BOT-02-05 | Un delivery sin ubicación no se puede aprobar. | Debe tener | RN-CAP-101 · RN-CAP-104 | Dado un delivery solo con dirección escrita, cuando el cajero intenta aprobar, entonces ve «Ubica el pedido primero». | Propuesto |
| RQ-BOT-02-06 | Con efectivo o tarjeta, el bot confirma el pedido para pagar al entregar, con aprobación de una persona. | Debería tener | RN-CAP-075 | Dado efectivo elegido, cuando el cliente dice con cuánto paga, entonces el chat queda «Por aprobar» y la persona lo confirma sin comprobante. | Propuesto |
| RQ-BOT-02-07 | Se registra el costo de cada plantilla enviada. | Debería tener | RN-CAP-100 · RNF-CAP-015 | Dado un mes, cuando el administrador revisa el costo del bot, entonces ve cuántas plantillas se enviaron y su costo estimado. | Propuesto |
| RQ-BOT-02-08 | Si el cliente no responde en un tiempo, caja recibe un recordatorio; el pedido no se anula solo. | Debería tener | D-05 | Dado un pedido sin respuesta del cliente en 10 minutos, cuando pasa el tiempo, entonces caja recibe un aviso y el pedido sigue en la cola. | Propuesto |

Prioridad *Debería tener* por la épica. RQ-BOT-02-05 es *Debe tener* (RN-CAP-104). Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-015 | Costo | El uso de IA y de plantillas de WhatsApp se registra y tiene un tope mensual configurable. | Costo mensual visible · alerta al 80 % del tope (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-016 | Rendimiento | El chatbot responde a un botón o mensaje sin demora perceptible. | Respuesta ≤ 5 s (p90) (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-009 | Auditoría | Toda acción que cambia datos guarda quién la hizo y cuándo. | 100 % de cambios con autor y fecha (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-008 | Datos personales | El DNI, el teléfono y la ubicación se guardan con aceptación registrada y el DNI se muestra enmascarado en listas (Ley 29733). | 0 datos personales sin aceptación · 0 DNI completos en listas (umbral propuesto) | Debería tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-008 aplica a las capturas de pago, que pueden mostrar datos de la cuenta del cliente.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-043 | Al entrar un pedido web, el chatbot escribe al teléfono del cliente. | Acta 02 |
| RN-CAP-075 | Con Yape, Plin o transferencia se sube el comprobante; se guarda quién confirmó. | Reunión del 18/10 |
| RN-CAP-100 | El primer mensaje es plantilla y se cobra; las respuestas en 24 horas son gratis. | Costos |
| RN-CAP-101 | El bot no verifica comprobantes ni manda a cocina; un delivery sin ubicación no se aprueba. | Pagos |
| DT-17 | La carta y el chatbot no cobran: informan y una persona confirma. | decisiones.md |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-BOT-02-01 | HU-CAP-130 | DEP-12 (D-08) | R-04 |
| RQ-BOT-02-02 | HU-CAP-130 | FT-CFG-02 | R-01 |
| RQ-BOT-02-03 | HU-CAP-131 | FT-ATN-01 | R-01 |
| RQ-BOT-02-04 | HU-CAP-131 | FT-CAJ-01 | R-01 |
| RQ-BOT-02-05 | HU-CAP-131 | FT-CAJ-01 | R-01 |
| RQ-BOT-02-06 | HU-CAP-132 | — | R-01 |
| RQ-BOT-02-07 | HU-CAP-132 | D-08 | R-01 |
| RQ-BOT-02-08 | HU-CAP-132 | D-05 | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-130 Recibir el mensaje del bot con mi pedido y los datos de pago
- HU-CAP-131 Enviar mi captura y esperar la aprobación
- HU-CAP-132 Aprobar o rechazar un pago desde la consola

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-007, ADR-009.

**Fuera de alcance**

- Verificación automática del pago con Yape o el banco (no hay integración, DT-11).
- Consola de chats: FT-ATN-01.

**Preguntas abiertas**

1. **Costo de plantillas en Perú** — D-08.
2. **¿El pedido de la carta también puede confirmarse sin el bot?** Sí: caja lo confirma por WhatsApp a mano (FT-CAJ-01).

---

Generado por IA: BRD (NEC-CAP-090; RN-CAP-043, 075, 081, 100, 101, 104), DT-17, D-05, D-08 y el mockup del chatbot — Revisado por: *(pendiente)*
