---
id: FT-CAJ-02
tipo: spec
titulo: "Cobro con medios de pago y pago mixto"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-004, FT-CAJ-01, FT-CIE-01, FT-CIE-02, FT-LEG-01, FT-CLI-02, FT-USR-03, ADR-001, ADR-011, ADR-014, ADR-003, ADR-006, ADR-007, ADR-008, ADR-010, ADR-012, NEC-CAP-063, RN-CAP-011, RN-CAP-030, RN-CAP-096]
tags: [caja, plt-03, ep-cap-004, ft-caj-02, debe-tener]
---

# FT-CAJ-02 — Cobro con medios de pago y pago mixto

**PLT-03 · Feature · Catálogo de requerimientos** · Frente CAJA · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-CAJ-02 | Cobro con medios de pago y pago mixto | EP-CAP-004 Confirmación y cobro en caja |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debe tener** (NEC-CAP-063) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H1 · piloto en el local · 28/12/2026 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** El cajero cobra cada pedido eligiendo el medio de pago: efectivo, Yape, Plin, transferencia o tarjeta (RN-CAP-011). Puede **dividir el pago** entre varios medios; los montos deben sumar el total y el vuelto se calcula sobre la parte en efectivo (NEC-CAP-063, RN-CAP-082). Anota con cuánto paga el cliente y ve el vuelto. El mozo no cobra: saca la precuenta y el cajero cobra (RN-CAP-030). Al cobrar se elige el comprobante (nota de venta por defecto), se libera la mesa si es un pedido de salón, se suman los puntos si hay cuenta y, si el pago es a crédito del personal, se carga al mes del trabajador. **Anular** lo puede hacer el cajero, con **motivo obligatorio** y la aprobación de el PIN de 6 dígitos de la supervisora (rol administrador), escrito en persona en la caja, no por una notificación a distancia: así responden dos personas (DT-61, acta 03). Un pedido cobrado solo se anula mientras el cobro siga en la caja abierta (RN-CAP-096). Si el cliente tiene cuenta, en el cobro también puede **canjear puntos** (FT-CLI-02). Todo cobro alimenta el cierre de caja por medio de pago.

**Beneficio esperado.** Cobros exactos por medio de pago que cuadran con el cierre del día, sin cuentas hechas a mano. Hipótesis medible: **Diferencia 0,00 entre lo cobrado por medio y lo que suma el cierre**; **0 anulaciones de cobro sin motivo y PIN**.

**Usuarios / roles.** ACT-CAP-002 Cajero/a (cobra y pide anulaciones) · ACT-CAP-001 Kevin Rosales, dueño y administrador (como supervisora, aprueba anulaciones con su PIN en la caja) · ACT-CAP-004 Mozos (saca la precuenta, no cobra).

