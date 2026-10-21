---
id: FT-ATN-01
tipo: spec
titulo: "Consola de chats con dueño único"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-20
relacionados: [EP-CAP-015, FT-ATN-02, FT-BOT-02, FT-BOT-03, ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, ADR-009, NEC-CAP-083, NEC-CAP-091, NEC-CAP-098, RN-CAP-102, RN-CAP-111]
tags: [atencion, plt-03, ep-cap-015, ft-atn-01, deberia-tener]
---

# FT-ATN-01 — Consola de chats con dueño único

**PLT-03 · Feature · Catálogo de requerimientos** · Frente ATENCION · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-ATN-01 | Consola de chats con dueño único | EP-CAP-015 Atención por WhatsApp y posventa |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debería tener** (NEC-CAP-083 · NEC-CAP-091 · NEC-CAP-098) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H2 · 01/03/2027 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** Una **consola de mensajes de WhatsApp** dentro del administrativo, con aspecto de WhatsApp: lista de chats con buscador y filtros (pendientes, validar pago, urgentes, atendidos), zoom y pantalla completa (NEC-CAP-083, NEC-CAP-098). **Cada chat tiene un solo dueño**: el bot o una persona (NEC-CAP-091). Se puede **tomar** y **soltar** un chat; mientras lo atiende una persona, **el bot calla** y otra persona no puede escribir sin tomarlo, con confirmación (RN-CAP-102). Se libera con «Soltar el chat» o «Marcar atendido». Un aviso **urgente** pasa el chat a una persona al instante. Hay **respuestas rápidas**, botones para copiar productos y el celular, para registrar o rechazar el pago coordinado (el pedido ya está en cocina, DT-57) y, en el chat de cada cliente, los **avisos de reparto** enviados y su respuesta (DT-60, DT-74). Un botón opcional **«Pulir mensaje»** mejora tono y ortografía con vista previa y nunca envía solo (RN-CAP-111).

**Beneficio esperado.** Que el bot y las personas no se pisen y que ningún cliente quede sin respuesta. Hipótesis medible: **0 chats con respuestas del bot mientras los atiende una persona**; **tiempo de primera respuesta humana medido**.

**Usuarios / roles.** ACT-CAP-002 Cajero/a (atiende chats) · ACT-CAP-004 Mozos (atiende chats) · Call center (aún sin código ACT en el BRD) (atiende chats) · ACT-CAP-001 Kevin Rosales, dueño y administrador (supervisa).

**Pantallas de referencia.** Administrativo ▸ Mensajes (consola tipo WhatsApp) (`Admin.dc.html`) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-ATN-01-01 | La consola lista los chats con buscador y filtros: pendientes, validar pago, urgentes, atendidos. | Debería tener | NEC-CAP-083 · NEC-CAP-098 | Dados 10 chats, cuando el cajero filtra «Validar pago», entonces ve solo esos, con el último mensaje y la hora. | Propuesto |
| RQ-ATN-01-02 | Cada chat tiene un solo dueño: bot o una persona. | Debería tener | NEC-CAP-091 · RN-CAP-102 | Dado un chat del bot, cuando el cajero toca «Tomar», entonces el chat pasa a su nombre y el bot deja de responder. | Propuesto |
| RQ-ATN-01-03 | Otra persona no escribe en un chat tomado sin tomarlo, con confirmación. | Debería tener | RN-CAP-102 | Dado un chat tomado por el cajero, cuando el mozo intenta escribir, entonces ve «Lo atiende … ¿Tomarlo?» y solo con Sí pasa a su nombre. | Propuesto |
| RQ-ATN-01-04 | Un chat se libera con «Soltar el chat» o «Marcar atendido». | Debería tener | RN-CAP-102 | Dado un chat tomado, cuando el cajero toca «Soltar el chat», entonces vuelve al bot; con «Marcar atendido», queda cerrado hasta el próximo mensaje del cliente. | Propuesto |
| RQ-ATN-01-05 | Un aviso urgente pasa el chat a una persona al instante. | Debería tener | NEC-CAP-091 | Dado un cliente que escribe «urgente», cuando llega el mensaje, entonces el chat pasa a «Urgente», el bot calla y suena un aviso en el administrativo. | Propuesto |
| RQ-ATN-01-06 | Hay respuestas rápidas y botones para copiar productos y el celular. | Debería tener | NEC-CAP-083 | Dado un chat, cuando el cajero elige la respuesta rápida «Datos de Yape», entonces se escribe en el cuadro para revisarla y enviarla. | Propuesto |
| RQ-ATN-01-07 | «Pulir mensaje» mejora tono y ortografía con vista previa y nunca envía solo. | Podría tener | NEC-CAP-098 · RN-CAP-111 | Dado un texto con faltas, cuando el cajero toca «Pulir», entonces ve la versión mejorada y decide si usarla; no se envía hasta que toque «Enviar». | Propuesto |
| RQ-ATN-01-08 | Desde la consola se registra o rechaza el pago coordinado de un pedido que ya está en cocina. | Debería tener | NEC-CAP-083 · NEC-CAP-090 · DT-57 | Dado un chat en «Validar pago», cuando el cajero registra el pago, entonces el pedido queda pagado y no se reenvía a cocina (FT-BOT-02). | Propuesto |
| RQ-ATN-01-09 | Un chat tomado sin actividad se libera solo tras un tiempo configurable. | Podría tener | RN-CAP-102 (pendiente) | Dado un chat tomado sin mensajes en 15 minutos, cuando pasa el tiempo, entonces vuelve al bot y se avisa a quien lo tenía. | Propuesto |
| RQ-ATN-01-10 | El chat del cliente muestra los avisos de reparto enviados y su respuesta. | Debería tener | DT-60 · DT-74 | Dado un pedido en camino, cuando se envía el mensaje 2 al pulsar «He llegado», entonces el chat del cliente en la consola muestra «Aviso de reparto 2» con la hora y, si el cliente toca «Ya salgo», su respuesta con la marca «Respondió». | Propuesto |

