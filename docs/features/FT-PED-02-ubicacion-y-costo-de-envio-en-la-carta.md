---
id: FT-PED-02
tipo: spec
titulo: "Ubicación y costo de envío en la carta"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-002, FT-PED-01, FT-DEL-01, FT-CAJ-01, ADR-001, ADR-011, ADR-014, ADR-003, ADR-005, ADR-009, ADR-010, NEC-CAP-019, NEC-CAP-049, NEC-CAP-076, NEC-CAP-092, RN-CAP-065, RN-CAP-103]
tags: [pedido, plt-03, ep-cap-002, ft-ped-02, debe-tener]
---

# FT-PED-02 — Ubicación y costo de envío en la carta

**PLT-03 · Feature · Catálogo de requerimientos** · Frente PEDIDO · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-PED-02 | Ubicación y costo de envío en la carta | EP-CAP-002 Pedido del cliente en la carta |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debe tener** (NEC-CAP-049 · NEC-CAP-092) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H1 · piloto en el local · 28/12/2026 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** En delivery, la carta pide la ubicación con el botón «Usar mi ubicación actual»: el celular da el punto, se muestra en un mapa con su enlace a Google Maps, y el cliente puede mover el pin (por ejemplo, a la puerta de atrás o a la otra calle), escribir o corregir la dirección y dejar una referencia (NEC-CAP-049). Debajo del mapa el cliente **confirma** «Mi pedido llega aquí» antes de seguir, porque con la prisa el GPS queda impreciso y hay calles con el mismo nombre en distritos distintos (DT-57, acta 03). El mapa **no dibuja los límites de las zonas** de reparto. La ubicación **nunca es obligatoria ni bloquea** (NEC-CAP-092): si el cliente no la comparte (sin permiso, tardó demasiado o el equipo no la soporta), ve «No fue posible conseguir la ubicación» y escribe la dirección, que entonces es obligatoria; un asesor la ubica después (FT-CAJ-01). No se pide código Plus (RN-CAP-065). Con el punto, el sistema calcula solo la zona de reparto y su costo; el cliente nunca elige ni ve una «zona», solo el costo o el aviso de fuera de cobertura, con la opción de recoger (RN-CAP-103). Aplica envío gratis (más de S/ 70, V2) y pedido mínimo (V3).

**Beneficio esperado.** Pedidos de delivery con un punto exacto que el repartidor abre en su app de mapas, y un costo de envío correcto sin preguntar zonas al cliente. Contribuye a OBJ-CAP-001. Hipótesis medible: **80 % de los delivery llegan con ubicación del cliente** (propuesta) y **0 envíos cobrados con una zona distinta a la del punto**.

**Usuarios / roles.** ACT-CAP-006 Clientes (comparten o escriben su ubicación).

**Pantallas de referencia.** Carta ▸ paso de entrega con «Usar mi ubicación actual», mapa, dirección, referencia y costo de envío (`Main.dc.html`) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-PED-02-01 | En delivery, la carta ofrece «Usar mi ubicación actual» y muestra el punto en un mapa con enlace a Google Maps. | Debe tener | NEC-CAP-049 | Dado un cliente que acepta el permiso, cuando toca el botón, entonces ve «Ubicación encontrada», el pin en el mapa y el enlace que abre ese punto. | Propuesto |
| RQ-PED-02-02 | Si la ubicación falla, se avisa y se pide escribir la dirección, sin bloquear el pedido. | Debe tener | RN-CAP-065 · NEC-CAP-092 | Dado un cliente que niega el permiso, cuando toca el botón, entonces ve «No fue posible conseguir la ubicación» y puede terminar el pedido escribiendo la dirección. | Propuesto |
| RQ-PED-02-03 | Con ubicación compartida, la dirección escrita es opcional; sin ubicación, es obligatoria. | Debe tener | NEC-CAP-092 | Dado un pedido con punto, cuando el cliente deja la dirección vacía, entonces puede enviar; sin punto y con la dirección vacía, no puede. | Propuesto |
| RQ-PED-02-04 | Debajo del mapa el cliente confirma la ubicación con «Mi pedido llega aquí» antes de seguir. | Debe tener | DT-57 · Acta 03 | Dado el pin puesto por el GPS, cuando el cliente intenta seguir sin confirmar, entonces ve «Revisa que el punto rojo sea donde recibirás tu pedido» y el botón «Mi pedido llega aquí»; al confirmar, se calcula el envío con ese punto. | Propuesto |
| RQ-PED-02-05 | El cliente puede mover el pin y dejar una referencia. | Debe tener | NEC-CAP-019 · NEC-CAP-049 | Dado el pin en el mapa, cuando el cliente lo arrastra a su puerta y escribe «casa verde, 2.º piso», entonces el pedido guarda el punto nuevo y la referencia. | Propuesto |
| RQ-PED-02-06 | La carta no pide código Plus de Google Maps. | Debe tener | RN-CAP-065 · NEC-CAP-019 | Dado el paso de entrega, cuando se revisa el formulario, entonces no hay campo de código Plus. | Propuesto |
| RQ-PED-02-07 | La zona y el costo de envío salen solos del punto; el cliente solo ve el costo y el mapa no dibuja los límites de las zonas. | Debe tener | RN-CAP-103 · NEC-CAP-076 · DT-57 | Dado un punto dentro de la zona Z3 con tarifa S/ 4, cuando el cliente confirma la ubicación, entonces ve «Envío S/ 4,00», sin el nombre de la zona y sin líneas de zonas en el mapa. | Propuesto |
| RQ-PED-02-08 | Un punto fuera de cobertura avisa y ofrece cambiar a recoger; no se guarda como delivery. | Debe tener | RN-CAP-103 · RN-CAP-087 | Dado un punto fuera de todas las zonas activas, cuando el cliente lo confirma, entonces ve «Aún no llegamos a esa dirección» con el botón «Recoger en tienda», y no puede enviar como delivery. | Propuesto |
| RQ-PED-02-09 | Sin punto, el envío queda «por calcular» y lo fija el asesor al ubicar el pedido. | Debe tener | RN-CAP-104 · NEC-CAP-092 | Dado un pedido enviado solo con dirección escrita, cuando llega a caja, entonces el envío figura «por calcular» y el pedido no se puede confirmar hasta ubicarlo (FT-CAJ-01). | Propuesto |
| RQ-PED-02-10 | El envío es gratis cuando los productos pasan del monto de envío gratis. | Debe tener | RN-CAP-095 · NEC-CAP-096 · V2 | Dado envío gratis con «más de S/ 70», cuando los productos suman S/ 70,00, entonces se cobra envío; con S/ 70,10, el envío es S/ 0. | Propuesto |
| RQ-PED-02-11 | No se puede enviar un delivery por debajo del pedido mínimo. | Debe tener | RN-CAP-008 · V3 | Dado un pedido mínimo de S/ 14,50, cuando los productos suman S/ 12, entonces se ve cuánto falta y no se puede enviar como delivery. | Propuesto |

