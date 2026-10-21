---
id: FT-CAJ-01
tipo: spec
titulo: "Cola de pedidos por confirmar"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-20
relacionados: [EP-CAP-004, FT-PED-03, FT-CAJ-02, FT-COC-01, FT-DEL-01, FT-BOT-02, ADR-001, ADR-011, ADR-014, ADR-003, ADR-006, ADR-007, ADR-008, ADR-010, ADR-012, NEC-CAP-061, NEC-CAP-059, RN-CAP-074, RN-CAP-075, RN-CAP-101, RN-CAP-104]
tags: [caja, plt-03, ep-cap-004, ft-caj-01, debe-tener]
---

# FT-CAJ-01 — Cola de pedidos por confirmar

**PLT-03 · Feature · Catálogo de requerimientos** · Frente CAJA · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-CAJ-01 | Cola de pedidos por confirmar | EP-CAP-004 Confirmación y cobro en caja |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debe tener** (NEC-CAP-061 · RN-CAP-074) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H1 · piloto en el local · 28/12/2026 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** Pedidos y caja muestra la cola de pedidos de fuera del local que esperan confirmación (**chatbot y teléfono**) con estado **«por confirmar»**, ordenados por llegada y con el tiempo que llevan esperando. **Los pedidos de la carta ya no pasan por esta cola** (DT-57, acta 03): van directo a las comandas y aparecen aparte, en **«Pago por coordinar»**, donde caja registra el pago que el asesor coordinó por WhatsApp (captura incluida) o los anula con motivo y PIN si el cliente no paga; un delivery de la carta sin ubicación se cocina igual y caja lo ubica antes de que un repartidor lo pueda tomar. Una persona del equipo (cajero, mozo o call center) abre el pedido, habla con el cliente por WhatsApp con un mensaje que ya trae el resumen (RN-CAP-081), elige el medio de pago y lo **confirma**; recién entonces pasa a cocina y se imprime (RN-CAP-074, RN-CAP-019). Para Yape, Plin o transferencia, quien confirma **sube el comprobante** y puede anotar el código de operación (RN-CAP-075). Un delivery sin ubicación se ubica antes de confirmar, buscando la dirección o tocando el mapa; al guardar se recalculan zona, envío y total (RN-CAP-104, NEC-CAP-059). Un pedido se puede rechazar o anular con motivo. Los pedidos del mozo en el local no pasan por esta cola: van directo a cocina (RN-CAP-073).

**Quién confirmó.** Cada confirmación guarda quién la hizo, a qué hora, el medio de pago y el comprobante (RN-CAP-075). El bot nunca confirma por sí solo (RN-CAP-101).

**Beneficio esperado.** Que ningún pedido del chatbot o del teléfono se cocine sin confirmación, que los de la carta tengan su pago coordinado antes del cierre y que ninguno se pierda entre canales. Contribuye a OBJ-CAP-001 y NEC-CAP-001. Hipótesis medible: **0 pedidos del chatbot o teléfono en cocina sin confirmación registrada**; **0 pedidos de la carta sin pago registrado o anulado al cierre**; **0 delivery entregados sin ubicación**.

**Usuarios / roles.** ACT-CAP-002 Cajero/a (confirma, ubica y rechaza) · ACT-CAP-004 Mozos (también confirma) · Call center (aún sin código ACT en el BRD) (también confirma) · ACT-CAP-001 Kevin Rosales, dueño y administrador (ve todo).

