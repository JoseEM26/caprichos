---
id: FT-PED-03
tipo: spec
titulo: "Envío del pedido a caja y aviso al cliente"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-002, FT-PED-01, FT-CAJ-01, FT-BOT-02, FT-INF-03, ADR-001, ADR-011, ADR-014, ADR-003, ADR-005, ADR-009, ADR-010, NEC-CAP-001, NEC-CAP-086, NEC-CAP-090, RN-CAP-043, RN-CAP-074]
tags: [pedido, plt-03, ep-cap-002, ft-ped-03, debe-tener]
---

# FT-PED-03 — Envío del pedido a caja y aviso al cliente

**PLT-03 · Feature · Catálogo de requerimientos** · Frente PEDIDO · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-PED-03 | Envío del pedido a caja y aviso al cliente | EP-CAP-002 Pedido del cliente en la carta |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debe tener** (NEC-CAP-001 · NEC-CAP-086) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H1 · piloto en el local · 28/12/2026 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** Al enviar, el pedido de la carta llega a la cola de Pedidos y caja con estado **«por confirmar»** y un código corto; no pasa a cocina (RN-CAP-074). El cliente ve una pantalla de confirmación con el código, el resumen y el mensaje de que un asesor le escribirá por WhatsApp; también un botón para escribir él mismo al WhatsApp del local con el resumen ya armado. En el administrativo suena un aviso y aparece una notificación. Cuando el chatbot esté activo (FT-BOT-02), el bot escribe primero al teléfono del cliente con el resumen del pedido (RN-CAP-043, RN-CAP-081). Si el pedido no se atiende en un tiempo configurable, caja recibe un recordatorio; nunca se anula solo (D-05).

**Beneficio esperado.** Ningún pedido de la carta se reescribe a mano y todos pasan por una persona antes de cocinar. Contribuye a NEC-CAP-001 y OBJ-CAP-001. Hipótesis medible: **0 pedidos de la carta reescritos a mano** y **95 % de los pedidos por confirmar atendidos en 5 minutos** (propuesta, D-05).

**Usuarios / roles.** ACT-CAP-006 Clientes (reciben la confirmación) · ACT-CAP-002 Cajero/a (recibe el pedido en la cola) · Chatbot de WhatsApp, sistema (escribe al cliente cuando está activo).

**Pantallas de referencia.** Carta ▸ pantalla «Pedido enviado»; administrativo ▸ Pedidos y caja, campanita de notificaciones (`Main.dc.html`, `Admin.dc.html`) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-PED-03-01 | Al enviar, el pedido queda «por confirmar» en la cola de caja, con código, canal «Carta» y todos sus datos. | Debe tener | NEC-CAP-086 · RN-CAP-074 | Dado un carrito válido, cuando el cliente envía, entonces aparece en Pedidos y caja como «por confirmar», con código, productos, opciones, notas, modalidad, ubicación, pago preferido y total. | Propuesto |
| RQ-PED-03-02 | Un pedido «por confirmar» no aparece en cocina ni se imprime. | Debe tener | RN-CAP-001 · RN-CAP-019 | Dado un pedido recién enviado desde la carta, cuando se revisan las pantallas de cocina y las ticketeras, entonces no hay rastro del pedido. | Propuesto |
| RQ-PED-03-03 | El cliente ve la confirmación con su código, el resumen y que un asesor le escribirá. | Debe tener | RN-CAP-076 | Dado el pedido enviado, cuando termina el envío, entonces el cliente ve «Pedido N.º ABC123 recibido», el resumen y el mensaje del asesor por WhatsApp. | Propuesto |
| RQ-PED-03-04 | El cliente puede abrir WhatsApp del local con el resumen del pedido ya escrito. | Debería tener | RN-CAP-081 | Dada la confirmación, cuando el cliente toca «Escribir por WhatsApp», entonces se abre un chat con el número del local y un mensaje con código, productos, opciones, nota, entrega, total y pago preferido. | Propuesto |
| RQ-PED-03-05 | El administrativo avisa con sonido y notificación al llegar un pedido de la carta. | Debe tener | NEC-CAP-086 · NEC-CAP-028 | Dado un usuario de caja con la sesión abierta, cuando entra un pedido de la carta, entonces suena un aviso y la campanita suma una notificación que abre el pedido. | Propuesto |
| RQ-PED-03-06 | Con el chatbot activo, el bot escribe al cliente con el resumen del pedido. | Debería tener | RN-CAP-043 · NEC-CAP-090 | Dado el chatbot activo, cuando entra un pedido de la carta, entonces el bot envía al teléfono del cliente la plantilla con el resumen y le pregunta cómo pagará (FT-BOT-02). | Propuesto |
| RQ-PED-03-07 | Un pedido sin atender recibe un recordatorio a caja a los N minutos y nunca se anula solo. | Debe tener | D-05 · RN-CAP-112 | Dado un plazo de 5 minutos, cuando un pedido sigue «por confirmar» a los 5 minutos, entonces caja recibe un recordatorio; a los 30 minutos sigue en la cola sin anularse. | Propuesto |
| RQ-PED-03-08 | El envío vuelve a comprobar horario, pausa y disponibilidad antes de registrar el pedido. | Debe tener | NEC-CAP-085 | Dada la pausa activada mientras el cliente confirmaba, cuando envía, entonces el pedido no se registra y el cliente ve el motivo (FT-CAR-02). | Propuesto |
| RQ-PED-03-09 | Un pedido no se registra dos veces si el cliente toca enviar dos veces o se corta la conexión. | Debe tener | Propuesta (calidad) | Dado un doble toque en «Enviar», cuando llegan las dos solicitudes, entonces queda un solo pedido con un solo código. | Propuesto |

