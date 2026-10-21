---
id: FT-BOT-01
tipo: spec
titulo: "Pedido por botones"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-20
relacionados: [EP-CAP-014, FT-BOT-02, FT-BOT-03, FT-CAR-01, FT-CAR-02, FT-OFE-02, ADR-001, ADR-011, ADR-014, ADR-007, ADR-009, NEC-CAP-004, NEC-CAP-028, RN-CAP-005, RN-CAP-049]
tags: [chatbot, plt-03, ep-cap-014, ft-bot-01, deberia-tener]
---

# FT-BOT-01 — Pedido por botones

**PLT-03 · Feature · Catálogo de requerimientos** · Frente CHATBOT · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-BOT-01 | Pedido por botones | EP-CAP-014 Chatbot: pedido y pago por WhatsApp |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debería tener** (NEC-CAP-004 · NEC-CAP-028) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H2 · 01/03/2027 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** El chatbot de WhatsApp toma el pedido completo **por botones y listas**, para clientes que no manejan bien la web (NEC-CAP-004). Ofrece las **mismas opciones, precios y reglas que la carta** (RN-CAP-005): categorías, productos, tamaños, leche, endulzante, cremas, toppings, combos y notas; un carrito con varios productos; delivery o recojo; ubicación compartida desde WhatsApp o dirección escrita; costo de envío por zona; medio de pago preferido. Respeta horario, agotados, pausa y Alta demanda, y aplica los descuentos automáticos. Al terminar, el pedido **pasa directo a cocina**, igual que el de la carta (DT-71, acta 03): el bot le dice al cliente «Tu pedido ya está en cocina» con el rango de entrega (de 25 a 35 minutos más la alta demanda) y el asesor coordina el pago después (FT-BOT-02). La IA no toma pedidos: solo responde dudas (FT-BOT-03, DT-18).

**Beneficio esperado.** Atender por WhatsApp sin errores de precios ni cobros olvidados (el bot actual a veces omite el delivery, R-07). Hipótesis medible: **0 pedidos del bot con precio o envío distinto al de la carta**; **% de chats que terminan en pedido medido**.

**Usuarios / roles.** ACT-CAP-006 Clientes (piden por WhatsApp) · Chatbot de WhatsApp, sistema (guía con botones) · ACT-CAP-002 Cajero/a (recibe el pedido).

**Pantallas de referencia.** Chatbot ▸ simulador de WhatsApp (`Chatbot.dc.html` o tablero del bot del mockup); `legacy/capri-bot/` (bot actual) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-BOT-01-01 | El bot muestra categorías y productos con botones y listas. | Debería tener | NEC-CAP-028 · RN-CAP-049 | Dado un cliente que escribe «hola», cuando elige «Hacer pedido», entonces ve la lista de categorías y, al elegir una, sus productos con precio. | Propuesto |
| RQ-BOT-01-02 | El bot pide tamaño y opciones con las mismas reglas de la carta. | Debería tener | RN-CAP-005 · RN-CAP-004 | Dado un frappé con leche obligatoria, cuando el cliente intenta seguir sin elegir, entonces el bot vuelve a mostrar las leches. | Propuesto |
| RQ-BOT-01-03 | El bot arma un carrito con varios productos, muestra el resumen y permite quitar o seguir pidiendo. | Debería tener | NEC-CAP-028 | Dados dos productos agregados, cuando el cliente pide «Ver carrito», entonces ve los dos con su total y botones «Agregar más», «Quitar» y «Terminar». | Propuesto |
| RQ-BOT-01-04 | El bot pide modalidad, ubicación o dirección y calcula el envío por zona. | Debería tener | NEC-CAP-092 · RN-CAP-103 | Dado un delivery, cuando el cliente comparte su ubicación de WhatsApp, entonces el bot calcula el envío; si escribe solo la dirección, el envío queda por calcular para el asesor. | Propuesto |
| RQ-BOT-01-05 | El bot respeta horario, agotados, pausa y Alta demanda. | Debería tener | NEC-CAP-085 · RN-CAP-113 | Dado un producto agotado, cuando el cliente abre su categoría, entonces no aparece; con la pausa activa, el bot ofrece hablar con una persona. | Propuesto |
| RQ-BOT-01-06 | El bot aplica los descuentos automáticos vigentes y avisa promociones aplicables. | Debería tener | NEC-CAP-110 · NEC-CAP-109 | Dado un descuento de 20 % en frappés, cuando el cliente agrega uno, entonces el resumen muestra el descuento. | Propuesto |
| RQ-BOT-01-07 | Al terminar, el pedido pasa directo a cocina con canal «Chatbot» y el pago por coordinar; el bot confirma con el rango de entrega. | Debería tener | DT-71 · DT-57 · V1 | Dado un carrito terminado sin alta demanda, cuando el cliente confirma, entonces cada parte aparece en la pantalla de su área, el pedido figura en caja con el pago por coordinar y el bot responde «Tu pedido ya está en cocina: te llega de 25 a 35 minutos». | Propuesto |
| RQ-BOT-01-08 | Un mensaje que el bot no entiende se repregunta una vez y luego pasa a una persona. | Debería tener | NEC-CAP-093 | Dado un texto libre fuera del flujo, cuando el bot no lo entiende dos veces, entonces avisa «Te comunico con un asesor» y deja el chat en la consola. | Propuesto |
| RQ-BOT-01-09 | Si el cliente manda un enlace de Google Maps, el bot lee las coordenadas (también de un enlace corto, abriéndolo desde el servidor) y guarda el punto, la zona y el envío. | Debería tener | DT-79 · NEC-CAP-092 | Dado un enlace de Google Maps con coordenadas, cuando el cliente lo manda por WhatsApp, entonces el pedido guarda el punto y el bot responde con el costo de envío. | Propuesto |
| RQ-BOT-01-10 | Si el bot no puede sacar un punto del mensaje (enlace de un lugar sin coordenadas o solo texto), pide la ubicación con el clip «Ubicación» de WhatsApp; si no la manda, el asesor ubica el pedido. Cada punto guarda de dónde vino (carta, GPS, WhatsApp, enlace, asesor). | Debería tener | DT-79 | Dado un enlace sin coordenadas, cuando el cliente lo manda, entonces el bot le pide la ubicación con el clip y no calcula el envío hasta recibirla. | Propuesto |

