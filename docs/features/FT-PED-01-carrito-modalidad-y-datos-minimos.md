---
id: FT-PED-01
tipo: spec
titulo: "Carrito, modalidad y datos mínimos"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-20
relacionados: [EP-CAP-002, FT-CAR-01, FT-PED-02, FT-PED-03, FT-OFE-02, FT-OFE-03, FT-LEG-01, ADR-001, ADR-011, ADR-014, ADR-003, ADR-005, ADR-009, ADR-010, NEC-CAP-017, NEC-CAP-018, RN-CAP-016, RN-CAP-028]
tags: [pedido, plt-03, ep-cap-002, ft-ped-01, debe-tener]
---

# FT-PED-01 — Carrito, modalidad y datos mínimos

**PLT-03 · Feature · Catálogo de requerimientos** · Frente PEDIDO · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-PED-01 | Carrito, modalidad y datos mínimos | EP-CAP-002 Pedido del cliente en la carta |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debe tener** (NEC-CAP-017 · BRD §4 «Pedido») | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H1 · piloto en el local · 28/12/2026 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** El cliente arma su pedido con el menor esfuerzo: primero elige productos y al final da sus datos (NEC-CAP-017). El carrito lista cada producto con sus opciones, su nota para cocina, cantidad editable y subtotal; permite quitar y editar. En el carrito se elige la modalidad: **delivery** o **para recoger** (RN-CAP-016); no hay «en el local», porque en el salón pide el mozo (A2). Al final se piden solo nombre y teléfono; el correo es opcional y no se pide fecha (todo es para el mismo día, RN-CAP-028) ni crear cuenta. El cliente **debe elegir** cómo pagará: Yape, Plin, efectivo (con cuánto paga, para el vuelto), tarjeta o transferencia (DT-57), para no recargar al personal preguntándolo por WhatsApp. La carta **no cobra ni pide la captura** (DT-17, DT-57): el asesor la pide por WhatsApp. Si el cliente no entró a su cuenta, al final se le recuerda que puede acumular puntos (FT-CLI-02). El resumen muestra subtotal, descuentos, cupón, envío y total.

**Datos que se recuerdan.** Con aviso de privacidad, el nombre, el teléfono y la última dirección se guardan en el dispositivo y, por teléfono, en el sistema para el siguiente pedido (RN-CAP-045).

**Beneficio esperado.** Menos pasos para pedir y pedidos completos en caja. Contribuye a NEC-CAP-001 y a OBJ-CAP-001. Hipótesis medible: **60 % de los carritos iniciados terminan en pedido** (propuesta) y **0 pedidos sin teléfono o sin modalidad**.

**Usuarios / roles.** ACT-CAP-006 Clientes (arman el carrito y envían el pedido).

**Pantallas de referencia.** Carta ▸ carrito, modalidad, datos del cliente, medio de pago y resumen (`Main.dc.html`) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-PED-01-01 | El carrito guarda varios productos, cada uno con sus opciones, nota y cantidad. | Debe tener | BRD §4 «Pedido» | Dados dos productos con opciones distintas, cuando el cliente los agrega, entonces el carrito los muestra por separado con sus opciones, nota y subtotal. | Propuesto |
| RQ-PED-01-02 | El cliente edita la cantidad, edita las opciones o quita un producto del carrito. | Debe tener | BRD §4 | Dado un producto en el carrito, cuando el cliente cambia la cantidad a 3, entonces el subtotal y el total se recalculan; al quitarlo con Sí/No desaparece. | Propuesto |
| RQ-PED-01-03 | La modalidad (delivery o para recoger) se elige en el carrito, no en la cabecera. | Debe tener | RN-CAP-016 · A2 | Dado el carrito, cuando el cliente va a confirmar, entonces elige entre «Delivery» y «Para recoger»; no aparece «En el local». | Propuesto |
| RQ-PED-01-04 | Al final se piden solo nombre y teléfono; el correo es opcional y no se pide fecha ni cuenta. | Debe tener | NEC-CAP-017 · RN-CAP-028 · RN-CAP-066 | Dado el paso de datos, cuando el cliente deja vacío el correo y no tiene cuenta, entonces puede enviar el pedido; sin nombre o con un teléfono de menos de 9 dígitos no puede. | Propuesto |
| RQ-PED-01-05 | Los datos del cliente se recuerdan para el siguiente pedido, con aviso de privacidad. | Debería tener | RN-CAP-045 · NEC-CAP-019 | Dado un cliente que ya pidió y aceptó el aviso, cuando vuelve a pedir desde el mismo celular o escribe el mismo teléfono, entonces su nombre y última dirección aparecen llenos y editables. | Propuesto |
| RQ-PED-01-06 | El cliente elige obligatoriamente su medio de pago entre Yape, Plin, efectivo, tarjeta y transferencia. | Debe tener | RN-CAP-011 · NEC-CAP-018 · DT-57 | Dados los medios activos en Configuración del local, cuando el cliente llega al pago, entonces solo ve esos medios, con Yape y Plin como opciones propias y visibles, y sin elegir uno no puede enviar el pedido. | Propuesto |
| RQ-PED-01-07 | Con efectivo, el cliente indica con cuánto paga y ve el vuelto. | Debe tener | RN-CAP-011 | Dado un total de S/ 37,50, cuando el cliente elige efectivo y escribe S/ 50, entonces ve vuelto S/ 12,50; un monto menor al total no se acepta. | Propuesto |
| RQ-PED-01-08 | La carta no cobra ni pide capturas: informa que un asesor escribirá por WhatsApp. | Debe tener | RN-CAP-076 · DT-17 | Dado cualquier medio de pago, cuando el cliente envía, entonces ve «Un asesor te escribirá por WhatsApp para coordinar el pago», sin campo para subir la captura. | Propuesto |
| RQ-PED-01-09 | El resumen muestra subtotal, descuento automático, cupón, envío y total. | Debe tener | RN-CAP-070 · NEC-CAP-065 | Dado un carrito con un descuento automático vigente y envío de S/ 4, cuando el cliente ve el resumen, entonces cada línea aparece por separado y el total es la suma correcta. | Propuesto |
| RQ-PED-01-10 | El cliente puede escribir un código de cupón en el resumen. | Debería tener | RN-CAP-069 · RN-CAP-133 | Dado un cupón vigente, cuando el cliente lo escribe, entonces ve el descuento aplicado o el motivo por el que no aplica. | Propuesto |
| RQ-PED-01-11 | El cliente puede pedir boleta o factura dejando DNI o RUC; por defecto es nota de venta. | Debe tener | RN-CAP-037 · NEC-CAP-089 | Dado el resumen, cuando el cliente marca «Quiero factura», entonces se le pide RUC de 11 dígitos y razón social; si no marca nada, el comprobante es nota de venta. | Propuesto |

