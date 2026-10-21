---
id: FT-OFF-01
tipo: spec
titulo: "Operación local y sincronización"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-20
relacionados: [EP-CAP-019, FT-CAJ-02, FT-COC-01, FT-COC-02, FT-SAL-02, ADR-001, ADR-011, ADR-014, ADR-002, ADR-013, NEC-CAP-022, RN-CAP-050, DT-52, DT-29, R-06]
tags: [offline, plt-03, ep-cap-019, ft-off-01, debe-tener]
---

# FT-OFF-01 — Operación local y sincronización

**PLT-03 · Feature · Catálogo de requerimientos** · Frente OFFLINE · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-OFF-01 | Operación local y sincronización | EP-CAP-019 Modo sin internet |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debe tener** (NEC-CAP-022 · DT-52) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H2 · 01/03/2027 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

> **Decidido (DT-52):** se hace con un **mini servidor en la PC de caja**, en la **segunda meta**, después de la carta y el administrativo en línea (sin el agente local). Su cotización queda aparte (DT-12). El router con respaldo 4G se descartó.

## 1. Descripción y valor

**Descripción.** Cuando se cae internet, el local **sigue operando**: la **red del local** (el router) sigue funcionando y **un mini servidor en la PC de caja** —el agente local de DT-29, con base local SQLite— atiende a caja, mozo y cocina. Guarda pedidos, cobros y comandas y, al volver la conexión, **los envía todos al sistema en línea en orden, sin perder ni duplicar** (NEC-CAP-022, RN-CAP-050). No es una aplicación de escritorio aparte. Hoy hay **una sola tablet** (la del mozo), lo que simplifica los conflictos. **Riesgo aceptado por el dueño:** mientras no hay internet **no llegan los pedidos de la carta ni de WhatsApp** y no se manda información al delivery; lo que importa es el local (DT-52). Exige que la PC de caja esté encendida en horario de atención.

**Beneficio esperado.** No parar de vender en el local por una caída de internet (R-06). Hipótesis medible: **0 pedidos o cobros perdidos** en una prueba de corte de 30 minutos.

**Usuarios / roles.** ACT-CAP-002 Cajero/a (cobra sin internet) · ACT-CAP-004 Mozos (toma pedidos sin internet) · ACT-CAP-003 Cocina y barra (ve comandas sin internet).

**Pantallas de referencia.** Propuesta en el prototipo (sección Modo sin internet) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-OFF-01-01 | Sin internet, caja, mozo y cocina siguen tomando pedidos, cobrando y viendo comandas por la red del local, con un mini servidor en la PC de caja. | Debe tener | NEC-CAP-022 · DT-52 | Dado internet cortado, cuando el mozo envía un pedido desde su tablet, entonces llega a la pantalla de cocina por la red local y la caja lo ve. | Propuesto |
| RQ-OFF-01-02 | Todo se guarda en la base local de la PC de caja. | Debe tener | RN-CAP-050 | Dado un cobro sin internet, cuando se registra, entonces queda en la base local con su hora y su número de orden. | Propuesto |
| RQ-OFF-01-03 | El mini servidor arranca solo con la PC de caja y la red del local alcanza sin internet para la tablet, la caja y cocina. | Debe tener | DT-52 · DT-29 | Dada la PC de caja recién encendida y el router sin internet, cuando la tablet abre el administrativo, entonces carga desde el mini servidor sin pedir internet. | Propuesto |
| RQ-OFF-01-04 | Al volver la conexión, todo se sincroniza en orden sin perder ni duplicar. | Debe tener | RN-CAP-050 | Dados 20 pedidos sin internet, cuando vuelve la conexión, entonces los 20 llegan al sistema en línea en orden, sin duplicados. | Propuesto |
| RQ-OFF-01-05 | Los conflictos (la misma mesa en dos equipos) los resuelve el mini servidor como única autoridad y se avisan. | Debe tener | BRD §7 riesgo 6 | Dada la mesa 3 pedida desde la tablet y desde caja sin conexión al sistema en línea, cuando se sincroniza, entonces queda un solo pedido y se avisa a caja. | Propuesto |
| RQ-OFF-01-06 | El sistema muestra claramente cuándo se trabaja sin internet y que los pedidos de la carta y de WhatsApp no llegan. | Debe tener | DT-52 | Dado internet cortado, cuando cualquier usuario mira la cabecera, entonces ve «Sin internet · los pedidos web no llegan», y la carta muestra que no recibe pedidos. | Propuesto |
| RQ-OFF-01-07 | Sin internet no se edita la carta, las ofertas ni los usuarios. | Debería tener | ADR-013 | Dado internet cortado, cuando el administrador intenta cambiar un precio, entonces ve «Esto se puede hacer cuando vuelva el internet». | Propuesto |

Todos *Debe tener*, para la segunda meta (DT-52). Aplica la decisión del dueño de hacerlo con un mini servidor en la caja. Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-018 | Resiliencia | Sin internet no se pierde ningún pedido ni cobro y todo se sincroniza en orden al volver. | 0 registros perdidos · sincronización ≤ 5 min tras volver la conexión (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-010 | Concurrencia | Cuando dos personas actúan a la vez sobre lo mismo (mesa, reparto, cupón, chat), solo una gana y la otra ve un aviso. | 0 duplicados en prueba con dos usuarios a la vez (umbral propuesto) | Debe tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-018 es el umbral de esta feature; RNF-CAP-010 aplica a los conflictos de mesa.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-050 | Sin internet, la caja sigue con una base local y todo se sincroniza en orden. | Propuesta por aprobar |
| DT-52 | Mini servidor en la caja; sin router 4G; riesgo aceptado; segunda meta. | decisiones.md |
| DT-29 | PWA más agente local en la PC de caja; no es una aplicación de escritorio aparte. | decisiones.md |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-OFF-01-01 | HU-CAP-168 | DT-52 | R-06 |
| RQ-OFF-01-02 | HU-CAP-168 | — | R-01 |
| RQ-OFF-01-03 | HU-CAP-168 | DT-52 | R-01 |
| RQ-OFF-01-04 | HU-CAP-169 | — | R-01 |
| RQ-OFF-01-05 | HU-CAP-169 | — | R-01 |
| RQ-OFF-01-06 | HU-CAP-168 | — | R-01 |
| RQ-OFF-01-07 | HU-CAP-168 | — | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-168 Seguir operando sin internet
- HU-CAP-169 Sincronizar al volver la conexión

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-002, ADR-013.

**Fuera de alcance**

- Pedidos de la web y del chatbot sin internet (no llegan; riesgo aceptado).
- Información al delivery sin internet.
- Todo lo que no sea caja, mozo y cocina.

**Preguntas abiertas**

1. **Cotización** de esta feature con Kevin (D-11 está resuelta; queda el precio).
2. **¿La PC de caja se queda siempre encendida?** Es una condición del modo sin internet.

---

Generado por IA: BRD (NEC-CAP-022; RN-CAP-050; §4 y §7), DT-12, DT-29 y DT-52 — Revisado por: *(pendiente)*
