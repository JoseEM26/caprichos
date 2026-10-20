---
id: FT-DEL-02
tipo: spec
titulo: "Reparto: tomar, navegar y entregar"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-008, FT-DEL-01, FT-DEL-03, FT-CIE-01, FT-USR-02, ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, ADR-010, NEC-CAP-009, NEC-CAP-015, NEC-CAP-079, RN-CAP-012, RN-CAP-024, RN-CAP-088]
tags: [delivery, plt-03, ep-cap-008, ft-del-02, debe-tener]
---

# FT-DEL-02 — Reparto: tomar, navegar y entregar

**PLT-03 · Feature · Catálogo de requerimientos** · Frente DELIVERY · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-DEL-02 | Reparto: tomar, navegar y entregar | EP-CAP-008 Delivery y entregas |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debe tener** (NEC-CAP-009 · NEC-CAP-015 · NEC-CAP-079) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H1 · piloto en el local · 28/12/2026 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** El repartidor es un rol dentro de la misma web, sin aplicación aparte (DT-10). Ve los delivery **listos** disponibles y **toma** el que va a llevar; si dos lo intentan a la vez, solo el primero lo recibe y el otro ve un aviso (NEC-CAP-015, RN-CAP-024). Ve solo sus entregas (RN-CAP-012). En cada una tiene la dirección, la referencia y el punto, que abre con un toque en Google Maps, Waze u otra aplicación de mapas por coordenadas (NEC-CAP-009); llama o escribe al cliente con un toque; y ve cuánto cobrar y el **vuelto que debe llevar** (NEC-CAP-079). Marca «En camino» y «Entregado». Si cobró en efectivo, ese dinero queda a su nombre hasta que caja lo **liquida** (RN-CAP-088).

**Beneficio esperado.** Entregas sin copiar direcciones a mano ni discusiones sobre quién lleva qué. Contribuye a OBJ-CAP-001. Hipótesis medible: **0 pedidos tomados por dos repartidores**; **100 % de las entregas con hora de salida y de entrega registradas**.

**Usuarios / roles.** ACT-CAP-009 Repartidor (motorizado) (toma, lleva y entrega) · ACT-CAP-002 Cajero/a (liquida su efectivo).

**Pantallas de referencia.** Administrativo ▸ Repartos (rol repartidor): disponibles, mis entregas, detalle con mapa (`Admin.dc.html`) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-DEL-02-01 | El repartidor ve los delivery listos disponibles para tomar. | Debe tener | NEC-CAP-015 · RN-CAP-012 | Dados 2 delivery listos sin repartidor, cuando el repartidor abre Repartos, entonces los ve con zona interna, total y minutos desde que están listos. | Propuesto |
| RQ-DEL-02-02 | Solo un repartidor puede tomar un pedido; el segundo ve un aviso. | Debe tener | RN-CAP-024 | Dados dos repartidores que tocan «Tomar» a la vez, cuando el sistema responde, entonces uno queda asignado y el otro ve «Otro repartidor ya tomó este pedido». | Propuesto |
| RQ-DEL-02-03 | El repartidor ve solo sus entregas y no los datos de otros pedidos. | Debe tener | RN-CAP-012 · RN-CAP-013 | Dado un repartidor con 1 pedido tomado, cuando abre Mis entregas, entonces solo ve ese pedido; no ve ventas ni otros módulos. | Propuesto |
| RQ-DEL-02-04 | El repartidor abre la ubicación en su aplicación de mapas por coordenadas con un toque. | Debe tener | NEC-CAP-009 | Dado un pedido con punto, cuando toca «Navegar», entonces se abre Google Maps, Waze u otra aplicación con esas coordenadas. | Propuesto |
| RQ-DEL-02-05 | El repartidor llama o escribe por WhatsApp al cliente con un toque. | Debe tener | NEC-CAP-079 | Dado un pedido, cuando toca «Llamar» o «WhatsApp», entonces se abre la llamada o el chat con el teléfono del cliente. | Propuesto |
| RQ-DEL-02-06 | El repartidor ve cuánto cobrar y el vuelto que debe llevar. | Debe tener | NEC-CAP-079 | Dado un delivery de S/ 37 en efectivo, «paga con S/ 50», cuando lo abre, entonces ve «Cobrar S/ 37,00 · llevar vuelto S/ 13,00»; si ya está pagado con Yape, ve «Pagado». | Propuesto |
| RQ-DEL-02-07 | El repartidor marca «En camino» y «Entregado», con hora. | Debe tener | OBJ-CAP-001 | Dado un pedido tomado, cuando marca «En camino» y luego «Entregado» con Sí/No, entonces quedan las dos horas registradas para medir el tiempo de entrega. | Propuesto |
| RQ-DEL-02-08 | El efectivo cobrado queda a nombre del repartidor hasta la liquidación. | Debe tener | RN-CAP-088 | Dado un delivery entregado y cobrado en efectivo, cuando se consulta caja, entonces figura en «Por liquidar» del repartidor (FT-CIE-01). | Propuesto |
| RQ-DEL-02-09 | El repartidor no toma pedidos nuevos. | Debe tener | RN-CAP-033 · A3 | Dado un repartidor, cuando revisa su menú, entonces no tiene Nuevo pedido. | Propuesto |

