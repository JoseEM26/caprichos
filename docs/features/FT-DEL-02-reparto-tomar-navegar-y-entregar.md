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

**Descripción.** El repartidor es un rol dentro de la misma web, sin aplicación aparte (DT-10), y cada uno tiene **su propio usuario**. Su **pantalla principal es un mapa a pantalla completa** en el celular (DT-59, acta 03), hecho con Leaflet y OpenStreetMap (sin costo por uso, ADR del mapa interno), con un **zoom automático** que abarca todos los pedidos listos: si están cerca, el mapa se acerca; si están repartidos en Campoy, Mangomarca y Huachipa, se aleja. Cada punto lleva el **nombre completo del cliente** y debajo, en chico, el **código** del pedido (así pide a despacho «dame el de Rosa y el de Diego» sin confundir a dos Diegos). El **color** dice cuánto espera el cliente desde que terminó su pedido: **verde** hasta 35 minutos, **naranja** de 35 a 50 y **rojo palpitando** desde 50 (configurables, D-29). Los pedidos se agrupan por las **zonas de reparto ya definidas** (FT-DEL-01) y el sistema propone un **orden sugerido** por cercanía y tiempo, calculado en línea recta sin API de pago; es solo una sugerencia: decide el repartidor (calles cerradas, tráfico). También hay **vista de lista**. Al tocar un punto aparece abajo el resumen: código, cliente, **Llamar**, **WhatsApp**, **Navegar** (Google Maps, Waze u otra por coordenadas, NEC-CAP-009), cuánto cobrar y el **vuelto que debe llevar** (NEC-CAP-079), y **un botón grande** con el siguiente estado, fácil de pulsar en la moto: **Tomar pedido → En camino → He llegado → Entregado**. Si dos repartidores intentan tomar el mismo pedido, solo el primero lo recibe (NEC-CAP-015, RN-CAP-024). Al pulsar «En camino» y «He llegado», el cliente recibe **mensajes automáticos por WhatsApp** (DT-60). Si cobró en efectivo, ese dinero queda a su nombre hasta que caja lo **liquida** (RN-CAP-088). La ubicación del repartidor en tiempo real **no se hace** por el costo de la API.

**Beneficio esperado.** El repartidor decide su ruta mirando una sola pantalla, sin entrar y salir de Google Maps por cada pedido; en hora punta sabe qué pedido lleva más retraso y qué puede llevar de pasada (problema de hoy con restaurant.pe, acta 03). Contribuye a OBJ-CAP-001. Hipótesis medible: **0 pedidos tomados por dos repartidores**; **100 % de las entregas con hora de toma, salida, llegada y entrega**; **porcentaje de entregas en rojo (más de 50 minutos) medido desde el primer día**.

**Usuarios / roles.** ACT-CAP-009 Repartidor (motorizado) (toma, lleva y entrega) · ACT-CAP-006 Clientes (recibe los avisos por WhatsApp) · ACT-CAP-002 Cajero/a (liquida su efectivo) · ACT-CAP-001 Kevin Rosales, dueño y administrador (ajusta colores y textos).

