---
id: FT-OFF-01
tipo: spec
titulo: "Operación local y sincronización"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-019, FT-CAJ-02, FT-COC-01, FT-SAL-02, ADR-001, ADR-011, ADR-014, ADR-002, ADR-013, NEC-CAP-022, RN-CAP-050]
tags: [offline, plt-03, ep-cap-019, ft-off-01, no-esta-vez]
---

# FT-OFF-01 — Operación local y sincronización

**PLT-03 · Feature · Catálogo de requerimientos** · Frente OFFLINE · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-OFF-01 | Operación local y sincronización | EP-CAP-019 Modo sin internet |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **No esta vez** (BRD §4 «fase aparte», DT-12) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| Fase aparte, con cotización propia (DT-12, D-11) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

> Feature de una **fase aparte con su propia cotización** (DT-12, D-11). Se documenta para dimensionarla; no entra en el piloto.

## 1. Descripción y valor

**Descripción.** Cuando se cae internet, el local **sigue operando**: caja, mozos y cocina trabajan por la **red del local** con una **base de datos local** en la computadora de caja (recomendación inicial: SQLite) que guarda pedidos, cobros y comandas; al volver la conexión, todo se **sincroniza en orden** sin perder ni borrar nada (NEC-CAP-022, RN-CAP-050). Los pedidos de la web y de WhatsApp no llegan mientras no haya internet. Exige reglas de conflicto (por ejemplo, la misma mesa tomada por dos equipos) y que la caja esté siempre encendida.

**Beneficio esperado.** No perder ventas en hora punta por una caída de internet (R-06). Hipótesis medible: **0 pedidos o cobros perdidos** en una prueba de corte de 30 minutos.

**Usuarios / roles.** ACT-CAP-002 Cajero/a (cobra sin internet) · ACT-CAP-004 Mozos (toma pedidos sin internet) · ACT-CAP-003 Cocina y barra (ve comandas sin internet).

**Pantallas de referencia.** Propuesta en el prototipo (sección Modo sin internet) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-OFF-01-01 | Sin internet, caja, mozos y cocina siguen tomando pedidos, cobrando y viendo comandas por la red del local. | No esta vez | NEC-CAP-022 | Dado internet cortado, cuando el mozo envía un pedido, entonces llega a la pantalla de cocina por la red local y se imprime. | Propuesto |
| RQ-OFF-01-02 | Todo se guarda en la base local de la computadora de caja. | No esta vez | RN-CAP-050 | Dado un cobro sin internet, cuando se registra, entonces queda en la base local con su hora. | Propuesto |
| RQ-OFF-01-03 | Al volver la conexión, todo se sincroniza en orden sin perder ni duplicar. | No esta vez | RN-CAP-050 | Dados 20 pedidos sin internet, cuando vuelve la conexión, entonces los 20 llegan al sistema en línea en orden, sin duplicados. | Propuesto |
| RQ-OFF-01-04 | Los conflictos (misma mesa en dos equipos) se resuelven con una regla conocida y se avisan. | No esta vez | BRD §7 riesgo 6 | Dada la mesa 3 abierta en dos equipos sin conexión entre ellos, cuando se sincroniza, entonces se juntan en un pedido y se avisa a caja. | Propuesto |
| RQ-OFF-01-05 | El sistema muestra claramente cuándo se trabaja sin internet. | No esta vez | Propuesta | Dado internet cortado, cuando cualquier usuario mira la cabecera, entonces ve «Sin internet · los pedidos web no llegan». | Propuesto |

Todos *No esta vez* (fase aparte, DT-12). Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-018 | Resiliencia | Sin internet no se pierde ningún pedido ni cobro y todo se sincroniza en orden al volver. | 0 registros perdidos · sincronización ≤ 5 min tras volver la conexión (umbral propuesto) | No esta vez (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-018 es el umbral de la fase aparte.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-050 | Sin internet, la caja sigue con una base local y todo se sincroniza en orden. | Propuesta por aprobar |
| DT-12 | El modo sin internet es una fase aparte. | decisiones.md |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-OFF-01-01 | HU-CAP-168 | D-11 · DEP-03 equipos | R-06 |
| RQ-OFF-01-02 | HU-CAP-168 | — | R-01 |
| RQ-OFF-01-03 | HU-CAP-169 | — | R-01 |
| RQ-OFF-01-04 | HU-CAP-169 | — | R-01 |
| RQ-OFF-01-05 | HU-CAP-168 | — | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-168 Seguir operando sin internet
- HU-CAP-169 Sincronizar al volver la conexión

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-002, ADR-013.

**Fuera de alcance**

- Pedidos de la web y del chatbot sin internet (no llegan).
- Todo lo que no sea caja, mozos y cocina.

**Preguntas abiertas**

1. **Equipos del local, caja siempre encendida y frecuencia de caídas** — BRD §4.
2. **Cotización** — D-11.

---

Generado por IA: BRD (NEC-CAP-022; RN-CAP-050; §4 y §7), DT-12 y D-11 — Revisado por: *(pendiente)*
