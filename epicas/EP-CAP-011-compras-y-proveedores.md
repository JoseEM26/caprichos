---
id: EP-CAP-011
tipo: spec
titulo: "EP-CAP-011 Compras y proveedores"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-19
relacionados: [CAP-PENDIENTE, BRD-CAP-001, RMP-CAP-001, NEC-CAP-027, NEC-CAP-069, NEC-CAP-070, NEC-CAP-112, RN-CAP-136, RN-CAP-137]
tags: [epica, plt-02, g1, compras, deberia-tener]
---

# EP-CAP-011 — Compras y proveedores

| Campo | Valor |
| --- | --- |
| ID ÉPICA | EP-CAP-011 |
| NOMBRE | Compras y proveedores |
| PRODUCTO | Plataforma digital de Caprichos |
| PRODUCT OWNER | José Ángel Espinoza (DT-48) |
| SPONSOR | Kevin Rosales (dueño, ACT-CAP-001) |
| PRIORIDAD | Debería tener |
| HORIZONTE | Siguiente |
| ESTADO | Borrador (`draft`) |
| FECHA / VERSIÓN | 19/10/2026 · 1.0 |

## 1 CONTEXTO

**Problema u oportunidad**

Los pedidos a proveedores se hacen de memoria por WhatsApp, sin saber qué falta ni a quién pedirlo, y las compras no suben el stock ni dejan su costo. No hay un directorio de proveedores con sus condiciones.

**Usuarios / segmentos**

- ACT-CAP-005: almacén, que pide y recibe
- ACT-CAP-001: el dueño, que paga y negocia con proveedores

**Evidencia**

- NEC-CAP-027, NEC-CAP-069, NEC-CAP-070 y NEC-CAP-112.
- RN-CAP-136 y RN-CAP-137: un insumo a un solo proveedor por pedido.
- `analisis/compras-y-proveedores.md`.

**Alineamiento estratégico**

- OBJ-CAP-002 No vender lo que no hay: reponer a tiempo.
- OBJ-CAP-003 Margen real con costos de compra.

## 2 OBJETIVOS

**Objetivo de negocio**

Reponer a tiempo con el proveedor correcto y que el costo real de cada compra alimente el margen.

**Objetivo del usuario**

Que almacén arme el pedido de lo que falta y lo mande por WhatsApp a cada proveedor con un clic.

| Métrica (KPI) | Línea base | Meta | Fuente de datos | Frecuencia |
| --- | --- | --- | --- | --- |
| Insumos que llegan a cero antes de reponerse | Por medir | Cero (propuesta) | Stock y compras | Semanal |
| Compras registradas con costo | Por medir | 100 % (propuesta) | Registro de compras | Mensual |

Las metas marcadas «(propuesta)» son de la IA y las fija el dueño; las líneas base «por medir» se toman en las dos primeras semanas de uso.

## 3 ALCANCE

**En alcance (IN)**

- Directorio de proveedores con RUC, WhatsApp, días de crédito y cuenta; se desactivan (NEC-CAP-070).
- Pedir a proveedores: lista de lo que falta, agrupada por proveedor, un mensaje de WhatsApp por proveedor (NEC-CAP-112).
- Un insumo a un solo proveedor por pedido; aviso si ya hay uno por recibir (RN-CAP-137).
- Pedido «por recibir» y recepción con costos, lote y vencimiento, que suma al stock (NEC-CAP-069).
- Historial de compras y de precios por proveedor.

**Fuera de alcance (OUT)**

- Órdenes de compra por correo (descartado, DT-13).
- Pagos a proveedores y cuentas por pagar contables.

**Features que componen la épica**

| ID Feature | Nombre | Prioridad | Estado |
| --- | --- | --- | --- |
| FT-COM-01 | Directorio de proveedores | Debería tener | Redactada en draft: [`FT-COM-01-directorio-de-proveedores.md`](../features/FT-COM-01-directorio-de-proveedores.md) |
| FT-COM-02 | Pedir a proveedores por WhatsApp | Debería tener | Redactada en draft: [`FT-COM-02-pedir-a-proveedores-por-whatsapp.md`](../features/FT-COM-02-pedir-a-proveedores-por-whatsapp.md) |
| FT-COM-03 | Registro y recepción de compras | Debería tener | Redactada en draft: [`FT-COM-03-registro-y-recepcion-de-compras.md`](../features/FT-COM-03-registro-y-recepcion-de-compras.md) |

**Supuestos**

- Los proveedores reciben pedidos por WhatsApp.

**Restricciones**

- No se reparte un insumo entre dos proveedores en el mismo pedido (DT-14).

**Dependencias y riesgos**

- DEP-11 Proveedores reales (D-15).

**Criterios de éxito / salida**

- Desde los insumos bajos se arma un pedido por proveedor y se abre el mensaje de WhatsApp.
- Recibir una compra suma al stock en la unidad del almacén y registra su costo.

## 4 APROBACIONES

| Rol | Nombre | Fecha | Firma |
| --- | --- | --- | --- |
| Product Owner |  |  |  |
| Sponsor |  |  |  |
| Líder técnico |  |  |  |

---
Generado por IA: BRD §5 (NEC-CAP-027, NEC-CAP-069, NEC-CAP-070, NEC-CAP-112, RN-CAP-136, RN-CAP-137) y `analisis/compras-y-proveedores.md` — Revisado por: *(pendiente)*