Prioridad por NEC-CAP-017 (E1). RQ-PED-01-05 queda en *Debería tener* hasta definir la política de datos personales (D-18). Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-004 | Usabilidad | Las pantallas se usan desde un celular sin desplazamiento horizontal. | Ancho mínimo 360 px · 0 pantallas con scroll horizontal (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-005 | Accesibilidad | Texto legible para personas mayores y botones fáciles de tocar. | Contraste WCAG AA · objetivos táctiles ≥ 44 px (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-011 | Exactitud | Los montos se calculan en soles con dos decimales sin errores de redondeo. | Diferencia 0,00 entre total mostrado, cobrado y registrado (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-008 | Datos personales | El DNI, el teléfono y la ubicación se guardan con aceptación registrada y el DNI se muestra enmascarado en listas (Ley 29733). | 0 datos personales sin aceptación · 0 DNI completos en listas (umbral propuesto) | Debe tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-008 aplica porque se guardan nombre, teléfono y dirección; RNF-CAP-011 porque el total de la carta es el que confirma caja.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-016 | La modalidad se elige en el carrito; el cliente no puede pedir «en el local». | Diseño y 17/10 |
| RN-CAP-028 | Todos los pedidos son para el mismo día: la carta no pide fecha. | Acta 02 |
| RN-CAP-029 | El cobro adelantado se incentiva pero no se obliga. | Acta 02 |
| RN-CAP-045 | Los datos del cliente se guardan para el siguiente pedido, con aviso de privacidad. | Acta 02 |
| RN-CAP-066 | La cuenta es opcional: sin cuenta se compra igual, sin puntos. | Acta 02 y 17/10 |
| RN-CAP-076 | La carta y el chatbot no piden pagar ni enviar capturas. | Reunión del 18/10 |
| RN-CAP-037 | Comprobante por defecto: nota de venta; boleta o factura a pedido. | Acta 02 |
| DT-57 | El método de pago se elige en la carta (obligatorio); la captura la pide el asesor por WhatsApp. | Acta 03 · decisiones.md |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-PED-01-01 | HU-CAP-012 | — | R-01 |
| RQ-PED-01-02 | HU-CAP-012 | — | R-01 |
| RQ-PED-01-03 | HU-CAP-012 | — | R-01 |
| RQ-PED-01-04 | HU-CAP-013 | — | R-01 |
| RQ-PED-01-05 | HU-CAP-013 | FT-LEG-02 (privacidad) · D-18 | R-11 |
| RQ-PED-01-06 | HU-CAP-014 | FT-CFG-02 · lista de medios de Kevin (acta 03) | R-01 |
| RQ-PED-01-07 | HU-CAP-014 | — | R-01 |
| RQ-PED-01-08 | HU-CAP-014 | — | R-01 |
| RQ-PED-01-09 | HU-CAP-015 | FT-OFE-02 · FT-OFE-03 · FT-PED-02 | R-01 |
| RQ-PED-01-10 | HU-CAP-015 | FT-OFE-03 | R-01 |
| RQ-PED-01-11 | HU-CAP-015 | FT-LEG-01 | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-012 Agregar y editar productos en el carrito
- HU-CAP-013 Dar mis datos mínimos al final
- HU-CAP-014 Elegir cómo pagar sin pagar en la web
- HU-CAP-015 Ver el resumen con descuentos, cupón y comprobante

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-003, ADR-005, ADR-009, ADR-010.

**Fuera de alcance**

- Ubicación y costo de envío: FT-PED-02.
- Envío a caja y mensaje de WhatsApp: FT-PED-03.
- Cuenta del cliente y puntos: FT-CLI-01 y FT-CLI-02.
- Pago en línea con pasarela (DT-11).
- Pedidos programados para otro día (A1).

**Preguntas abiertas**

1. **Pedido mínimo** — D-03. El mockup usa S/ 14,50 para delivery (V3); por confirmar con Kevin.
2. **¿Se guarda el carrito si el cliente cierra la carta?** Propuesta: sí, en el dispositivo, por 24 horas.

---

Generado por IA: BRD (NEC-CAP-017, 018, 019, 065, 089; RN-CAP-011, 016, 028, 029, 037, 045, 066, 069, 070, 076), decisiones A2, DT-17, D-03, D-18 y el mockup de la carta — Revisado por: *(pendiente)*
