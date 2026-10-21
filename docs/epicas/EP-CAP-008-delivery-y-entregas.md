---
id: EP-CAP-008
tipo: spec
titulo: "EP-CAP-008 Delivery y entregas"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-19
relacionados: [CAP-PENDIENTE, BRD-CAP-001, RMP-CAP-001, NEC-CAP-009, NEC-CAP-015, NEC-CAP-059, NEC-CAP-076, NEC-CAP-079, NEC-CAP-096, NEC-CAP-100, NEC-CAP-104]
tags: [epica, plt-02, g1, delivery, debe-tener]
---

# EP-CAP-008 — Delivery y entregas

| Campo | Valor |
| --- | --- |
| ID ÉPICA | EP-CAP-008 |
| NOMBRE | Delivery y entregas |
| PRODUCTO | Plataforma digital de Caprichos |
| PRODUCT OWNER | José Ángel Espinoza (DT-48) |
| SPONSOR | Kevin Rosales (dueño, ACT-CAP-001) |
| PRIORIDAD | Debe tener |
| HORIZONTE | Ahora |
| ESTADO | Borrador (`draft`) |
| FECHA / VERSIÓN | 19/10/2026 · 1.0 |

## 1 CONTEXTO

**Problema u oportunidad**

El repartidor recibe la dirección escrita y la copia a mano en su aplicación de mapas. El costo de envío se calcula a ojo, dos repartidores pueden salir con el mismo pedido y, si el cliente no contesta, no hay un procedimiento: el pedido se pierde o se cobra mal.

**Usuarios / segmentos**

- ACT-CAP-009: repartidores (motorizados), que usan la misma web
- ACT-CAP-002: cajero/a, que ubica el pedido y liquida el efectivo
- Call center (aún sin código ACT en el BRD): call center, que marca la ubicación del pedido telefónico
- ACT-CAP-001: el dueño, que define zonas y tarifas

**Evidencia**

- NEC-CAP-009 y NEC-CAP-079: pedido con ubicación, llamada, navegación y vuelto.
- NEC-CAP-015 y RN-CAP-024: el primero que lo toma se lo queda.
- NEC-CAP-076, NEC-CAP-096 y NEC-CAP-100: zonas, tarifas y envío gratis.
- NEC-CAP-104 y `analisis/flujo-entregas-fallidas.md`.

**Alineamiento estratégico**

- OBJ-CAP-001 Entregar más rápido.
- NEC-CAP-009 El repartidor abre la ubicación en su aplicación de mapas.

## 2 OBJETIVOS

**Objetivo de negocio**

Cobrar el envío correcto según la zona, sin pedidos tomados dos veces y con un procedimiento claro para las entregas fallidas.

**Objetivo del usuario**

Que el repartidor vea su pedido, navegue con un toque, sepa el vuelto y reporte un problema sin llamar a caja.

| Métrica (KPI) | Línea base | Meta | Fuente de datos | Frecuencia |
| --- | --- | --- | --- | --- |
| Pedidos de delivery con costo de envío corregido a mano | Por medir | Menos del 5 % (propuesta) | Registro de pedidos | Semanal |
| Pedidos tomados por dos repartidores | Por medir | Cero (RN-CAP-024) | Registro de repartos | Diaria |
| Entregas fallidas sin resolución registrada | Por medir | Cero (propuesta) | Registro de entregas fallidas | Semanal |

Las metas marcadas «(propuesta)» son de la IA y las fija el dueño; las líneas base «por medir» se toman en las dos primeras semanas de uso.

## 3 ALCANCE

**En alcance (IN)**

- Zonas de reparto editables como lista de puntos, con tarifa, encendido y validación (NEC-CAP-100).
- Zona y costo calculados solos por el punto del mapa o la ubicación del cliente (RN-CAP-103).
- Envío gratis por monto y tarifa especial por cliente (NEC-CAP-096, RN-CAP-109).
- Marcar el lugar de entrega en un mapa al tomar el pedido (NEC-CAP-059).
- El repartidor toma un pedido listo; si dos lo intentan, solo el primero (RN-CAP-024).
- Llamar, escribir, navegar por coordenadas, ver el vuelto y marcar entregado (NEC-CAP-079).
- Entrega fallida: reporte, aviso a caja, coordinación con el cliente, reprogramación o devolución (NEC-CAP-104, RN-CAP-125, RN-CAP-126).

**Fuera de alcance (OUT)**

- Seguimiento del repartidor en tiempo real sobre un mapa (DT-10).
- Aplicación móvil propia (DT-10).
- Liquidación del efectivo del repartidor en el cierre: EP-CAP-005.
- Mapa de calor e informes de delivery: EP-CAP-018.

**Features que componen la épica**

| ID Feature | Nombre | Prioridad | Estado |
| --- | --- | --- | --- |
| FT-DEL-01 | Zonas de reparto y tarifas | Debe tener | Redactada en draft: [`FT-DEL-01-zonas-de-reparto-y-tarifas.md`](../features/FT-DEL-01-zonas-de-reparto-y-tarifas.md) |
| FT-DEL-02 | Reparto: tomar, navegar y entregar | Debe tener | Redactada en draft: [`FT-DEL-02-reparto-tomar-navegar-y-entregar.md`](../features/FT-DEL-02-reparto-tomar-navegar-y-entregar.md) |
| FT-DEL-03 | Entregas fallidas | Debe tener | Redactada en draft: [`FT-DEL-03-entregas-fallidas.md`](../features/FT-DEL-03-entregas-fallidas.md) |

**Supuestos**

- Los repartidores tienen celular con datos y aplicación de mapas.
- Las zonas Z2 a Z7 y sus tarifas siguen vigentes (D-03).

**Restricciones**

- El cliente nunca elige ni ve una «zona»: la calcula el sistema (RN-CAP-103).
- Un delivery sin ubicación ni zona no se confirma (RN-CAP-104).

**Dependencias y riesgos**

- DEP-07 Zonas, tarifas y repartidores (D-03).
- R-03 Reglas de delivery desactualizadas.

**Criterios de éxito / salida**

- Un repartidor ve su pedido y abre la ubicación en una aplicación de mapas con un toque.
- Dos repartidores que toman el mismo pedido a la vez: solo uno lo recibe.
- Una entrega fallida queda en coordinación y ningún repartidor la puede tomar.

## 4 APROBACIONES

| Rol | Nombre | Fecha | Firma |
| --- | --- | --- | --- |
| Product Owner |  |  |  |
| Sponsor |  |  |  |
| Líder técnico |  |  |  |

---
Generado por IA: BRD §4 y §5 (NEC-CAP-009, NEC-CAP-015, NEC-CAP-059, NEC-CAP-076, NEC-CAP-079, NEC-CAP-096, NEC-CAP-100, NEC-CAP-104, RN-CAP-024, RN-CAP-103, RN-CAP-104, RN-CAP-109, RN-CAP-125, RN-CAP-126) y `analisis/flujo-entregas-fallidas.md` — Revisado por: *(pendiente)*
