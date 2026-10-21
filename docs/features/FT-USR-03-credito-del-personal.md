---
id: FT-USR-03
tipo: spec
titulo: "Crédito del personal"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-013, FT-USR-01, FT-CAJ-02, FT-CAJ-03, FT-CFG-02, ADR-001, ADR-011, ADR-014, ADR-004, ADR-008, NEC-CAP-025, NEC-CAP-094, NEC-CAP-108, RN-CAP-036, RN-CAP-106, RN-CAP-131]
tags: [usuarios, plt-03, ep-cap-013, ft-usr-03, deberia-tener]
---

# FT-USR-03 — Crédito del personal

**PLT-03 · Feature · Catálogo de requerimientos** · Frente PERSONAL · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-USR-03 | Crédito del personal | EP-CAP-013 Personal, usuarios y roles |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debería tener** (NEC-CAP-025 · NEC-CAP-108) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H2 · 01/03/2027 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** El personal puede consumir **a crédito con descuento** (25 % de inicio, configurable; V5), salvo combos, promociones, docenas y lo que ya tiene descuento (RN-CAP-036, RN-CAP-106). El crédito se usa **solo en Pedidos y caja**: el administrativo elige al trabajador activo en el pedido del personal, en el local o para llevar; por la carta virtual no se consume crédito (RN-CAP-131, D-09). Cada consumo se **suma a la semana del trabajador** con el detalle de lo que se llevó, porque el pago es semanal (DT-63, acta 03); **no hay plazo ni abonos** (DT-15). El administrador revisa en **Créditos del personal** cuánto consumió cada uno **por semana** (por defecto), por mes o por cualquier **rango de fechas**; el descuento del pago se hace **fuera del sistema**. El crédito es solo para el personal: no se da crédito a clientes (RN-CAP-058).

**Beneficio esperado.** Control claro de lo que consume el personal cada mes, sin cuadernos. Hipótesis medible: **100 % de consumos del personal registrados con su detalle**; **0 créditos a clientes**.

**Usuarios / roles.** ACT-CAP-002 Cajero/a (registra el consumo) · ACT-CAP-001 Kevin Rosales, dueño y administrador (revisa el mes y fija el descuento).

**Pantallas de referencia.** Administrativo ▸ Nuevo pedido ▸ Pedido del personal; Créditos del personal por semana, mes o rango (`Admin.dc.html`) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-USR-03-01 | El pedido del personal elige a un trabajador activo, solo en el local o para llevar. | Debería tener | NEC-CAP-094 · RN-CAP-106 | Dado un trabajador desactivado, cuando el cajero busca, entonces no aparece; para un activo, no se ofrece delivery ni reserva. | Propuesto |
| RQ-USR-03-02 | Se aplica el descuento del personal salvo a combos, promociones, docenas y lo que ya tiene descuento. | Debería tener | RN-CAP-036 · RN-CAP-106 · V5 | Dado un pedido con un café de S/ 8 y un combo de S/ 22, cuando se aplica el 25 %, entonces el café queda en S/ 6 y el combo en S/ 22. | Propuesto |
| RQ-USR-03-03 | El consumo cargado a crédito se suma a la semana del trabajador con su detalle. | Debería tener | RN-CAP-131 · NEC-CAP-108 · DT-63 | Dado un consumo de S/ 28 el jueves 15/10, cuando se cobra a crédito, entonces la semana del lunes 12 al domingo 18/10 del trabajador suma S/ 28 con el pedido y sus productos. | Propuesto |
| RQ-USR-03-04 | No hay plazos ni abonos en el crédito. | Debería tener | RN-CAP-131 · DT-15 · O3 | Dado Créditos del personal, cuando el administrador lo revisa, entonces no hay botón de abono ni fechas de vencimiento. | Propuesto |
| RQ-USR-03-05 | El administrador ve por semana (por defecto), por mes o por rango de fechas cuánto consumió cada trabajador y el detalle. | Debería tener | RN-CAP-131 · DT-63 | Dada la semana actual, cuando el administrador abre Créditos del personal, entonces ve cada trabajador con su total de la semana; al elegir «del 1 al 20/10», ve el total de ese rango y, al abrir a uno, sus consumos. | Propuesto |
| RQ-USR-03-06 | Por la carta virtual no se consume crédito. | Debe tener | RN-CAP-131 · D-09 | Dado un trabajador que pide en la carta con su cuenta, cuando elige el pago, entonces no aparece «Crédito del personal». | Propuesto |
| RQ-USR-03-07 | El porcentaje de descuento del personal se cambia en Configuración del local. | Debería tener | NEC-CAP-094 · RN-CAP-058 | Dado 25 %, cuando el administrador lo cambia a 20 % con Sí/No, entonces los pedidos nuevos usan 20 %. | Propuesto |
| RQ-USR-03-08 | El crédito no se da a clientes. | Debe tener | RN-CAP-058 | Dado un pedido de un cliente, cuando el cajero cobra, entonces no aparece la opción de crédito. | Propuesto |
| RQ-USR-03-09 | La semana o el rango de consumos se exporta para el pago fuera del sistema; solo el administrador (DT-75). | Debería tener | RN-CAP-131 · DT-63 | Dada la semana del 12 al 18/10, cuando el administrador toca «Exportar», entonces descarga un archivo de Excel con trabajador, total y detalle, y la exportación queda en el Historial de acciones. | Propuesto |
| RQ-USR-03-10 | El descuento del personal solo se da a trabajadores activos en cualquier canal, caja o carta virtual; al desactivar a un trabajador deja de recibirlo y al reactivarlo lo recupera. | Debe tener | Pedido del dueño 20/10/2026 · RN-CAP-106 | Dado un trabajador desactivado, cuando intenta aplicar su descuento de personal en la carta virtual o el cajero lo busca, entonces no se le aplica descuento ni aparece como trabajador activo; dado el mismo trabajador reactivado, cuando pide de nuevo, entonces vuelve a recibir su descuento. | Propuesto |

