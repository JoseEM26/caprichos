---
id: FT-COC-02
tipo: spec
titulo: "Impresión de comandas y etiquetas"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-006, FT-COC-01, FT-CAJ-01, FT-CFG-02, FT-OFE-03, ADR-001, ADR-011, ADR-014, ADR-002, ADR-006, ADR-007, NEC-CAP-013, NEC-CAP-021, NEC-CAP-060, RN-CAP-019, RN-CAP-020, RN-CAP-021]
tags: [cocina, plt-03, ep-cap-006, ft-coc-02, debe-tener]
---

# FT-COC-02 — Impresión de comandas y etiquetas

**PLT-03 · Feature · Catálogo de requerimientos** · Frente COCINA · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-COC-02 | Impresión de comandas y etiquetas | EP-CAP-006 Cocina por áreas e impresión |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debe tener** (NEC-CAP-013 · NEC-CAP-060) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H1 · piloto en el local · 28/12/2026 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** Cuando un pedido pasa a cocina (confirmado por caja o enviado por el mozo), se imprime automáticamente la **comanda** en la ticketera de cada área, solo con lo de esa área (RN-CAP-019, RN-CAP-020). Junto con la comanda salen tres tipos de **etiqueta adhesiva** (NEC-CAP-060): una **general** del pedido (para la bolsa o bandeja), una **por área** (bebidas, salados, postres) en la etiquetera de su área, y una **por bebida**, que dice qué lleva y se pega en el vaso. Cada tipo se activa o desactiva en la configuración y se puede reimprimir. Si la impresión falla, el pedido no se pierde: sigue en cocina, caja recibe una alerta y puede reimprimir (RN-CAP-021). En delivery se puede sacar una copia de despacho. Cómo se conecta la ticketera (red, USB, Bluetooth o nube) se decide en ADR-002 (D-13).

**Beneficio esperado.** Comandas y etiquetas sin escribir a mano, que reducen errores de preparación y de despacho. Hipótesis medible: **0 pedidos en cocina sin comanda impresa o alerta registrada**; **100 % de bebidas con su etiqueta** cuando el tipo está activo.

**Usuarios / roles.** ACT-CAP-003 Cocina y barra (recibe comandas y etiquetas) · ACT-CAP-002 Cajero/a (recibe alertas y reimprime) · ACT-CAP-001 Kevin Rosales, dueño y administrador (configura tipos y ticketeras).

