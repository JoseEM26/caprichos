---
id: FT-COM-02
tipo: spec
titulo: "Pedir a proveedores por WhatsApp"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-20
relacionados: [EP-CAP-011, FT-COM-01, FT-COM-03, FT-STK-01, ADR-001, ADR-011, ADR-014, ADR-003, ADR-004, NEC-CAP-027, NEC-CAP-112, RN-CAP-136, RN-CAP-137]
tags: [compras, plt-03, ep-cap-011, ft-com-02, deberia-tener]
---

# FT-COM-02 — Pedir a proveedores por WhatsApp

**PLT-03 · Feature · Catálogo de requerimientos** · Frente COMPRAS · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-COM-02 | Pedir a proveedores por WhatsApp | EP-CAP-011 Compras y proveedores |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debería tener** (NEC-CAP-027 · NEC-CAP-112) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H2 · 01/03/2027 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** Pedir a proveedores se hace en Compras (NEC-CAP-112). La lista trae lo que está **bajo el mínimo** (y, si se quiere, lo regular), con cantidades en **cajas o sacos enteros** según la unidad de compra, agrupado por proveedor A del insumo, y genera **un mensaje de WhatsApp por proveedor** (RN-CAP-136). Un insumo se pide a un solo proveedor por vez; elegir otro lo cambia de pedido (no se reparte mitad y mitad), y si el insumo ya tiene un pedido por recibir, se avisa (RN-CAP-137). Enviar el mensaje crea un pedido **«Por recibir»**, que se puede anular sin tocar el stock. Hay atajos desde Almacén y Stock para empezar el pedido con un clic (NEC-CAP-027).

**Beneficio esperado.** Armar el pedido a proveedores en minutos y sin olvidar insumos. Hipótesis medible: **0 insumos bajo el mínimo sin pedido en curso al final de la semana** (propuesta).

**Usuarios / roles.** ACT-CAP-005 Almacén (arma y envía los pedidos) · ACT-CAP-001 Kevin Rosales, dueño y administrador (revisa).

**Pantallas de referencia.** Administrativo ▸ Compras ▸ Pedir a proveedores (`Admin.dc.html`); `analisis/compras-y-proveedores.md` (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-COM-02-01 | La lista de pedido trae los insumos bajo el mínimo y, opcionalmente, los regulares. | Debería tener | RN-CAP-136 | Dados 3 insumos rojos y 2 naranjas, cuando almacén abre «Pedir», entonces ve los 3 rojos y, al marcar «Incluir regulares», los 5. | Propuesto |
| RQ-COM-02-02 | La cantidad sugerida llega al máximo y se redondea a unidades de compra enteras. | Debería tener | RN-CAP-136 | Dada la leche con 8 L, máximo 40 L y caja de 12 L, cuando se arma el pedido, entonces sugiere 3 cajas (36 L). | Propuesto |
| RQ-COM-02-03 | Los insumos se agrupan por su proveedor A y se puede cambiar el proveedor de un insumo. | Debería tener | RN-CAP-136 · RN-CAP-137 | Dada la leche con proveedor A «Lácteos SAC», cuando almacén elige su proveedor B, entonces la leche pasa al grupo del proveedor B y sale del A. | Propuesto |
| RQ-COM-02-04 | Si un insumo ya tiene un pedido por recibir, se avisa. | Debería tener | RN-CAP-137 | Dada la leche en un pedido por recibir, cuando aparece en la lista, entonces muestra «Ya pedida el 18/10». | Propuesto |
| RQ-COM-02-05 | Se genera un mensaje de WhatsApp por proveedor con los insumos y cantidades. | Debería tener | NEC-CAP-027 · RN-CAP-083 (2.ª) | Dado un grupo de 3 insumos para un proveedor, cuando almacén toca «Enviar por WhatsApp», entonces se abre WhatsApp con el número del proveedor y el mensaje armado. | Propuesto |
| RQ-COM-02-06 | Enviar crea un pedido «Por recibir», que se puede anular sin tocar el stock. | Debería tener | RN-CAP-136 | Dado el mensaje enviado, cuando almacén confirma, entonces queda un pedido «Por recibir»; al anularlo con motivo, el stock no cambia. | Propuesto |
| RQ-COM-02-07 | Desde Almacén y Stock hay un atajo para pedir un insumo. | Podría tener | NEC-CAP-112 | Dado un insumo rojo en Stock, cuando almacén toca «Pedir», entonces se abre Compras con ese insumo en la lista. | Propuesto |

Prioridad *Debería tener* por la épica. Órdenes de compra por correo descartadas (DT-13). Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-009 | Auditoría | Toda acción que cambia datos guarda quién la hizo y cuándo. | 100 % de cambios con autor y fecha (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-014 | Conservación | Los registros no se borran: se desactivan o anulan (RN-CAP-014). | 0 borrados físicos fuera de las excepciones del BRD (umbral propuesto) | Debería tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. El envío por WhatsApp se hace abriendo el chat; no usa plantillas pagadas (sin RNF-CAP-015).

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-083 (2.ª) | La orden por WhatsApp se arma desde el insumo, con su proveedor A (id repetido, O1). | Compras |
| RN-CAP-136 | La lista trae lo bajo el mínimo en unidades enteras, agrupa por proveedor y crea un pedido «Por recibir». | Revisión de Compras 19/10 |
| RN-CAP-137 | Un insumo se pide a un solo proveedor por vez; se avisa si ya tiene pedido. | Decisión del dueño 19/10 |
| DT-14 | Un insumo se pide a un solo proveedor por pedido. | decisiones.md |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-COM-02-01 | HU-CAP-099 | FT-STK-01 | R-01 |
| RQ-COM-02-02 | HU-CAP-099 | — | R-01 |
| RQ-COM-02-03 | HU-CAP-100 | FT-COM-01 | R-01 |
| RQ-COM-02-04 | HU-CAP-100 | — | R-01 |
| RQ-COM-02-05 | HU-CAP-101 | FT-COM-01 | R-01 |
| RQ-COM-02-06 | HU-CAP-101 | — | R-01 |
| RQ-COM-02-07 | HU-CAP-099 | — | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-099 Armar la lista de insumos a pedir
- HU-CAP-100 Elegir el proveedor de cada insumo
- HU-CAP-101 Enviar el pedido por WhatsApp y seguirlo como «Por recibir»

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-003, ADR-004.

**Fuera de alcance**

- Recibir el pedido y registrar costos: FT-COM-03.
- Órdenes de compra por correo (descartadas, DT-13).

**Preguntas abiertas**

1. **¿Se incluyen los regulares por defecto?** Propuesta: no; se marcan a mano.

---

Generado por IA: BRD (NEC-CAP-027, 112; RN-CAP-083, 136, 137), DT-14, `analisis/compras-y-proveedores.md` y el mockup de Compras — Revisado por: *(pendiente)*
