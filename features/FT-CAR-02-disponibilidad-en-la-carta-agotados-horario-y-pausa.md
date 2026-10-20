---
id: FT-CAR-02
tipo: spec
titulo: "Disponibilidad en la carta: agotados, horario y pausa"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-001, FT-CAR-01, FT-COC-03, FT-CFG-01, FT-STK-03, ADR-001, ADR-011, ADR-014, ADR-003, ADR-006, NEC-CAP-085, RN-CAP-017, RN-CAP-060, RN-CAP-113]
tags: [carta, plt-03, ep-cap-001, ft-car-02, debe-tener]
---

# FT-CAR-02 — Disponibilidad en la carta: agotados, horario y pausa

**PLT-03 · Feature · Catálogo de requerimientos** · Frente CARTA · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-CAR-02 | Disponibilidad en la carta: agotados, horario y pausa | EP-CAP-001 Carta virtual y catálogo |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debe tener** (NEC-CAP-085 · OBJ-CAP-002) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H1 · piloto en el local · 28/12/2026 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** La carta solo deja pedir lo que se puede atender. Muestra si el local está abierto o cerrado según el horario de cada día y las fechas especiales de Configuración del local (RN-CAP-060). Un producto agotado (por cocina con «agotado por hoy» o por el administrador) se ve apagado con la etiqueta «Agotado» y no se puede agregar. Con la pausa de pedidos de Alta demanda activa, o fuera de horario, o en un feriado cerrado, la carta se puede mirar pero no recibe pedidos. Todo se comprueba otra vez al confirmar el pedido, por si cambió mientras el cliente armaba su carrito (NEC-CAP-085).

**Doble comprobación.** La disponibilidad se valida al agregar al carrito y otra vez al enviar el pedido. Si algo cambió, el cliente ve qué producto ya no está y puede quitarlo; el pedido no se envía con un producto agotado.

**Beneficio esperado.** Evita vender lo que no hay y recibir pedidos que no se pueden atender. Contribuye directamente a OBJ-CAP-002. Hipótesis medible: **0 pedidos con un producto agotado** y **0 pedidos recibidos fuera de horario o en pausa** (propuesta), medidos en el registro de pedidos.

**Usuarios / roles.** ACT-CAP-006 Clientes (ven qué hay y cuándo se puede pedir) · ACT-CAP-003 Cocina y barra (marcan agotados (FT-COC-03)) · ACT-CAP-001 Kevin Rosales, dueño y administrador (define horario y fechas especiales).

**Pantallas de referencia.** Carta ▸ cabecera con estado abierto/cerrado, tarjeta de producto agotado, aviso de pausa (`Main.dc.html`) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-CAR-02-01 | La carta muestra «Abierto» o «Cerrado» según el horario del día y las fechas especiales, en hora de Lima. | Debe tener | RN-CAP-060 · NEC-CAP-038 | Dado un horario de 14:00 a 22:00, cuando un cliente abre la carta a las 13:30, entonces ve «Cerrado · abre a las 14:00»; a las 14:00 ve «Abierto». | Propuesto |
| RQ-CAR-02-02 | Una fecha especial manda sobre el horario normal. | Debe tener | RN-CAP-060 | Dado un feriado marcado como cerrado, cuando un cliente abre la carta ese día en horario normal, entonces ve «Cerrado por feriado» y no puede pedir. | Propuesto |
| RQ-CAR-02-03 | Fuera de horario la carta se puede mirar pero no recibe pedidos. | Debe tener | NEC-CAP-085 | Dado el local cerrado, cuando el cliente intenta enviar un carrito, entonces el botón de enviar queda desactivado con el horario de apertura. | Propuesto |
| RQ-CAR-02-04 | Un producto agotado se ve apagado con «Agotado» y no se puede agregar. | Debe tener | RN-CAP-017 · OBJ-CAP-002 | Dado un producto marcado agotado, cuando aparece en la carta, entonces se ve en gris con «Agotado» y su botón de agregar no responde. | Propuesto |
| RQ-CAR-02-05 | Un sabor o una opción agotada no se ofrece dentro de la ficha. | Debe tener | RN-CAP-017 · NEC-CAP-058 | Dado el sabor «Manjar» agotado, cuando el cliente elige donas, entonces el sabor aparece apagado y no se puede marcar. | Propuesto |
| RQ-CAR-02-06 | Con la pausa de pedidos activa, la carta muestra un aviso y no recibe pedidos. | Debe tener | RN-CAP-113 | Dada la Alta demanda con pausa activa, cuando el cliente abre la carta, entonces ve «Por ahora no estamos recibiendo pedidos» y no puede enviar; al apagar la pausa vuelve a recibir. | Propuesto |
| RQ-CAR-02-07 | Con Alta demanda activa, la carta muestra el tiempo de entrega aumentado. | Debe tener | RN-CAP-113 · NEC-CAP-103 | Dado un tiempo prometido de 13 minutos y Alta demanda de +15, cuando el cliente ve el tiempo estimado, entonces lee 28 minutos. | Propuesto |
| RQ-CAR-02-08 | Al enviar el pedido se vuelve a comprobar horario, pausa y disponibilidad de cada producto. | Debe tener | NEC-CAP-085 | Dado un carrito con un producto que se agotó mientras el cliente lo armaba, cuando envía, entonces el pedido no se envía, ve qué producto ya no está y puede quitarlo y continuar. | Propuesto |
| RQ-CAR-02-09 | Cuando hay stock y recetas, un producto se apaga solo si falta un insumo de su receta. | Debería tener | RN-CAP-003 · OBJ-CAP-002 | Dado un producto cuya receta usa un insumo con stock cero en su área, cuando el cliente abre la carta, entonces el producto aparece agotado sin que nadie lo marque. | Propuesto |

