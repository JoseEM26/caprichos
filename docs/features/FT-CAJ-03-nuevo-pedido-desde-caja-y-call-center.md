---
id: FT-CAJ-03
tipo: spec
titulo: "Nuevo pedido desde caja y call center"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-20
relacionados: [EP-CAP-004, FT-CAJ-01, FT-SAL-02, FT-OFE-01, FT-OFE-02, FT-OFE-03, FT-CLI-01, FT-DEL-01, FT-USR-03, ADR-001, ADR-011, ADR-014, ADR-003, ADR-006, ADR-007, ADR-008, ADR-010, ADR-012, NEC-CAP-065, NEC-CAP-080, NEC-CAP-094, RN-CAP-033, RN-CAP-109]
tags: [caja, plt-03, ep-cap-004, ft-caj-03, debe-tener]
---

# FT-CAJ-03 — Nuevo pedido desde caja y call center

**PLT-03 · Feature · Catálogo de requerimientos** · Frente CAJA · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-CAJ-03 | Nuevo pedido desde caja y call center | EP-CAP-004 Confirmación y cobro en caja |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debe tener** (NEC-CAP-080 · RN-CAP-033) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H1 · piloto en el local · 28/12/2026 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** Nuevo pedido permite al cajero y al call center tomar pedidos por teléfono, WhatsApp o en el mostrador (RN-CAP-033), con el mismo catálogo y las mismas reglas de opciones que la carta. El cliente se busca por teléfono o DNI y se **recuerda su dirección** (NEC-CAP-080); se puede **repetir un pedido** anterior. Para delivery se marca el lugar en un mapa buscando la dirección que dio el cliente o tocando el punto (NEC-CAP-059), y se aplica su **tarifa especial de envío** si la tiene (RN-CAP-109). Se pueden elegir las promociones vigentes y aplicar un cupón; los descuentos automáticos se aplican solos (NEC-CAP-065). También se registra el **pedido del personal**: se elige al trabajador activo, en el local o para llevar, con su descuento (NEC-CAP-094). El pedido tomado por teléfono entra «por confirmar» como cualquier pedido de fuera; el de mostrador para llevar se cobra en el momento.

**Beneficio esperado.** Que los pedidos por teléfono y WhatsApp se registren rápido y con los mismos datos que los de la carta. Hipótesis medible: **Tiempo para registrar un pedido repetido ≤ 60 s** (propuesta); **0 pedidos de delivery sin punto en el mapa al confirmarse**.

**Usuarios / roles.** ACT-CAP-002 Cajero/a (toma pedidos de mostrador y teléfono) · Call center (aún sin código ACT en el BRD) (toma pedidos por teléfono y WhatsApp).

