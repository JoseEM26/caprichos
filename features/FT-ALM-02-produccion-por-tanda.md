---
id: FT-ALM-02
tipo: spec
titulo: "Producción por tanda"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-010, FT-STK-02, FT-ALM-01, FT-ALM-03, ADR-001, ADR-011, ADR-014, ADR-003, NEC-CAP-081, RN-CAP-091, RN-CAP-092, RN-CAP-117]
tags: [almacen, plt-03, ep-cap-010, ft-alm-02, deberia-tener]
---

# FT-ALM-02 — Producción por tanda

**PLT-03 · Feature · Catálogo de requerimientos** · Frente ALMACEN · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-ALM-02 | Producción por tanda | EP-CAP-010 Almacén y producción |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debería tener** (NEC-CAP-081) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H2 · 01/03/2027 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** Producción (la encargada de la mañana) registra **tandas por receta** de los productos hechos por lote: donas, galletas, pan de molde (pullman) y gelatina (NEC-CAP-081). Registrar una tanda **baja la materia prima** de su receta por el número de tandas y **suma el producto terminado** al stock (RN-CAP-091). La materia prima se toma **primero de cocina** y, si no alcanza, del **almacén central**, con un mensaje de confirmación que dice cuánto se restará del almacén (DT-19). El stock **nunca queda en negativo**: si falta materia prima, la producción no se registra y el sistema muestra qué falta y cuántas tandas sí alcanzan (RN-CAP-117). Las donas avisan a las 10 horas y pasan a alerta alta a las 12 horas desde su producción (RN-CAP-092); la vida útil es configurable por producto (RN-CAP-040).

**Beneficio esperado.** Que lo producido cada mañana entre al stock con su costo y que no se vendan productos pasados de su vida útil. Hipótesis medible: **100 % de las tandas con su materia prima descontada**; **0 producciones que dejen stock negativo**.

**Usuarios / roles.** Producción, encargada de la mañana (aún sin código ACT en el BRD) (registra las tandas) · ACT-CAP-001 Kevin Rosales, dueño y administrador (revisa) · ACT-CAP-003 Cocina y barra (ve la vida útil).