Prioridad *Debería tener* por la épica. RQ-ATN-01-09 aplica la propuesta de 15 minutos de RN-CAP-102, pendiente. Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-010 | Concurrencia | Cuando dos personas actúan a la vez sobre lo mismo (mesa, reparto, cupón, chat), solo una gana y la otra ve un aviso. | 0 duplicados en prueba con dos usuarios a la vez (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-002 | Tiempo real | Un pedido que pasa a cocina aparece en todas sus pantallas sin recargar. | Retardo ≤ 3 s (p95) · medición: registro de eventos (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-008 | Datos personales | El DNI, el teléfono y la ubicación se guardan con aceptación registrada y el DNI se muestra enmascarado en listas (Ley 29733). | 0 datos personales sin aceptación · 0 DNI completos en listas (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-015 | Costo | El uso de IA y de plantillas de WhatsApp se registra y tiene un tope mensual configurable. | Costo mensual visible · alerta al 80 % del tope (umbral propuesto) | Debería tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-010 aplica al dueño único del chat; RNF-CAP-015 a «Pulir mensaje» con IA.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-048 | Un pedido de hablar con una persona muestra un aviso hasta que se atienda. | Acta 02 |
| RN-CAP-102 | Cada chat tiene un solo dueño; el bot calla; se libera con Soltar o Marcar atendido; liberación por inactividad pendiente (15 min). | Atención |
| RN-CAP-111 | Pulir mensaje es opcional, con vista previa, nunca envía solo; con IA real tiene costo. | Atención |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-ATN-01-01 | HU-CAP-136 | DEP-12 | R-01 |
| RQ-ATN-01-02 | HU-CAP-137 | — | R-01 |
| RQ-ATN-01-03 | HU-CAP-137 | — | R-09 |
| RQ-ATN-01-04 | HU-CAP-137 | — | R-01 |
| RQ-ATN-01-05 | HU-CAP-138 | FT-INF-03 | R-01 |
| RQ-ATN-01-06 | HU-CAP-138 | — | R-01 |
| RQ-ATN-01-07 | HU-CAP-138 | — | R-07 |
| RQ-ATN-01-08 | HU-CAP-138 | FT-BOT-02 | R-01 |
| RQ-ATN-01-09 | HU-CAP-137 | — | R-01 |
| RQ-ATN-01-10 | HU-CAP-136 | FT-DEL-02 | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-136 Ver y filtrar los chats en la consola
- HU-CAP-137 Tomar, soltar y marcar atendido un chat
- HU-CAP-138 Responder con respuestas rápidas y pulir el mensaje

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, ADR-009.

**Fuera de alcance**

- Cambios después del pedido: FT-ATN-02.
- Encuesta posventa: FT-ATN-03.
- Varias cuentas de WhatsApp (un solo número).

**Preguntas abiertas**

1. **Liberación por inactividad** — RN-CAP-102 la deja pendiente (propuesta 15 minutos).

---

Generado por IA: BRD (NEC-CAP-083, 090, 091, 098; RN-CAP-048, 102, 111) y el mockup de Mensajes — Revisado por: *(pendiente)*
