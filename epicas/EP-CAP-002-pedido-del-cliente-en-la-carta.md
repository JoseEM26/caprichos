---
id: EP-CAP-002
tipo: spec
titulo: "EP-CAP-002 Pedido del cliente en la carta"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-19
relacionados: [CAP-PENDIENTE, BRD-CAP-001, RMP-CAP-001, NEC-CAP-001, NEC-CAP-017, NEC-CAP-018, NEC-CAP-019, NEC-CAP-049, NEC-CAP-086, NEC-CAP-092]
tags: [epica, plt-02, g1, pedido, debe-tener]
---

# EP-CAP-002 — Pedido del cliente en la carta

| Campo | Valor |
| --- | --- |
| ID ÉPICA | EP-CAP-002 |
| NOMBRE | Pedido del cliente en la carta |
| PRODUCTO | Plataforma digital de Caprichos |
| PRODUCT OWNER | José Ángel Espinoza (DT-48) |
| SPONSOR | Kevin Rosales (dueño, ACT-CAP-001) |
| PRIORIDAD | Debe tener |
| HORIZONTE | Ahora |
| ESTADO | Borrador (`draft`) |
| FECHA / VERSIÓN | 19/10/2026 · 1.0 |

## 1 CONTEXTO

**Problema u oportunidad**

Hoy un pedido hecho en la web o en WhatsApp no pasa de forma ordenada por caja ni llega a cocina: se reescribe a mano. Además, pedir es lento: la carta anterior pide datos al inicio, fecha, correo o cuenta, y la dirección con código Plus de Google Maps, que los clientes no entienden.

**Usuarios / segmentos**

- ACT-CAP-006: clientes que piden delivery o para recoger
- ACT-CAP-002: cajero/a, que recibe el pedido como «por confirmar»

**Evidencia**

- BRD §1 y NEC-CAP-001, NEC-CAP-017, NEC-CAP-018.
- Acta 02: datos al final, sin fecha ni cuenta, Yape y Plin visibles, ubicación actual sin código Plus (NEC-CAP-019, NEC-CAP-049).
- NEC-CAP-092: la ubicación nunca es obligatoria ni bloquea.
- Mockup: carrito y resumen de la carta (`Main.dc.html`).

**Alineamiento estratégico**

- OBJ-CAP-001 Entregar más rápido: el pedido llega ordenado a caja.
- NEC-CAP-001 Que el pedido no se reescriba a mano.

## 2 OBJETIVOS

**Objetivo de negocio**

Recibir pedidos de la carta completos y ordenados en la cola de caja, sin reescribirlos.

**Objetivo del usuario**

Pedir en pocos pasos: elegir productos, decir cómo lo quiere y dónde, sin crear cuenta ni dar datos de más.

| Métrica (KPI) | Línea base | Meta | Fuente de datos | Frecuencia |
| --- | --- | --- | --- | --- |
| Pedidos de la carta que hubo que reescribir a mano | Por medir | Cero (propuesta) | Registro de pedidos | Semanal |
| Carritos iniciados que terminan en pedido | Por medir | 60 % (propuesta) | Registro de la carta | Semanal |
| Pedidos de delivery con ubicación del cliente | Por medir | 80 % (propuesta) | Registro de pedidos | Semanal |

Las metas marcadas «(propuesta)» son de la IA y las fija el dueño; las líneas base «por medir» se toman en las dos primeras semanas de uso.

## 3 ALCANCE

**En alcance (IN)**

- Carrito con varios productos, notas para cocina y resumen con el total (RN-CAP-016).
- Modalidad delivery o para recoger, elegida en el carrito (A2).
- Datos mínimos al final: nombre y teléfono; sin fecha, sin correo y sin cuenta obligatoria (NEC-CAP-017).
- Ubicación actual con mapa y enlace, o dirección escrita si el cliente no la da (NEC-CAP-049, NEC-CAP-092).
- Costo de envío por zona calculado solo, envío gratis y pedido mínimo (RN-CAP-103).
- Medios de pago visibles: Yape, Plin, efectivo con vuelto, tarjeta y transferencia, sin cobrar en la web (DT-17).
- El pedido llega a caja como «por confirmar» y el chatbot escribe al cliente (NEC-CAP-086, RN-CAP-043).

**Fuera de alcance (OUT)**

- La confirmación y el cobro en caja: EP-CAP-004.
- El chatbot completo: EP-CAP-014.
- Pago en línea con pasarela (DT-11).
- Pedidos programados para otro día (A1).

**Features que componen la épica**

| ID Feature | Nombre | Prioridad | Estado |
| --- | --- | --- | --- |
| FT-PED-01 | Carrito, modalidad y datos mínimos | Debe tener | Redactada en draft: [`FT-PED-01-carrito-modalidad-y-datos-minimos.md`](../features/FT-PED-01-carrito-modalidad-y-datos-minimos.md) |
| FT-PED-02 | Ubicación y costo de envío en la carta | Debe tener | Redactada en draft: [`FT-PED-02-ubicacion-y-costo-de-envio-en-la-carta.md`](../features/FT-PED-02-ubicacion-y-costo-de-envio-en-la-carta.md) |
| FT-PED-03 | Envío del pedido a caja y aviso al cliente | Debe tener | Redactada en draft: [`FT-PED-03-envio-del-pedido-a-caja-y-aviso-al-cliente.md`](../features/FT-PED-03-envio-del-pedido-a-caja-y-aviso-al-cliente.md) |

**Supuestos**

- La mayoría de clientes pide desde el celular y acepta compartir su ubicación.
- El cajero sigue aceptando todos los pedidos de fuera del local.

**Restricciones**

- La carta no cobra: informa cómo pagar (DT-17).
- Un delivery sin ubicación ni zona no se confirma (RN-CAP-104).

**Dependencias y riesgos**

- DEP-07 Zonas de reparto y tarifas (D-03).
- DEP-12 WhatsApp para el aviso al cliente (D-08).
- R-04 Errores del canal de WhatsApp.

**Criterios de éxito / salida**

- Un pedido de prueba hecho en la carta llega a la cola de caja como «por confirmar» con todos sus datos.
- Un cliente que niega el permiso de ubicación termina su pedido escribiendo la dirección.
- El envío se calcula solo según la zona y respeta el envío gratis.

## 4 APROBACIONES

| Rol | Nombre | Fecha | Firma |
| --- | --- | --- | --- |
| Product Owner |  |  |  |
| Sponsor |  |  |  |
| Líder técnico |  |  |  |

---
Generado por IA: BRD §1, §4 y §6 (NEC-CAP-001, NEC-CAP-017 a NEC-CAP-019, NEC-CAP-049, NEC-CAP-086, NEC-CAP-092), acta 02 y el mockup de la carta — Revisado por: *(pendiente)*
