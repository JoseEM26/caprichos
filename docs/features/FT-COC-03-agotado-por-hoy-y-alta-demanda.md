---
id: FT-COC-03
tipo: spec
titulo: "Agotado por hoy y alta demanda"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-20
relacionados: [EP-CAP-006, FT-CAR-02, FT-COC-01, FT-BOT-01, ADR-001, ADR-011, ADR-014, ADR-002, ADR-006, ADR-007, NEC-CAP-073, NEC-CAP-074, NEC-CAP-103, RN-CAP-085, RN-CAP-113]
tags: [cocina, plt-03, ep-cap-006, ft-coc-03, debe-tener]
---

# FT-COC-03 — Agotado por hoy y alta demanda

**PLT-03 · Feature · Catálogo de requerimientos** · Frente COCINA · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-COC-03 | Agotado por hoy y alta demanda | EP-CAP-006 Cocina por áreas e impresión |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debe tener** (NEC-CAP-073 · NEC-CAP-074 · NEC-CAP-103) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H1 · piloto en el local · 28/12/2026 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** Cocina y barra marcan un producto, un sabor o una opción como **agotado por hoy**: se apaga al momento en la carta, en Nuevo pedido y en el chatbot, y vuelve solo al día siguiente (NEC-CAP-073). El administrador también puede agotarlo desde Productos hasta que lo vuelva a ofrecer (RN-CAP-085). **Alta demanda** es un interruptor que suma minutos (de 5 a 180, con atajos de 5 a 60) al **rango de entrega** que se le dice al cliente (de 25 a 35 minutos sin congestión, V1) en la carta, el chatbot y las respuestas del bot; cualquier área puede activarla y el cambio se ve **en tiempo real en todas las áreas** (DT-58, acta 03); mientras está activa, se puede además **pausar pedidos**: la carta y el chatbot dejan de recibir pedidos nuevos y el bot pasa a un asesor. Apagarla vuelve todo a la normalidad (RN-CAP-113). Toda activación pide confirmación Sí/No y queda en el Historial de acciones con quién la hizo: en el acta 03 Kevin contó que un producto quedó agotado dos días porque nadie lo reactivó, por eso el agotado por hoy vuelve solo al día siguiente.

**Beneficio esperado.** Evita prometer lo que no hay y tiempos que no se cumplen en hora punta. Hipótesis medible: **0 pedidos con productos agotados por hoy**; **el tiempo mostrado en la carta coincide al 100 % con el de Alta demanda**.

**Usuarios / roles.** ACT-CAP-003 Cocina y barra (marca agotados y activa Alta demanda) · ACT-CAP-001 Kevin Rosales, dueño y administrador (agota desde Productos).

**Pantallas de referencia.** Administrativo ▸ Cocina ▸ Agotados y Alta demanda; Productos ▸ agotado (`Admin.dc.html`) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-COC-03-01 | Cocina marca un producto, sabor u opción como agotado por hoy con Sí/No. | Debe tener | NEC-CAP-073 · RN-CAP-085 (1.ª) | Dado el frappé de fresa, cuando Bebidas lo marca agotado por hoy y confirma, entonces queda en la lista de agotados con autor y hora. | Propuesto |
| RQ-COC-03-02 | Un agotado se apaga al momento en la carta, Nuevo pedido y el chatbot. | Debe tener | RN-CAP-017 · NEC-CAP-073 | Dado un producto recién agotado, cuando un cliente tiene la carta abierta, entonces lo ve apagado sin recargar; el chatbot ya no lo ofrece. | Propuesto |
| RQ-COC-03-03 | El agotado por hoy vuelve solo al cambiar el día en Lima. | Debe tener | RN-CAP-085 (1.ª) | Dado un producto agotado por hoy, cuando pasan las 00:00 de Lima, entonces vuelve a ofrecerse sin que nadie lo active. | Propuesto |
| RQ-COC-03-04 | Cocina puede volver a ofrecer un agotado antes del día siguiente. | Debe tener | RN-CAP-085 (1.ª) | Dado un producto agotado por hoy, cuando Bebidas lo reactiva con Sí/No, entonces vuelve a la carta al momento. | Propuesto |
| RQ-COC-03-05 | El administrador agota un producto desde Productos hasta que lo vuelva a ofrecer. | Debe tener | RN-CAP-085 (1.ª) | Dado un producto agotado desde Productos, cuando cambia el día, entonces sigue agotado hasta que el administrador lo active. | Propuesto |
| RQ-COC-03-06 | Alta demanda suma los minutos elegidos al tiempo prometido en la carta y el chatbot. | Debe tener | RN-CAP-113 · NEC-CAP-103 | Dado el rango de 25 a 35 minutos, cuando cocina activa Alta demanda con +30, entonces la carta y el bot dicen «de 55 a 65 minutos». | Propuesto |
| RQ-COC-03-07 | Alta demanda se ve en tiempo real en todas las áreas; cualquiera puede cambiarla y queda quién lo hizo. | Debe tener | DT-58 · DT-49 | Dadas tres pantallas de cocina abiertas, cuando Bebidas activa +30, entonces Postres y Salados ven «Alta demanda +30 · activó Bebidas» sin recargar, y el Historial de acciones registra el cambio. | Propuesto |
| RQ-COC-03-08 | Los minutos extra van de 5 a 180, con atajos de 5 a 60. | Debe tener | RN-CAP-113 · V10 | Dado el control de Alta demanda, cuando cocina escribe 200, entonces no se acepta; con el atajo «30» se aplica 30. | Propuesto |
| RQ-COC-03-09 | La pausa de pedidos solo se puede activar con Alta demanda activa. | Debe tener | RN-CAP-113 | Dada Alta demanda apagada, cuando cocina busca la pausa, entonces está desactivada; con Alta demanda activa se puede pausar. | Propuesto |
| RQ-COC-03-10 | Con la pausa, la carta y el chatbot no reciben pedidos nuevos y el bot pasa los chats a un asesor. | Debe tener | RN-CAP-113 · RN-CAP-044 | Dada la pausa activa, cuando un cliente intenta pedir por la carta o el bot, entonces ve el aviso de pausa y el bot ofrece hablar con una persona. | Propuesto |
| RQ-COC-03-11 | Apagar Alta demanda quita los minutos extra y la pausa. | Debe tener | RN-CAP-113 | Dada Alta demanda con pausa, cuando cocina la apaga con Sí/No, entonces el rango vuelve a «de 25 a 35 minutos» y la carta recibe pedidos. | Propuesto |

