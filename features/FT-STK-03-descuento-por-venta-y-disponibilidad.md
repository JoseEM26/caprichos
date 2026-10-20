---
id: FT-STK-03
tipo: spec
titulo: "Descuento por venta y disponibilidad"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-009, FT-STK-01, FT-STK-02, FT-CAR-02, FT-ALM-01, FT-INF-03, ADR-001, ADR-011, ADR-014, ADR-003, ADR-007, NEC-CAP-002, NEC-CAP-026, RN-CAP-003, RN-CAP-039, RN-CAP-127]
tags: [stock, plt-03, ep-cap-009, ft-stk-03, deberia-tener]
---

# FT-STK-03 — Descuento por venta y disponibilidad

**PLT-03 · Feature · Catálogo de requerimientos** · Frente STOCK · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-STK-03 | Descuento por venta y disponibilidad | EP-CAP-009 Stock y recetas |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debería tener** (NEC-CAP-002 · OBJ-CAP-002) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H2 · 01/03/2027 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** Cada venta **baja los insumos de su receta** del stock del área que la prepara; cada parte de un combo se descuenta desde su área (RN-CAP-127, RN-CAP-085 2.ª). Los productos hechos por lote bajan su propio stock de producto terminado. El descuento ocurre cuando el pedido pasa a cocina (confirmado o enviado por el mozo); un pedido rechazado no descuenta y una anulación devuelve. Si un insumo no alcanza, **se avisa y se deja vender** (decisión del 19/10): el stock puede quedar bajo cero en el área y aparece como alerta para corregirlo. Con stock, el producto cuya receta tiene un insumo en cero se muestra agotado en la carta (RN-CAP-003). Al bajar de su mínimo, se notifica.

**Un solo camino de salida.** El stock de un área solo baja por ventas, merma o devolución desde esa área; entre el almacén y un área solo hay traslados (FT-ALM-01, RN-CAP-127).

**Beneficio esperado.** Stock al día sin conteos manuales, y no ofrecer lo que no hay (OBJ-CAP-002). Hipótesis medible: **Diferencia entre stock del sistema y conteo físico ≤ 5 % por insumo** (propuesta) y **0 pedidos con productos sin insumos ofrecidos como disponibles**.

**Usuarios / roles.** El propio sistema (tareas automáticas) (descuenta al pasar a cocina) · ACT-CAP-005 Almacén (corrige diferencias) · ACT-CAP-001 Kevin Rosales, dueño y administrador (recibe alertas).

**Pantallas de referencia.** Administrativo ▸ Stock y recetas (movimientos por venta), notificaciones de stock bajo (`Admin.dc.html`) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-STK-03-01 | Al pasar un pedido a cocina se descuentan los insumos de su receta del área que lo prepara. | Debería tener | RN-CAP-039 · RN-CAP-127 | Dado un capuchino (18 g café, 200 ml leche) preparado en Barra, cuando el pedido pasa a cocina, entonces Barra baja 18 g de café y 200 ml de leche con un movimiento «Venta · pedido N». | Propuesto |
| RQ-STK-03-02 | Cada parte de un combo se descuenta desde su área y se registra el combo vendido. | Debería tener | RN-CAP-085 (2.ª) · RN-CAP-035 | Dado un combo de frappé y dona, cuando pasa a cocina, entonces el frappé descuenta de Barra, la dona del stock de producto terminado y el informe registra el combo. | Propuesto |
| RQ-STK-03-03 | Las opciones descuentan lo que su receta indique. | Debería tener | NEC-CAP-088 | Dado un capuchino con shot extra (+9 g de café), cuando pasa a cocina, entonces baja 27 g de café. | Propuesto |
| RQ-STK-03-04 | Un pedido rechazado no descuenta y una anulación devuelve lo descontado. | Debería tener | RN-CAP-019 · RN-CAP-089 | Dado un pedido anulado después de pasar a cocina, cuando se anula, entonces se registra un movimiento de devolución por las mismas cantidades, salvo lo que se marque como merma. | Propuesto |
| RQ-STK-03-05 | Si un insumo no alcanza, se avisa y se deja vender. | Debería tener | Decisión del 19/10 (registro-mockup) | Dado 100 ml de leche en Barra, cuando se vende un capuchino de 200 ml, entonces la venta procede, Barra queda en −100 ml y aparece una alerta «Stock negativo en Barra: leche». | Propuesto |
| RQ-STK-03-06 | Un producto cuya receta tiene un insumo en cero o menos se muestra agotado en la carta. | Debería tener | RN-CAP-003 · OBJ-CAP-002 | Dado el café en cero en Barra, cuando el cliente abre la carta, entonces los productos con café se ven agotados hasta que entre café a Barra. | Propuesto |
| RQ-STK-03-07 | Al bajar del mínimo, se notifica a almacén y al administrador. | Debería tener | NEC-CAP-026 · RN-CAP-041 | Dado un mínimo de 10 L, cuando una venta deja la leche en 9 L, entonces almacén y el administrador reciben «Leche por debajo del mínimo». | Propuesto |
| RQ-STK-03-08 | Cada descuento por venta queda como movimiento con pedido, área, insumo y cantidad. | Debería tener | RNF-CAP-020 | Dado un día de ventas, cuando almacén abre el historial y filtra «Venta», entonces ve cada movimiento con su pedido. | Propuesto |

