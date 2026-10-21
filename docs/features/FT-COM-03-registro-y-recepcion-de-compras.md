---
id: FT-COM-03
tipo: spec
titulo: "Registro y recepción de compras"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-20
relacionados: [EP-CAP-011, FT-COM-01, FT-COM-02, FT-ALM-01, FT-STK-02, ADR-001, ADR-011, ADR-014, ADR-003, ADR-004, NEC-CAP-069, RN-CAP-081, RN-CAP-136]
tags: [compras, plt-03, ep-cap-011, ft-com-03, deberia-tener]
---

# FT-COM-03 — Registro y recepción de compras

**PLT-03 · Feature · Catálogo de requerimientos** · Frente COMPRAS · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-COM-03 | Registro y recepción de compras | EP-CAP-011 Compras y proveedores |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debería tener** (NEC-CAP-069) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H2 · 01/03/2027 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** Cada compra a un proveedor se registra con su **comprobante** (tipo, número y foto), condición **contado o crédito** y el **detalle**: insumo, cantidad en unidad de compra y costo (NEC-CAP-069); la serie del comprobante es opcional. **No se pide lote ni fecha de vencimiento** (DT-64, acta 03): el almacén es chico, no usa código de barras y las compras de un mes se mezclan con las del siguiente, así que esos datos no servirían. La cantidad se **convierte** a la unidad del almacén con la equivalencia del insumo (RN-CAP-081 2.ª). Al registrarla, **suma al stock** del almacén y deja la entrada en Almacén. Un pedido «Por recibir» (FT-COM-02) se recibe completando costos y comprobante; recién ahí sube el stock (RN-CAP-136). Una compra registrada no se borra: se anula o se marca pagada. El costo de la compra actualiza el costo del insumo para las recetas.

**Beneficio esperado.** Stock y costos actualizados con cada compra; base del margen por plato (OBJ-CAP-003). Hipótesis medible: **100 % de compras con comprobante y costo**; **costo de insumos actualizado en el 100 % de las recetas**.

**Usuarios / roles.** ACT-CAP-005 Almacén (registra y recibe) · ACT-CAP-001 Kevin Rosales, dueño y administrador (marca pagadas).

**Pantallas de referencia.** Administrativo ▸ Compras ▸ Registrar compra, Por recibir, historial (`Admin.dc.html`) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-COM-03-01 | Se registra una compra con proveedor, comprobante, condición y detalle. | Debería tener | NEC-CAP-069 | Dada una factura de 2 cajas de leche a S/ 60 cada una, cuando almacén la registra con su foto, entonces queda con total S/ 120 y condición «crédito 15 días». | Propuesto |
| RQ-COM-03-02 | La cantidad se convierte a la unidad del almacén con la equivalencia del insumo. | Debería tener | RN-CAP-081 (2.ª) | Dadas 2 cajas de 12 L, cuando se registra la compra, entonces el almacén sube 24 L. | Propuesto |
| RQ-COM-03-03 | La compra no pide lote ni fecha de vencimiento. | Debería tener | DT-64 · Acta 03 | Dada una compra de 15 filetes de pollo, cuando almacén la registra, entonces el formulario no tiene campos de lote ni de vencimiento y la compra se guarda con insumo, cantidad y costo. | Propuesto |
| RQ-COM-03-04 | Registrar la compra suma al stock y deja la entrada en Almacén. | Debería tener | NEC-CAP-069 | Dada la compra guardada, cuando almacén abre el historial, entonces ve la entrada «Compra · proveedor · comprobante». | Propuesto |
| RQ-COM-03-05 | Un pedido «Por recibir» se recibe con costos y comprobante, y recién ahí sube el stock. | Debería tener | RN-CAP-136 | Dado un pedido por recibir de 3 cajas, cuando llegan 2, entonces almacén recibe 2 con su costo y el pedido queda parcial con 1 pendiente. | Propuesto |
| RQ-COM-03-06 | El costo de la compra actualiza el costo del insumo para las recetas. | Debería tener | OBJ-CAP-003 | Dada la leche a S/ 5 por litro en la nueva compra, cuando se registra, entonces el costo de la leche pasa a S/ 5 y los márgenes se recalculan. | Propuesto |
| RQ-COM-03-07 | Una compra no se borra: se anula con motivo o se marca pagada. | Debería tener | RN-CAP-081 (2.ª) · RN-CAP-014 | Dada una compra a crédito, cuando el administrador la marca pagada, entonces queda con fecha de pago; al anularla, se revierte su entrada al stock. | Propuesto |
| RQ-COM-03-08 | Las compras se filtran por proveedor, fechas, condición y estado de pago. | Podría tener | NEC-CAP-050 | Dadas compras de un mes, cuando se filtra «crédito sin pagar», entonces solo aparecen esas, con su vencimiento de pago. | Propuesto |

Prioridad *Debería tener* por la épica. Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-020 | Trazabilidad | Todo cambio de stock deja un movimiento con origen, cantidad, autor y fecha. | 100 % de cambios de stock con movimiento (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-011 | Exactitud | Los montos se calculan en soles con dos decimales sin errores de redondeo. | Diferencia 0,00 entre total mostrado, cobrado y registrado (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-014 | Conservación | Los registros no se borran: se desactivan o anulan (RN-CAP-014). | 0 borrados físicos fuera de las excepciones del BRD (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-009 | Auditoría | Toda acción que cambia datos guarda quién la hizo y cuándo. | 100 % de cambios con autor y fecha (umbral propuesto) | Debería tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-020 aplica a la entrada de stock de cada compra.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-081 (2.ª) | La cantidad se convierte a la unidad del almacén; una compra no se borra (id repetido, O1). Lo de exigir vencimiento a los perecibles queda **reemplazado por DT-64**. | Compras |
| RN-CAP-136 | Al llegar se recibe y se registran costos y comprobante; recién ahí sube el stock (sin vencimientos, DT-64). | Revisión de Compras 19/10 |
| DT-64 | Las compras no llevan lote ni fecha de vencimiento. | Acta 03 · decisiones.md |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-COM-03-01 | HU-CAP-102 | FT-COM-01 | R-01 |
| RQ-COM-03-02 | HU-CAP-102 | FT-STK-01 | R-01 |
| RQ-COM-03-03 | HU-CAP-102 | — | R-01 |
| RQ-COM-03-04 | HU-CAP-102 | FT-ALM-01 | R-01 |
| RQ-COM-03-05 | HU-CAP-103 | FT-COM-02 | R-01 |
| RQ-COM-03-06 | HU-CAP-104 | FT-STK-02 | R-01 |
| RQ-COM-03-07 | HU-CAP-104 | — | R-01 |
| RQ-COM-03-08 | HU-CAP-104 | — | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-102 Registrar una compra con su comprobante
- HU-CAP-103 Recibir un pedido por recibir, completo o parcial
- HU-CAP-104 Anular una compra o marcarla pagada

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-003, ADR-004.

**Fuera de alcance**

- Cuentas por pagar y pagos a proveedores desde el sistema (solo se marca pagada).
- Facturación electrónica del proveedor (DT-11).

**Preguntas abiertas**

1. **Recepción parcial** — propuesta en RQ-COM-03-05; por confirmar con Kevin.

---

Generado por IA: BRD (NEC-CAP-050, 069; RN-CAP-014, 081, 136), OBJ-CAP-003 y el mockup de Compras — Revisado por: *(pendiente)*
