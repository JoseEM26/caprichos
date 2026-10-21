---
id: FT-ALM-03
tipo: spec
titulo: "Pedidos internos, mermas y cierre del día"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-010, FT-ALM-01, FT-ALM-02, FT-DEL-03, ADR-001, ADR-011, ADR-014, ADR-003, NEC-CAP-075, NEC-CAP-102, RN-CAP-116, RN-CAP-121, RN-CAP-124]
tags: [almacen, plt-03, ep-cap-010, ft-alm-03, deberia-tener]
---

# FT-ALM-03 — Pedidos internos, mermas y cierre del día

**PLT-03 · Feature · Catálogo de requerimientos** · Frente ALMACEN · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-ALM-03 | Pedidos internos, mermas y cierre del día | EP-CAP-010 Almacén y producción |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debería tener** (NEC-CAP-075 · NEC-CAP-102) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H2 · 01/03/2027 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** Cocina y barra **piden insumos al almacén**; almacén ve los pedidos y los marca como entregados, lo que genera el traslado «por recibir» (NEC-CAP-075). En la pantalla de Cocina solo se registra **merma de productos de cocina** (donas, galletas, empanadas, pan, gelatina) que existen y tienen stock, con origen Cocina, Barra o Producción (RN-CAP-115). Al final del día, el **cierre del día** lista todos los productos del día con stock; por cada uno se anota lo contado, cuánto se bota y su destino (donación, personal, desecho, caída, error de comanda o calibración). Lo que no se bota sigue en el stock y la diferencia entre el sistema y lo contado queda como **merma por diferencia de conteo** (RN-CAP-121, RN-CAP-124). La estación se cierra al terminar.

**Beneficio esperado.** Saber cuánto se pierde cada día y por qué, y que cocina tenga lo que necesita sin pedir de palabra. Hipótesis medible: **100 % de los días con cierre de cocina registrado**; **merma diaria medida por destino**.

**Usuarios / roles.** ACT-CAP-003 Cocina y barra (pide insumos, registra merma y cierra) · Producción, encargada de la mañana (aún sin código ACT en el BRD) (cierra el día de producción) · ACT-CAP-005 Almacén (atiende los pedidos internos).

**Pantallas de referencia.** Administrativo ▸ Cocina ▸ Pedir insumos, Merma, Cierre del día; Almacén ▸ Pedidos internos (`Admin.dc.html`) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-ALM-03-01 | Cocina o barra piden insumos al almacén con cantidades. | Debería tener | NEC-CAP-075 | Dada la barra, cuando pide 6 L de leche y 1 kg de café, entonces almacén ve el pedido interno con el área, autor y hora. | Propuesto |
| RQ-ALM-03-02 | Almacén marca un pedido interno como entregado y se crea el traslado por recibir. | Debería tener | NEC-CAP-075 · RN-CAP-127 | Dado un pedido interno, cuando almacén lo marca entregado, entonces baja el stock central y el área ve el traslado por recibir (FT-ALM-01). | Propuesto |
| RQ-ALM-03-03 | En Cocina solo se registra merma de productos de cocina que tienen stock. | Debería tener | RN-CAP-115 | Dadas donas con stock 10, cuando cocina registra una merma de 12, entonces no se acepta; la leche no aparece en la merma de Cocina. | Propuesto |
| RQ-ALM-03-04 | Una merma de varios productos lleva cantidad, origen y destino por producto, con un destino común por defecto. | Debería tener | RN-CAP-116 · RN-CAP-124 | Dadas 3 donas y 2 galletas, cuando cocina registra la merma con destino «personal», entonces cada una queda con ese destino y su origen. | Propuesto |
| RQ-ALM-03-05 | El cierre del día lista todos los productos del día con stock para contarlos. | Debería tener | RN-CAP-121 | Dados donas, galletas y gelatina con stock, cuando producción abre el cierre del día, entonces aparecen los tres con su stock del sistema. | Propuesto |
| RQ-ALM-03-06 | Por cada producto se anota lo contado, cuánto se bota y su destino. | Debería tener | RN-CAP-121 · RN-CAP-124 | Dadas 10 donas en sistema, cuando se cuentan 9 y se botan 4 a donación, entonces quedan 5 en stock, 4 de merma «donación» y 1 de «diferencia de conteo». | Propuesto |
| RQ-ALM-03-07 | Lo no botado sigue en stock y la diferencia queda como merma por diferencia de conteo. | Debería tener | RN-CAP-121 | Dado el cierre anterior, cuando se confirma con Sí/No, entonces el stock final es 5 y el informe de merma muestra 1 por diferencia. | Propuesto |
| RQ-ALM-03-08 | Lo no entregado de un reparto se registra como merma informativa sin descontar stock. | Podría tener | RN-CAP-126 | Dado un pedido devuelto (FT-DEL-03), cuando se registra su merma con origen Reparto, entonces no hay movimiento de stock. | Propuesto |
| RQ-ALM-03-09 | La estación se cierra al terminar el cierre del día. | Podría tener | NEC-CAP-075 | Dado el cierre confirmado, cuando el área cierra la estación, entonces su pantalla muestra «Estación cerrada» hasta el día siguiente. | Propuesto |