**Pantallas de referencia.** Administrativo ▸ Nuevo pedido: cliente, catálogo con o sin imágenes, mapa, ofertas, cupón, pedido del personal (`Admin.dc.html`) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-CAJ-03-01 | Nuevo pedido usa el mismo catálogo y reglas de opciones que la carta, con o sin imágenes. | Debe tener | RN-CAP-027 · NEC-CAP-043 | Dado un producto con grupo obligatorio, cuando el cajero lo agrega sin elegir, entonces no puede; puede alternar la vista con o sin imágenes. | Propuesto |
| RQ-CAJ-03-02 | Al pedir más de una unidad de un producto con opciones, se elige la opción de cada unidad, con un mismo tamaño. | Debe tener | DT-62 · Acta 03 | Dados 3 frappés de fresa tamaño regular, cuando el cajero pone cantidad 3, entonces se le piden 3 leches y elige «entera, entera, almendra»; la cuenta y la comanda muestran «2 × entera · 1 × almendra». | Propuesto |
| RQ-CAJ-03-03 | El cliente se busca por teléfono o DNI y su dirección se recuerda. | Debe tener | NEC-CAP-080 | Dado un cliente que pidió antes, cuando el call center escribe su teléfono, entonces aparecen su nombre y su última dirección con el punto en el mapa, editables. | Propuesto |
| RQ-CAJ-03-04 | Se puede repetir un pedido anterior del cliente. | Debería tener | NEC-CAP-080 | Dado un cliente con pedidos anteriores, cuando el call center toca «Repetir» en uno, entonces el carrito se llena con esos productos y opciones a los precios de hoy. | Propuesto |
| RQ-CAJ-03-05 | Para delivery se marca el lugar en el mapa buscando la dirección o tocando el punto. | Debe tener | NEC-CAP-059 · NEC-CAP-049 | Dado un pedido por teléfono, cuando el call center busca la dirección que dictó el cliente y ajusta el pin, entonces el pedido guarda el punto, el enlace, la zona y su envío. | Propuesto |
| RQ-CAJ-03-06 | Se aplica la tarifa especial de envío del cliente si la tiene. | Debería tener | RN-CAP-109 · NEC-CAP-096 | Dado un cliente con envío fijo de S/ 2, cuando se toma su delivery a la zona de S/ 5, entonces el envío es S/ 2. | Propuesto |
| RQ-CAJ-03-07 | Se pueden elegir promociones vigentes y aplicar un cupón; los descuentos automáticos se aplican solos. | Debe tener | NEC-CAP-065 · RN-CAP-070 | Dado un descuento automático vigente para la categoría Frappés, cuando el cajero agrega un frappé, entonces el descuento aparece solo; al escribir un cupón, se aplica según la regla de acumulación. | Propuesto |
| RQ-CAJ-03-08 | El sistema sugiere la promoción para la que califica el pedido y quien atiende la aplica si el cliente acepta. | Debería tener | DT-62 · Acta 03 | Dado un pedido con dos Ice Coffee de S/ 9, cuando el cajero los agrega, entonces ve «El pedido califica para 2×1 Ice Coffee · ahorra S/ 9 · Aplicar»; si el cliente no la quiere, el aviso se cierra y no vuelve a salir en ese pedido. | Propuesto |
| RQ-CAJ-03-09 | Un pedido por teléfono para delivery o recojo entra «por confirmar». | Debe tener | RN-CAP-074 | Dado un pedido tomado por teléfono, cuando el call center lo guarda, entonces entra a la cola «por confirmar» con canal «Teléfono». | Propuesto |
| RQ-CAJ-03-10 | El pedido del personal elige a un trabajador activo, en el local o para llevar, con su descuento. | Debería tener | NEC-CAP-094 · RN-CAP-106 | Dado el pedido del personal, cuando el cajero elige a un trabajador activo, entonces solo se ofrecen «En el local» y «Para llevar» y se aplica el 25 % salvo a combos, promociones y docenas. | Propuesto |
| RQ-CAJ-03-11 | Anular un pedido exige motivo y queda en el historial. | Debe tener | RN-CAP-089 · NEC-CAP-080 | Dado un pedido guardado sin cobrar, cuando el call center lo anula con motivo, entonces queda anulado con su autor y motivo. | Propuesto |
| RQ-CAJ-03-12 | Se registra con cuánto paga el cliente en efectivo para que el repartidor lleve el vuelto. | Debe tener | NEC-CAP-080 · NEC-CAP-079 | Dado un delivery en efectivo de S/ 37, cuando el call center anota «paga con S/ 50», entonces el pedido muestra vuelto S/ 13 para el repartidor. | Propuesto |
| RQ-CAJ-03-13 | En las bebidas, Nuevo pedido pide el nombre de la persona que tomará cada una, uno por unidad, para su sticker. | Debe tener | DT-57 · DT-58 · Acta 03 | Dados 5 frappés en Nuevo pedido, cuando el cajero o el mozo los agrega, entonces ve 5 campos «Ingresa el nombre de la persona que tomará esta bebida (1 de 5 … 5 de 5)» y cada sticker del vaso sale con su nombre en grande; si uno queda vacío, va el nombre del cliente. | Propuesto |