Prioridad por NEC-CAP-049 y NEC-CAP-092 (E1). Los valores de envío gratis y pedido mínimo son los del mockup (V2, V3), por confirmar (D-02, D-03). Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-008 | Datos personales | El DNI, el teléfono y la ubicación se guardan con aceptación registrada y el DNI se muestra enmascarado en listas (Ley 29733). | 0 datos personales sin aceptación · 0 DNI completos en listas (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-004 | Usabilidad | Las pantallas se usan desde un celular sin desplazamiento horizontal. | Ancho mínimo 360 px · 0 pantallas con scroll horizontal (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-011 | Exactitud | Los montos se calculan en soles con dos decimales sin errores de redondeo. | Diferencia 0,00 entre total mostrado, cobrado y registrado (umbral propuesto) | Debe tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-008 aplica porque la ubicación del cliente es un dato personal; se guarda con el pedido y para el siguiente solo con aceptación.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-008 | Delivery: pedido mínimo de S/ 14,50 (por confirmar). | Web anterior |
| RN-CAP-009 | Envío gratis desde S/ 70; por debajo, el costo depende de la zona. | Web anterior |
| RN-CAP-065 | Manda la ubicación actual; no se pide código Plus; si falla, se avisa y se escribe la dirección. | Decisión del 17/10 |
| RN-CAP-087 | La zona la decide el pin; fuera de cobertura no se registra delivery. | Delivery |
| RN-CAP-095 | Envío gratis «más de 70» por defecto, configurable a «desde 70». | Delivery |
| RN-CAP-103 | La zona y su costo salen solos del punto; el cliente nunca ve la zona. | Delivery |
| RN-CAP-104 | Un delivery sin ubicación ni zona no se confirma. | Delivery |
| DT-57 | La ubicación se confirma bajo el mapa, no es obligatoria y los límites de las zonas no se muestran al cliente. | Acta 03 · decisiones.md |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-PED-02-01 | HU-CAP-016 | — | R-01 |
| RQ-PED-02-02 | HU-CAP-016 | — | R-01 |
| RQ-PED-02-03 | HU-CAP-016 | — | R-01 |
| RQ-PED-02-04 | HU-CAP-016 | — | R-01 |
| RQ-PED-02-05 | HU-CAP-016 | — | R-01 |
| RQ-PED-02-06 | HU-CAP-016 | — | R-01 |
| RQ-PED-02-07 | HU-CAP-017 | FT-DEL-01 · DEP-07 (D-03) | R-03 |
| RQ-PED-02-08 | HU-CAP-017 | FT-DEL-01 | R-01 |
| RQ-PED-02-09 | HU-CAP-017 | FT-CAJ-01 | R-01 |
| RQ-PED-02-10 | HU-CAP-018 | D-02 | R-01 |
| RQ-PED-02-11 | HU-CAP-018 | D-03 | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-016 Compartir mi ubicación o escribir mi dirección
- HU-CAP-017 Ver el costo de envío o el aviso de fuera de cobertura
- HU-CAP-018 Ver envío gratis y pedido mínimo

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-003, ADR-005, ADR-009, ADR-010.

**Fuera de alcance**

- Cómo se editan zonas y tarifas: FT-DEL-01.
- Cómo el asesor ubica un pedido sin punto: FT-CAJ-01.
- Seguimiento del repartidor en un mapa en tiempo real (fuera de alcance, BRD §4).

**Preguntas abiertas**

1. **Zonas y tarifas vigentes** — D-03 y DEP-07.
2. **«Más de» o «desde» S/ 70** — D-02. Propuesta: «más de S/ 70», como el bot actual.
3. **Proveedor del mapa y su costo** — se decide en G3 (D-12).

---

Generado por IA: BRD (NEC-CAP-019, 049, 076, 092, 096; RN-CAP-008, 009, 065, 087, 095, 103, 104), decisiones D-02, D-03 y el mockup de la carta — Revisado por: *(pendiente)*
