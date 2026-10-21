---
id: FT-CAR-01
tipo: spec
titulo: "Catálogo por categorías con tamaños y opciones"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-001, FT-CAR-02, FT-PED-01, FT-CON-01, ADR-001, ADR-011, ADR-014, ADR-003, ADR-006, NEC-CAP-006, NEC-CAP-084, RN-CAP-004, RN-CAP-051]
tags: [carta, plt-03, ep-cap-001, ft-car-01, debe-tener]
---

# FT-CAR-01 — Catálogo por categorías con tamaños y opciones

**PLT-03 · Feature · Catálogo de requerimientos** · Frente CARTA · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-CAR-01 | Catálogo por categorías con tamaños y opciones | EP-CAP-001 Carta virtual y catálogo |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debe tener** (BRD §4 «Carta virtual», E1) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H1 · piloto en el local · 28/12/2026 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** La carta virtual muestra el catálogo oficial de Caprichos agrupado por categorías (bebidas calientes, frappés, postres, salados, combos…), con una barra de categorías que se queda fija arriba y un buscador. No hay filtros ni paginación (RN-CAP-051). Cada producto abre una ficha con foto cuadrada ampliable, descripción, tamaños con su precio y grupos de opciones (tipo de leche, endulzante, cremas, toppings, shots, extras). Cada grupo dice si es obligatorio, cuántas opciones se eligen como mínimo y como máximo y cuánto suma cada una (RN-CAP-004). El precio de la ficha se recalcula en vivo con lo elegido. Los productos con variantes (donas, galletas, mañana pizzas) se eligen por sabor, y solo se ofrecen los sabores activos (NEC-CAP-058). Las promociones muestran el precio anterior tachado y el porcentaje de descuento (RN-CAP-007).

**Una sola fuente de precios.** Los precios y opciones salen del catálogo que mantiene el administrador (FT-CON-01); la carta no tiene precios propios. Los precios vigentes son los de la carta oficial (RN-CAP-006) y los de la web anterior no mandan.

**Mismas reglas en todos los canales.** El catálogo y sus reglas de opciones son los mismos que usan el pedido del mozo (FT-SAL-02), Nuevo pedido en caja (FT-CAJ-03) y el chatbot (FT-BOT-01), según RN-CAP-005 y RN-CAP-027.

**Beneficio esperado.** Un canal de venta propio con la carta oficial, sin el costo ni las limitaciones de la plataforma anterior (NEC-CAP-006). Contribuye a OBJ-CAP-002 «No vender lo que no hay». Hipótesis medible: **100 % de los productos de la carta coinciden en nombre, precio y opciones con `recursos/carta-completa.md`** (propuesta); **0 pedidos con un total distinto al calculado por las reglas de opciones**.

**Usuarios / roles.** ACT-CAP-006 Clientes (ven la carta y arman su producto) · ACT-CAP-001 Kevin Rosales, dueño y administrador (valida que la carta sea la oficial).

