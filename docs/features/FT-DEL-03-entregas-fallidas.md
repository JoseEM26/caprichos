---
id: FT-DEL-03
tipo: spec
titulo: "Entregas fallidas"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-20
relacionados: [EP-CAP-008, FT-DEL-02, FT-CAJ-01, FT-CAJ-02, FT-ALM-03, FT-INF-03, ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, ADR-010, NEC-CAP-104, RN-CAP-089, RN-CAP-125, RN-CAP-126]
tags: [delivery, plt-03, ep-cap-008, ft-del-03, debe-tener]
---

# FT-DEL-03 — Entregas fallidas

**PLT-03 · Feature · Catálogo de requerimientos** · Frente DELIVERY · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-DEL-03 | Entregas fallidas | EP-CAP-008 Delivery y entregas |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debe tener** (NEC-CAP-104) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H1 · piloto en el local · 28/12/2026 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** El repartidor reporta que **el cliente no contesta** o que **no encuentra la dirección**. Se avisa al momento a caja y al call center (RN-CAP-089), que pueden corregir la dirección y el punto. Se cuentan los intentos; tras el tiempo de espera y los intentos configurados, si no se resuelve, el pedido **vuelve a la tienda** y queda **en coordinación** con el cliente por WhatsApp: ningún repartidor puede tomarlo hasta que caja o el call center lo cierre (RN-CAP-125). El cierre puede ser **reprogramar** (sale otra vez, con recargo opcional), **devolver el dinero** (anular con «Cliente no recibió», con las reglas de siempre) o **cobrar igual**. Lo preparado y no entregado se registra como merma informativa, origen Reparto, sin volver a descontar stock (RN-CAP-126). Tiempos, intentos, recargo y recomendación son configurables. Detalle en `analisis/flujo-entregas-fallidas.md`.

**Beneficio esperado.** Que una entrega fallida no se quede en el aire: alguien la atiende, se decide qué hacer y queda registrada. Hipótesis medible: **100 % de entregas fallidas con cierre registrado** (reprogramada, devuelta o cobrada) y **0 pedidos devueltos tomados por otro repartidor antes de cerrar**.

**Usuarios / roles.** ACT-CAP-009 Repartidor (motorizado) (reporta el problema) · ACT-CAP-002 Cajero/a (coordina y cierra) · Call center (aún sin código ACT en el BRD) (coordina y cierra) · ACT-CAP-001 Kevin Rosales, dueño y administrador (configura tiempos y recargo).

