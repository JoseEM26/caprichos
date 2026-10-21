---
id: FT-CON-01
tipo: spec
titulo: "Productos, listas y categorías"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-016, FT-CAR-01, FT-CON-02, FT-STK-02, ADR-001, ADR-011, ADR-014, ADR-003, ADR-012, NEC-CAP-016, NEC-CAP-058, NEC-CAP-067, NEC-CAP-082, NEC-CAP-106, RN-CAP-128, RN-CAP-129, RN-CAP-130]
tags: [contenidos, plt-03, ep-cap-016, ft-con-01, deberia-tener]
---

# FT-CON-01 — Productos, listas y categorías

**PLT-03 · Feature · Catálogo de requerimientos** · Frente CONTENIDOS · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-CON-01 | Productos, listas y categorías | EP-CAP-016 Administración de la carta y contenidos |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debería tener** (NEC-CAP-016 · NEC-CAP-067 · NEC-CAP-082 · NEC-CAP-106) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H2 · 01/03/2027 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** El administrador **agrega productos nuevos** a la carta sin programador, con nombre, descripción, foto, categoría, precio, tamaños y opciones (NEC-CAP-082). Las **categorías** se crean (por ejemplo, Pizzas) y dicen si sus productos llevan tamaños y opciones o se venden fijos; una categoría con opciones abre «Opciones y tamaños» al crear el producto, y una fija pide solo nombre y precio (RN-CAP-130). Los tamaños, leches, endulzantes, shots, extras y demás opciones se gestionan **en un solo lugar** con su precio y la elección de en qué productos o categorías se preguntan (NEC-CAP-067). Se eligen de **listas predefinidas por categoría** (los tamaños solo tienen tamaños, etc.), no se escriben; quien edita puede crear o corregir un nombre ahí mismo, sin salir (RN-CAP-128, RN-CAP-129). Los productos con variantes (donas, galletas) son **tipos con sus sabores** (NEC-CAP-058). Nada se elimina: se oculta o desactiva, y los nombres no se repiten. Un cambio en un grupo de opciones vale para todos los productos que lo usan (RN-CAP-086 2.ª).

**Beneficio esperado.** Que el dueño mantenga la carta sin depender de un programador (NEC-CAP-082). Hipótesis medible: **100 % de los cambios de catálogo hechos por el administrador sin soporte técnico** durante el piloto.

**Usuarios / roles.** ACT-CAP-001 Kevin Rosales, dueño y administrador (gestiona productos, listas y categorías).