**Pantallas de referencia.** Administrativo ▸ Pedidos y caja ▸ Cobrar, pago mixto, vuelto, comprobante, anular (`Admin.dc.html`) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-CAJ-02-01 | El cajero cobra eligiendo uno de los medios activos: efectivo, Yape, Plin, transferencia o tarjeta. | Debe tener | RN-CAP-011 · NEC-CAP-063 | Dado un pedido de S/ 42, cuando el cajero elige «Plin» y confirma, entonces el pedido queda cobrado con Plin S/ 42, su autor y hora. | Propuesto |
| RQ-CAJ-02-02 | Con efectivo, el cajero anota con cuánto paga el cliente y ve el vuelto. | Debe tener | NEC-CAP-063 | Dado un total de S/ 42, cuando el cajero escribe S/ 100 en efectivo, entonces ve vuelto S/ 58,00; con S/ 40 no puede cobrar. | Propuesto |
| RQ-CAJ-02-03 | El cajero divide el pago entre varios medios y los montos deben sumar el total. | Debe tener | NEC-CAP-063 · RN-CAP-082 (1.ª) | Dado un total de S/ 42, cuando el cajero pone S/ 20 Yape y S/ 20 efectivo, entonces ve «Faltan S/ 2,00» y no puede cobrar; con S/ 22 en efectivo, sí. | Propuesto |
| RQ-CAJ-02-04 | En un pago mixto, el vuelto se calcula solo sobre la parte en efectivo. | Debe tener | RN-CAP-082 (1.ª) | Dado un total de S/ 42 con S/ 30 Yape y efectivo por S/ 12 entregado con S/ 20, cuando se cobra, entonces el vuelto es S/ 8,00. | Propuesto |
| RQ-CAJ-02-05 | El mozo saca la precuenta y no puede cobrar. | Debe tener | RN-CAP-030 | Dado un usuario mozo con una mesa ocupada, cuando abre el pedido, entonces puede imprimir la precuenta y no ve el botón «Cobrar». | Propuesto |
| RQ-CAJ-02-06 | Al cobrar un pedido de salón se liberan su mesa o sus mesas. | Debe tener | RN-CAP-054 · RN-CAP-108 | Dado un pedido que ocupa las mesas 4 y 5, cuando se cobra, entonces ambas quedan libres en el plano. | Propuesto |
| RQ-CAJ-02-07 | Al cobrar se elige el comprobante, nota de venta por defecto. | Debe tener | RN-CAP-037 | Dado un cobro, cuando el cajero no cambia nada, entonces el comprobante es nota de venta; si el cliente pidió factura, se exige RUC. | Propuesto |
| RQ-CAJ-02-08 | El cajero puede cobrar a crédito del personal un pedido del personal. | Debería tener | RN-CAP-072 · RN-CAP-131 | Dado un pedido del personal, cuando el cajero elige «Crédito del personal», entonces el monto con descuento se suma al mes del trabajador y no entra a la caja. | Propuesto |
| RQ-CAJ-02-09 | El cajero anula un pedido con motivo obligatorio y el PIN de 6 dígitos de la supervisora (rol administrador), escrito en persona en la caja; un cobrado, solo si el cobro sigue en la caja abierta. | Debe tener | RN-CAP-096 · RN-CAP-094 · DT-61 | Dado un cobro de la caja abierta, cuando el cajero elige el motivo y la supervisora escribe su PIN de 6 dígitos en la pantalla de caja, entonces el pedido queda anulado y el cobro sale de los totales; sin motivo o con un PIN de 4 dígitos no se acepta; con la caja ya cerrada, no se permite; no existe aprobación por notificación. | Propuesto |
| RQ-CAJ-02-10 | Toda anulación guarda quién la pidió, quién la aprobó con su PIN y el motivo. | Debe tener | RN-CAP-089 · DT-61 · DT-49 | Dado un pedido anulado por el cajero Luis con el PIN de la supervisora Ana, cuando se revisa el Historial de acciones, entonces aparece «ANULAR · CP-0098 · pidió Luis · aprobó Ana · motivo: cliente no pagó». | Propuesto |
| RQ-CAJ-02-11 | No se puede cobrar con la caja cerrada. | Debe tener | RN-CAP-077 · RN-CAP-079 | Dada la caja del día sin abrir, cuando el cajero intenta cobrar, entonces ve «Abre la caja para cobrar». | Propuesto |
| RQ-CAJ-02-12 | Tras 3 PIN incorrectos seguidos, la aprobación se bloquea 5 minutos y queda registrado. | Debe tener | Propuesta (seguridad) · DT-61 | Dados 3 PIN erróneos en una anulación, cuando se intenta un cuarto, entonces se rechaza con «Espera 5 minutos» y el Historial de acciones registra los 3 intentos con la caja y la hora. | Propuesto |

