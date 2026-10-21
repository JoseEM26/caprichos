---
id: FT-CIE-01
tipo: spec
titulo: "Apertura, movimientos y liquidación de repartidores"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-005, FT-CIE-02, FT-CAJ-02, FT-DEL-02, ADR-001, ADR-011, ADR-014, ADR-003, ADR-008, NEC-CAP-062, RN-CAP-077, RN-CAP-088, RN-CAP-097]
tags: [cierre-caja, plt-03, ep-cap-005, ft-cie-01, debe-tener]
---

# FT-CIE-01 — Apertura, movimientos y liquidación de repartidores

**PLT-03 · Feature · Catálogo de requerimientos** · Frente CAJA · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-CIE-01 | Apertura, movimientos y liquidación de repartidores | EP-CAP-005 Apertura y cierre de caja |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debe tener** (NEC-CAP-062) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H1 · piloto en el local · 28/12/2026 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** Cada mañana la caja se **abre en cero**; el monto de apertura se puede cambiar y las ventas del día empiezan vacías, mientras lo anterior queda en el historial (RN-CAP-077). Durante el turno, el cajero registra **ingresos y egresos de caja** con motivo (por ejemplo, compra de hielo o sencillo) y ve sus cobros uno por uno, pero **no ve los totales por medio de pago ni el efectivo esperado**: así el cierre puede ser ciego (DT-61, acta 03). Esos totales en vivo (efectivo, Yape, Plin, transferencia, tarjeta y otros) solo los ve el administrador. El efectivo que cobran los repartidores no cuenta como efectivo de caja hasta que caja lo recibe: la **liquidación de repartidores** registra cuánto entrega cada uno (RN-CAP-088). Con esto, el sistema sabe en todo momento el efectivo esperado: apertura + ventas en efectivo + ingresos − egresos (RN-CAP-079), visible solo para el administrador.

**Beneficio esperado.** Saber en cualquier momento cuánto efectivo debería haber, y que el efectivo de los repartidores no se pierda entre turnos. Hipótesis medible: **100 % de los repartos en efectivo liquidados antes del cierre** y **0 movimientos de caja sin motivo**.

**Usuarios / roles.** ACT-CAP-002 Cajero/a (abre la caja, registra movimientos y recibe liquidaciones) · ACT-CAP-009 Repartidor (motorizado) (entrega su efectivo) · ACT-CAP-001 Kevin Rosales, dueño y administrador (revisa).

**Pantallas de referencia.** Administrativo ▸ Cierre de caja ▸ apertura, resumen por medio, ingresos y egresos, liquidación de repartidores (`Admin.dc.html`) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-CIE-01-01 | La caja se abre en cero, con monto de apertura editable, y las ventas del día empiezan vacías. | Debe tener | RN-CAP-077 | Dado el día nuevo, cuando el cajero abre la caja sin cambiar el monto, entonces la apertura es S/ 0,00 y los totales del día están en cero; el día anterior queda en el historial. | Propuesto |
| RQ-CIE-01-02 | Solo hay una caja abierta a la vez. | Debe tener | RN-CAP-038 (un solo local) | Dada una caja abierta, cuando otro usuario intenta abrir otra, entonces ve «Ya hay una caja abierta por …». | Propuesto |
| RQ-CIE-01-03 | Durante el turno, solo el administrador ve en vivo las ventas por medio de pago; el cajero ve sus cobros uno por uno, sin totales. | Debe tener | NEC-CAP-062 · DT-61 | Dados cobros con efectivo, Yape y tarjeta, cuando el administrador abre el resumen, entonces ve el total de cada medio y del día; cuando lo abre el cajero, ve la lista de cobros sin sumas por medio ni efectivo esperado, y el servidor no le entrega esos totales. | Propuesto |
| RQ-CIE-01-04 | El cajero registra ingresos y egresos de caja con monto, motivo y autor. | Debe tener | NEC-CAP-062 | Dado un egreso de S/ 15 por «compra de hielo», cuando el cajero lo registra con Sí/No, entonces baja el efectivo esperado en S/ 15 y queda en la lista con su autor y hora. | Propuesto |
| RQ-CIE-01-05 | Un movimiento de caja no se edita ni se borra: se anula con motivo. | Debe tener | RN-CAP-014 · RN-CAP-080 | Dado un ingreso mal registrado, cuando el cajero lo anula con motivo, entonces deja de sumar y sigue visible tachado con su motivo. | Propuesto |
| RQ-CIE-01-06 | El efectivo esperado se calcula como apertura + ventas en efectivo + ingresos − egresos, y solo lo ve el administrador. | Debe tener | RN-CAP-079 · DT-61 | Dada apertura S/ 50, ventas en efectivo S/ 300, ingresos S/ 20 y egresos S/ 15, cuando se consulta, entonces el efectivo esperado es S/ 355,00. | Propuesto |
| RQ-CIE-01-07 | El efectivo cobrado por un repartidor no cuenta en caja hasta liquidarlo. | Debe tener | RN-CAP-088 | Dado un delivery cobrado en efectivo por el repartidor (S/ 40), cuando se consulta el efectivo esperado, entonces no lo incluye y figura en «Por liquidar» a nombre del repartidor. | Propuesto |
| RQ-CIE-01-08 | Caja registra la liquidación de cada repartidor con lo que entrega. | Debe tener | RN-CAP-088 · NEC-CAP-079 | Dado un repartidor con S/ 120 por liquidar, cuando entrega S/ 120 y el cajero confirma, entonces sube el efectivo esperado y su saldo por liquidar queda en cero; si entrega S/ 110, se registra la diferencia de S/ 10. | Propuesto |

