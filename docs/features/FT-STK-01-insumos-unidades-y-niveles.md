---
id: FT-STK-01
tipo: spec
titulo: "Insumos, unidades y niveles"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-20
relacionados: [EP-CAP-009, FT-STK-02, FT-STK-03, FT-ALM-01, FT-COM-01, ADR-001, ADR-011, ADR-014, ADR-003, ADR-007, NEC-CAP-026, NEC-CAP-071, RN-CAP-041, RN-CAP-118, RN-CAP-127]
tags: [stock, plt-03, ep-cap-009, ft-stk-01, deberia-tener]
---

# FT-STK-01 — Insumos, unidades y niveles

**PLT-03 · Feature · Catálogo de requerimientos** · Frente STOCK · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-STK-01 | Insumos, unidades y niveles | EP-CAP-009 Stock y recetas |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debería tener** (NEC-CAP-026 · NEC-CAP-071) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H2 · 01/03/2027 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** Cada insumo (leche, azúcar, harina, huevos, pollo, café…) tiene una **ficha** con unidad de compra, de almacén y de receta y sus equivalencias (por ejemplo, caja de 12 litros → litro → mililitro), niveles de stock editables (mínimo, intermedio y máximo), sus **proveedores A, B y C** elegidos del directorio (NEC-CAP-071). El stock se lleva **por lugar**: el almacén central y cada área (cocina, barra) tienen su propio stock (RN-CAP-127). Cada insumo muestra un **semáforo** y una barra de qué tan lleno está frente a su máximo, con marcas de mínimo y medio y un estado en palabras: agotado, por acabarse, poco, bien, lleno (RN-CAP-041, RN-CAP-118). Los insumos no se eliminan: se desactivan.

**Beneficio esperado.** Saber qué hay, dónde está y qué falta, con un vistazo. Base para OBJ-CAP-002 y OBJ-CAP-003. Hipótesis medible: **100 % de los insumos de las recetas con ficha completa** y **semáforo correcto en el 100 % de los casos de prueba**.

**Usuarios / roles.** ACT-CAP-005 Almacén (mantiene las fichas) · ACT-CAP-001 Kevin Rosales, dueño y administrador (define niveles y proveedores).

**Pantallas de referencia.** Administrativo ▸ Stock y recetas ▸ pestaña Insumos, ficha del insumo (`Admin.dc.html`) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-STK-01-01 | Un insumo tiene ficha con nombre, unidad de compra, de almacén y de receta con sus equivalencias. | Debería tener | NEC-CAP-071 | Dada la leche con «caja de 12 L = 12 L» y «1 L = 1000 ml», cuando se registran 2 cajas, entonces el almacén suma 24 L y una receta de 250 ml descuenta 0,25 L. | Propuesto |
| RQ-STK-01-02 | Los niveles mínimo, intermedio y máximo se editan por insumo. | Debería tener | RN-CAP-041 · NEC-CAP-071 | Dada la leche con mínimo 10 L, cuando el administrador lo cambia a 12 L con Sí/No, entonces el semáforo se recalcula con el nuevo mínimo. | Propuesto |
| RQ-STK-01-03 | Las entradas de insumos no piden lote ni fecha de vencimiento. | Debería tener | DT-64 · Acta 03 | Dado el pollo, cuando se registra una entrada, entonces no hay campos de lote ni de vencimiento; la frescura de lo producido se controla con la vida útil de los productos (V7). | Propuesto |
| RQ-STK-01-04 | Un insumo tiene proveedores A, B y C elegidos del directorio, sin repetir. | Debería tener | NEC-CAP-071 · RN-CAP-082 (2.ª) | Dado un insumo, cuando el administrador elige el mismo proveedor como A y B, entonces no se acepta. | Propuesto |
| RQ-STK-01-05 | El stock se lleva por lugar: almacén central y cada área. | Debería tener | RN-CAP-127 | Dada la leche con 20 L en almacén y 3 L en barra, cuando se abre la ficha, entonces se ven las dos cantidades por separado y el total. | Propuesto |
| RQ-STK-01-06 | Cada insumo muestra semáforo, barra frente al máximo y estado en palabras. | Debería tener | RN-CAP-041 · RN-CAP-118 | Dado un máximo de 40 y un mínimo de 10, cuando hay 8, entonces se ve rojo y «Poco»; con 0, «Agotado»; con 38, «Lleno». | Propuesto |
| RQ-STK-01-07 | La lista de insumos se filtra por estado, lugar y búsqueda. | Debería tener | NEC-CAP-047 · NEC-CAP-050 | Dados 60 insumos, cuando almacén filtra «Por acabarse» en Barra, entonces solo ve esos. | Propuesto |
| RQ-STK-01-08 | Un insumo no se elimina: se desactiva y sale de las listas de elección. | Debe tener | RN-CAP-014 | Dado un insumo sin uso, cuando se desactiva con Sí/No, entonces deja de ofrecerse en recetas y movimientos y conserva su historial. | Propuesto |
| RQ-STK-01-09 | Se asigna el área de cada insumo (dónde se guarda y desde dónde se descuenta). | Debería tener | RN-CAP-127 (pendiente del mockup) | Dado el café asignado a Barra, cuando se vende un capuchino, entonces el café se descuenta del stock de Barra. | Propuesto |

