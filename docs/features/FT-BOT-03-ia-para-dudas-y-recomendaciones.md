---
id: FT-BOT-03
tipo: spec
titulo: "IA para dudas y recomendaciones"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-20
relacionados: [EP-CAP-014, FT-BOT-01, FT-ATN-01, FT-SAL-03, ADR-001, ADR-011, ADR-014, ADR-007, ADR-009, NEC-CAP-007, NEC-CAP-028, RN-CAP-047, RN-CAP-049]
tags: [chatbot, plt-03, ep-cap-014, ft-bot-03, deberia-tener]
---

# FT-BOT-03 — IA para dudas y recomendaciones

**PLT-03 · Feature · Catálogo de requerimientos** · Frente CHATBOT · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-BOT-03 | IA para dudas y recomendaciones | EP-CAP-014 Chatbot: pedido y pago por WhatsApp |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debería tener** (NEC-CAP-007 · NEC-CAP-028) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H2 · 01/03/2027 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** Una IA especializada responde **solo dudas y recomendaciones** (ingredientes, qué lleva un producto, horario, cómo llegar, qué recomiendan), consultando la **disponibilidad real** de la base de datos (RN-CAP-049). **No toma pedidos**: para pedir lleva al flujo de botones (DT-18). Responde con la voz de la marca y sin inventar precios ni promociones (NEC-CAP-007). Toma **solicitudes de reserva** (personas y hora) que un mozo o cajero aprueba (RN-CAP-047). Cuando el cliente pide hablar con una persona, el administrativo muestra un aviso con su nombre y teléfono hasta que alguien lo atienda (RN-CAP-048). El uso de IA tiene **tope de costo** y registro (R-07).

**Beneficio esperado.** Respuestas rápidas y correctas sin el costo ni los errores del bot actual (casi US$ 10 en 3 días, R-07). Hipótesis medible: **0 respuestas con precios o productos inexistentes** en una muestra semanal; **costo mensual de IA dentro del tope**.

**Usuarios / roles.** Chatbot de WhatsApp, sistema (responde dudas) · ACT-CAP-006 Clientes (pregunta) · ACT-CAP-004 Mozos (aprueba reservas) · ACT-CAP-002 Cajero/a (aprueba reservas).

**Pantallas de referencia.** Chatbot ▸ simulador (dudas, reserva, hablar con una persona); administrativo ▸ avisos (`Admin.dc.html`) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-BOT-03-01 | La IA responde dudas sobre productos, horario y ubicación con datos del sistema. | Debería tener | RN-CAP-049 · NEC-CAP-028 | Dado «¿el frappé de Oreo lleva café?», cuando el cliente pregunta, entonces la IA responde según la descripción del producto en la carta. | Propuesto |
| RQ-BOT-03-02 | La IA recomienda solo productos disponibles. | Debería tener | RN-CAP-049 | Dado un producto agotado, cuando el cliente pide una recomendación, entonces la IA no lo menciona. | Propuesto |
| RQ-BOT-03-03 | La IA no toma pedidos: lleva al flujo de botones. | Debería tener | DT-18 · RN-CAP-049 | Dado «quiero 2 frappés», cuando lo escribe el cliente, entonces la IA responde con el botón «Hacer pedido» y no arma el carrito. | Propuesto |
| RQ-BOT-03-04 | La IA no inventa precios ni promociones: los toma del sistema o dice que no sabe. | Debería tener | NEC-CAP-007 | Dada una pregunta por una promoción que no existe, cuando el cliente la hace, entonces la IA dice que no hay esa promoción y muestra las vigentes. | Propuesto |
| RQ-BOT-03-05 | El bot toma solicitudes de reserva que un mozo o cajero aprueba. | Debería tener | RN-CAP-047 · NEC-CAP-028 | Dado «reserva para 6 a las 8», cuando el cliente confirma, entonces queda una solicitud en el administrativo; al aprobarla, se crea la reserva (FT-SAL-03) y el bot avisa al cliente. | Propuesto |
| RQ-BOT-03-06 | Pedir una persona muestra un aviso con nombre y teléfono hasta que se atienda. | Debería tener | RN-CAP-048 | Dado «hablar con una persona», cuando el cliente lo pide, entonces el administrativo muestra el aviso y el bot deja de responder ese chat. | Propuesto |
| RQ-BOT-03-07 | El uso de IA tiene tope mensual y registro de costo. | Debería tener | R-07 · RNF-CAP-015 | Dado un tope mensual, cuando el gasto llega al 80 %, entonces el administrador recibe un aviso; al 100 %, la IA responde con un mensaje fijo y deriva a una persona. | Propuesto |

Prioridad *Debería tener* por la épica. Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-015 | Costo | El uso de IA y de plantillas de WhatsApp se registra y tiene un tope mensual configurable. | Costo mensual visible · alerta al 80 % del tope (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-016 | Rendimiento | El chatbot responde a un botón o mensaje sin demora perceptible. | Respuesta ≤ 5 s (p90) (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-008 | Datos personales | El DNI, el teléfono y la ubicación se guardan con aceptación registrada y el DNI se muestra enmascarado en listas (Ley 29733). | 0 datos personales sin aceptación · 0 DNI completos en listas (umbral propuesto) | Debería tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-008 aplica: no se envían DNI ni datos personales del cliente al proveedor de IA.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-047 | Una reserva por WhatsApp es una solicitud que aprueba un mozo o cajero. | Acta 02 |
| RN-CAP-048 | Pedir una persona muestra un aviso con nombre y teléfono hasta que se marque atendido. | Acta 02 |
| RN-CAP-049 | La IA consulta disponibilidad para recomendar; el pedido va por botones. | Acta 02 |
| DT-18 | IA solo para dudas y recomendaciones. | decisiones.md |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-BOT-03-01 | HU-CAP-133 | DEP-12 | R-07 |
| RQ-BOT-03-02 | HU-CAP-133 | FT-CAR-02 | R-01 |
| RQ-BOT-03-03 | HU-CAP-133 | FT-BOT-01 | R-01 |
| RQ-BOT-03-04 | HU-CAP-133 | — | R-04 |
| RQ-BOT-03-05 | HU-CAP-134 | FT-SAL-03 | R-01 |
| RQ-BOT-03-06 | HU-CAP-135 | FT-ATN-01 | R-01 |
| RQ-BOT-03-07 | HU-CAP-135 | D-08 | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-133 Preguntar una duda al bot
- HU-CAP-134 Pedir una reserva por WhatsApp
- HU-CAP-135 Pedir hablar con una persona

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-007, ADR-009.

**Fuera de alcance**

- Pedido: FT-BOT-01.
- Consola de chats: FT-ATN-01.
- Elección del modelo y proveedor de IA: ADR en el Bloque 4.

**Preguntas abiertas**

1. **Prompts y panel del bot actual** — BRD §7 riesgo 8 (D-15).
2. **Tope mensual de IA** — propuesta: definirlo con Kevin según el gasto actual.

---

Generado por IA: BRD (NEC-CAP-007, 028; RN-CAP-047 a 049), DT-18, R-07 y el mockup del chatbot — Revisado por: *(pendiente)*
