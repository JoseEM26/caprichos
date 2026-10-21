---
id: EP-CAP-009
tipo: spec
titulo: "EP-CAP-009 Stock y recetas"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-19
relacionados: [CAP-PENDIENTE, BRD-CAP-001, RMP-CAP-001, NEC-CAP-002, NEC-CAP-003, NEC-CAP-026, NEC-CAP-071, RN-CAP-039, RN-CAP-041]
tags: [epica, plt-02, g1, stock, deberia-tener]
---

# EP-CAP-009 — Stock y recetas

| Campo | Valor |
| --- | --- |
| ID ÉPICA | EP-CAP-009 |
| NOMBRE | Stock y recetas |
| PRODUCTO | Plataforma digital de Caprichos |
| PRODUCT OWNER | José Ángel Espinoza (DT-48) |
| SPONSOR | Kevin Rosales (dueño, ACT-CAP-001) |
| PRIORIDAD | Debería tener |
| HORIZONTE | Siguiente |
| ESTADO | Borrador (`draft`) |
| FECHA / VERSIÓN | 19/10/2026 · 1.0 |

## 1 CONTEXTO

**Problema u oportunidad**

No se sabe cuánto queda de cada insumo ni cuánto se gana por plato. Se venden productos sin insumos y se descubre tarde que algo falta.

**Usuarios / segmentos**

- ACT-CAP-001: el dueño, que quiere el margen por plato
- ACT-CAP-005: almacén, que controla el stock
- ACT-CAP-003: cocina y barra, que preparan con receta

**Evidencia**

- NEC-CAP-002, NEC-CAP-003 y NEC-CAP-026.
- NEC-CAP-071: ficha del insumo con unidades y niveles.
- RN-CAP-039 y RN-CAP-041.
- `analisis/flujo-cocina-y-almacen.md` y el mockup de Stock y recetas.

**Alineamiento estratégico**

- OBJ-CAP-002 No vender lo que no hay.
- OBJ-CAP-003 Saber cuánto se gana por plato.

## 2 OBJETIVOS

**Objetivo de negocio**

Vender solo lo que hay y conocer el margen real de cada plato.

**Objetivo del usuario**

Que el dueño vea en un vistazo qué insumos están bajos y cuánto deja cada plato.

| Métrica (KPI) | Línea base | Meta | Fuente de datos | Frecuencia |
| --- | --- | --- | --- | --- |
| Platos de la carta con margen calculado | Por medir | Todos los platos con receta (OBJ-CAP-003) | Recetas y costos | Diaria |
| Pedidos con producto sin stock | Por medir | Cero (OBJ-CAP-002) | Pedidos y stock | Diaria |
| Diferencia entre stock del sistema y conteo físico | Por medir | Menos del 5 % (propuesta) | Cierre del día | Semanal |

Las metas marcadas «(propuesta)» son de la IA y las fija el dueño; las líneas base «por medir» se toman en las dos primeras semanas de uso.

## 3 ALCANCE

**En alcance (IN)**

- Ficha de insumo: unidades de compra, almacén y receta con equivalencias; niveles; vencimiento; proveedores (NEC-CAP-071).
- Stock por área: almacén central y cocina o barra (RN-CAP-127).
- Semáforo con mínimo, medio y máximo (RN-CAP-041, RN-CAP-118).
- Recetas por plato con costo y margen.
- Descuento de insumos al vender según la receta, primero del área y luego del almacén (RN-CAP-039).
- Aviso de poco stock al vender un producto elaborado.

**Fuera de alcance (OUT)**

- Producción, mermas y movimientos: EP-CAP-010.
- Compras: EP-CAP-011.
- Transferencia entre almacenes (hay uno solo).

**Features que componen la épica**

| ID Feature | Nombre | Prioridad | Estado |
| --- | --- | --- | --- |
| FT-STK-01 | Insumos, unidades y niveles | Debería tener | Redactada en draft: [`FT-STK-01-insumos-unidades-y-niveles.md`](../features/FT-STK-01-insumos-unidades-y-niveles.md) |
| FT-STK-02 | Recetas, costo y margen | Debería tener | Redactada en draft: [`FT-STK-02-recetas-costo-y-margen.md`](../features/FT-STK-02-recetas-costo-y-margen.md) |
| FT-STK-03 | Descuento por venta y disponibilidad | Debería tener | Redactada en draft: [`FT-STK-03-descuento-por-venta-y-disponibilidad.md`](../features/FT-STK-03-descuento-por-venta-y-disponibilidad.md) |

**Supuestos**

- Habrá recetas y costos para cargar (D-15).

**Restricciones**

- El stock nunca queda en negativo (RN-CAP-117).

**Dependencias y riesgos**

- DEP-10 Recetas, insumos y stock inicial (D-15).
- R-02 Datos incompletos.

**Criterios de éxito / salida**

- Al vender un producto con receta se descuentan sus insumos y el semáforo cambia de color.
- Cada plato con receta muestra su margen.

## 4 APROBACIONES

| Rol | Nombre | Fecha | Firma |
| --- | --- | --- | --- |
| Product Owner |  |  |  |
| Sponsor |  |  |  |
| Líder técnico |  |  |  |

---
Generado por IA: BRD §2, §4 y §5 (NEC-CAP-002, NEC-CAP-003, NEC-CAP-026, NEC-CAP-071, RN-CAP-039, RN-CAP-041, RN-CAP-117, RN-CAP-118, RN-CAP-127) y `analisis/flujo-cocina-y-almacen.md` — Revisado por: *(pendiente)*