**Pantallas de referencia.** Administrativo ▸ Pedidos y caja (reimprimir), Configuración del local ▸ Impresión (`Admin.dc.html`); `analisis/impresion-tickets.md` (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-COC-02-01 | Al pasar a cocina se imprime la comanda en la ticketera de cada área con solo lo suyo. | Debe tener | NEC-CAP-013 · RN-CAP-020 | Dado un pedido con bebida y salado, cuando pasa a cocina, entonces la ticketera de barra imprime la bebida y la de cocina el salado, cada una con ticket, hora, mozo o canal y notas. | Propuesto |
| RQ-COC-02-02 | Un pedido por confirmar o rechazado no se imprime. | Debe tener | RN-CAP-019 | Dado un pedido de la carta por confirmar, cuando se revisan las ticketeras, entonces no se imprimió nada; tampoco al rechazarlo. | Propuesto |
| RQ-COC-02-03 | Se imprime una etiqueta general del pedido. | Debería tener | NEC-CAP-060 | Dado el tipo «general» activo, cuando el pedido pasa a cocina, entonces sale una etiqueta con ticket, cliente o mesa, modalidad y cantidad de productos. | Propuesto |
| RQ-COC-02-04 | Se imprime una etiqueta por área en la etiquetera de esa área. | Debería tener | NEC-CAP-060 · NEC-CAP-021 | Dado un pedido con productos de tres áreas, cuando pasa a cocina, entonces cada etiquetera imprime la etiqueta de su área. | Propuesto |
| RQ-COC-02-05 | Se imprime una etiqueta por bebida con lo que contiene. | Debería tener | NEC-CAP-060 | Dados 2 frappés con leches distintas, cuando el pedido pasa a cocina, entonces salen 2 etiquetas, cada una con su sabor, tamaño, leche, dulzor y toppings. | Propuesto |
| RQ-COC-02-06 | Cada tipo de etiqueta se activa o desactiva en la configuración. | Debería tener | NEC-CAP-060 | Dada la etiqueta por bebida desactivada, cuando un pedido pasa a cocina, entonces no se imprime ese tipo y los demás sí. | Propuesto |
| RQ-COC-02-07 | Si la impresión falla, el pedido sigue en cocina y caja recibe una alerta. | Debe tener | RN-CAP-021 · NEC-CAP-013 | Dada la ticketera de barra apagada, cuando un pedido pasa a cocina, entonces aparece en la pantalla de Bebidas y caja ve «No se imprimió la comanda de Bebidas · Reimprimir». | Propuesto |
| RQ-COC-02-08 | Caja reimprime la comanda o cualquier tipo de etiqueta de un pedido. | Debe tener | NEC-CAP-013 · NEC-CAP-060 | Dado un pedido en cocina, cuando el cajero toca «Reimprimir» y elige «Etiqueta por bebida», entonces se vuelve a imprimir solo eso, marcado como copia. | Propuesto |
| RQ-COC-02-09 | En delivery se puede sacar una copia de despacho. | Podría tener | BRD §4 «Impresión de tickets» | Dado un delivery listo, cuando el cajero imprime la copia de despacho, entonces sale con cliente, dirección, referencia, enlace al mapa y vuelto. | Propuesto |
| RQ-COC-02-10 | Las áreas propias no tienen etiqueta de impresión propia. | Debe tener | RN-CAP-123 | Dada el área propia «Parrilla», cuando un pedido le llega, entonces su parte se imprime en la ticketera de cocina asignada, sin etiquetera propia. | Propuesto |

Prioridad por NEC-CAP-013 (E1); las etiquetas (NEC-CAP-060) son *Debería tener* hasta conocer las etiqueteras del local (DEP-03, R-08). Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-013 | Impresión | La comanda y las etiquetas salen poco después de pasar a cocina; si fallan, caja se entera. | Impresión ≤ 5 s · alerta de fallo ≤ 10 s (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-003 | Disponibilidad | La carta, el administrativo y el chatbot están en línea durante el horario de atención. | ≥ 99,5 % mensual en horario · medición: monitoreo externo (umbral propuesto) | Debe tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-013 es el umbral clave; depende de la conexión que decida ADR-002.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-019 | La comanda y las etiquetas se imprimen al pasar a cocina; un pedido rechazado no se imprime. | Reunión |
| RN-CAP-020 | Cada área tiene su ticketera y solo imprime lo suyo. | restaurant.pe |
| RN-CAP-021 | Si falla la impresión, el pedido sigue en cocina, caja recibe alerta y puede reimprimir. | Propuesta |
| RN-CAP-123 | Las áreas propias no tienen etiqueta propia. | Cocina |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-COC-02-01 | HU-CAP-051 | DEP-03 · D-13 (ADR-002) | R-08 |
| RQ-COC-02-02 | HU-CAP-051 | — | R-01 |
| RQ-COC-02-03 | HU-CAP-052 | DEP-03 | R-08 |
| RQ-COC-02-04 | HU-CAP-052 | DEP-03 | R-08 |
| RQ-COC-02-05 | HU-CAP-052 | DEP-03 | R-08 |
| RQ-COC-02-06 | HU-CAP-053 | FT-CFG-02 | R-01 |
| RQ-COC-02-07 | HU-CAP-054 | ADR-002 (D-13) | R-08 |
| RQ-COC-02-08 | HU-CAP-054 | — | R-01 |
| RQ-COC-02-09 | HU-CAP-054 | — | R-01 |
| RQ-COC-02-10 | HU-CAP-051 | FT-COC-01 | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-051 Imprimir la comanda por área al pasar a cocina
- HU-CAP-052 Imprimir las etiquetas general, por área y por bebida
- HU-CAP-053 Activar o desactivar tipos de etiqueta
- HU-CAP-054 Recibir la alerta de fallo y reimprimir

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-002, ADR-006, ADR-007.

**Fuera de alcance**

- Pantallas de cocina: FT-COC-01.
- Comprobante y cupones impresos: FT-LEG-01 y FT-OFE-03.
- Elección técnica de la conexión: ADR-002 (Bloque 4).

**Preguntas abiertas**

1. **Modelo y conexión de ticketeras y etiqueteras** — D-13, DEP-03.
2. **Tamaño de la etiqueta adhesiva** — por definir con las etiqueteras.

---

Generado por IA: BRD (NEC-CAP-013, 021, 060; RN-CAP-019 a 021, 123), `analisis/impresion-tickets.md` y el mockup — Revisado por: *(pendiente)*