Prioridad por NEC-CAP-062 (E1). RQ-CIE-01-02 es derivado: un solo local y una caja (RN-CAP-038). Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-011 | Exactitud | Los montos se calculan en soles con dos decimales sin errores de redondeo. | Diferencia 0,00 entre total mostrado, cobrado y registrado (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-009 | Auditoría | Toda acción que cambia datos guarda quién la hizo y cuándo. | 100 % de cambios con autor y fecha (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-014 | Conservación | Los registros no se borran: se desactivan o anulan (RN-CAP-014). | 0 borrados físicos fuera de las excepciones del BRD (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-019 | Hora local | Horarios, vigencias, «agotado por hoy» y cierres usan la hora de Lima. | Zona America/Lima · 0 cambios de día fuera de las 00:00 locales (umbral propuesto) | Debe tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-019 aplica porque el día de caja empieza a las 00:00 de Lima.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-077 | La caja se abre en cero (monto editable) y las ventas del día empiezan vacías. | Reunión del 18/10 |
| RN-CAP-079 | Efectivo esperado = apertura + ventas en efectivo + ingresos − egresos. | Reunión del 18/10 · restaurant.pe |
| RN-CAP-088 | El efectivo del repartidor no cuenta en caja hasta la liquidación. | Caja, repartos |
| RN-CAP-097 | La caja no se cierra con efectivo de repartidores sin liquidar. | Caja |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-CIE-01-01 | HU-CAP-041 | — | R-01 |
| RQ-CIE-01-02 | HU-CAP-041 | — | R-01 |
| RQ-CIE-01-03 | HU-CAP-042 | FT-CAJ-02 | R-01 |
| RQ-CIE-01-04 | HU-CAP-042 | — | R-01 |
| RQ-CIE-01-05 | HU-CAP-042 | — | R-01 |
| RQ-CIE-01-06 | HU-CAP-042 | — | R-01 |
| RQ-CIE-01-07 | HU-CAP-043 | FT-DEL-02 | R-01 |
| RQ-CIE-01-08 | HU-CAP-043 | FT-DEL-02 | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-041 Abrir la caja del día
- HU-CAP-042 Ver ventas por medio y registrar ingresos y egresos
- HU-CAP-043 Liquidar el efectivo de un repartidor

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-003, ADR-008.

**Fuera de alcance**

- Arqueo, cierre e historial: FT-CIE-02.
- Varias cajas o varios turnos al día (un solo local, una caja).

**Preguntas abiertas**

1. **¿Hay más de un turno de caja al día?** El BRD habla de una caja diaria. Propuesta: una sola apertura y un solo cierre por día.
2. **¿Qué pasa con una diferencia en la liquidación?** Propuesta: se registra y no se descuenta a nadie (como RN-CAP-080).

---

Generado por IA: BRD (NEC-CAP-062, 079; RN-CAP-014, 038, 077, 079, 080, 088, 097), `analisis/cierre-de-caja.md` y el mockup de Cierre de caja — Revisado por: *(pendiente)*