**Pantallas de referencia.** Administrativo ▸ Repartos (rol repartidor): mapa a pantalla completa, vista de lista, resumen al tocar un punto, botón de estado (`Admin.dc.html`) (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-DEL-02-01 | El repartidor ve los delivery listos disponibles para tomar, en el mapa y en la lista. | Debe tener | NEC-CAP-015 · RN-CAP-012 · DT-59 | Dados 2 delivery listos sin repartidor, cuando el repartidor abre Repartos, entonces los ve en el mapa y, con «Lista», con zona, total y minutos de espera. | Propuesto |
| RQ-DEL-02-02 | Solo un repartidor puede tomar un pedido; el segundo ve un aviso. | Debe tener | RN-CAP-024 | Dados dos repartidores que tocan «Tomar» a la vez, cuando el sistema responde, entonces uno queda asignado y el otro ve «Otro repartidor ya tomó este pedido». | Propuesto |
| RQ-DEL-02-03 | El repartidor ve solo sus entregas y no los datos de otros pedidos. | Debe tener | RN-CAP-012 · RN-CAP-013 | Dado un repartidor con 1 pedido tomado, cuando abre Mis entregas, entonces solo ve ese pedido; no ve ventas ni otros módulos. | Propuesto |
| RQ-DEL-02-04 | El repartidor abre la ubicación en su aplicación de mapas por coordenadas con un toque. | Debe tener | NEC-CAP-009 | Dado un pedido con punto, cuando toca «Navegar», entonces se abre Google Maps, Waze u otra aplicación con esas coordenadas. | Propuesto |
| RQ-DEL-02-05 | El repartidor llama o escribe por WhatsApp al cliente con un toque. | Debe tener | NEC-CAP-079 | Dado un pedido, cuando toca «Llamar» o «WhatsApp», entonces se abre la llamada o el chat con el teléfono del cliente. | Propuesto |
| RQ-DEL-02-06 | El repartidor ve cuánto cobrar y el vuelto que debe llevar. | Debe tener | NEC-CAP-079 | Dado un delivery de S/ 37 en efectivo, «paga con S/ 50», cuando lo abre, entonces ve «Cobrar S/ 37,00 · llevar vuelto S/ 13,00»; si ya está pagado con Yape, ve «Pagado». | Propuesto |
| RQ-DEL-02-07 | Un solo botón grande avanza el estado: Tomar pedido → En camino → He llegado → Entregado, con hora de cada paso. | Debe tener | OBJ-CAP-001 · DT-59 | Dado un pedido tomado, cuando el repartidor pulsa el botón grande, entonces pasa a «En camino», luego a «He llegado» y a «Entregado» (este último con Sí/No), y quedan las cuatro horas para medir el tiempo de entrega; el botón está siempre abajo, al alcance del pulgar. | Propuesto |
| RQ-DEL-02-08 | El efectivo cobrado queda a nombre del repartidor hasta la liquidación. | Debe tener | RN-CAP-088 | Dado un delivery entregado y cobrado en efectivo, cuando se consulta caja, entonces figura en «Por liquidar» del repartidor (FT-CIE-01). | Propuesto |
| RQ-DEL-02-09 | El repartidor no toma pedidos nuevos. | Debe tener | RN-CAP-033 · A3 | Dado un repartidor, cuando revisa su menú, entonces no tiene Nuevo pedido. | Propuesto |
| RQ-DEL-02-10 | La pantalla principal es un mapa a pantalla completa con zoom automático que abarca los pedidos listos. | Debe tener | DT-59 · Acta 03 | Dados 2 pedidos a media cuadra entre sí, cuando el repartidor abre Repartos, entonces el mapa se acerca a esos dos puntos; con 10 pedidos en Campoy, Mangomarca y Huachipa, se aleja hasta mostrarlos todos. | Propuesto |
| RQ-DEL-02-11 | Cada punto muestra el nombre completo del cliente y debajo, en chico, el código del pedido. | Debe tener | DT-59 · Acta 03 | Dados dos pedidos de «Diego», cuando aparecen en el mapa, entonces se leen «Diego Ramos · CP-0104» y «Diego Salas · CP-0107»; si el cliente dejó solo su nombre, el código los distingue. | Propuesto |
| RQ-DEL-02-12 | El color de cada punto depende del tiempo desde que el cliente terminó su pedido: verde, naranja o rojo palpitando. | Debe tener | DT-59 · D-29 | Dados umbrales de 35 y 50 minutos, cuando un pedido lleva 20, 40 y 55 minutos, entonces sus puntos se ven verde, naranja (palpita suave) y rojo (palpita fuerte); el administrador cambia los minutos en Configuración. | Propuesto |
| RQ-DEL-02-13 | Los pedidos se agrupan por las zonas de reparto ya definidas, para saber qué se puede llevar en una misma ruta. | Debería tener | DT-59 · FT-DEL-01 | Dados 3 pedidos en la zona Z4 y 1 en Z7, cuando el repartidor abre la lista, entonces los ve agrupados «Z4 · 3 pedidos» y «Z7 · 1 pedido»; en el mapa, el filtro de zona muestra solo esa zona. | Propuesto |
| RQ-DEL-02-14 | El sistema propone un orden sugerido por cercanía y tiempo para los pedidos que tomó, sin obligarlo. | Debería tener | DT-59 · Acta 03 | Dado un repartidor con 3 pedidos tomados, cuando abre el mapa, entonces ve los números 1, 2 y 3 sobre sus puntos según la distancia desde el local y el tiempo de espera, sin ninguna pregunta; puede entregarlos en otro orden. | Propuesto |
| RQ-DEL-02-15 | Al tocar un punto, abajo aparece el resumen del pedido con Llamar, WhatsApp, Navegar, cobro y el botón de estado. | Debe tener | DT-59 · NEC-CAP-079 | Dado el mapa, cuando el repartidor toca «Rosa Díaz», entonces ve abajo el código, el total, el vuelto, los botones Llamar, WhatsApp y Navegar, y el botón grande «Tomar pedido». | Propuesto |
| RQ-DEL-02-16 | Al pulsar «En camino», el cliente recibe un mensaje automático por WhatsApp. | Debería tener | DT-60 · Acta 03 | Dado un pedido tomado, cuando el repartidor pulsa «En camino», entonces el cliente recibe el mensaje 1 («Tu pedido está en camino, por favor atento a tu celular para recibir la llamada») en menos de un minuto. | Propuesto |
| RQ-DEL-02-17 | Al pulsar «He llegado» se envía el mensaje 2 y, si el cliente no responde en el tiempo configurado, el mensaje 3 con la espera máxima de 10 minutos. | Debería tener | DT-60 · D-27 | Dado un repartidor que pulsa «He llegado», cuando el cliente no responde en 2 minutos, entonces recibe el mensaje 3 («Recuerda que el tiempo máximo de espera es de 10 minutos…; si no estás, el repartidor regresará al local con tu pedido»). | Propuesto |
| RQ-DEL-02-18 | Si el cliente responde por WhatsApp (con un botón o un texto), no se envían los mensajes siguientes. | Debería tener | DT-60 | Dado el mensaje 2 enviado, cuando el cliente toca «Ya salgo», entonces no se envía el mensaje 3 y el repartidor ve «El cliente respondió». | Propuesto |
| RQ-DEL-02-19 | Los textos de los mensajes de reparto y los minutos entre ellos los edita el administrador. | Debería tener | DT-60 · Acta 03 | Dado el mensaje 1, cuando el administrador cambia el texto en Configuración ▸ Mensajes con Sí/No, entonces los siguientes envíos usan el nuevo texto. | Propuesto |

Prioridad por NEC-CAP-009, 015 y 079 (E1) y por el acta 03 (DT-59). Los mensajes al cliente (RQ-DEL-02-16 a 19) son *Debería tener* porque dependen del acceso a WhatsApp de Meta y del costo de sus plantillas (DEP-12, D-08, R-04). Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-010 | Concurrencia | Cuando dos personas actúan a la vez sobre lo mismo (mesa, reparto, cupón, chat), solo una gana y la otra ve un aviso. | 0 duplicados en prueba con dos usuarios a la vez (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-004 | Usabilidad | Las pantallas se usan desde un celular sin desplazamiento horizontal. | Ancho mínimo 360 px · 0 pantallas con scroll horizontal (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-006 | Seguridad | Cada acción se autoriza en el servidor según el rol, no solo ocultando botones. | 0 accesos a módulos o datos fuera del rol · prueba con un usuario por rol (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-008 | Datos personales | El DNI, el teléfono y la ubicación se guardan con aceptación registrada y el DNI se muestra enmascarado en listas (Ley 29733). | 0 datos personales sin aceptación · 0 DNI completos en listas (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-002 | Tiempo real | Un pedido que pasa a cocina aparece en todas sus pantallas sin recargar. | Retardo ≤ 3 s (p95) · medición: registro de eventos (umbral propuesto) | Debe tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-010 aplica a RQ-DEL-02-02; RNF-CAP-008 porque el repartidor ve teléfono y dirección de los pedidos listos y de sus entregas; RNF-CAP-002 porque el mapa y los colores se actualizan sin recargar.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-012 | El repartidor ve solo los pedidos asignados, con ubicación, y la abre en una app de mapas. | Descubrimiento |
| RN-CAP-024 | Un delivery listo lo toma un solo repartidor; el otro ve un aviso. | Reunión |
| RN-CAP-033 | El repartidor no toma pedidos. | Acta 02 |
| RN-CAP-088 | El efectivo del repartidor no cuenta en caja hasta liquidarlo. | Caja, repartos |
| DT-10 | No hay aplicación móvil propia: el repartidor usa la misma web. | decisiones.md |
| DT-59 | Mapa a pantalla completa con nombres, código, colores por tiempo, zonas y orden sugerido; cuatro estados con un botón. | Acta 03 · decisiones.md |
| DT-60 | Mensajes automáticos al cliente al salir y al llegar; se cortan si responde; textos editables. | Acta 03 · decisiones.md |

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
| RQ-DEL-02-10 | HU-CAP-196 | ADR del mapa interno (Leaflet + OpenStreetMap) | R-01 |
| RQ-DEL-02-11 | HU-CAP-196 | — | R-01 |
| RQ-DEL-02-12 | HU-CAP-196 | FT-CFG-02 · D-29 | R-01 |
| RQ-DEL-02-13 | HU-CAP-196 | FT-DEL-01 | R-01 |
| RQ-DEL-02-14 | HU-CAP-196 | — | R-01 |
| RQ-DEL-02-15 | HU-CAP-196 | — | R-01 |
| RQ-DEL-02-16 | HU-CAP-197 | DEP-12 · D-08 | R-04 |
| RQ-DEL-02-17 | HU-CAP-197 | D-27 · FT-DEL-03 | R-04 |
| RQ-DEL-02-18 | HU-CAP-197 | DEP-12 | R-01 |
| RQ-DEL-02-19 | HU-CAP-197 | FT-CFG-02 · plantilla de Kevin (acta 03) | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-071 Ver y tomar un delivery listo
- HU-CAP-072 Navegar y contactar al cliente
- HU-CAP-073 Marcar en camino, he llegado y entregado con el cobro
- HU-CAP-196 Ver los pedidos en el mapa con nombre, color de espera y orden sugerido
- HU-CAP-197 Recibir por WhatsApp el aviso de que mi pedido sale y de que el repartidor llegó

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, ADR-010.

**Fuera de alcance**

- Entregas fallidas: FT-DEL-03.
- Liquidación en caja: FT-CIE-01.
- Ubicación del repartidor en tiempo real (descartada por el costo de la API, DT-59).
- Asignación automática de repartidores (no pedida).
- Ruta calculada por calles con una API de pago: el orden sugerido usa distancia en línea recta.

**Preguntas abiertas**

1. **Colores del mapa** — D-29. Propuesta: verde hasta 35 minutos, naranja de 35 a 50, rojo desde 50.
2. **Momento de los mensajes 2 y 3 y sus textos** — D-27. Propuesta: desde «He llegado», cada 2 minutos; Kevin envía su plantilla.
3. **¿Un repartidor puede tomar varios pedidos a la vez?** Propuesta: sí, hasta 3, configurable.
4. **¿Caja puede asignar un pedido a un repartidor?** Propuesta: sí, como respaldo, con aviso al repartidor.

---

Generado por IA: BRD (NEC-CAP-009, 015, 079; RN-CAP-012, 013, 024, 033, 088), DT-10, DT-59, DT-60, D-27, D-29, acta 03 y el mockup de Repartos — Revisado por: *(pendiente)*