Prioridad por NEC-CAP-009, 015 y 079 (E1). Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-010 | Concurrencia | Cuando dos personas actúan a la vez sobre lo mismo (mesa, reparto, cupón, chat), solo una gana y la otra ve un aviso. | 0 duplicados en prueba con dos usuarios a la vez (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-004 | Usabilidad | Las pantallas se usan desde un celular sin desplazamiento horizontal. | Ancho mínimo 360 px · 0 pantallas con scroll horizontal (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-006 | Seguridad | Cada acción se autoriza en el servidor según el rol, no solo ocultando botones. | 0 accesos a módulos o datos fuera del rol · prueba con un usuario por rol (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-008 | Datos personales | El DNI, el teléfono y la ubicación se guardan con aceptación registrada y el DNI se muestra enmascarado en listas (Ley 29733). | 0 datos personales sin aceptación · 0 DNI completos en listas (umbral propuesto) | Debe tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-010 aplica a RQ-DEL-02-02; RNF-CAP-008 porque el repartidor ve teléfono y dirección solo de sus entregas.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-012 | El repartidor ve solo los pedidos asignados, con ubicación, y la abre en una app de mapas. | Descubrimiento |
| RN-CAP-024 | Un delivery listo lo toma un solo repartidor; el otro ve un aviso. | Reunión |
| RN-CAP-033 | El repartidor no toma pedidos. | Acta 02 |
| RN-CAP-088 | El efectivo del repartidor no cuenta en caja hasta liquidarlo. | Caja, repartos |
| DT-10 | No hay aplicación móvil propia: el repartidor usa la misma web. | decisiones.md |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-DEL-02-01 | HU-CAP-071 | — | R-01 |
| RQ-DEL-02-02 | HU-CAP-071 | ADR (mecanismo, Bloque 4) | R-09 |
| RQ-DEL-02-03 | HU-CAP-071 | FT-USR-02 | R-01 |
| RQ-DEL-02-04 | HU-CAP-072 | — | R-01 |
| RQ-DEL-02-05 | HU-CAP-072 | — | R-01 |
| RQ-DEL-02-06 | HU-CAP-072 | — | R-01 |
| RQ-DEL-02-07 | HU-CAP-073 | FT-INF-01 | R-01 |
| RQ-DEL-02-08 | HU-CAP-073 | FT-CIE-01 | R-01 |
| RQ-DEL-02-09 | HU-CAP-071 | FT-USR-02 | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-071 Ver y tomar un delivery listo
- HU-CAP-072 Navegar y contactar al cliente
- HU-CAP-073 Marcar en camino y entregado con el cobro

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, ADR-010.

**Fuera de alcance**

- Entregas fallidas: FT-DEL-03.
- Liquidación en caja: FT-CIE-01.
- Seguimiento del repartidor en un mapa en tiempo real (fuera de alcance, BRD §4).
- Asignación automática de repartidores (no pedida).

**Preguntas abiertas**

1. **¿Un repartidor puede tomar varios pedidos a la vez?** Propuesta: sí, hasta 3, configurable.
2. **¿Caja puede asignar un pedido a un repartidor?** Propuesta: sí, como respaldo, con aviso al repartidor.

---

Generado por IA: BRD (NEC-CAP-009, 015, 079; RN-CAP-012, 013, 024, 033, 088), DT-10 y el mockup de Repartos — Revisado por: *(pendiente)*
