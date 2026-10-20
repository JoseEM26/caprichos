---
id: FT-SAL-02
tipo: spec
titulo: "Pedido del mozo y control de mesas"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-007, FT-SAL-01, FT-SAL-03, FT-COC-01, FT-CAJ-02, ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, NEC-CAP-023, NEC-CAP-043, NEC-CAP-053, NEC-CAP-078, RN-CAP-073, RN-CAP-090]
tags: [salon, plt-03, ep-cap-007, ft-sal-02, debe-tener]
---

# FT-SAL-02 — Pedido del mozo y control de mesas

**PLT-03 · Feature · Catálogo de requerimientos** · Frente SALON · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-SAL-02 | Pedido del mozo y control de mesas | EP-CAP-007 Salón: plano, mesas, pedido del mozo y reservas |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debe tener** (NEC-CAP-023 · NEC-CAP-053 · NEC-CAP-078) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H1 · piloto en el local · 28/12/2026 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** El mozo toma el pedido en mesa desde su tablet o celular. Primero elige la mesa con botones de mesas libres o en el plano (NEC-CAP-053); la mesa queda siempre visible con la opción de cambiarla. Arma el pedido con el mismo catálogo y reglas que la carta (RN-CAP-027), con o sin imágenes (NEC-CAP-043), y lo envía **directo a cocina**, sin pasar por caja (RN-CAP-073). Una mesa ocupada no se puede abrir otra vez, ni desde otro mozo ni desde caja (NEC-CAP-023); a una mesa ocupada se le **agregan consumos** como comanda adicional (RN-CAP-090). Un pedido puede ocupar varias mesas juntas (RN-CAP-108). «Para llevar» no usa mesa. El mozo imprime la **precuenta**, marca que llevó el pedido a la mesa y recibe aviso cuando está listo (NEC-CAP-078). La mesa se libera al cobrar y también a mano (RN-CAP-054).

**Beneficio esperado.** Pedidos de salón que llegan a cocina al instante y sin mezclar mesas. Contribuye a OBJ-CAP-001. Hipótesis medible: **0 mesas con dos pedidos abiertos a la vez**; **tiempo desde que el mozo envía hasta que cocina lo ve ≤ 3 s**.

**Usuarios / roles.** ACT-CAP-004 Mozos (toma y sigue el pedido de mesa) · ACT-CAP-002 Cajero/a (cobra y libera) · ACT-CAP-003 Cocina y barra (recibe la comanda).

**Pantallas de referencia.** Administrativo ▸ Nuevo pedido (mozo), Mesas, precuenta (`Admin.dc.html`) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-SAL-02-01 | El mozo elige la mesa con botones de mesas libres o en el plano, y la mesa queda visible con opción de cambiarla. | Debe tener | NEC-CAP-053 | Dado el pedido de mesa, cuando el mozo abre Nuevo pedido, entonces se le pregunta la mesa con las libres como botones y un acceso al plano; la mesa elegida se ve arriba con «Cambiar». | Propuesto |
| RQ-SAL-02-02 | Una mesa ocupada no se puede abrir otra vez, aunque dos personas lo intenten a la vez. | Debe tener | NEC-CAP-023 · RN-CAP-025 | Dados dos mozos que eligen la mesa 3 al mismo tiempo, cuando envían, entonces solo uno abre el pedido y el otro ve «La mesa 3 ya está ocupada». | Propuesto |
| RQ-SAL-02-03 | El pedido del mozo usa el mismo catálogo y reglas que la carta, con o sin imágenes. | Debe tener | RN-CAP-027 · NEC-CAP-043 | Dado un producto con grupo obligatorio, cuando el mozo lo agrega sin elegir, entonces no puede; puede alternar la vista con o sin imágenes. | Propuesto |
| RQ-SAL-02-04 | El pedido del mozo va directo a cocina y se imprimen su comanda y etiquetas. | Debe tener | RN-CAP-073 | Dado un pedido de mesa, cuando el mozo lo envía con Sí/No, entonces aparece en las pantallas de sus áreas y no en «Por confirmar». | Propuesto |
| RQ-SAL-02-05 | A una mesa ocupada se le agregan consumos como comanda adicional. | Debe tener | RN-CAP-090 · NEC-CAP-078 | Dada la mesa 3 ocupada, cuando el mozo agrega dos cafés, entonces cocina recibe una comanda adicional marcada «Adicional · Mesa 3» y la cuenta suma los cafés. | Propuesto |
| RQ-SAL-02-06 | Un pedido puede ocupar varias mesas juntas, que se muestran y liberan juntas. | Debe tener | RN-CAP-108 | Dado un grupo de 8, cuando el mozo elige las mesas 4 y 5, entonces ambas quedan ocupadas por el mismo pedido y se liberan juntas al cobrar. | Propuesto |
| RQ-SAL-02-07 | «Para llevar» no usa mesa. | Debe tener | Acta 02 · BRD §4 «Mesas» | Dado un pedido para llevar del mozo, cuando lo arma, entonces no se le pide mesa. | Propuesto |
| RQ-SAL-02-08 | El mozo imprime la precuenta de una mesa. | Debe tener | RN-CAP-030 · NEC-CAP-078 | Dada la mesa 3 con consumos, cuando el mozo toca «Precuenta», entonces se imprime el detalle y el total, sin ser comprobante. | Propuesto |
| RQ-SAL-02-09 | El mozo recibe aviso cuando su pedido está listo y marca que lo llevó a la mesa. | Debe tener | NEC-CAP-078 | Dado un pedido listo de la mesa 3, cuando todas las áreas terminan, entonces el mozo que lo tomó recibe un aviso; al marcar «Entregado en mesa», el pedido lo registra con la hora. | Propuesto |
| RQ-SAL-02-10 | La mesa se libera al cobrar y también a mano por mozo o caja, con Sí/No. | Debe tener | RN-CAP-054 · RN-CAP-031 | Dada una mesa cobrada, cuando termina el cobro, entonces queda libre; una mesa con pedido cancelado se libera a mano con confirmación. | Propuesto |