Prioridad *Debería tener* por la épica (fase Siguiente). RQ-USR-03-06 y 08 son *Debe tener* porque fijan límites del crédito. Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-011 | Exactitud | Los montos se calculan en soles con dos decimales sin errores de redondeo. | Diferencia 0,00 entre total mostrado, cobrado y registrado (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-006 | Seguridad | Cada acción se autoriza en el servidor según el rol, no solo ocultando botones. | 0 accesos a módulos o datos fuera del rol · prueba con un usuario por rol (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-009 | Auditoría | Toda acción que cambia datos guarda quién la hizo y cuándo. | 100 % de cambios con autor y fecha (umbral propuesto) | Debería tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-006 aplica porque solo el administrador ve los totales del mes.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-036 | El personal consume a crédito con 25 % de descuento salvo combos y promociones; sin plazo. | Acta 02 |
| RN-CAP-058 | El crédito es solo para el personal; el porcentaje se configura. | Acta 02 y 16/10 |
| RN-CAP-106 | Pedido del personal solo en el local o para llevar, solo usuarios activos; sin descuento en combos, promociones ni docenas. | Personal |
| RN-CAP-131 | Sin plazo ni abonos; solo en Pedidos y caja; no por la carta. «Se suma al mes» queda reemplazado por la semana (DT-63). | Instrucción del dueño 19/10/2026 |
| DT-63 | El crédito se revisa por semana (el pago es semanal) y por rango de fechas. | Acta 03 · decisiones.md |
| RN-CAP-084 (2.ª) | Abonos del crédito: **obsoleta** por RN-CAP-131 (O3). | Revisión del rol cajero |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-USR-03-01 | HU-CAP-123 | FT-CAJ-03 | R-01 |
| RQ-USR-03-02 | HU-CAP-123 | — | R-01 |
| RQ-USR-03-03 | HU-CAP-124 | FT-CAJ-02 | R-01 |
| RQ-USR-03-04 | HU-CAP-124 | — | R-01 |
| RQ-USR-03-05 | HU-CAP-124 | — | R-01 |
| RQ-USR-03-06 | HU-CAP-123 | D-09 | R-01 |
| RQ-USR-03-07 | HU-CAP-125 | FT-CFG-02 | R-01 |
| RQ-USR-03-08 | HU-CAP-124 | — | R-01 |
| RQ-USR-03-09 | HU-CAP-125 | FT-USR-04 | R-01 |
| RQ-USR-03-10 | HU-CAP-123 | FT-USR-01 · D-24 | R-11 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-123 Registrar el consumo del personal a crédito
- HU-CAP-124 Revisar el crédito del personal por semana o por rango de fechas
- HU-CAP-125 Configurar el descuento del personal y exportar la semana

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-004, ADR-008.

**Fuera de alcance**

- Descuento del pago al trabajador (fuera del sistema).
- Crédito a clientes (excluido, RN-CAP-058).
- Consumo a crédito desde la carta (D-09).

**Preguntas abiertas**

1. **¿En qué día empieza la semana de pago?** Propuesta: de lunes a domingo, configurable en Configuración del local.
2. **D-09** — si un trabajador puede cargar a su crédito desde la carta. Recomendación: no en la primera versión.
3. **D-24** — cómo se identifica un trabajador en la carta virtual para recibir su descuento (propuesta: iniciando sesión con su usuario del administrativo; solo para trabajadores activos).
4. **O3** — renumerar o retirar la RN-CAP-084 de abonos.

---

Generado por IA: BRD (NEC-CAP-025, 094, 108; RN-CAP-036, 058, 084, 106, 131), DT-15, D-09, O3 y el mockup — Revisado por: *(pendiente)*