**Pantallas de referencia.** Administrativo ▸ Pedidos y caja ▸ «Por confirmar» y «Pago por coordinar», detalle del pedido, ubicar en el mapa, subir comprobante (`Admin.dc.html`) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-CAJ-01-01 | La cola muestra los pedidos «por confirmar» del chatbot y del teléfono con canal, código, cliente, modalidad, total y minutos de espera. | Debe tener | NEC-CAP-061 · NEC-CAP-086 · DT-57 | Dados 2 pedidos por confirmar de chatbot y teléfono y 1 de la carta, cuando el cajero abre la cola, entonces ve los 2 primeros ordenados por llegada con su canal y tiempo de espera, y el de la carta en «Pago por coordinar». | Propuesto |
| RQ-CAJ-01-02 | «Pago por coordinar» lista los pedidos de la carta ya enviados a cocina, y caja registra su pago con la captura sin volver a mandarlos a cocina. | Debe tener | DT-57 · RN-CAP-075 | Dado un pedido de la carta con Yape, cuando el asesor recibe la captura por WhatsApp y el cajero la sube y confirma el pago, entonces el pedido queda pagado con su autor y hora, y cocina no recibe una comanda repetida. | Propuesto |
| RQ-CAJ-01-03 | Un delivery de la carta sin ubicación se cocina igual, pero ningún repartidor lo puede tomar hasta que caja lo ubique. | Debe tener | DT-57 · RN-CAP-104 | Dado un pedido de la carta solo con dirección escrita, cuando está listo, entonces el repartidor lo ve con «Falta ubicar» y no puede tomarlo; cuando caja fija el punto, se calculan zona y envío y se puede tomar. | Propuesto |
| RQ-CAJ-01-04 | Abrir un pedido muestra todos sus datos y un botón de WhatsApp con el resumen del pedido. | Debe tener | RN-CAP-081 (1.ª) | Dado un pedido por confirmar, cuando el cajero toca «Escribir al cliente», entonces se abre WhatsApp con el número del cliente y el resumen (productos, opciones, nota, entrega, total y pago preferido). | Propuesto |
| RQ-CAJ-01-05 | Confirmar exige elegir el medio de pago y, si es Yape, Plin o transferencia, subir el comprobante. | Debe tener | RN-CAP-075 | Dado un pedido con Yape, cuando el cajero intenta confirmar sin comprobante, entonces no puede; con la imagen del comprobante y Sí/No, el pedido queda confirmado con su autor y hora. | Propuesto |
| RQ-CAJ-01-06 | Con efectivo o tarjeta, que se cobran al entregar o recoger, se confirma sin comprobante. | Debe tener | RN-CAP-075 | Dado un delivery con efectivo y vuelto de S/ 50, cuando el cajero confirma, entonces no se pide comprobante y el pedido conserva con cuánto paga el cliente. | Propuesto |
| RQ-CAJ-01-07 | Al confirmar, el pedido pasa a cocina, se imprimen su comanda y sus etiquetas y empieza su tiempo. | Debe tener | RN-CAP-002 · RN-CAP-019 | Dado un pedido confirmado, cuando termina la confirmación, entonces aparece en las pantallas de sus áreas con el cronómetro en cero y se envía a sus ticketeras. | Propuesto |
| RQ-CAJ-01-08 | Un delivery sin ubicación no se puede confirmar hasta ubicarlo en el mapa. | Debe tener | RN-CAP-104 · RN-CAP-101 | Dado un delivery solo con dirección escrita, cuando el cajero intenta confirmar, entonces ve «Ubica el pedido antes de confirmarlo» y el botón queda desactivado. | Propuesto |
| RQ-CAJ-01-09 | Quien atiende ubica el pedido buscando la dirección o tocando el mapa, y se recalculan zona, envío y total. | Debe tener | NEC-CAP-059 · RN-CAP-104 | Dado un pedido sin punto, cuando el cajero busca «Av. Brasil 1234» y fija el pin, entonces el pedido guarda el punto y el enlace, el envío pasa de «por calcular» al de su zona y el total se actualiza. | Propuesto |
| RQ-CAJ-01-10 | La zona solo se cambia a mano si el cliente la confirma; fuera de cobertura no se guarda como delivery. | Debe tener | RN-CAP-087 · RN-CAP-103 | Dado un punto fuera de cobertura, cuando el cajero lo fija, entonces se avisa y se ofrece pasar el pedido a «para recoger». | Propuesto |
| RQ-CAJ-01-11 | Rechazar un pedido exige motivo; un pedido rechazado no va a cocina ni se imprime. | Debe tener | RN-CAP-019 · RN-CAP-089 | Dado un pedido por confirmar, cuando el cajero lo rechaza con el motivo «Cliente no responde» y Sí/No, entonces sale de la cola, queda en el historial con su motivo y no llega a cocina. | Propuesto |
| RQ-CAJ-01-12 | Dos personas no pueden confirmar el mismo pedido a la vez. | Debe tener | Propuesta (RNF-CAP-010) | Dado un pedido abierto por el cajero, cuando el call center intenta confirmarlo al mismo tiempo, entonces solo una confirmación vale y la otra ve «Este pedido ya lo confirmó …». | Propuesto |
| RQ-CAJ-01-13 | Los pedidos tomados por el mozo en el local no aparecen en la cola: van directo a cocina. | Debe tener | RN-CAP-073 · DT-16 | Dado un pedido de mesa del mozo, cuando se envía, entonces no aparece en «Por confirmar» y sí en cocina. | Propuesto |

