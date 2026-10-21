---
id: FT-SAL-03
tipo: spec
titulo: "Reservas"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-20
relacionados: [EP-CAP-007, FT-SAL-01, FT-SAL-02, FT-BOT-03, FT-CFG-01, ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, NEC-CAP-095, NEC-CAP-107, RN-CAP-047, RN-CAP-107]
tags: [salon, plt-03, ep-cap-007, ft-sal-03, debe-tener]
---

# FT-SAL-03 — Reservas

**PLT-03 · Feature · Catálogo de requerimientos** · Frente SALON · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-SAL-03 | Reservas | EP-CAP-007 Salón: plano, mesas, pedido del mozo y reservas |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debe tener** (NEC-CAP-095 · NEC-CAP-107) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H1 · piloto en el local · 28/12/2026 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** Las reservas llegan por WhatsApp (4 o 5 al mes) y las registra un mozo o cajero en un solo formulario: nombre, teléfono, personas, hora exacta y una o varias mesas (NEC-CAP-095). No hay reserva desde la web (A4, DT-13). La hora debe estar dentro del horario y no haber pasado; los asientos de las mesas elegidas deben alcanzar para las personas (RN-CAP-107). La reserva es **solo una marca visual** en el plano: no impide usar la mesa. Dura desde su hora durante la tolerancia (15 minutos, V6) y luego se anula sola; también se puede sentar (abrir el pedido) o liberar por no asistencia (RN-CAP-090). Las reservas se ven en un **calendario del mes** y, al tocar un día, su agenda (NEC-CAP-107).

**Beneficio esperado.** Que el equipo vea qué mesas están reservadas y a qué hora, sin libreta. Hipótesis medible: **0 reservas guardadas con asientos insuficientes**; **100 % de reservas no asistidas se anulan solas tras la tolerancia**.

**Usuarios / roles.** ACT-CAP-004 Mozos (registra y sienta reservas) · ACT-CAP-002 Cajero/a (registra y sienta reservas).

**Pantallas de referencia.** Administrativo ▸ Reservas (calendario del mes, agenda del día), plano con mesas reservadas (`Admin.dc.html`) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-SAL-03-01 | Una reserva se registra en un solo formulario: nombre, teléfono, personas, hora exacta y mesas. | Debe tener | NEC-CAP-095 | Dado el formulario, cuando el mozo completa todo y confirma, entonces la reserva queda guardada con su autor. | Propuesto |
| RQ-SAL-03-02 | La hora debe estar dentro del horario del día y no haber pasado. | Debe tener | RN-CAP-107 · RN-CAP-060 | Dado un horario de 14:00 a 22:00, cuando se elige 22:30 o una hora ya pasada, entonces no se puede guardar. | Propuesto |
| RQ-SAL-03-03 | Los asientos de las mesas elegidas deben alcanzar para las personas. | Debe tener | RN-CAP-107 | Dada una reserva de 8 personas, cuando se eligen las mesas 1 (4) y 2 (2), entonces se ve «Faltan 2 asientos» y no se guarda; al sumar la mesa 3 (2), sí. | Propuesto |
| RQ-SAL-03-04 | La reserva se ve como marca en el plano y no impide usar la mesa. | Debe tener | RN-CAP-107 · NEC-CAP-023 | Dada la mesa 5 reservada a las 19:00, cuando el mozo la elige a las 17:00, entonces ve el aviso de la reserva y puede abrir el pedido igual. | Propuesto |
| RQ-SAL-03-05 | La reserva se anula sola al pasar la tolerancia desde su hora. | Debe tener | RN-CAP-107 · V6 | Dada una reserva a las 19:00 con tolerancia de 15 minutos, cuando son las 19:15 y no se sentó, entonces pasa a «No asistió» y la marca desaparece del plano. | Propuesto |
| RQ-SAL-03-06 | Una reserva se sienta, abriendo el pedido en sus mesas, o se libera por no asistencia. | Debe tener | RN-CAP-090 | Dada una reserva activa, cuando el mozo toca «Sentar», entonces se abre Nuevo pedido con sus mesas ya elegidas. | Propuesto |
| RQ-SAL-03-07 | Las reservas se ven en un calendario del mes con su agenda por día. | Debe tener | NEC-CAP-107 | Dadas reservas el 5 y el 12, cuando el cajero abre el calendario, entonces esos días tienen marca y al tocar el 12 ve su agenda por hora. | Propuesto |
| RQ-SAL-03-08 | Una reserva se edita o se cancela con motivo, sin eliminarse. | Debe tener | RN-CAP-014 | Dada una reserva, cuando el cajero la cancela con motivo y Sí/No, entonces queda «Cancelada» en el historial. | Propuesto |

Prioridad por NEC-CAP-095 y NEC-CAP-107 (E1). Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-019 | Hora local | Horarios, vigencias, «agotado por hoy» y cierres usan la hora de Lima. | Zona America/Lima · 0 cambios de día fuera de las 00:00 locales (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-008 | Datos personales | El DNI, el teléfono y la ubicación se guardan con aceptación registrada y el DNI se muestra enmascarado en listas (Ley 29733). | 0 datos personales sin aceptación · 0 DNI completos en listas (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-012 | Usabilidad | Toda acción que cambia datos pide confirmación Sí/No (RN-CAP-015). | 100 % de acciones de cambio con confirmación (umbral propuesto) | Debe tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-019 aplica a la tolerancia y la anulación automática; RNF-CAP-008 al teléfono del cliente.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-032 | Las reservas se piden por WhatsApp; la mesa se guarda 15 minutos de tolerancia. | Acta 02 |
| RN-CAP-047 | Una reserva pedida por WhatsApp es una solicitud: un mozo o cajero la aprueba y asigna la mesa. | Acta 02 |
| RN-CAP-090 | Una reserva se sienta o se libera por no asistencia tras la tolerancia. | Mozo |
| RN-CAP-107 | La reserva dura la tolerancia y se anula sola; es solo marca visual; hora válida; asientos suficientes. | Reservas |
| A4 | Las reservas llegan por WhatsApp como solicitud; no hay reserva desde la web. | decisiones.md |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-SAL-03-01 | HU-CAP-065 | — | R-01 |
| RQ-SAL-03-02 | HU-CAP-065 | FT-CFG-01 | R-01 |
| RQ-SAL-03-03 | HU-CAP-065 | — | R-01 |
| RQ-SAL-03-04 | HU-CAP-066 | FT-SAL-01 | R-01 |
| RQ-SAL-03-05 | HU-CAP-066 | FT-CFG-02 (tolerancia) | R-01 |
| RQ-SAL-03-06 | HU-CAP-066 | FT-SAL-02 | R-01 |
| RQ-SAL-03-07 | HU-CAP-067 | — | R-01 |
| RQ-SAL-03-08 | HU-CAP-067 | — | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-065 Registrar una reserva con una o varias mesas
- HU-CAP-066 Ver la reserva en el plano, sentarla o dejar que venza
- HU-CAP-067 Ver las reservas en el calendario del mes

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-006, ADR-007.

**Fuera de alcance**

- Reservas desde la web (descartadas, DT-13).
- Solicitud de reserva desde el chatbot: FT-BOT-03.
- Cobro de garantía o adelanto por reservar (no pedido).

**Preguntas abiertas**

1. **¿Se avisa al cliente un recordatorio de su reserva?** No está en el BRD; propuesta: no en la primera versión.

---

Generado por IA: BRD (NEC-CAP-095, 107; RN-CAP-014, 032, 047, 060, 090, 107), A4, V6 y el mockup de Reservas — Revisado por: *(pendiente)*
