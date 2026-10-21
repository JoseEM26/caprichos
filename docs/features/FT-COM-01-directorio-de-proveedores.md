---
id: FT-COM-01
tipo: spec
titulo: "Directorio de proveedores"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-20
relacionados: [EP-CAP-011, FT-COM-02, FT-COM-03, FT-STK-01, ADR-001, ADR-011, ADR-014, ADR-003, ADR-004, NEC-CAP-070, RN-CAP-082]
tags: [compras, plt-03, ep-cap-011, ft-com-01, deberia-tener]
---

# FT-COM-01 — Directorio de proveedores

**PLT-03 · Feature · Catálogo de requerimientos** · Frente COMPRAS · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-COM-01 | Directorio de proveedores | EP-CAP-011 Compras y proveedores |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debería tener** (NEC-CAP-070) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H2 · 01/03/2027 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** Un directorio de proveedores con razón social, **RUC**, contacto, **WhatsApp**, días de crédito y cuenta de pago (NEC-CAP-070). Cada proveedor muestra su **historial de compras y de precios** por insumo. Los proveedores no se eliminan: se desactivan; un proveedor desactivado conserva su historial y no se puede elegir en compras nuevas (RN-CAP-082 2.ª). Desde un insumo se ven sus proveedores A, B y C.

**Beneficio esperado.** Comprar mejor: saber a quién se le compra cada insumo, a qué precio y con qué condiciones. Hipótesis medible: **100 % de los insumos con al menos un proveedor A**.

**Usuarios / roles.** ACT-CAP-005 Almacén (consulta y mantiene) · ACT-CAP-001 Kevin Rosales, dueño y administrador (mantiene).

**Pantallas de referencia.** Administrativo ▸ Compras ▸ Proveedores (`Admin.dc.html`); `analisis/compras-y-proveedores.md` (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-COM-01-01 | Se registra un proveedor con razón social, RUC, contacto, WhatsApp, días de crédito y cuenta de pago. | Debería tener | NEC-CAP-070 | Dado el formulario, cuando almacén registra un proveedor con RUC de 11 dígitos, entonces queda guardado; un RUC con otro largo no se acepta. | Propuesto |
| RQ-COM-01-02 | Un RUC no se repite entre proveedores. | Debería tener | Propuesta (calidad) | Dado un RUC ya registrado, cuando se intenta registrar otro proveedor con él, entonces se rechaza. | Propuesto |
| RQ-COM-01-03 | Cada proveedor muestra su historial de compras y de precios por insumo. | Debería tener | NEC-CAP-070 | Dado un proveedor con 3 compras de leche, cuando se abre su ficha, entonces se ven las compras y la evolución del precio de la leche. | Propuesto |
| RQ-COM-01-04 | Un proveedor se desactiva, conserva su historial y no se elige en compras nuevas. | Debería tener | RN-CAP-082 (2.ª) · RN-CAP-014 | Dado un proveedor desactivado, cuando se registra una compra, entonces no aparece; su ficha sigue mostrando su historial. | Propuesto |
| RQ-COM-01-05 | El directorio se busca por nombre, RUC o insumo que provee. | Podría tener | NEC-CAP-047 | Dados 15 proveedores, cuando almacén busca «leche», entonces ve los que son A, B o C de la leche. | Propuesto |

Prioridad *Debería tener* por la épica. Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-014 | Conservación | Los registros no se borran: se desactivan o anulan (RN-CAP-014). | 0 borrados físicos fuera de las excepciones del BRD (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-009 | Auditoría | Toda acción que cambia datos guarda quién la hizo y cuándo. | 100 % de cambios con autor y fecha (umbral propuesto) | Debería tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. Los datos de proveedores son de empresas; no se aplica RNF-CAP-008 salvo contactos personales.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-082 (2.ª) | Un proveedor desactivado conserva su historial y no se elige; A, B y C no se repiten (id repetido, O1). | Proveedores |
| RN-CAP-014 | Los registros no se eliminan: se desactivan. | Diseño |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-COM-01-01 | HU-CAP-097 | DEP-11 (D-15) | R-01 |
| RQ-COM-01-02 | HU-CAP-097 | — | R-01 |
| RQ-COM-01-03 | HU-CAP-098 | FT-COM-03 | R-01 |
| RQ-COM-01-04 | HU-CAP-098 | — | R-01 |
| RQ-COM-01-05 | HU-CAP-097 | — | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-097 Registrar y editar un proveedor
- HU-CAP-098 Ver el historial de compras y precios de un proveedor

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-003, ADR-004.

**Fuera de alcance**

- Pedir a proveedores: FT-COM-02.
- Registrar compras: FT-COM-03.
- Pagos a proveedores y cuentas por pagar (no pedido).

**Preguntas abiertas**

1. **Lista de proveedores actuales** — D-15, DEP-11.

---

Generado por IA: BRD (NEC-CAP-047, 070; RN-CAP-014, 082), `analisis/compras-y-proveedores.md` y el mockup de Compras — Revisado por: *(pendiente)*