Prioridad por NEC-CAP-073, 074 y 103 (E1). Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-002 | Tiempo real | Un pedido que pasa a cocina aparece en todas sus pantallas sin recargar. | Retardo ≤ 3 s (p95) · medición: registro de eventos (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-019 | Hora local | Horarios, vigencias, «agotado por hoy» y cierres usan la hora de Lima. | Zona America/Lima · 0 cambios de día fuera de las 00:00 locales (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-009 | Auditoría | Toda acción que cambia datos guarda quién la hizo y cuándo. | 100 % de cambios con autor y fecha (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-012 | Usabilidad | Toda acción que cambia datos pide confirmación Sí/No (RN-CAP-015). | 100 % de acciones de cambio con confirmación (umbral propuesto) | Debe tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-019 aplica al vencimiento de «agotado por hoy» a las 00:00 de Lima.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-017 | Un producto agotado deja de ofrecerse en la carta y el chatbot. | Diseño |
| RN-CAP-044 | En alta demanda se puede pausar el bot o subir los tiempos. | Acta 02 |
| RN-CAP-085 (1.ª) | Agotado por hoy vence al cambiar la fecha; agotado desde Productos dura hasta reactivarlo (id repetido, O1). | Cocina |
| RN-CAP-086 (1.ª) | Con Alta demanda el tiempo mostrado es el rango normal + lo elegido (id repetido, O1; ampliado por RN-CAP-113 y V1). | Cocina |
| DT-58 | Alta demanda suma minutos al rango de 25 a 35 y se ve en tiempo real en todas las áreas, la carta y el bot. | Acta 03 · decisiones.md |
| RN-CAP-113 | Alta demanda suma de 5 a 180 minutos; la pausa solo vale con Alta demanda activa. | Operación |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-COC-03-01 | HU-CAP-055 | — | R-01 |
| RQ-COC-03-02 | HU-CAP-055 | FT-CAR-02 · FT-BOT-01 | R-01 |
| RQ-COC-03-03 | HU-CAP-055 | — | R-01 |
| RQ-COC-03-04 | HU-CAP-055 | — | R-01 |
| RQ-COC-03-05 | HU-CAP-056 | FT-CON-01 | R-01 |
| RQ-COC-03-06 | HU-CAP-057 | — | R-01 |
| RQ-COC-03-07 | HU-CAP-057 | — | R-01 |
| RQ-COC-03-08 | HU-CAP-057 | — | R-01 |
| RQ-COC-03-09 | HU-CAP-057 | — | R-01 |
| RQ-COC-03-10 | HU-CAP-057 | FT-CAR-02 · FT-BOT-01 | R-01 |
| RQ-COC-03-11 | HU-CAP-057 | — | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-055 Marcar y reactivar un agotado por hoy
- HU-CAP-056 Agotar un producto desde Productos
- HU-CAP-057 Activar Alta demanda y pausar pedidos

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-002, ADR-006, ADR-007.

**Fuera de alcance**

- Agotado automático por stock: FT-STK-03.
- Cómo la carta muestra agotados y pausa: FT-CAR-02.

**Preguntas abiertas**

1. **Tiempo prometido base** — resuelto en el acta 03: de 25 a 35 minutos (V1).
2. **¿Alta demanda se apaga sola al cierre?** Propuesta: sí, a la hora de cierre del día.

---

Generado por IA: BRD (NEC-CAP-073, 074, 103; RN-CAP-017, 044, 085, 086, 113), V10 y el mockup de Cocina — Revisado por: *(pendiente)*