Prioridad *Debería tener* por la épica. RQ-STK-03-05 aplica la decisión «avisar y dejar vender» tomada en el mockup el 19/10 (registro-mockup.md). Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-020 | Trazabilidad | Todo cambio de stock deja un movimiento con origen, cantidad, autor y fecha. | 100 % de cambios de stock con movimiento (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-002 | Tiempo real | Un pedido que pasa a cocina aparece en todas sus pantallas sin recargar. | Retardo ≤ 3 s (p95) · medición: registro de eventos (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-011 | Exactitud | Los montos se calculan en soles con dos decimales sin errores de redondeo. | Diferencia 0,00 entre total mostrado, cobrado y registrado (umbral propuesto) | Debería tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-020 es el umbral clave: ningún cambio de stock sin movimiento.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-003 | Solo se ofrece lo disponible según el stock. | Acta 01 |
| RN-CAP-039 | Al vender se descuentan los insumos por receta; los de lote entran desde la producción. | Acta 02 |
| RN-CAP-085 (2.ª) | Al vender un combo se descuenta cada producto por separado y se registra el combo (id repetido, O1). | Reunión del 18/10 |
| RN-CAP-127 | Cada venta baja los insumos del área que la prepara; cada parte de un combo desde su área. | Stock |
| DT-19 | La venta descuenta por receta; el stock de producción no queda en negativo. | decisiones.md |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-STK-03-01 | HU-CAP-085 | FT-STK-02 | R-02 |
| RQ-STK-03-02 | HU-CAP-085 | FT-OFE-01 | R-01 |
| RQ-STK-03-03 | HU-CAP-085 | FT-STK-02 | R-01 |
| RQ-STK-03-04 | HU-CAP-086 | — | R-01 |
| RQ-STK-03-05 | HU-CAP-086 | — | R-02 |
| RQ-STK-03-06 | HU-CAP-087 | FT-CAR-02 | R-01 |
| RQ-STK-03-07 | HU-CAP-087 | FT-INF-03 | R-01 |
| RQ-STK-03-08 | HU-CAP-086 | FT-ALM-01 | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-085 Descontar insumos al pasar un pedido a cocina
- HU-CAP-086 Devolver insumos al anular un pedido
- HU-CAP-087 Avisar stock negativo o bajo y apagar productos sin insumos

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-003, ADR-007.

**Fuera de alcance**

- Producción y su descuento de materia prima: FT-ALM-02.
- Traslados entre almacén y áreas: FT-ALM-01.

**Preguntas abiertas**

1. **¿Descontar al pasar a cocina o al cobrar?** Propuesta: al pasar a cocina, porque es cuando se usan los insumos.
2. **¿Apagar productos automáticamente por stock desde el piloto?** Propuesta: solo cuando las recetas estén completas y validadas.

---

Generado por IA: BRD (NEC-CAP-002, 026, 088; RN-CAP-003, 019, 035, 039, 041, 085, 089, 127), DT-19, decisión del 19/10 en `analisis/registro-mockup.md` — Revisado por: *(pendiente)*
