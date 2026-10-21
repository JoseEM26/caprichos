---
id: EP-CAP-010
tipo: spec
titulo: "EP-CAP-010 Almacén y producción"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-19
relacionados: [CAP-PENDIENTE, BRD-CAP-001, RMP-CAP-001, NEC-CAP-026, NEC-CAP-075, NEC-CAP-081, NEC-CAP-102, RN-CAP-091, RN-CAP-117]
tags: [epica, plt-02, g1, almacen, deberia-tener]
---

# EP-CAP-010 — Almacén y producción

| Campo | Valor |
| --- | --- |
| ID ÉPICA | EP-CAP-010 |
| NOMBRE | Almacén y producción |
| PRODUCTO | Plataforma digital de Caprichos |
| PRODUCT OWNER | José Ángel Espinoza (DT-48) |
| SPONSOR | Kevin Rosales (dueño, ACT-CAP-001) |
| PRIORIDAD | Debería tener |
| HORIZONTE | Siguiente |
| ESTADO | Borrador (`draft`) |
| FECHA / VERSIÓN | 19/10/2026 · 1.0 |

## 1 CONTEXTO

**Problema u oportunidad**

Las entradas, salidas y mermas no se registran, la producción del día (donas, galletas, pan, gelatina) no entra al stock y lo que sobra al final del día se bota sin anotar. Cocina pide insumos al almacén de palabra.

**Usuarios / segmentos**

- ACT-CAP-005: almacén
- Producción (aún sin código ACT en el BRD): producción, que hace las tandas del día
- ACT-CAP-003: cocina y barra, que piden insumos y registran mermas

**Evidencia**

- NEC-CAP-026, NEC-CAP-075, NEC-CAP-081 y NEC-CAP-102.
- RN-CAP-091, RN-CAP-114 a RN-CAP-117, RN-CAP-121 y RN-CAP-124.
- `analisis/registro-mockup.md` v187: la producción toma primero de cocina y confirma si usa el almacén.

**Alineamiento estratégico**

- OBJ-CAP-002 No vender lo que no hay.
- NEC-CAP-081 Producción por tandas al stock.

## 2 OBJETIVOS

**Objetivo de negocio**

Que todo lo que entra, sale, se produce o se pierde quede registrado, para que el stock sea real.

**Objetivo del usuario**

Que producción registre su tanda en un minuto y que cocina pida insumos al almacén sin salir de su pantalla.

| Métrica (KPI) | Línea base | Meta | Fuente de datos | Frecuencia |
| --- | --- | --- | --- | --- |
| Tandas de producción registradas | Por medir | 100 % (propuesta) | Registro de producción | Diaria |
| Mermas registradas con motivo | Por medir | 100 % (propuesta) | Movimientos de almacén | Semanal |

Las metas marcadas «(propuesta)» son de la IA y las fija el dueño; las líneas base «por medir» se toman en las dos primeras semanas de uso.

## 3 ALCANCE

**En alcance (IN)**

- Movimientos de almacén: entrada, salida, merma y devolución (RN-CAP-046, RN-CAP-114).
- Producción por tanda: baja la materia prima (primero de cocina, luego del almacén con confirmación), suma el producto terminado y controla la vida útil (RN-CAP-091, RN-CAP-092).
- Pedidos de cocina y barra al almacén, con entrega y recepción (RN-CAP-093).
- Merma de varios productos a la vez (RN-CAP-116).
- Cierre del día con conteo físico: lo que sobra a merma con destino (RN-CAP-121, RN-CAP-124).

**Fuera de alcance (OUT)**

- Recetas y descuento por venta: EP-CAP-009.
- Compras a proveedores: EP-CAP-011.

**Features que componen la épica**

| ID Feature | Nombre | Prioridad | Estado |
| --- | --- | --- | --- |
| FT-ALM-01 | Movimientos de almacén | Debería tener | Redactada en draft: [`FT-ALM-01-movimientos-de-almacen.md`](../features/FT-ALM-01-movimientos-de-almacen.md) |
| FT-ALM-02 | Producción por tanda | Debería tener | Redactada en draft: [`FT-ALM-02-produccion-por-tanda.md`](../features/FT-ALM-02-produccion-por-tanda.md) |
| FT-ALM-03 | Pedidos internos, mermas y cierre del día | Debería tener | Redactada en draft: [`FT-ALM-03-pedidos-internos-mermas-y-cierre-del-dia.md`](../features/FT-ALM-03-pedidos-internos-mermas-y-cierre-del-dia.md) |

**Supuestos**

- Hay un solo almacén (RN-CAP-046).
- La encargada de producción registra al final de cada tanda.

**Restricciones**

- El stock nunca queda en negativo (RN-CAP-117).
- En Cocina solo se registra merma de productos de cocina (RN-CAP-115).

**Dependencias y riesgos**

- DEP-10 Recetas de producción reales (D-15).

**Criterios de éxito / salida**

- Una tanda de donas baja la materia prima, suma las donas y avisa a las 10 y 12 horas.
- Si la cocina no alcanza, pide confirmar antes de tomar del almacén.
- El cierre del día deja lo sobrante como merma con destino.

## 4 APROBACIONES

| Rol | Nombre | Fecha | Firma |
| --- | --- | --- | --- |
| Product Owner |  |  |  |
| Sponsor |  |  |  |
| Líder técnico |  |  |  |

---
Generado por IA: BRD §5 (NEC-CAP-026, NEC-CAP-075, NEC-CAP-081, NEC-CAP-102, RN-CAP-046, RN-CAP-091 a RN-CAP-093, RN-CAP-114 a RN-CAP-117, RN-CAP-121, RN-CAP-124) y `analisis/registro-mockup.md` v187 — Revisado por: *(pendiente)*