Prioridad por NEC-CAP-001 y NEC-CAP-086. RQ-PED-03-06 depende del acceso a WhatsApp (DEP-12), por eso es *Debería tener* en la fase Ahora y se completa con FT-BOT-02. RQ-PED-03-09 es derivado (calidad) y se propone. Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-002 | Tiempo real | Un pedido que pasa a cocina aparece en todas sus pantallas sin recargar. | Retardo ≤ 3 s (p95) · medición: registro de eventos (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-010 | Concurrencia | Cuando dos personas actúan a la vez sobre lo mismo (mesa, reparto, cupón, chat), solo una gana y la otra ve un aviso. | 0 duplicados en prueba con dos usuarios a la vez (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-003 | Disponibilidad | La carta, el administrativo y el chatbot están en línea durante el horario de atención. | ≥ 99,5 % mensual en horario · medición: monitoreo externo (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-015 | Costo | El uso de IA y de plantillas de WhatsApp se registra y tiene un tope mensual configurable. | Costo mensual visible · alerta al 80 % del tope (umbral propuesto) | Debe tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-010 aplica a RQ-PED-03-09 (envío duplicado); RNF-CAP-015 porque el primer mensaje del bot es una plantilla de pago (RN-CAP-100).

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-001 | Un pedido fuera del local no pasa a cocina hasta que una persona lo confirma. | Acta 01 y 18/10 |
| RN-CAP-043 | Al entrar un pedido por la web, el chatbot escribe al teléfono del cliente. | Acta 02 |
| RN-CAP-074 | Un pedido fuera del local llega «por confirmar» y no aparece en cocina hasta confirmarse. | Reunión del 18/10 |
| RN-CAP-081 (1.ª) | El mensaje al cliente incluye el resumen completo, no solo código y total (id repetido, O1). | Reunión del 18/10 |
| RN-CAP-100 | El primer mensaje del bot es plantilla y se cobra; las respuestas en 24 horas son gratis. | Costos |
| RN-CAP-112 | Pendiente de Kevin el plazo de espera de un pedido por confirmar. | Decisiones |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-PED-03-01 | HU-CAP-019 | FT-CAJ-01 | R-01 |
| RQ-PED-03-02 | HU-CAP-019 | — | R-01 |
| RQ-PED-03-03 | HU-CAP-020 | — | R-01 |
| RQ-PED-03-04 | HU-CAP-020 | FT-CFG-01 (número de WhatsApp) | R-01 |
| RQ-PED-03-05 | HU-CAP-021 | FT-INF-03 | R-01 |
| RQ-PED-03-06 | HU-CAP-021 | FT-BOT-02 · DEP-12 (D-08) | R-04 |
| RQ-PED-03-07 | HU-CAP-021 | D-05 | R-01 |
| RQ-PED-03-08 | HU-CAP-019 | FT-CAR-02 | R-01 |
| RQ-PED-03-09 | HU-CAP-019 | — | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-019 Enviar mi pedido y ver la confirmación
- HU-CAP-020 Escribir al local por WhatsApp con mi pedido
- HU-CAP-021 Recibir el aviso de un pedido nuevo en caja

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-003, ADR-005, ADR-009, ADR-010.

**Fuera de alcance**

- Confirmar, ubicar y cobrar el pedido: FT-CAJ-01 y FT-CAJ-02.
- Conversación completa del bot para el pago: FT-BOT-02.
- Seguimiento del estado del pedido por el cliente en la carta (no pedido en el BRD).

**Preguntas abiertas**

1. **Plazo para el recordatorio** — D-05. Propuesta: 5 minutos, configurable; nunca anular solo.
2. **Costo de la plantilla de WhatsApp** — D-08 y DEP-12.

---

Generado por IA: BRD (NEC-CAP-001, 028, 085, 086, 090; RN-CAP-001, 019, 043, 074, 076, 081, 100, 112), decisiones D-05 y D-08 y el mockup — Revisado por: *(pendiente)*
