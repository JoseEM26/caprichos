---
id: EP-CAP-004
tipo: spec
titulo: "EP-CAP-004 Confirmación y cobro en caja"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-19
relacionados: [CAP-PENDIENTE, BRD-CAP-001, RMP-CAP-001, NEC-CAP-061, NEC-CAP-063, NEC-CAP-064, NEC-CAP-065, NEC-CAP-080, RN-CAP-074]
tags: [epica, plt-02, g1, caja, debe-tener]
---

# EP-CAP-004 — Confirmación y cobro en caja

| Campo | Valor |
| --- | --- |
| ID ÉPICA | EP-CAP-004 |
| NOMBRE | Confirmación y cobro en caja |
| PRODUCTO | Plataforma digital de Caprichos |
| PRODUCT OWNER | José Ángel Espinoza (DT-48) |
| SPONSOR | Kevin Rosales (dueño, ACT-CAP-001) |
| PRIORIDAD | Debe tener |
| HORIZONTE | Ahora |
| ESTADO | Borrador (`draft`) |
| FECHA / VERSIÓN | 19/10/2026 · 1.0 |

## 1 CONTEXTO

**Problema u oportunidad**

Los pedidos de fuera del local llegan por distintos canales y hoy nadie verifica de forma ordenada que el pago sea real antes de cocinar. En caja se cobra con varios medios, a veces combinados, y se anulan pedidos sin motivo registrado.

**Usuarios / segmentos**

- ACT-CAP-002: cajero/a, que confirma y cobra
- ACT-CAP-004: mozos, que también confirman pedidos de fuera
- Call center (aún sin código ACT en el BRD): call center, que toma pedidos por teléfono
- ACT-CAP-006: clientes que esperan la confirmación

**Evidencia**

- NEC-CAP-061 y RN-CAP-074: dos caminos para un pedido.
- NEC-CAP-063: medios de pago, pago mixto y vuelto.
- NEC-CAP-064, NEC-CAP-065 y NEC-CAP-080: clientes, promociones, cupones y pedido telefónico.
- Mockup: Pedidos y caja, Nuevo pedido (`Admin.dc.html`).

**Alineamiento estratégico**

- OBJ-CAP-001 Entregar más rápido: confirmar sin demora.
- NEC-CAP-001 El pedido pasa por caja y llega a cocina.

## 2 OBJETIVOS

**Objetivo de negocio**

Que ningún pedido de fuera llegue a cocina sin un pago o una confirmación verificada por una persona, y que cada cobro quede registrado con su medio.

**Objetivo del usuario**

Que el cajero confirme y cobre en pocos toques, con el resumen del pedido y el mensaje de WhatsApp listos.

| Métrica (KPI) | Línea base | Meta | Fuente de datos | Frecuencia |
| --- | --- | --- | --- | --- |
| Minutos desde que llega un pedido «por confirmar» hasta que se confirma | Por medir | 5 minutos o menos (propuesta, D-05) | Registro de tiempos del sistema | Diaria |
| Cobros con medio de pago registrado | Por medir | 100 % (propuesta) | Registro de cobros | Diaria |
| Anulaciones sin motivo | Por medir | Cero (RN-CAP-089) | Historial de pedidos | Semanal |

Las metas marcadas «(propuesta)» son de la IA y las fija el dueño; las líneas base «por medir» se toman en las dos primeras semanas de uso.

## 3 ALCANCE

**En alcance (IN)**

- Cola de pedidos «por confirmar» con aviso, resumen y mensaje de WhatsApp para contactar al cliente (RN-CAP-081).
- Confirmar el pago con comprobante adjunto para Yape, Plin o transferencia (RN-CAP-075) y enviar a cocina.
- Cobro con efectivo (y vuelto), Yape, Plin, transferencia, tarjeta y pago mixto (RN-CAP-082).
- Nuevo pedido desde caja y call center: cliente, dirección recordada, promociones vigentes y cupón (NEC-CAP-065, NEC-CAP-080).
- Crear y buscar clientes por DNI completo (NEC-CAP-064).
- El cajero anula con motivo y el PIN de 6 dígitos de la supervisora, escrito en persona en la caja (RN-CAP-089, RN-CAP-096, DT-61).

**Fuera de alcance (OUT)**

- Apertura y cierre de caja: EP-CAP-005.
- Emisión de boleta o factura electrónica (DT-11).
- El pedido del mozo en mesa, que no pasa por confirmación: EP-CAP-007.

**Features que componen la épica**

| ID Feature | Nombre | Prioridad | Estado |
| --- | --- | --- | --- |
| FT-CAJ-01 | Cola de pedidos por confirmar | Debe tener | Redactada en draft: [`FT-CAJ-01-cola-de-pedidos-por-confirmar.md`](../features/FT-CAJ-01-cola-de-pedidos-por-confirmar.md) |
| FT-CAJ-02 | Cobro con medios de pago y pago mixto | Debe tener | Redactada en draft: [`FT-CAJ-02-cobro-con-medios-de-pago-y-pago-mixto.md`](../features/FT-CAJ-02-cobro-con-medios-de-pago-y-pago-mixto.md) |
| FT-CAJ-03 | Nuevo pedido desde caja y call center | Debe tener | Redactada en draft: [`FT-CAJ-03-nuevo-pedido-desde-caja-y-call-center.md`](../features/FT-CAJ-03-nuevo-pedido-desde-caja-y-call-center.md) |

**Supuestos**

- Hay una computadora en caja donde se confirma y cobra.
- El comprobante de pago lo envía el cliente por WhatsApp.

**Restricciones**

- El sistema no verifica que un comprobante sea verdadero: lo decide una persona (RN-CAP-101).
- Toda anulación lleva motivo y el PIN de la supervisora; un cobrado, solo con el cobro en la caja abierta (RN-CAP-096, DT-61).

**Dependencias y riesgos**

- DEP-12 WhatsApp para contactar al cliente (D-08).
- D-05 Plazo para atender un pedido por confirmar.
- R-04 Errores del canal de WhatsApp.

**Criterios de éxito / salida**

- Un pedido de la carta con Yape se confirma con su comprobante y aparece en cocina.
- Un pago mixto que no suma el total no se puede registrar.
- Una anulación sin motivo no se puede guardar.

## 4 APROBACIONES

| Rol | Nombre | Fecha | Firma |
| --- | --- | --- | --- |
| Product Owner |  |  |  |
| Sponsor |  |  |  |
| Líder técnico |  |  |  |

---
Generado por IA: BRD §4 y §5 (NEC-CAP-061, NEC-CAP-063 a NEC-CAP-065, NEC-CAP-080, RN-CAP-074, RN-CAP-075, RN-CAP-081, RN-CAP-082, RN-CAP-089, RN-CAP-096) y el mockup de Pedidos y caja — Revisado por: *(pendiente)*
