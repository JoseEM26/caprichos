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

**Descripción.** Al llegar un pedido de la carta, el bot **escribe primero** al cliente con el **resumen del pedido**, le pregunta cómo paga, le envía los **datos de pago y el monto**, y espera la **captura** (NEC-CAP-090). Ese primer mensaje es una plantilla de WhatsApp y se cobra; las respuestas dentro de las 24 horas siguientes al mensaje del cliente son gratis (RN-CAP-100). **Desde el acta 03 el pago ya no frena la cocina** (DT-57, DT-71): el pedido de la carta o del bot está en cocina desde que el cliente lo envía, y el pago **se coordina después**. El chat queda en **«Validar pago»** y una persona (administrador, cajero, mozo o call center) **registra o rechaza** el comprobante; el pedido no vuelve a cocina. El bot **no verifica** que un comprobante sea verdadero. Si el cliente no paga, caja anula con motivo y el PIN de la supervisora (DT-61). Un delivery sin ubicación se cocina igual, pero no sale a reparto hasta que caja lo ubique. Con efectivo o tarjeta se cobra al entregar o recoger, sin aprobación previa. El bot también envía los **avisos de reparto** (DT-60, DT-74) como plantillas de la API de Meta, que José ya tiene (DT-72).

**Beneficio esperado.** Confirmar pagos sin que caja escriba cada mensaje a mano, y sin que el bot decida solo. Hipótesis medible: **0 pedidos pasados a cocina sin aprobación de una persona**; **tiempo de confirmación medio medido** (meta con D-05).

**Usuarios / roles.** Chatbot de WhatsApp, sistema (escribe, pide el pago y recibe la captura) · ACT-CAP-002 Cajero/a (aprueba o rechaza) · ACT-CAP-004 Mozos (aprueba o rechaza) · Call center (aún sin código ACT en el BRD) (aprueba o rechaza) · ACT-CAP-006 Clientes (paga y envía la captura).

**Pantallas de referencia.** Chatbot ▸ simulador; administrativo ▸ Mensajes ▸ «Validar pago» (`Admin.dc.html`) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-BOT-02-01 | Al llegar un pedido de la carta, el bot escribe al cliente con el resumen, el método de pago que eligió y que ya está en cocina. | Debería tener | NEC-CAP-090 · RN-CAP-043 · DT-57 | Dado un pedido de la carta con Yape, cuando entra, entonces el cliente recibe la plantilla con productos, opciones, entrega, total, «Método de pago: Yape» y «Tu pedido ya está en cocina; un asesor te escribe para coordinar el pago». | Propuesto |
| RQ-BOT-02-02 | El bot envía los datos de pago del medio elegido y el monto. | Debería tener | NEC-CAP-090 | Dado Yape elegido, cuando el cliente toca «Yape», entonces recibe el número, el nombre del titular y el monto a pagar, leídos de Configuración del local. | Propuesto |
| RQ-BOT-02-03 | El bot recibe la captura y deja el chat en «Validar pago». | Debería tener | NEC-CAP-090 | Dada una imagen enviada por el cliente, cuando llega, entonces se adjunta al pedido y el chat aparece en «Validar pago» con aviso a caja. | Propuesto |
| RQ-BOT-02-04 | Una persona registra o rechaza el comprobante; el bot nunca lo hace y el pedido no vuelve a cocina. | Debería tener | RN-CAP-101 · DT-57 | Dado un chat en «Validar pago», cuando el cajero registra el pago con Sí/No, entonces el pedido queda pagado sin volver a cocina; si lo rechaza, el bot avisa el motivo y caja decide si anula con motivo y el PIN de la supervisora. | Propuesto |
| RQ-BOT-02-05 | Un delivery sin ubicación se cocina, pero no sale a reparto hasta que caja lo ubique. | Debe tener | RN-CAP-104 · DT-57 | Dado un delivery solo con dirección escrita, cuando el repartidor intenta tomarlo, entonces ve «Falta ubicar» y caja lo ubica en el mapa desde el chat. | Propuesto |
| RQ-BOT-02-06 | Con efectivo o tarjeta se cobra al entregar o recoger, sin aprobación previa. | Debería tener | RN-CAP-075 · DT-57 | Dado efectivo elegido, cuando el cliente dice con cuánto paga, entonces se guarda para el vuelto del repartidor y el pedido sigue en cocina sin esperar a nadie. | Propuesto |
| RQ-BOT-02-07 | Se registra el costo de cada plantilla enviada. | Debería tener | RN-CAP-100 · RNF-CAP-015 | Dado un mes, cuando el administrador revisa el costo del bot, entonces ve cuántas plantillas se enviaron y su costo estimado. | Propuesto |
| RQ-BOT-02-08 | Si el pago no se coordina en un tiempo, caja recibe un recordatorio; el pedido no se anula solo. | Debería tener | D-05 · DT-57 | Dado un pedido con el pago por coordinar sin respuesta del cliente en 10 minutos, cuando pasa el tiempo, entonces caja recibe un aviso y el pedido sigue en cocina. | Propuesto |
| RQ-BOT-02-09 | El bot envía los 3 avisos de reparto como plantillas de Meta con botones de respuesta, y la respuesta del cliente corta los siguientes. | Debería tener | DT-60 · DT-72 · DT-74 | Dado un repartidor que pulsa «En camino», cuando sale el mensaje 1, entonces el cliente lo recibe como plantilla con los botones «Estoy atento» y «No estoy»; si responde, no se envían los mensajes 2 y 3 y el repartidor ve la respuesta. | Propuesto |

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
| RN-CAP-101 | El bot no verifica comprobantes. Que el pago se aprobaba antes de cocina queda **reemplazado por DT-57 y DT-71**: el pedido va directo a cocina. | Pagos |
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
| RQ-BOT-02-09 | HU-CAP-130 | FT-DEL-02 · D-08 | R-04 |

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