Prioridad por NEC-CAP-085 y OBJ-CAP-002. RQ-CAR-02-09 depende de stock y recetas, que van en la fase Siguiente (R-02), por eso queda en *Debería tener*. Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-019 | Hora local | Horarios, vigencias, «agotado por hoy» y cierres usan la hora de Lima. | Zona America/Lima · 0 cambios de día fuera de las 00:00 locales (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-002 | Tiempo real | Un pedido que pasa a cocina aparece en todas sus pantallas sin recargar. | Retardo ≤ 3 s (p95) · medición: registro de eventos (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-003 | Disponibilidad | La carta, el administrativo y el chatbot están en línea durante el horario de atención. | ≥ 99,5 % mensual en horario · medición: monitoreo externo (umbral propuesto) | Debe tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-019 aplica porque horario y «agotado por hoy» dependen del cambio de día en Lima; RNF-CAP-002 porque un agotado debe llegar a la carta abierta sin recargar.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-003 | Solo se ofrece lo que está disponible según el stock. | Acta 01 |
| RN-CAP-010 | La tienda muestra si está abierta o cerrada según su horario (14:00 a 22:00, por confirmar, D-04). | Web anterior |
| RN-CAP-017 | Un producto agotado deja de ofrecerse en la carta y en el chatbot. | Diseño |
| RN-CAP-060 | El horario de cada día y las fechas especiales deciden si el local aparece abierto; una fecha especial manda. | Decisión del 17/10 |
| RN-CAP-085 (1.ª) | Agotado por hoy vence al cambiar la fecha; agotado desde Productos dura hasta que se vuelva a ofrecer (ver O1: el id está repetido en el BRD). | Cocina, productos |
| RN-CAP-113 | Alta demanda suma minutos al tiempo prometido; la pausa de pedidos solo vale con Alta demanda activa. | Operación |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-CAR-02-01 | HU-CAP-005 | DEP-04 horario real (D-04) | R-03 |
| RQ-CAR-02-02 | HU-CAP-005 | FT-CFG-01 | R-01 |
| RQ-CAR-02-03 | HU-CAP-005 | — | R-01 |
| RQ-CAR-02-04 | HU-CAP-006 | FT-COC-03 | R-01 |
| RQ-CAR-02-05 | HU-CAP-006 | FT-COC-03 | R-01 |
| RQ-CAR-02-06 | HU-CAP-007 | FT-COC-03 | R-01 |
| RQ-CAR-02-07 | HU-CAP-007 | FT-COC-03 · D-01 | R-01 |
| RQ-CAR-02-08 | HU-CAP-008 | — | R-01 |
| RQ-CAR-02-09 | HU-CAP-006 | FT-STK-03 (fase Siguiente) | R-02 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-005 Ver si el local está abierto o cerrado
- HU-CAP-006 Ver productos y opciones agotados
- HU-CAP-007 Ver la pausa y el tiempo de Alta demanda
- HU-CAP-008 Comprobar la disponibilidad al enviar el pedido

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-003, ADR-006.

**Fuera de alcance**

- Cómo cocina marca agotados y activa Alta demanda: FT-COC-03.
- Cómo el administrador define horario y fechas especiales: FT-CFG-01.
- El cálculo de disponibilidad por stock: FT-STK-03.

**Preguntas abiertas**

1. **Horario real por día** — D-04. Propuesta: cargar el horario real en Configuración del local antes del piloto.
2. **¿Se puede pedir un rato antes del cierre?** No está en el BRD. Propuesta: dejar de recibir pedidos 15 minutos antes del cierre, configurable (pendiente de Kevin).

---

Generado por IA: BRD (NEC-CAP-038, 085, 103; RN-CAP-003, 010, 017, 060, 085, 113), decisiones D-01 y D-04 y el mockup de la carta — Revisado por: *(pendiente)*