Prioridad *Debería tener* por la épica (fase Siguiente, R-02). RQ-STK-01-08 es *Debe tener* por la regla general de no eliminar. Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-020 | Trazabilidad | Todo cambio de stock deja un movimiento con origen, cantidad, autor y fecha. | 100 % de cambios de stock con movimiento (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-014 | Conservación | Los registros no se borran: se desactivan o anulan (RN-CAP-014). | 0 borrados físicos fuera de las excepciones del BRD (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-009 | Auditoría | Toda acción que cambia datos guarda quién la hizo y cuándo. | 100 % de cambios con autor y fecha (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-011 | Exactitud | Los montos se calculan en soles con dos decimales sin errores de redondeo. | Diferencia 0,00 entre total mostrado, cobrado y registrado (umbral propuesto) | Debería tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-011 aplica a las conversiones de unidad; se proponen 3 decimales para cantidades de insumos.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-041 | Semáforo verde, naranja y rojo con mínimo, intermedio y máximo. | Acta 02 |
| RN-CAP-081 (2.ª) | Al registrar una compra se convierte a la unidad del almacén (id repetido, O1); sin lote ni vencimiento (DT-64). | Compras |
| RN-CAP-082 (2.ª) | Proveedor desactivado no se elige; A, B y C no se repiten (id repetido, O1). | Proveedores |
| RN-CAP-118 | Barra de llenado con marcas y estado en palabras. | Stock |
| RN-CAP-127 | Stock por área: almacén central y cocina o barra, cada uno con su stock. | Stock |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-STK-01-01 | HU-CAP-078 | DEP-10 (D-15) | R-02 |
| RQ-STK-01-02 | HU-CAP-078 | — | R-01 |
| RQ-STK-01-03 | HU-CAP-078 | FT-COM-03 | R-01 |
| RQ-STK-01-04 | HU-CAP-079 | FT-COM-01 | R-01 |
| RQ-STK-01-05 | HU-CAP-079 | — | R-01 |
| RQ-STK-01-06 | HU-CAP-080 | — | R-01 |
| RQ-STK-01-07 | HU-CAP-080 | — | R-01 |
| RQ-STK-01-08 | HU-CAP-078 | — | R-01 |
| RQ-STK-01-09 | HU-CAP-079 | FT-STK-03 | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-078 Crear la ficha de un insumo con unidades y equivalencias
- HU-CAP-079 Asignar proveedores y área a un insumo
- HU-CAP-080 Ver el stock por lugar con semáforo y barra

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-003, ADR-007.

**Fuera de alcance**

- Recetas y costos: FT-STK-02.
- Movimientos de almacén: FT-ALM-01.
- Varios almacenes (horizonte futuro).

**Preguntas abiertas**

1. **Lista inicial de insumos con unidades y costos** — D-15, DEP-10.
2. **Alertas por correo de stock bajo** — el acta 02 las menciona; propuesta: notificación en el administrativo (FT-INF-03) y correo opcional.

---

Generado por IA: BRD (NEC-CAP-026, 047, 050, 071; RN-CAP-014, 041, 081, 082, 118, 127), `analisis/flujo-cocina-y-almacen.md` y el mockup de Stock y recetas — Revisado por: *(pendiente)*