**Pantallas de referencia.** Administrativo ▸ Productos, Opciones y tamaños, Listas y categorías (`Admin.dc.html`); `analisis/combos-y-opciones.md` (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-CON-01-01 | El administrador crea un producto con nombre, descripción, foto, categoría y precio. | Debería tener | NEC-CAP-082 | Dada la categoría Pizzas (fija), cuando crea «Pizza Americana» a S/ 25 con foto, entonces queda oculta hasta publicar la carta (FT-CON-02). | Propuesto |
| RQ-CON-01-02 | Una categoría se crea indicando si sus productos llevan tamaños y opciones o son fijos. | Debería tener | RN-CAP-130 · NEC-CAP-106 | Dada la categoría nueva «Hamburguesas» con opciones, cuando se crea un producto en ella, entonces se abre «Opciones y tamaños». | Propuesto |
| RQ-CON-01-03 | Las opciones (tamaños, leches, endulzantes, extras) se gestionan en un solo lugar con su precio y alcance. | Debería tener | NEC-CAP-067 | Dado el grupo «Leches», cuando el administrador sube la de almendras de S/ 1,50 a S/ 2 y la asigna a la categoría Frappés, entonces todos los frappés la ofrecen a S/ 2. | Propuesto |
| RQ-CON-01-04 | Un grupo de opciones define si es obligatorio, mínimo y máximo. | Debería tener | RN-CAP-004 | Dado el grupo «Toppings», cuando se define opcional con máximo 3, entonces la carta lo aplica (FT-CAR-01). | Propuesto |
| RQ-CON-01-05 | Los nombres se eligen de listas por categoría y se crean o corrigen ahí mismo sin repetirse. | Debería tener | RN-CAP-128 · RN-CAP-129 | Dado el combo de tamaños, cuando el administrador escribe «Mediano» que no existe, entonces puede crearlo ahí mismo; «Grande» repetido no se acepta. | Propuesto |
| RQ-CON-01-06 | Un módulo de Listas y categorías crea categorías de lista y agrega, edita y oculta elementos. | Debería tener | NEC-CAP-106 · RN-CAP-129 | Dada la lista «Endulzantes», cuando el administrador oculta «Stevia», entonces deja de ofrecerse y los pedidos pasados la conservan. | Propuesto |
| RQ-CON-01-07 | Los productos con variantes son tipos con sabores que se crean, editan y desactivan. | Debería tener | NEC-CAP-058 | Dado el tipo «Donas», cuando se agrega el sabor «Pistacho», entonces aparece en la carta y en las promociones que piden donas. | Propuesto |
| RQ-CON-01-08 | Un producto tiene la marca «No suma puntos ni aplica cupones». | Debería tener | DT-65 · Acta 03 | Dado el producto «Frappé 2×1 de campaña», cuando el administrador activa la marca con Sí/No, entonces ese producto deja de sumar puntos y de aceptar cupones (FT-CLI-02, FT-OFE-03), y el cambio queda en el historial. | Propuesto |
| RQ-CON-01-09 | Productos, opciones y categorías no se eliminan: se ocultan o desactivan. | Debe tener | RN-CAP-014 · RN-CAP-086 (2.ª) | Dado un producto, cuando el administrador busca «Eliminar», entonces solo hay «Ocultar»; sus ventas pasadas se conservan. | Propuesto |
| RQ-CON-01-10 | Los cambios de precio se conservan y quedan en el historial. | Debería tener | NEC-CAP-082 · RNF-CAP-009 | Dado un cambio de precio, cuando se publica, entonces el historial muestra precio anterior, nuevo, autor y fecha, y los pedidos pasados mantienen su precio. | Propuesto |

Prioridad *Debería tener* por la épica (fase Siguiente). En el piloto la carta se carga con la carta oficial (DEP-05). Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-014 | Conservación | Los registros no se borran: se desactivan o anulan (RN-CAP-014). | 0 borrados físicos fuera de las excepciones del BRD (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-009 | Auditoría | Toda acción que cambia datos guarda quién la hizo y cuándo. | 100 % de cambios con autor y fecha (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-012 | Usabilidad | Toda acción que cambia datos pide confirmación Sí/No (RN-CAP-015). | 100 % de acciones de cambio con confirmación (umbral propuesto) | Debería tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-014 aplica a productos, opciones y listas.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-026 | Las listas no se eliminan: se crean, editan y desactivan. | Reunión |
| RN-CAP-086 (2.ª) | Las opciones no se eliminan; un cambio en un grupo vale para todos sus productos (id repetido, O1). | Reunión del 18/10 |
| RN-CAP-128 | Tamaños y opciones se eligen de listas; se crean o corrigen ahí mismo; no se repiten. | Productos, Ofertas |
| RN-CAP-129 | Listas por categoría específica; módulo de Listas y categorías. | Productos |
| RN-CAP-130 | Categorías gestionables con o sin tamaños y opciones; se ocultan, no se eliminan. | Productos, Carta |
| DT-65 | Un producto puede marcarse «No suma puntos ni aplica cupones». | Acta 03 · decisiones.md |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-CON-01-01 | HU-CAP-144 | — | R-01 |
| RQ-CON-01-02 | HU-CAP-144 | — | R-01 |
| RQ-CON-01-03 | HU-CAP-145 | — | R-01 |
| RQ-CON-01-04 | HU-CAP-145 | FT-CAR-01 | R-01 |
| RQ-CON-01-05 | HU-CAP-146 | — | R-01 |
| RQ-CON-01-06 | HU-CAP-146 | — | R-01 |
| RQ-CON-01-07 | HU-CAP-147 | — | R-01 |
| RQ-CON-01-08 | HU-CAP-144 | FT-CLI-02 | R-01 |
| RQ-CON-01-09 | HU-CAP-144 | — | R-01 |
| RQ-CON-01-10 | HU-CAP-144 | — | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-144 Crear un producto en una categoría fija o con opciones
- HU-CAP-145 Gestionar opciones y tamaños en un solo lugar
- HU-CAP-146 Gestionar listas y categorías
- HU-CAP-147 Gestionar tipos con sabores

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-003, ADR-012.

**Fuera de alcance**

- Orden, fotos y publicación de la carta: FT-CON-02.
- Recetas del producto: FT-STK-02.
- Combos: FT-OFE-01.

**Preguntas abiertas**

1. **Carta validada y fotos** — D-15, DEP-05.

---

Generado por IA: BRD (NEC-CAP-016, 058, 067, 082, 106; RN-CAP-004, 014, 026, 086, 128 a 130) y el mockup de Productos — Revisado por: *(pendiente)*