**Pantallas de referencia.** Administrativo ▸ Repartos (reportar), Pedidos y caja ▸ «En coordinación», Configuración ▸ Entregas fallidas (`Admin.dc.html`); `analisis/flujo-entregas-fallidas.md` (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-DEL-03-01 | El repartidor reporta «Cliente no contesta» o «No encuentro la dirección». | Debe tener | NEC-CAP-104 · NEC-CAP-079 | Dado un pedido en camino, cuando el repartidor toca «No contesta», entonces el pedido queda con el incidente, la hora y el intento 1. | Propuesto |
| RQ-DEL-03-02 | Un reporte avisa al momento a caja y al call center. | Debe tener | RN-CAP-089 | Dado un reporte, cuando se registra, entonces caja y call center reciben una notificación con el pedido, el motivo y un botón para escribir al cliente. | Propuesto |
| RQ-DEL-03-03 | Caja o call center corrigen la dirección y el punto, y el repartidor ve el cambio. | Debe tener | NEC-CAP-104 | Dado un «No encuentro la dirección», cuando caja corrige el punto, entonces el repartidor ve la nueva ubicación y un aviso «Dirección corregida». | Propuesto |
| RQ-DEL-03-04 | Se cuentan los intentos y, al pasar el tiempo o los intentos configurados, se recomienda volver a la tienda. | Debe tener | NEC-CAP-104 | Dados 2 intentos y 10 minutos configurados, cuando se llega al segundo intento o a los 10 minutos, entonces el repartidor ve «Volver a la tienda» como recomendación. | Propuesto |
| RQ-DEL-03-05 | Un pedido devuelto queda en coordinación y ningún repartidor puede tomarlo. | Debe tener | RN-CAP-125 | Dado un pedido devuelto a la tienda, cuando un repartidor revisa los disponibles, entonces no lo ve; en caja figura «En coordinación». | Propuesto |
| RQ-DEL-03-06 | Caja o call center cierran la coordinación: reprogramar, devolver el dinero o cobrar igual. | Debe tener | NEC-CAP-104 · RN-CAP-125 | Dado un pedido en coordinación, cuando caja elige «Reprogramar», entonces vuelve a los disponibles; con «Devolver», se anula con motivo «Cliente no recibió» y las reglas de PIN; con «Cobrar igual», queda cerrado y cobrado. | Propuesto |
| RQ-DEL-03-07 | Reprogramar puede sumar un recargo configurable. | Podría tener | NEC-CAP-104 | Dado un recargo de S/ 3, cuando caja reprograma con recargo, entonces el total sube S/ 3 y el cliente lo ve en el mensaje. | Propuesto |
| RQ-DEL-03-08 | Lo preparado y no entregado se registra como merma informativa de origen Reparto, sin descontar stock otra vez. | Debería tener | RN-CAP-126 | Dado un pedido devuelto con un frappé, cuando caja registra su destino «desecho», entonces queda una merma informativa sin movimiento de stock. | Propuesto |
| RQ-DEL-03-09 | Tiempos, intentos, recargo y recomendación se configuran. | Debería tener | NEC-CAP-104 | Dada la configuración, cuando el administrador cambia los intentos de 2 a 3 con Sí/No, entonces la recomendación de volver sale al tercer intento. | Propuesto |
| RQ-DEL-03-10 | Al reportar un problema, cada llamada y mensaje de WhatsApp al cliente queda con su hora, y el repartidor puede agregar una foto de la puerta. | Debe tener | D-34 · Acta 03 | Dado un repartidor que tocó «Llamar» dos veces y «WhatsApp» una vez, cuando reporta «No contesta», entonces el pedido guarda los tres intentos con su hora y, si toma una foto, queda en la carpeta privada; caja la ve si el cliente reclama. | Propuesto |

Prioridad por NEC-CAP-104 (E1). Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-002 | Tiempo real | Un pedido que pasa a cocina aparece en todas sus pantallas sin recargar. | Retardo ≤ 3 s (p95) · medición: registro de eventos (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-009 | Auditoría | Toda acción que cambia datos guarda quién la hizo y cuándo. | 100 % de cambios con autor y fecha (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-010 | Concurrencia | Cuando dos personas actúan a la vez sobre lo mismo (mesa, reparto, cupón, chat), solo una gana y la otra ve un aviso. | 0 duplicados en prueba con dos usuarios a la vez (umbral propuesto) | Debe tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-002 aplica al aviso a caja; RNF-CAP-010 a que nadie tome el pedido en coordinación.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| RN-CAP-089 | Cliente que no contesta o dirección no encontrada avisa a caja y al call center. | Pedidos |
| RN-CAP-125 | Un pedido devuelto queda en coordinación y nadie lo toma hasta concluir; anular por «Cliente no recibió» sigue las reglas de siempre. | Delivery |
| RN-CAP-126 | Lo preparado y no entregado es merma informativa sin descontar stock otra vez. | Stock |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-DEL-03-01 | HU-CAP-074 | — | R-01 |
| RQ-DEL-03-02 | HU-CAP-074 | FT-INF-03 | R-01 |
| RQ-DEL-03-03 | HU-CAP-075 | FT-DEL-01 | R-01 |
| RQ-DEL-03-04 | HU-CAP-075 | D-05 | R-01 |
| RQ-DEL-03-05 | HU-CAP-076 | — | R-01 |
| RQ-DEL-03-06 | HU-CAP-076 | FT-CAJ-02 | R-01 |
| RQ-DEL-03-07 | HU-CAP-076 | — | R-01 |
| RQ-DEL-03-08 | HU-CAP-077 | FT-ALM-03 | R-01 |
| RQ-DEL-03-09 | HU-CAP-077 | FT-CFG-02 | R-01 |
| RQ-DEL-03-10 | HU-CAP-074 | ADR-005 | R-11 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-074 Reportar que el cliente no contesta o no encuentro la dirección
- HU-CAP-075 Corregir la dirección y seguir los intentos
- HU-CAP-076 Cerrar la coordinación de un pedido devuelto
- HU-CAP-077 Registrar la merma de lo no entregado y configurar entregas fallidas

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, ADR-010.

**Fuera de alcance**

- Avisos automáticos al salir y al llegar: FT-DEL-02 (DT-60). La coordinación después de una entrega fallida se hace a mano por WhatsApp en la primera versión.
- Merma de reparto en el stock: FT-ALM-03.

**Preguntas abiertas**

1. **Tiempos e intentos por defecto** — el acta 03 fija una espera máxima de 10 minutos desde «He llegado» (DT-60); propuesta: 2 intentos.
2. **¿Quién paga el recargo de reprogramación?** Pendiente de Kevin.
3. **Evidencia de la entrega fallida** — D-34 resuelta por José (21/10/2026): registro de llamadas y WhatsApp con su hora y foto opcional de la puerta, que **no se borra a los 30 días**; se conserva como el Historial de acciones (2 años en línea y luego archivo cifrado, DT-49). La Ley 29733 pide un plazo definido: confirmarlo en la política de privacidad (D-18).

---

Generado por IA: BRD (NEC-CAP-079, 104; RN-CAP-089, 125, 126), `analisis/flujo-entregas-fallidas.md` y el mockup — Revisado por: *(pendiente)*