**Pantallas de referencia.** Carta ▸ inicio, barra de categorías, buscador y ficha de producto (`Main.dc.html`) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-CAR-01-01 | La carta muestra los productos activos agrupados por categoría, en el orden que definió el administrador. | Debe tener | NEC-CAP-006 · BRD §4 | Dado un catálogo con categorías y productos activos e inactivos, cuando el cliente abre la carta, entonces ve solo los activos, agrupados por categoría y en el orden publicado (FT-CON-02). | Propuesto |
| RQ-CAR-01-02 | La barra de categorías queda fija arriba y lleva a cada categoría con un toque. | Debe tener | RN-CAP-051 · mockup | Dado que el cliente se desplazó por la carta, cuando toca una categoría en la barra, entonces la carta salta a esa categoría y la barra marca la categoría visible. | Propuesto |
| RQ-CAR-01-03 | El buscador encuentra productos por nombre o descripción, sin tildes ni mayúsculas. | Debe tener | RN-CAP-051 | Dado el producto «Frappé de Café», cuando el cliente escribe «frappe cafe», entonces aparece en los resultados; si no hay coincidencias, ve «No encontramos ese producto». | Propuesto |
| RQ-CAR-01-04 | La carta no tiene filtros por precio ni paginación. | Debe tener | RN-CAP-051 · DT-13 | Dada la carta abierta, cuando se revisa la pantalla, entonces no hay filtros por rango de precio ni páginas: todo el catálogo se recorre por categorías y buscador. | Propuesto |
| RQ-CAR-01-05 | La ficha del producto muestra foto cuadrada ampliable, descripción, tamaños y grupos de opciones. | Debe tener | NEC-CAP-017 · BRD §4 · Acta 03 | Dado un producto con foto, cuando el cliente lo abre, entonces ve la foto cuadrada, puede ampliarla con un toque y la foto ampliada se adapta sin recortarse a productos anchos o altos y al tamaño de la pantalla; ve sus tamaños y grupos de opciones. | Propuesto |
| RQ-CAR-01-06 | Cada grupo de opciones aplica su obligatoriedad, mínimo y máximo. | Debe tener | RN-CAP-004 | Dado un grupo obligatorio con mínimo 1 y máximo 2, cuando el cliente intenta agregar sin elegir, entonces el botón queda desactivado con el aviso del grupo; al marcar una tercera opción, la más antigua no se agrega y se avisa del máximo. | Propuesto |
| RQ-CAR-01-07 | El precio de la ficha se recalcula en vivo con tamaño, opciones con precio extra y cantidad. | Debe tener | RN-CAP-004 · RN-CAP-007 | Dado un frappé de S/ 12 en tamaño grande (+S/ 2) con leche de almendras (+S/ 1,50) y cantidad 2, cuando el cliente lo arma, entonces el precio mostrado es S/ 31,00. | Propuesto |
| RQ-CAR-01-08 | Los toppings secos cuestan S/ 1 y los frappés muestran el aviso de hielo. | Debería tener | NEC-CAP-084 · RN-CAP-053 | Dado un frappé, cuando el cliente abre su ficha, entonces ve el aviso de hielo y los toppings secos (Oreo triturado, chispas, chin chin, almendra) a S/ 1 cada uno. | Propuesto |
| RQ-CAR-01-09 | En las bebidas se pide «Ingresa el nombre de la persona que tomará esta bebida», uno por cada unidad, con una imagen de referencia. | Debería tener | DT-57 · Acta 03 | Dados 3 capuchinos, cuando el cliente los agrega, entonces ve tres campos «Ingresa el nombre de la persona que tomará esta bebida» con la imagen de una etiqueta de ejemplo; si deja uno vacío se usa el nombre del cliente, y cada nombre sale en la etiqueta de su bebida (FT-COC-02). | Propuesto |
| RQ-CAR-01-10 | Los productos con variantes se eligen por sabor y solo muestran los sabores activos. | Debe tener | NEC-CAP-058 | Dado el tipo «Donas» con 5 sabores, 1 desactivado, cuando el cliente elige donas, entonces ve 4 sabores y no puede pedir el desactivado. | Propuesto |
| RQ-CAR-01-11 | Un combo se arma por unidad, en pasos plegables, y un paso con más de 10 opciones lleva buscador. | Debe tener | NEC-CAP-040 · RN-CAP-067 | Dado un combo de 2 frappés, cuando el cliente lo arma, entonces elige sabor, leche, dulzor y toppings de cada frappé en un paso plegable propio; si un paso tiene 11 opciones, aparece un buscador dentro. | Propuesto |
| RQ-CAR-01-12 | Una promoción muestra el precio anterior tachado y el porcentaje de descuento. | Debe tener | RN-CAP-007 · NEC-CAP-006 | Dado un producto de S/ 20 con promoción a S/ 15, cuando aparece en la carta, entonces se ve «S/ 20» tachado, «S/ 15» y «-25 %». | Propuesto |
| RQ-CAR-01-13 | Los combos Dúo muestran su precio por tamaño. | Debe tener | RN-CAP-007 | Dado el combo Dúo con precio para tamaño regular y grande, cuando el cliente lo abre, entonces ve los dos precios y el total cambia al elegir el tamaño. | Propuesto |