Prioridad por NEC-CAP-061 y RN-CAP-074 (E1), con el cambio de DT-57 (acta 03) para los pedidos de la carta. RQ-CAJ-01-12 es derivado de RNF-CAP-010. Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-002 | Tiempo real | Un pedido que pasa a cocina aparece en todas sus pantallas sin recargar. | Retardo ≤ 3 s (p95) · medición: registro de eventos (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-006 | Seguridad | Cada acción se autoriza en el servidor según el rol, no solo ocultando botones. | 0 accesos a módulos o datos fuera del rol · prueba con un usuario por rol (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-009 | Auditoría | Toda acción que cambia datos guarda quién la hizo y cuándo. | 100 % de cambios con autor y fecha (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-010 | Concurrencia | Cuando dos personas actúan a la vez sobre lo mismo (mesa, reparto, cupón, chat), solo una gana y la otra ve un aviso. | 0 duplicados en prueba con dos usuarios a la vez (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-012 | Usabilidad | Toda acción que cambia datos pide confirmación Sí/No (RN-CAP-015). | 100 % de acciones de cambio con confirmación (umbral propuesto) | Debe tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-009 aplica porque cada confirmación guarda autor, hora, medio y comprobante (RN-CAP-075); RNF-CAP-006 porque solo caja, mozo, call center y administrador confirman.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-001 | Un pedido fuera del local no pasa a cocina hasta que una persona lo confirma (para la carta, reemplazada por DT-57). | Acta 01 y 18/10 |
| DT-57 | El pedido de la carta va directo a las comandas; caja coordina el pago después. | Acta 03 · decisiones.md |
| RN-CAP-073 | El pedido del mozo en el local va directo a cocina. | Reunión del 18/10 |
| RN-CAP-074 | Un pedido fuera del local llega «por confirmar»; caja, mozo o call center confirman. | Reunión del 18/10 |
| RN-CAP-075 | Con Yape, Plin o transferencia se sube el comprobante; con efectivo o tarjeta no; se guarda quién y cuándo. | Reunión del 18/10 |
| RN-CAP-101 | El bot no verifica comprobantes ni manda a cocina; un delivery sin ubicación no se aprueba. | Pagos |
| RN-CAP-104 | Un delivery sin ubicación ni zona no se confirma; al ubicar se recalculan zona, envío y total. | Delivery |
| RN-CAP-087 | La zona se cambia a mano solo si el cliente la confirma. | Delivery |
| RN-CAP-089 | Anular exige motivo y queda en el historial. | Pedidos |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-CAJ-01-01 | HU-CAP-029 | — | R-01 |
| RQ-CAJ-01-02 | HU-CAP-030 | FT-PED-03 · D-26 | R-01 |
| RQ-CAJ-01-03 | HU-CAP-031 | FT-DEL-02 | R-01 |
| RQ-CAJ-01-04 | HU-CAP-029 | — | R-01 |
| RQ-CAJ-01-05 | HU-CAP-030 | — | R-01 |
| RQ-CAJ-01-06 | HU-CAP-030 | — | R-01 |
| RQ-CAJ-01-07 | HU-CAP-030 | FT-COC-01 · FT-COC-02 | R-01 |
| RQ-CAJ-01-08 | HU-CAP-031 | FT-DEL-01 | R-01 |
| RQ-CAJ-01-09 | HU-CAP-031 | FT-DEL-01 | R-03 |
| RQ-CAJ-01-10 | HU-CAP-031 | FT-DEL-01 | R-01 |
| RQ-CAJ-01-11 | HU-CAP-032 | — | R-01 |
| RQ-CAJ-01-12 | HU-CAP-030 | — | R-09 |
| RQ-CAJ-01-13 | HU-CAP-029 | FT-SAL-02 | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-029 Ver y abrir la cola de pedidos por confirmar
- HU-CAP-030 Confirmar el pago de un pedido y enviarlo a cocina
- HU-CAP-031 Ubicar en el mapa un delivery sin ubicación
- HU-CAP-032 Rechazar un pedido con motivo

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-003, ADR-006, ADR-007, ADR-008, ADR-010, ADR-012.

**Fuera de alcance**

- El cobro con medios de pago y el pago mixto: FT-CAJ-02.
- La aprobación del comprobante desde la consola de WhatsApp: FT-BOT-02 y FT-ATN-01.
- Pedidos que toma caja o el call center: FT-CAJ-03.

**Preguntas abiertas**

1. **¿El pedido del chatbot también va directo a cocina?** — D-26. Propuesta: sí, igual que la carta; si se acepta, esta cola queda solo para el teléfono.
2. **Recordatorio de pedidos sin atender** — D-05.
3. **¿El mozo confirma pedidos de fuera desde su tablet?** El BRD dice que sí (RN-CAP-074); por confirmar si el mozo tiene tiempo en hora punta.

---

Generado por IA: BRD (NEC-CAP-059, 061, 086; RN-CAP-001, 002, 019, 073 a 075, 081, 087, 089, 101, 103, 104) y el mockup de Pedidos y caja — Revisado por: *(pendiente)*
