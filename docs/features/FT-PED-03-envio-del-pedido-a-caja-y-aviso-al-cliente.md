---
id: FT-PED-03
tipo: spec
titulo: "Envío del pedido a comandas y aviso al cliente"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-20
relacionados: [EP-CAP-002, FT-PED-01, FT-CAJ-01, FT-BOT-02, FT-INF-03, ADR-001, ADR-011, ADR-014, ADR-003, ADR-005, ADR-009, ADR-010, NEC-CAP-001, NEC-CAP-086, NEC-CAP-090, RN-CAP-043, RN-CAP-074, DT-57]
tags: [pedido, plt-03, ep-cap-002, ft-ped-03, debe-tener]
---

# FT-PED-03 — Envío del pedido a comandas y aviso al cliente

**PLT-03 · Feature · Catálogo de requerimientos** · Frente PEDIDO · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-PED-03 | Envío del pedido a comandas y aviso al cliente | EP-CAP-002 Pedido del cliente en la carta |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debe tener** (NEC-CAP-001 · NEC-CAP-086) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H1 · piloto en el local · 28/12/2026 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** Al enviar, el pedido de la carta **pasa directo a las comandas** (DT-57, acta 03): cada parte aparece en la pantalla de su área y se imprime su comanda, sin esperar la confirmación de caja ni la captura de pago. Esto **reemplaza para la carta** la regla de «por confirmar» (RN-CAP-074). El pedido aparece también en Pedidos y caja, con un código corto, para que el asesor coordine el pago por WhatsApp y caja lo cobre. Al cliente le llega un **mensaje automático al WhatsApp** con el resumen y el método de pago elegido (RN-CAP-043, RN-CAP-081), y ve una pantalla de confirmación con el código, el resumen y un botón para escribir él mismo al WhatsApp del local. En el administrativo suena un aviso y aparece una notificación. Si el cliente nunca paga, caja anula el pedido con motivo y el PIN de la supervisora (DT-61); nunca se anula solo.

**Beneficio esperado.** Ningún pedido de la carta se reescribe a mano y cocina empieza apenas el cliente envía, sin que el personal tenga que pasar cada pedido. Contribuye a NEC-CAP-001 y OBJ-CAP-001. Hipótesis medible: **0 pedidos de la carta reescritos a mano** y **100 % de los pedidos de la carta en las pantallas de cocina en menos de 5 segundos** (propuesta); se mide además cuántos se anulan por falta de pago (riesgo de D-26).

**Usuarios / roles.** ACT-CAP-006 Clientes (reciben la confirmación) · ACT-CAP-002 Cajero/a (recibe el pedido en la cola) · Chatbot de WhatsApp, sistema (escribe al cliente cuando está activo).