Prioridad por NEC-CAP-063 (E1). RQ-CAJ-02-12 es derivado (seguridad del PIN). RQ-CAJ-02-08 es *Debería tener* porque el crédito del personal va en la fase Siguiente. Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-011 | Exactitud | Los montos se calculan en soles con dos decimales sin errores de redondeo. | Diferencia 0,00 entre total mostrado, cobrado y registrado (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-009 | Auditoría | Toda acción que cambia datos guarda quién la hizo y cuándo. | 100 % de cambios con autor y fecha (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-007 | Seguridad | Las contraseñas y PIN se guardan solo como huella (hash con sal), nunca en texto. | 0 contraseñas en texto · revisión de la base (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-012 | Usabilidad | Toda acción que cambia datos pide confirmación Sí/No (RN-CAP-015). | 100 % de acciones de cambio con confirmación (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-014 | Conservación | Los registros no se borran: se desactivan o anulan (RN-CAP-014). | 0 borrados físicos fuera de las excepciones del BRD (umbral propuesto) | Debe tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-011 aplica a vuelto y pago mixto; RNF-CAP-007 al PIN del administrador.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-011 | Medios admitidos: efectivo (con monto para vuelto), Yape, Plin, transferencia y tarjeta. | Web anterior |
| RN-CAP-030 | El mozo no cobra: saca la precuenta y el cajero cobra. | Acta 02 |
| RN-CAP-082 (1.ª) | Los montos de un pago mixto suman el total; el vuelto se calcula sobre el efectivo (id repetido, O1). | Revisión del rol cajero |
| RN-CAP-089 | Anular exige motivo y queda en el historial; solo se anulan pedidos sin cobrar. | Pedidos |
| RN-CAP-094 | Anular por otro rol exige el PIN del administrador. | Permisos |
| RN-CAP-096 | Anular un cobrado exige motivo y PIN, solo admin y cajero, solo con el cobro en la caja abierta. | Caja |
| DT-61 | El cajero anula con motivo y el PIN de 6 dígitos de la supervisora, en persona; cierre de caja ciego. | Acta 03 · decisiones.md |
| RN-CAP-054 | Una mesa se libera al cobrar y también a mano. | Acta 02 |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-CAJ-02-01 | HU-CAP-033 | FT-CFG-02 | R-01 |
| RQ-CAJ-02-02 | HU-CAP-033 | — | R-01 |
| RQ-CAJ-02-03 | HU-CAP-034 | — | R-01 |
| RQ-CAJ-02-04 | HU-CAP-034 | — | R-01 |
| RQ-CAJ-02-05 | HU-CAP-033 | FT-SAL-02 | R-01 |
| RQ-CAJ-02-06 | HU-CAP-033 | FT-SAL-02 | R-01 |
| RQ-CAJ-02-07 | HU-CAP-035 | FT-LEG-01 | R-01 |
| RQ-CAJ-02-08 | HU-CAP-035 | FT-USR-03 | R-01 |
| RQ-CAJ-02-09 | HU-CAP-036 | FT-CIE-02 | R-01 |
| RQ-CAJ-02-10 | HU-CAP-036 | FT-USR-04 | R-01 |
| RQ-CAJ-02-11 | HU-CAP-033 | FT-CIE-01 | R-01 |
| RQ-CAJ-02-12 | HU-CAP-036 | FT-USR-04 | R-11 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-033 Cobrar un pedido con un medio de pago y vuelto
- HU-CAP-034 Cobrar con pago mixto
- HU-CAP-035 Elegir comprobante y cobrar a crédito del personal
- HU-CAP-036 Anular un pedido con motivo y el PIN de la supervisora

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-003, ADR-006, ADR-007, ADR-008, ADR-010, ADR-012.

**Fuera de alcance**

- Apertura y cierre de caja: FT-CIE-01 y FT-CIE-02.
- Emisión electrónica de boleta y factura (DT-11, D-07).
- Pago en línea con pasarela (DT-11).
- Devolución de un cobro ya cerrado (pendiente de Kevin, RN-CAP-096).

**Preguntas abiertas**

1. **Devolución de un cobro de una caja ya cerrada** — RN-CAP-096 lo deja pendiente. Propuesta: registrarlo como egreso de la caja del día con motivo y PIN.
2. **¿La tarjeta lleva número de operación del terminal?** Propuesta: opcional.

---

Generado por IA: BRD (NEC-CAP-063; RN-CAP-011, 030, 037, 054, 072, 077, 079, 082, 089, 094, 096, 108, 131) y el mockup de Pedidos y caja — Revisado por: *(pendiente)*