Prioridad *Debería tener* por la épica (fase Siguiente); depende del acceso a WhatsApp (DEP-12). Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-016 | Rendimiento | El chatbot responde a un botón o mensaje sin demora perceptible. | Respuesta ≤ 5 s (p90) (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-015 | Costo | El uso de IA y de plantillas de WhatsApp se registra y tiene un tope mensual configurable. | Costo mensual visible · alerta al 80 % del tope (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-011 | Exactitud | Los montos se calculan en soles con dos decimales sin errores de redondeo. | Diferencia 0,00 entre total mostrado, cobrado y registrado (umbral propuesto) | Debería tener (hereda de la feature) |
| RNF-CAP-003 | Disponibilidad | La carta, el administrativo y el chatbot están en línea durante el horario de atención. | ≥ 99,5 % mensual en horario · medición: monitoreo externo (umbral propuesto) | Debería tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-015 aplica al costo de plantillas y de IA; RNF-CAP-016 a la respuesta del bot.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-005 | El chatbot ofrece las mismas opciones, precios y reglas que la carta. | Descubrimiento |
| RN-CAP-049 | La IA consulta la disponibilidad para recomendar; el pedido siempre va por botones. | Acta 02 |
| RN-CAP-076 | El chatbot no pide pagar ni enviar capturas al hacer el pedido. | Reunión del 18/10 |
| DT-18 | El chatbot pide por botones; la IA solo para dudas. | decisiones.md |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-BOT-01-01 | HU-CAP-126 | DEP-12 (D-08) | R-04 |
| RQ-BOT-01-02 | HU-CAP-126 | FT-CAR-01 | R-01 |
| RQ-BOT-01-03 | HU-CAP-127 | — | R-01 |
| RQ-BOT-01-04 | HU-CAP-127 | FT-DEL-01 | R-07 |
| RQ-BOT-01-05 | HU-CAP-128 | FT-CAR-02 · FT-COC-03 | R-01 |
| RQ-BOT-01-06 | HU-CAP-128 | FT-OFE-02 | R-01 |
| RQ-BOT-01-07 | HU-CAP-128 | FT-CAJ-01 | R-01 |
| RQ-BOT-01-08 | HU-CAP-129 | FT-ATN-01 | R-01 |
| RQ-BOT-01-09 | HU-CAP-127 | FT-DEL-01 | R-07 |
| RQ-BOT-01-10 | HU-CAP-127 | FT-DEL-01 | R-07 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-126 Elegir productos y opciones con botones en WhatsApp
- HU-CAP-127 Armar el carrito y dar la entrega en WhatsApp
- HU-CAP-128 Enviar el pedido del bot a caja
- HU-CAP-129 Pasar a una persona cuando el bot no entiende

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-007, ADR-009.

**Fuera de alcance**

- Pago por WhatsApp: FT-BOT-02.
- IA para dudas: FT-BOT-03.
- Consola de chats: FT-ATN-01.
- Preferencias guardadas del cliente en el bot (horizonte futuro).

**Preguntas abiertas**

1. **Acceso a la cuenta de Meta y costo** — D-08, DEP-12.
2. **¿Se reemplaza el bot actual o conviven?** — D-20.

---

Generado por IA: BRD (NEC-CAP-004, 028, 085, 092, 093, 109, 110; RN-CAP-004, 005, 049, 074, 076, 103, 113), DT-18 y el mockup del chatbot — Revisado por: *(pendiente)*