Prioridad por NEC-CAP-023, 053 y 078 (E1). Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-010 | Concurrencia | Cuando dos personas actúan a la vez sobre lo mismo (mesa, reparto, cupón, chat), solo una gana y la otra ve un aviso. | 0 duplicados en prueba con dos usuarios a la vez (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-002 | Tiempo real | Un pedido que pasa a cocina aparece en todas sus pantallas sin recargar. | Retardo ≤ 3 s (p95) · medición: registro de eventos (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-004 | Usabilidad | Las pantallas se usan desde un celular sin desplazamiento horizontal. | Ancho mínimo 360 px · 0 pantallas con scroll horizontal (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-005 | Accesibilidad | Texto legible para personas mayores y botones fáciles de tocar. | Contraste WCAG AA · objetivos táctiles ≥ 44 px (umbral propuesto) | Debe tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-010 es el umbral clave (R-09): la mesa se bloquea en el servidor, no solo en la pantalla.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-025 | El mozo solo abre pedido en mesas libres. | Prototipo |
| RN-CAP-027 | Mismo catálogo y reglas que la carta; varios productos. | Reunión |
| RN-CAP-030 | El mozo no cobra: saca la precuenta. | Acta 02 |
| RN-CAP-031 | Una mesa no debe quedar libre mientras el cliente sigue en ella. | Acta 02 |
| RN-CAP-054 | Una mesa se libera al cobrar y también a mano. | Acta 02 |
| RN-CAP-073 | El pedido del mozo en el local va directo a cocina. | Reunión del 18/10 |
| RN-CAP-090 | Una mesa ocupada recibe consumos como comanda adicional. | Mozo |
| RN-CAP-108 | Un pedido puede ocupar varias mesas juntas, que se liberan juntas. | Mesas |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-SAL-02-01 | HU-CAP-061 | FT-SAL-01 | R-01 |
| RQ-SAL-02-02 | HU-CAP-061 | — | R-09 |
| RQ-SAL-02-03 | HU-CAP-062 | FT-CAR-01 | R-01 |
| RQ-SAL-02-04 | HU-CAP-062 | FT-COC-01 · FT-COC-02 | R-01 |
| RQ-SAL-02-05 | HU-CAP-063 | — | R-01 |
| RQ-SAL-02-06 | HU-CAP-061 | — | R-01 |
| RQ-SAL-02-07 | HU-CAP-061 | — | R-01 |
| RQ-SAL-02-08 | HU-CAP-063 | FT-COC-02 | R-01 |
| RQ-SAL-02-09 | HU-CAP-064 | FT-COC-01 · FT-INF-03 | R-01 |
| RQ-SAL-02-10 | HU-CAP-064 | FT-CAJ-02 | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-061 Elegir la mesa y armar el pedido de mesa
- HU-CAP-062 Enviar el pedido de mesa directo a cocina
- HU-CAP-063 Agregar consumos a una mesa ocupada e imprimir la precuenta
- HU-CAP-064 Recibir aviso de listo, entregar en mesa y liberar

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-006, ADR-007.

**Fuera de alcance**

- Dibujar el plano: FT-SAL-01.
- Reservas: FT-SAL-03.
- El cobro: FT-CAJ-02.
- Dividir la cuenta de una mesa entre varias personas (no pedido en el BRD).

**Preguntas abiertas**

1. **¿Cómo se libera una mesa cuando el cliente sigue sentado tras pagar?** RN-CAP-031 lo deja por definir. Propuesta: al cobrar se ofrece «Liberar ahora» o «Mantener ocupada».
2. **¿Se puede mover un pedido de una mesa a otra?** No está en el BRD; propuesta: sí, con «Cambiar mesa».

---

Generado por IA: BRD (NEC-CAP-023, 043, 053, 078; RN-CAP-025, 027, 030, 031, 054, 073, 090, 108) y el mockup del pedido del mozo — Revisado por: *(pendiente)*
