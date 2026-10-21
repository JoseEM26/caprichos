---
id: FT-STK-02
tipo: spec
titulo: "Recetas, costo y margen"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-009, FT-STK-01, FT-STK-03, FT-ALM-02, FT-INF-01, ADR-001, ADR-011, ADR-014, ADR-003, ADR-007, NEC-CAP-003, NEC-CAP-088, RN-CAP-039]
tags: [stock, plt-03, ep-cap-009, ft-stk-02, deberia-tener]
---

# FT-STK-02 — Recetas, costo y margen

**PLT-03 · Feature · Catálogo de requerimientos** · Frente STOCK · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-STK-02 | Recetas, costo y margen | EP-CAP-009 Stock y recetas |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debería tener** (NEC-CAP-003 · OBJ-CAP-003) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H2 · 01/03/2027 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** Cada producto de la carta tiene su **receta**: qué insumos usa y en qué cantidad, en unidad de receta. Las opciones también pueden consumir insumos (por ejemplo, leche de almendras en lugar de leche entera, o un shot extra de café). Con el costo de cada insumo (de su última compra o el costo cargado), el sistema calcula el **costo del plato** y su **margen** frente al precio de venta (NEC-CAP-003). El consumo de insumos por producto lo edita el administrador (NEC-CAP-088). Los productos hechos por lote (donas, galletas, pan pullman, gelatina) tienen una **receta de producción** por tanda y entran al stock desde la producción del día (RN-CAP-039, FT-ALM-02).

**Beneficio esperado.** Que el dueño sepa cuánto gana por plato y pueda corregir precios. Es el objetivo OBJ-CAP-003. Hipótesis medible: **100 % de los platos con receta muestran su margen** (meta de OBJ-CAP-003).

**Usuarios / roles.** ACT-CAP-001 Kevin Rosales, dueño y administrador (carga y revisa recetas y márgenes) · Producción, encargada de la mañana (aún sin código ACT en el BRD) (aporta las recetas de producción).

**Pantallas de referencia.** Administrativo ▸ Stock y recetas ▸ pestaña Recetas, costo y margen (`Admin.dc.html`) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-STK-02-01 | El administrador define la receta de un producto con insumos y cantidades en unidad de receta. | Debería tener | NEC-CAP-003 · NEC-CAP-088 | Dado el capuchino, cuando el administrador agrega 18 g de café y 200 ml de leche, entonces la receta queda guardada con su autor. | Propuesto |
| RQ-STK-02-02 | Una receta puede variar por tamaño. | Debería tener | RN-CAP-004 | Dado el capuchino grande, cuando su receta usa 300 ml de leche, entonces vender un grande descuenta 300 ml y no 200. | Propuesto |
| RQ-STK-02-03 | Una opción puede sumar, quitar o reemplazar insumos de la receta. | Debería tener | NEC-CAP-088 | Dada la opción «leche de almendras» que reemplaza la leche entera, cuando se vende un capuchino con esa opción, entonces se usan 200 ml de leche de almendras y nada de leche entera. | Propuesto |
| RQ-STK-02-04 | El sistema calcula el costo del plato con el costo de sus insumos. | Debería tener | NEC-CAP-003 · OBJ-CAP-003 | Dado café a S/ 0,08 por g y leche a S/ 0,005 por ml, cuando se abre el capuchino, entonces su costo es S/ 2,44. | Propuesto |
| RQ-STK-02-05 | El sistema muestra el margen en soles y en porcentaje frente al precio. | Debería tener | OBJ-CAP-003 | Dado un costo de S/ 2,44 y un precio de S/ 9, cuando se abre el producto, entonces el margen es S/ 6,56 (72,9 %). | Propuesto |
| RQ-STK-02-06 | Un producto sin receta se marca «sin receta» y no muestra margen. | Debería tener | OBJ-CAP-003 | Dado un producto sin receta, cuando se abre la lista, entonces aparece «Sin receta» y cuenta en el indicador de platos sin margen. | Propuesto |
| RQ-STK-02-07 | Los productos por lote tienen receta de producción por tanda. | Debería tener | RN-CAP-039 · NEC-CAP-081 | Dada la receta de donas, cuando se define que una tanda usa 1 kg de harina y rinde 24 donas, entonces la producción la usa (FT-ALM-02). | Propuesto |
| RQ-STK-02-08 | Cambiar una receta pide Sí/No y queda en el historial; no cambia las ventas pasadas. | Debería tener | RN-CAP-015 · RNF-CAP-009 | Dada una receta, cuando el administrador la cambia, entonces las ventas anteriores conservan lo que descontaron y el historial muestra el cambio. | Propuesto |

Prioridad *Debería tener* por la épica; el margen es OBJ-CAP-003, pero depende de recetas y costos que debe entregar el cliente (R-02). Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-011 | Exactitud | Los montos se calculan en soles con dos decimales sin errores de redondeo. | Diferencia 0,00 entre total mostrado, cobrado y registrado (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-009 | Auditoría | Toda acción que cambia datos guarda quién la hizo y cuándo. | 100 % de cambios con autor y fecha (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-006 | Seguridad | Cada acción se autoriza en el servidor según el rol, no solo ocultando botones. | 0 accesos a módulos o datos fuera del rol · prueba con un usuario por rol (umbral propuesto) | Debería tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-006 aplica porque costos y márgenes solo los ve el administrador (RN-CAP-013).

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-039 | Al vender un producto al momento se descuentan sus insumos por receta; los de lote entran desde la producción. | Acta 02 |
| RN-CAP-013 | Solo el administrador ve ventas e indicadores del negocio. | Prototipo |
| DT-19 | La venta descuenta por receta; la producción descuenta materia prima y suma producto terminado. | decisiones.md |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-STK-02-01 | HU-CAP-081 | DEP-10 (D-15) | R-02 |
| RQ-STK-02-02 | HU-CAP-081 | — | R-01 |
| RQ-STK-02-03 | HU-CAP-082 | — | R-01 |
| RQ-STK-02-04 | HU-CAP-083 | — | R-01 |
| RQ-STK-02-05 | HU-CAP-083 | — | R-01 |
| RQ-STK-02-06 | HU-CAP-083 | — | R-01 |
| RQ-STK-02-07 | HU-CAP-084 | FT-ALM-02 | R-01 |
| RQ-STK-02-08 | HU-CAP-081 | — | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-081 Definir la receta de un producto por tamaño
- HU-CAP-082 Definir cómo las opciones cambian la receta
- HU-CAP-083 Ver el costo y el margen de cada plato
- HU-CAP-084 Definir la receta de producción por tanda

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-003, ADR-007.

**Fuera de alcance**

- Descontar el stock al vender: FT-STK-03.
- Registrar la producción: FT-ALM-02.
- Costeo por lote de compra (PEPS/promedio): se decide en G3.

**Preguntas abiertas**

1. **¿Qué costo usa el cálculo: última compra o promedio?** Propuesta: costo de la última compra, y promedio cuando haya compras registradas (G3).
2. **Recetas reales** — D-15, DEP-10.

---

Generado por IA: BRD (NEC-CAP-003, 081, 088; RN-CAP-004, 013, 039), OBJ-CAP-003, DT-19 y el mockup de Stock y recetas — Revisado por: *(pendiente)*