**Pantallas de referencia.** Administrativo ▸ Producción del día ▸ «Registrar la producción», vida útil (`Admin.dc.html`); `analisis/flujo-cocina-y-almacen.md` (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-ALM-02-01 | Producción registra tandas de un producto por lote según su receta de producción. | Debería tener | NEC-CAP-081 | Dada la receta de donas (1 tanda = 24 donas), cuando producción registra 2 tandas con Sí/No, entonces el stock de donas sube 48. | Propuesto |
| RQ-ALM-02-02 | Registrar una tanda baja la materia prima por el número de tandas. | Debería tener | RN-CAP-091 | Dada 1 tanda = 1 kg de harina, cuando se registran 2 tandas, entonces baja 2 kg de harina con un movimiento «Producción». | Propuesto |
| RQ-ALM-02-03 | La materia prima se toma primero de cocina y lo que falta del almacén, con confirmación. | Debería tener | DT-19 · decisión del 19/10 | Dados 1,5 kg de harina en cocina y 10 kg en almacén, cuando se registran 2 tandas (2 kg), entonces se pregunta «Se restarán 0,5 kg del almacén. ¿Seguro?»; con Sí, baja 1,5 kg de cocina y 0,5 kg del almacén. | Propuesto |
| RQ-ALM-02-04 | Si falta materia prima, la producción no se registra y se muestra qué falta y cuántas tandas alcanzan. | Debe tener | RN-CAP-117 | Dados 1,2 kg de harina en total, cuando se intentan 2 tandas, entonces no se registra y se ve «Falta 0,8 kg de harina · alcanza para 1 tanda». | Propuesto |
| RQ-ALM-02-05 | Cada tanda guarda su hora de producción para la vida útil. | Debería tener | RN-CAP-092 · RN-CAP-040 | Dada una tanda de donas a las 07:00, cuando son las 17:00, entonces las donas de esa tanda avisan «10 horas»; a las 19:00 pasan a alerta alta. | Propuesto |
| RQ-ALM-02-06 | La vida útil es configurable por producto. | Debería tener | RN-CAP-040 | Dado el pan de molde, cuando el administrador fija 48 horas, entonces sus avisos usan ese valor. | Propuesto |
| RQ-ALM-02-07 | El pan de molde se produce como producto por lote y lo usan otras recetas. | Debería tener | Decisión del 19/10 (pullman = pan de molde) | Dado un club sándwich que usa 2 rebanadas de pan de molde, cuando se vende, entonces baja el stock de pan de molde producido. | Propuesto |
| RQ-ALM-02-08 | Una producción mal registrada se anula con motivo y revierte sus movimientos. | Debería tener | RN-CAP-014 | Dada una tanda registrada por error, cuando producción la anula con motivo, entonces se devuelven la materia prima y se resta el producto terminado. | Propuesto |

Prioridad *Debería tener* por la épica. RQ-ALM-02-04 es *Debe tener* porque el stock nunca puede quedar negativo (RN-CAP-117). Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-020 | Trazabilidad | Todo cambio de stock deja un movimiento con origen, cantidad, autor y fecha. | 100 % de cambios de stock con movimiento (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-019 | Hora local | Horarios, vigencias, «agotado por hoy» y cierres usan la hora de Lima. | Zona America/Lima · 0 cambios de día fuera de las 00:00 locales (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-012 | Usabilidad | Toda acción que cambia datos pide confirmación Sí/No (RN-CAP-015). | 100 % de acciones de cambio con confirmación (umbral propuesto) | Debería tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-019 aplica a la vida útil, medida en horas desde la producción.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-040 | Lo que sobra y no se conserva es merma; la vida útil es configurable por producto. | Acta 02 |
| RN-CAP-091 | Registrar una producción baja la materia prima por tandas; si falta, no se registra. | Producción |
| RN-CAP-092 | Las donas avisan a las 10 horas y alerta alta a las 12. | Producción |
| RN-CAP-117 | El stock nunca queda en negativo; se muestra qué falta y cuántas tandas alcanzan. | Producción |
| DT-19 | La producción toma primero de cocina y, si falta, del almacén, con confirmación. | decisiones.md |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-ALM-02-01 | HU-CAP-091 | FT-STK-02 | R-01 |
| RQ-ALM-02-02 | HU-CAP-091 | — | R-01 |
| RQ-ALM-02-03 | HU-CAP-092 | — | R-01 |
| RQ-ALM-02-04 | HU-CAP-092 | — | R-01 |
| RQ-ALM-02-05 | HU-CAP-093 | — | R-01 |
| RQ-ALM-02-06 | HU-CAP-093 | — | R-01 |
| RQ-ALM-02-07 | HU-CAP-091 | FT-STK-03 | R-01 |
| RQ-ALM-02-08 | HU-CAP-091 | — | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-091 Registrar una tanda de producción
- HU-CAP-092 Tomar materia prima de cocina y del almacén con confirmación
- HU-CAP-093 Ver la vida útil de lo producido

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-003.

**Fuera de alcance**

- Cierre del día y conteo: FT-ALM-03.
- Recetas de producción: FT-STK-02.

**Preguntas abiertas**

1. **Recetas de producción reales** — D-15, DEP-10.
2. **¿Qué pasa con las donas al pasar las 12 horas?** Propuesta: se marcan como no vendibles y pasan al cierre del día como merma.

---

Generado por IA: BRD (NEC-CAP-081; RN-CAP-014, 040, 091, 092, 117), DT-19, decisiones del 19/10 (pullman y confirmación) y el mockup de Producción — Revisado por: *(pendiente)*