Prioridad *Debería tener* por la épica. Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-020 | Trazabilidad | Todo cambio de stock deja un movimiento con origen, cantidad, autor y fecha. | 100 % de cambios de stock con movimiento (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-019 | Hora local | Horarios, vigencias, «agotado por hoy» y cierres usan la hora de Lima. | Zona America/Lima · 0 cambios de día fuera de las 00:00 locales (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-009 | Auditoría | Toda acción que cambia datos guarda quién la hizo y cuándo. | 100 % de cambios con autor y fecha (umbral propuesto) | Debería tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-020 aplica a cada merma y cada diferencia de conteo.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-056 | Las mermas las registran almacén, producción o el administrador. | Acta 02 |
| RN-CAP-115 | En Cocina solo se registra merma de productos de cocina con stock. | Cocina, Almacén |
| RN-CAP-116 | Merma de varios productos a la vez, con origen y destino. | Cocina, Almacén |
| RN-CAP-121 | El cierre del día lista los productos; lo contado de menos queda como diferencia de conteo. | Cocina, Producción |
| RN-CAP-124 | Destinos de merma: donación, personal, desecho, caída, error de comanda y calibración. | Cocina |
| RN-CAP-126 | Lo preparado y no entregado es merma informativa sin descontar stock otra vez. | Stock |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-ALM-03-01 | HU-CAP-094 | — | R-01 |
| RQ-ALM-03-02 | HU-CAP-094 | FT-ALM-01 | R-01 |
| RQ-ALM-03-03 | HU-CAP-095 | — | R-01 |
| RQ-ALM-03-04 | HU-CAP-095 | — | R-01 |
| RQ-ALM-03-05 | HU-CAP-096 | — | R-01 |
| RQ-ALM-03-06 | HU-CAP-096 | — | R-01 |
| RQ-ALM-03-07 | HU-CAP-096 | — | R-01 |
| RQ-ALM-03-08 | HU-CAP-095 | FT-DEL-03 | R-01 |
| RQ-ALM-03-09 | HU-CAP-096 | — | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-094 Pedir insumos al almacén y atender el pedido
- HU-CAP-095 Registrar la merma de productos de cocina
- HU-CAP-096 Hacer el cierre del día con conteo y destino

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-003.

**Fuera de alcance**

- Movimientos de insumos del almacén: FT-ALM-01.
- Producción: FT-ALM-02.

**Preguntas abiertas**

1. **¿El cierre del día es obligatorio para cerrar caja?** Propuesta: no; son independientes.

---

Generado por IA: BRD (NEC-CAP-075, 102; RN-CAP-056, 115, 116, 121, 124, 126, 127), `analisis/flujo-cocina-y-almacen.md` y el mockup de Cocina — Revisado por: *(pendiente)*
