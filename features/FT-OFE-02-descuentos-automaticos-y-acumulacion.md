---
id: FT-OFE-02
tipo: spec
titulo: "Descuentos automáticos y acumulación"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-012, FT-OFE-01, FT-OFE-03, FT-PED-01, FT-CAJ-03, FT-BOT-01, ADR-001, ADR-011, ADR-014, ADR-003, ADR-007, NEC-CAP-056, NEC-CAP-110, RN-CAP-070, RN-CAP-132]
tags: [ofertas, plt-03, ep-cap-012, ft-ofe-02, deberia-tener]
---

# FT-OFE-02 — Descuentos automáticos y acumulación

**PLT-03 · Feature · Catálogo de requerimientos** · Frente OFERTAS · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-OFE-02 | Descuentos automáticos y acumulación | EP-CAP-012 Promociones, descuentos y cupones |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debería tener** (NEC-CAP-056 · NEC-CAP-110) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H2 · 01/03/2027 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** Los **descuentos automáticos** se aplican solos, sin código, por categoría o producto, en porcentaje o monto (NEC-CAP-056). Valen solo en sus días, horas (desde inclusiva, hasta exclusiva) y fechas (ambas inclusivas), en sus canales y con su compra mínima, y solo sobre las líneas a las que aplican (RN-CAP-132). Se aplican en la carta, en Nuevo pedido y en el chatbot (NEC-CAP-110); si hay varios, se aplica **solo el mejor**. Las **reglas generales** fijan la acumulación entre promoción, descuento y cupón: por defecto un cupón no se junta con un descuento automático activo (RN-CAP-070), cuántos cupones salen por comprobante, la validez y el texto al pie. La lógica se revisa con una **simulación de reloj** documentada en `analisis/descuentos-y-promociones.md`.

**Beneficio esperado.** Promociones por horario (por ejemplo, «happy hour») que se aplican igual en todos los canales sin que nadie tenga que recordar el código. Hipótesis medible: **0 descuentos aplicados fuera de su día y hora** en las pruebas con reloj simulado.

**Usuarios / roles.** ACT-CAP-001 Kevin Rosales, dueño y administrador (crea descuentos y reglas) · ACT-CAP-006 Clientes (los reciben).

**Pantallas de referencia.** Administrativo ▸ Ofertas y descuentos ▸ Descuentos automáticos y Reglas (`Admin.dc.html`); `analisis/descuentos-y-promociones.md` (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-OFE-02-01 | El administrador crea un descuento automático por categoría o producto, en porcentaje o monto. | Debería tener | NEC-CAP-056 | Dado «20 % en Frappés», cuando se guarda activo, entonces aplica a los productos de esa categoría. | Propuesto |
| RQ-OFE-02-02 | El descuento vale solo en sus días, horas y fechas, con hora desde inclusiva y hasta exclusiva. | Debería tener | RN-CAP-132 | Dado un descuento de 15:00 a 18:00, cuando el pedido se hace a las 15:00, entonces aplica; a las 18:00 ya no aplica. | Propuesto |
| RQ-OFE-02-03 | El descuento vale solo en sus canales y con su compra mínima. | Debería tener | RN-CAP-132 | Dado un descuento solo en la carta con mínimo S/ 30, cuando el cliente pide S/ 28 en la carta o S/ 40 en el chatbot, entonces no aplica. | Propuesto |
| RQ-OFE-02-04 | El descuento se aplica solo sobre las líneas a las que corresponde. | Debería tener | RN-CAP-132 | Dado un pedido con un frappé de S/ 12 y un sándwich de S/ 15 con 20 % en Frappés, cuando se calcula, entonces el descuento es S/ 2,40. | Propuesto |
| RQ-OFE-02-05 | Si aplican varios descuentos automáticos, se aplica solo el mejor. | Debería tener | RN-CAP-070 · RN-CAP-132 | Dados 10 % en todo y 20 % en Frappés, cuando se pide un frappé, entonces se aplica solo el 20 % a esa línea. | Propuesto |
| RQ-OFE-02-06 | Por defecto un cupón no se junta con un descuento automático activo; la regla se puede cambiar. | Debería tener | RN-CAP-070 · D-10 | Dado un pedido con descuento automático, cuando el cliente escribe un cupón, entonces ve «Este cupón no se combina con el descuento vigente» y elige cuál usar; si la regla lo permite, se aplican ambos. | Propuesto |
| RQ-OFE-02-07 | Los descuentos se aplican igual en la carta, Nuevo pedido y el chatbot. | Debería tener | NEC-CAP-110 | Dado un mismo carrito a la misma hora, cuando se calcula en los tres canales permitidos, entonces el descuento es el mismo. | Propuesto |
| RQ-OFE-02-08 | Las reglas generales fijan acumulación, cupones por comprobante, validez y texto al pie. | Debería tener | NEC-CAP-056 | Dadas las reglas, cuando el administrador cambia «cupones por comprobante» de 2 a 1 con Sí/No, entonces los comprobantes nuevos llevan 1. | Propuesto |

Prioridad *Debería tener* por la épica. Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-019 | Hora local | Horarios, vigencias, «agotado por hoy» y cierres usan la hora de Lima. | Zona America/Lima · 0 cambios de día fuera de las 00:00 locales (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-011 | Exactitud | Los montos se calculan en soles con dos decimales sin errores de redondeo. | Diferencia 0,00 entre total mostrado, cobrado y registrado (umbral propuesto) | Debería tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-019 es el umbral clave: días y horas con la hora de Lima, también en el servidor del chatbot.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-070 | Una promoción o descuento vale en sus días, horas, fechas y canales; la carta aplica solo el mejor; cupón y descuento no se juntan por defecto. | Pedido del 17/10 |
| RN-CAP-132 | Hora desde inclusiva, hasta exclusiva; fechas inclusivas; canales, mínimo y líneas; solo el mejor. | Revisión 19/10/2026 |
| D-10 | Acumulación: «no acumula» por defecto (pendiente de Kevin). | decisiones.md |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-OFE-02-01 | HU-CAP-109 | — | R-01 |
| RQ-OFE-02-02 | HU-CAP-110 | — | R-01 |
| RQ-OFE-02-03 | HU-CAP-110 | — | R-01 |
| RQ-OFE-02-04 | HU-CAP-109 | — | R-01 |
| RQ-OFE-02-05 | HU-CAP-111 | — | R-01 |
| RQ-OFE-02-06 | HU-CAP-111 | FT-OFE-03 · D-10 | R-01 |
| RQ-OFE-02-07 | HU-CAP-109 | FT-BOT-01 | R-01 |
| RQ-OFE-02-08 | HU-CAP-111 | FT-OFE-03 | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-109 Crear un descuento automático con su vigencia
- HU-CAP-110 Aplicar el mejor descuento en todos los canales
- HU-CAP-111 Configurar las reglas de acumulación

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-003, ADR-007.

**Fuera de alcance**

- Combos y promociones: FT-OFE-01.
- Cupones: FT-OFE-03.

**Preguntas abiertas**

1. **Acumulación** — D-10.

---

Generado por IA: BRD (NEC-CAP-056, 110; RN-CAP-070, 132), D-10 y `analisis/descuentos-y-promociones.md` — Revisado por: *(pendiente)*