**Pantallas de referencia.** Carta ▸ pantalla «Pedido enviado»; administrativo ▸ Pedidos y caja, campanita de notificaciones (`Main.dc.html`, `Admin.dc.html`) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-PED-03-01 | Al enviar, el pedido pasa directo a las comandas con código, canal «Carta» y todos sus datos, sin esperar a caja. | Debe tener | NEC-CAP-086 · DT-57 | Dado un carrito válido, cuando el cliente envía, entonces cada parte aparece en la pantalla de su área y se imprime su comanda, y el pedido figura en Pedidos y caja como «en cocina, pago por coordinar» con código, productos, opciones, notas, modalidad, ubicación, método de pago y total. | Propuesto |
| RQ-PED-03-02 | Caja ve los pedidos de la carta con el pago por coordinar y los cobra o anula; un pedido de la carta no se anula solo. | Debe tener | DT-57 · DT-61 | Dado un pedido de la carta sin pagar, cuando el asesor confirma el pago por WhatsApp, entonces caja lo marca cobrado; si el cliente no paga, caja lo anula con motivo y PIN de la supervisora y cocina lo ve anulado. | Propuesto |
| RQ-PED-03-03 | El cliente ve la confirmación con su código, el resumen y que un asesor le escribirá. | Debe tener | RN-CAP-076 | Dado el pedido enviado, cuando termina el envío, entonces el cliente ve «Pedido N.º ABC123 recibido», el resumen y el mensaje del asesor por WhatsApp. | Propuesto |
| RQ-PED-03-04 | El cliente puede abrir WhatsApp del local con el resumen del pedido ya escrito. | Debería tener | RN-CAP-081 | Dada la confirmación, cuando el cliente toca «Escribir por WhatsApp», entonces se abre un chat con el número del local y un mensaje con código, productos, opciones, nota, entrega, total y pago preferido. | Propuesto |
| RQ-PED-03-05 | El administrativo avisa con sonido y notificación al llegar un pedido de la carta. | Debe tener | NEC-CAP-086 · NEC-CAP-028 | Dado un usuario de caja con la sesión abierta, cuando entra un pedido de la carta, entonces suena un aviso y la campanita suma una notificación que abre el pedido. | Propuesto |
| RQ-PED-03-06 | Al enviar, llega un mensaje automático al WhatsApp del cliente con el resumen y el método de pago elegido. | Debería tener | RN-CAP-043 · NEC-CAP-090 · DT-57 | Dado el acceso a WhatsApp configurado, cuando entra un pedido de la carta, entonces el número del local envía al teléfono del cliente «Recibimos tu pedido» con el código, los productos, el total y el método de pago; el asesor sigue la conversación para pedir la captura. | Propuesto |
| RQ-PED-03-07 | Un pedido de la carta sin pago coordinado recibe un recordatorio a caja a los N minutos. | Debe tener | D-05 · RN-CAP-112 · DT-57 | Dado un plazo de 5 minutos, cuando un pedido de la carta sigue con el pago por coordinar a los 5 minutos, entonces caja recibe un recordatorio; a los 30 minutos sigue sin anularse. | Propuesto |
| RQ-PED-03-08 | El envío vuelve a comprobar horario, pausa y disponibilidad antes de registrar el pedido. | Debe tener | NEC-CAP-085 | Dada la pausa activada mientras el cliente confirmaba, cuando envía, entonces el pedido no se registra y el cliente ve el motivo (FT-CAR-02). | Propuesto |
| RQ-PED-03-09 | Un pedido no se registra dos veces si el cliente toca enviar dos veces o se corta la conexión. | Debe tener | Propuesta (calidad) | Dado un doble toque en «Enviar», cuando llegan las dos solicitudes, entonces queda un solo pedido con un solo código. | Propuesto |

Prioridad por NEC-CAP-001 y NEC-CAP-086. RQ-PED-03-01 y 02 aplican DT-57 (acta 03), que reemplaza para la carta el paso «por confirmar»; si D-26 extiende la regla al chatbot, se ajusta FT-BOT-02. RQ-PED-03-06 depende del acceso a WhatsApp (DEP-12), por eso es *Debería tener* en la fase Ahora. RQ-PED-03-09 es derivado (calidad) y se propone. Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

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
| DT-57 | El pedido de la carta pasa directo a las comandas; la captura la pide el asesor por WhatsApp; reemplaza RN-CAP-001 y RN-CAP-074 para la carta. | Acta 03 · decisiones.md |
| RN-CAP-001 | Un pedido fuera del local no pasa a cocina hasta que una persona lo confirma (para la carta, reemplazada por DT-57). | Acta 01 y 18/10 |
| RN-CAP-043 | Al entrar un pedido por la web, el chatbot escribe al teléfono del cliente. | Acta 02 |
| RN-CAP-074 | Un pedido fuera del local llega «por confirmar» y no aparece en cocina hasta confirmarse (para la carta, reemplazada por DT-57). | Reunión del 18/10 |
| RN-CAP-081 (1.ª) | El mensaje al cliente incluye el resumen completo, no solo código y total (id repetido, O1). | Reunión del 18/10 |
| RN-CAP-100 | El primer mensaje del bot es plantilla y se cobra; las respuestas en 24 horas son gratis. | Costos |
| RN-CAP-112 | Pendiente de Kevin el plazo de espera de un pedido por confirmar. | Decisiones |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-PED-03-01 | HU-CAP-019 | FT-COC-01 · FT-CAJ-01 · D-26 | R-01 |
| RQ-PED-03-02 | HU-CAP-019 | FT-CAJ-02 · D-26 | R-01 |
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

1. **¿Vale también para el chatbot y qué pasa si el cliente no paga?** — D-26. Propuesta: igual en la carta y en el bot; si no paga, caja anula con motivo y PIN.
2. **Plazo para el recordatorio** — D-05. Propuesta: 5 minutos, configurable; nunca anular solo.
3. **Costo de la plantilla de WhatsApp** — D-08 y DEP-12.

---

Generado por IA: BRD (NEC-CAP-001, 028, 085, 086, 090; RN-CAP-001, 019, 043, 074, 076, 081, 100, 112), decisiones DT-57, DT-61, D-05, D-08 y D-26, acta 03 y el mockup — Revisado por: *(pendiente)*