Prioridad por BRD §4 (E1). RQ-CAR-01-08 queda en *Debería tener* porque la lista de toppings la confirma Kevin (RN-CAP-053). Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-001 | Rendimiento | La carta abre en un celular con 4G y muestra la primera categoría sin esperar a que carguen todas las fotos. | Primera vista ≤ 3 s (p75) · medición: monitoreo del navegador (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-004 | Usabilidad | Las pantallas se usan desde un celular sin desplazamiento horizontal. | Ancho mínimo 360 px · 0 pantallas con scroll horizontal (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-005 | Accesibilidad | Texto legible para personas mayores y botones fáciles de tocar. | Contraste WCAG AA · objetivos táctiles ≥ 44 px (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-011 | Exactitud | Los montos se calculan en soles con dos decimales sin errores de redondeo. | Diferencia 0,00 entre total mostrado, cobrado y registrado (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-003 | Disponibilidad | La carta, el administrativo y el chatbot están en línea durante el horario de atención. | ≥ 99,5 % mensual en horario · medición: monitoreo externo (umbral propuesto) | Debe tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-001 y 005 aplican porque la carta la usan sobre todo celulares y personas mayores (BRD §3); RNF-CAP-011 porque el total de la ficha es el que llega a caja.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-004 | Cada producto puede tener tamaños y grupos de opciones; cada grupo indica si es obligatorio, mínimo, máximo y precio extra de cada opción. | BRD §5 (web anterior) |
| RN-CAP-005 | El chatbot ofrece las mismas opciones, precios y reglas que la carta. | BRD §5 |
| RN-CAP-006 | Los precios vigentes son los de la carta oficial; los de la web anterior no mandan. | BRD §5 · `recursos/carta-completa.md` |
| RN-CAP-007 | Una promoción muestra el precio anterior tachado y el porcentaje; los combos Dúo tienen precio por tamaño. | BRD §5 |
| RN-CAP-051 | La carta navega solo por categorías y buscador: sin filtros ni paginación. | Acta 02 |
| RN-CAP-053 | Las bebidas pueden llevar toppings opcionales con precio extra; la lista se confirma con el cliente. | Acta 02 |
| RN-CAP-067 | Un combo con más de 10 opciones lleva buscador dentro de la lista. | Pedido del 17/10 |
| RN-CAP-038 | Moneda: soles. Un solo local. | Acta 02 |
| DT-57 | En las bebidas se pide el nombre de quien la tomará, uno por unidad; sale como protagonista en su etiqueta. | Acta 03 · decisiones.md |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-CAR-01-01 | HU-CAP-001 | DEP-05 carta validada | R-03 |
| RQ-CAR-01-02 | HU-CAP-001 | — | R-01 |
| RQ-CAR-01-03 | HU-CAP-001 | — | R-01 |
| RQ-CAR-01-04 | HU-CAP-001 | — | R-01 |
| RQ-CAR-01-05 | HU-CAP-002 | — | R-01 |
| RQ-CAR-01-06 | HU-CAP-002 | — | R-01 |
| RQ-CAR-01-07 | HU-CAP-002 | — | R-03 |
| RQ-CAR-01-08 | HU-CAP-002 | DEP-05 lista de toppings | R-03 |
| RQ-CAR-01-09 | HU-CAP-002 | FT-COC-02 | R-01 |
| RQ-CAR-01-10 | HU-CAP-003 | — | R-01 |
| RQ-CAR-01-11 | HU-CAP-003 | FT-OFE-01 combos | R-01 |
| RQ-CAR-01-12 | HU-CAP-004 | FT-OFE-01 | R-01 |
| RQ-CAR-01-13 | HU-CAP-004 | FT-OFE-01 | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-001 Navegar la carta por categorías y buscador
- HU-CAP-002 Armar un producto con tamaño y opciones
- HU-CAP-003 Elegir sabores y armar un combo por unidad
- HU-CAP-004 Ver promociones y combos con su precio

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-003, ADR-006.

**Fuera de alcance**

- Agotados, horario y pausa en la carta: FT-CAR-02.
- Carrito, modalidad y datos del cliente: FT-PED-01.
- Cómo el administrador crea productos, listas y categorías: FT-CON-01.
- Cómo se crean combos y promociones: FT-OFE-01.
- Filtros por rango de precio y reseñas públicas (descartados, DT-13).

**Preguntas abiertas**

1. **Lista final de toppings y sus precios** — RN-CAP-053 la deja por confirmar con Kevin (D-15). Propuesta: la de NEC-CAP-084 (Oreo, chispas, chin chin, almendra a S/ 1).
2. **Fotos de todos los productos** — D-15. Mientras no lleguen, la ficha muestra un marcador neutro sin texto de «sin foto».

---

Generado por IA: BRD §1, §4 y §5 (NEC-CAP-006, 040, 058, 084; RN-CAP-004 a 007, 051, 053, 067), `recursos/carta-completa.md` y el mockup de la carta — Revisado por: *(pendiente)*