Prioridad por NEC-CAP-080 (E1). RQ-CAJ-03-04, 06 y 10 quedan en *Debería tener* por depender de historial, tarifas especiales y crédito del personal; RQ-CAJ-03-08 porque depende de las promociones (fase Siguiente). Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-004 | Usabilidad | Las pantallas se usan desde un celular sin desplazamiento horizontal. | Ancho mínimo 360 px · 0 pantallas con scroll horizontal (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-008 | Datos personales | El DNI, el teléfono y la ubicación se guardan con aceptación registrada y el DNI se muestra enmascarado en listas (Ley 29733). | 0 datos personales sin aceptación · 0 DNI completos en listas (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-011 | Exactitud | Los montos se calculan en soles con dos decimales sin errores de redondeo. | Diferencia 0,00 entre total mostrado, cobrado y registrado (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-006 | Seguridad | Cada acción se autoriza en el servidor según el rol, no solo ocultando botones. | 0 accesos a módulos o datos fuera del rol · prueba con un usuario por rol (umbral propuesto) | Debe tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-008 aplica porque se guardan teléfono, DNI y dirección de clientes.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-027 | El pedido del administrativo usa el mismo catálogo y reglas que la carta. | Reunión |
| RN-CAP-033 | Toman pedidos manuales o telefónicos el cajero y el mozo; el repartidor no. | Acta 02 |
| RN-CAP-070 | Promociones y descuentos valen en sus días, horas y canales; por defecto un cupón no se junta con un descuento automático. | Pedido del 17/10 |
| RN-CAP-106 | El pedido del personal es solo en el local o para llevar; el descuento no aplica a combos, promociones ni docenas. | Personal |
| RN-CAP-109 | Tarifa especial por cliente: el monto fijo prevalece sobre el porcentaje y el envío gratis sobre ambos. | Delivery |
| DT-62 | Opciones por unidad al pedir varias, con un mismo tamaño; sugerencia de la promoción aplicable. | Acta 03 · decisiones.md |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-CAJ-03-01 | HU-CAP-037 | FT-CAR-01 | R-01 |
| RQ-CAJ-03-02 | HU-CAP-037 | FT-COC-01 | R-01 |
| RQ-CAJ-03-03 | HU-CAP-038 | — | R-01 |
| RQ-CAJ-03-04 | HU-CAP-038 | — | R-01 |
| RQ-CAJ-03-05 | HU-CAP-038 | FT-DEL-01 | R-01 |
| RQ-CAJ-03-06 | HU-CAP-038 | FT-DEL-01 | R-01 |
| RQ-CAJ-03-07 | HU-CAP-039 | FT-OFE-01 · FT-OFE-02 · FT-OFE-03 | R-01 |
| RQ-CAJ-03-08 | HU-CAP-039 | FT-OFE-01 | R-01 |
| RQ-CAJ-03-09 | HU-CAP-037 | FT-CAJ-01 | R-01 |
| RQ-CAJ-03-10 | HU-CAP-040 | FT-USR-03 | R-01 |
| RQ-CAJ-03-11 | HU-CAP-037 | — | R-01 |
| RQ-CAJ-03-12 | HU-CAP-038 | FT-DEL-02 | R-01 |
| RQ-CAJ-03-13 | HU-CAP-037 | FT-COC-02 | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-037 Armar un pedido para un cliente en Nuevo pedido
- HU-CAP-038 Recordar, ubicar y repetir el pedido de un cliente por teléfono
- HU-CAP-039 Aplicar promociones, descuentos y cupón en Nuevo pedido
- HU-CAP-040 Registrar el pedido del personal

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-003, ADR-006, ADR-007, ADR-008, ADR-010, ADR-012.

**Fuera de alcance**

- El pedido del mozo en mesa: FT-SAL-02.
- Confirmar y cobrar: FT-CAJ-01 y FT-CAJ-02.
- Creación de ofertas y cupones: FT-OFE-01 a FT-OFE-03.

**Preguntas abiertas**

1. **¿El call center tiene rol propio?** El BRD lo nombra pero no tiene código ACT (épica EP-CAP-013).
2. **Tarifas especiales por cliente** — quién las tiene hoy (pendiente de Kevin, DEP-07).

---

Generado por IA: BRD (NEC-CAP-043, 049, 059, 065, 079, 080, 094, 096; RN-CAP-027, 033, 070, 074, 089, 106, 109) y el mockup de Nuevo pedido — Revisado por: *(pendiente)*
