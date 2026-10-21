---
id: FT-ATN-02
tipo: spec
titulo: "Cambios después del pedido y derivación"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-20
relacionados: [EP-CAP-015, FT-ATN-01, FT-CAJ-01, FT-DEL-02, ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, ADR-009, NEC-CAP-093, RN-CAP-105]
tags: [atencion, plt-03, ep-cap-015, ft-atn-02, deberia-tener]
---

# FT-ATN-02 — Cambios después del pedido y derivación

**PLT-03 · Feature · Catálogo de requerimientos** · Frente ATENCION · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-ATN-02 | Cambios después del pedido y derivación | EP-CAP-015 Atención por WhatsApp y posventa |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debería tener** (NEC-CAP-093) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H2 · 01/03/2027 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** Después de pedir, el cliente puede escribir al chatbot para **cambiar la dirección o el pedido**, preguntar **cuánto falta** o **hablar con una persona** (NEC-CAP-093). El bot responde **según el estado del pedido** (en cocina, listo, en camino, el repartidor llegó, entregado; «por confirmar» solo para el teléfono) y con los tiempos de Kevin: al cliente se le dice de 25 a 35 minutos desde que terminó su pedido, más la alta demanda si está activa (V1, DT-69). El bot **no cambia pedidos**: registra la solicitud y avisa a un asesor, que decide (RN-CAP-105). Con el pedido **en camino** no se cambia la dirección y el aviso es **urgente**. Un mensaje que el bot no entiende se repregunta una vez y luego pasa a una persona.

**Beneficio esperado.** Que el cliente sepa cómo va su pedido sin llamar, y que los cambios no se pierdan. Hipótesis medible: **100 % de solicitudes de cambio con decisión registrada**; **0 cambios hechos por el bot sin asesor**.

**Usuarios / roles.** ACT-CAP-006 Clientes (consulta y pide cambios) · Chatbot de WhatsApp, sistema (responde según estado) · ACT-CAP-002 Cajero/a (decide el cambio) · Call center (aún sin código ACT en el BRD) (decide el cambio).

**Pantallas de referencia.** Chatbot ▸ simulador (estado, cambio, persona); administrativo ▸ Mensajes y Pedidos (`Admin.dc.html`) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-ATN-02-01 | El cliente pregunta cuánto falta y el bot responde según el estado del pedido. | Debería tener | NEC-CAP-093 · V1 · DT-69 | Dado un delivery en cocina desde hace 10 minutos, sin alta demanda, cuando el cliente pregunta «¿cuánto falta?», entonces el bot responde «Tu pedido está en cocina: te llega en unos 15 a 25 minutos»; si ya salió, «El repartidor ya está en camino»; si llegó, «El repartidor está en tu puerta». | Propuesto |
| RQ-ATN-02-02 | El cliente pide cambiar la dirección o el pedido y el bot registra la solicitud y avisa a un asesor. | Debería tener | RN-CAP-105 | Dado un pedido en cocina, cuando el cliente pide cambiar la dirección, entonces el bot dice que un asesor lo revisará y el pedido muestra «Solicitud de cambio» en caja. | Propuesto |
| RQ-ATN-02-03 | El bot no cambia el pedido por sí solo. | Debería tener | RN-CAP-105 | Dada una solicitud de cambio, cuando el bot la recibe, entonces el pedido no cambia hasta que un asesor lo edite. | Propuesto |
| RQ-ATN-02-04 | Con el pedido en camino no se cambia la dirección y el aviso es urgente. | Debería tener | RN-CAP-105 | Dado un pedido en camino, cuando el cliente pide otra dirección, entonces el bot dice que un asesor lo contactará y el chat pasa a «Urgente». | Propuesto |
| RQ-ATN-02-05 | El asesor acepta o rechaza la solicitud y el bot avisa al cliente. | Debería tener | RN-CAP-105 | Dada una solicitud, cuando el asesor la acepta y edita el pedido, entonces el bot avisa «Listo, cambiamos tu pedido»; si la rechaza, avisa el motivo. | Propuesto |
| RQ-ATN-02-06 | Un mensaje no entendido se repregunta una vez y luego pasa a una persona. | Debería tener | NEC-CAP-093 | Dado un mensaje confuso, cuando el bot no lo entiende por segunda vez, entonces deriva a una persona. | Propuesto |

Prioridad *Debería tener* por la épica. Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-016 | Rendimiento | El chatbot responde a un botón o mensaje sin demora perceptible. | Respuesta ≤ 5 s (p90) (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-009 | Auditoría | Toda acción que cambia datos guarda quién la hizo y cuándo. | 100 % de cambios con autor y fecha (umbral propuesto) | Debería tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-009 aplica a cada solicitud y decisión de cambio.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-105 | El chatbot no cambia pedidos: registra y avisa; en camino no se cambia la dirección y el aviso es urgente. | Atención |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-ATN-02-01 | HU-CAP-139 | — | R-01 |
| RQ-ATN-02-02 | HU-CAP-140 | FT-CAJ-01 | R-01 |
| RQ-ATN-02-03 | HU-CAP-140 | — | R-01 |
| RQ-ATN-02-04 | HU-CAP-140 | FT-DEL-02 | R-01 |
| RQ-ATN-02-05 | HU-CAP-140 | — | R-01 |
| RQ-ATN-02-06 | HU-CAP-141 | FT-ATN-01 | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-139 Preguntar por el estado de mi pedido
- HU-CAP-140 Pedir un cambio y que lo decida un asesor
- HU-CAP-141 Derivar a una persona un mensaje no entendido

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, ADR-009.

**Fuera de alcance**

- Cancelar un pedido desde el bot (propuesta: también como solicitud).
- Consola: FT-ATN-01.

**Preguntas abiertas**

1. **¿El cliente puede cancelar desde el bot?** Propuesta: como solicitud al asesor, igual que un cambio.

---

Generado por IA: BRD (NEC-CAP-093; RN-CAP-105) y el mockup del chatbot — Revisado por: *(pendiente)*
