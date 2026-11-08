---
modulo: mirest
titulo: Configuración: Medios de pago
ruta: /admin/mirest
seccion: pagos
activa_con: [tab=pagos]
permiso: local/ver
roles: [ADMIN]
relacionados: [caja, comprobantes, mensajes]
sugerencias:
  - ¿Cómo apago o enciendo un medio de pago como la tarjeta o el efectivo?
  - ¿Dónde pongo el número de Yape y Plin?
  - ¿Dónde cambio la cuenta bancaria para transferencias?
  - ¿Por qué la carta muestra mi teléfono como número de Yape?
---
# Configuración: Medios de pago

## Para que sirve
Decide qué medios de pago ofrece Caprichos (efectivo, tarjeta con POS al entregar, Yape, Plin y transferencia bancaria) y a qué número o cuenta paga el cliente. La carta virtual, el chatbot de WhatsApp y las pantallas de cobro de [[caja]] solo ofrecen los medios que estén activos. Los vouchers de Yape y Plin los revisa Caja; la lectura automática con IA se configura en [Lectura de vouchers con IA](/admin/mirest?tab=vouchers).

## Como se hace: encender o apagar un medio de pago
1. Entra a Configuración del local y abre la pestaña "Pagos" ([Pagos](/admin/mirest?tab=pagos)).
2. Marca o desmarca los interruptores "Aceptar efectivo", "Aceptar tarjeta (POS al entregar)", "Aceptar Yape", "Aceptar Plin" y "Aceptar transferencia bancaria".
3. Pulsa "Guardar medios de pago" y confirma con "Sí, guardar" en "¿Guardar medios de pago?". Los pedidos ya creados no cambian.

## Como se hace: poner el número de Yape y Plin
1. En la pestaña "Pagos", con Yape o Plin activo, escribe el número de celular al que el cliente debe enviar el pago.
2. Sale en el paso de pago de la carta y en las indicaciones del bot, con el nombre del local como titular. Si lo dejas vacío, se muestra el teléfono del local.
3. Pulsa "Guardar medios de pago" y confirma con "Sí, guardar".

## Como se hace: poner la cuenta para transferencias
1. En "Aceptar transferencia bancaria", escribe el Banco (si queda vacío la carta muestra BCP) y el Número de cuenta o CCI.
2. El cliente lo ve en el paso de pago de la carta, con botón para copiar.
3. Pulsa "Guardar medios de pago" y confirma con "Sí, guardar".

## Ajustes: Medios de pago
- **Aceptar efectivo** (local_pagos.efectivo.activo): Cobro en soles en la entrega o en caja. La carta, el bot de WhatsApp y las pantallas de cobro solo ofrecen los medios activos. valor por defecto Activo. Riesgo alto: toca dinero o deja de atender clientes. [Aceptar efectivo](/admin/mirest?tab=pagos&campo=pagos-pg-efe)
- **Aceptar tarjeta (POS al entregar)** (local_pagos.tarjeta.activo): El repartidor o el cajero lleva el POS para cobrar con tarjeta. La carta, el bot de WhatsApp y las pantallas de cobro solo ofrecen los medios activos. valor por defecto Activo. Riesgo alto: toca dinero o deja de atender clientes. [Aceptar tarjeta (POS al entregar)](/admin/mirest?tab=pagos&campo=pagos-pg-tarj)
- **Aceptar Yape** (local_pagos.yape.activo): Billetera digital: el cliente paga a tu número y sube la captura. La carta, el bot de WhatsApp y las pantallas de cobro solo ofrecen los medios activos. valor por defecto Activo. Riesgo alto: toca dinero o deja de atender clientes. [Aceptar Yape](/admin/mirest?tab=pagos&campo=pagos-pg-yape)
- **Número de celular para Yape** (local_pagos.yape.numero): Número al que el cliente envía su pago por Yape. Sale en el paso de pago de la carta y en las indicaciones del bot, con el nombre del local como titular. Si lo dejas vacío se muestra el teléfono del local. Ejemplo: 977503006. Riesgo alto: toca dinero o deja de atender clientes. [Número de celular para Yape](/admin/mirest?tab=pagos&campo=pagos-yape)
- **Aceptar Plin** (local_pagos.plin.activo): Billetera digital de BBVA, Interbank o Scotiabank. La carta, el bot de WhatsApp y las pantallas de cobro solo ofrecen los medios activos. valor por defecto Activo. Riesgo alto: toca dinero o deja de atender clientes. [Aceptar Plin](/admin/mirest?tab=pagos&campo=pagos-pg-plin)
- **Número de celular para Plin** (local_pagos.plin.numero): Número al que el cliente envía su pago por Plin. Sale en el paso de pago de la carta y en las indicaciones del bot, con el nombre del local como titular. Si lo dejas vacío se muestra el teléfono del local. Ejemplo: 977503006. Riesgo alto: toca dinero o deja de atender clientes. [Número de celular para Plin](/admin/mirest?tab=pagos&campo=pagos-plin)
- **Aceptar transferencia bancaria** (local_pagos.transferencia.activo): Pago por depósito o transferencia a la cuenta del negocio. La carta, el bot de WhatsApp y las pantallas de cobro solo ofrecen los medios activos. valor por defecto Activo. Riesgo alto: toca dinero o deja de atender clientes. [Aceptar transferencia bancaria](/admin/mirest?tab=pagos&campo=pagos-pg-transf)
- **Banco de la cuenta** (local_pagos.transferencia.banco): Nombre del banco que ve el cliente cuando elige transferencia. Si queda vacío la carta muestra BCP. Ejemplo: BCP. Riesgo alto: toca dinero o deja de atender clientes. [Banco de la cuenta](/admin/mirest?tab=pagos&campo=pagos-banco)
- **Número de cuenta o CCI** (local_pagos.transferencia.cuenta): Cuenta o CCI a la que el cliente transfiere. Sale en el paso de pago de la carta con botón para copiar, junto al banco. Ejemplo: 191-12345678-0-12. Riesgo alto: toca dinero o deja de atender clientes. [Número de cuenta o CCI](/admin/mirest?tab=pagos&campo=pagos-cuenta)
- **Guardar medios de pago**: Aplica los medios activos y sus datos de cobro a la carta, el bot y la caja. Pide confirmación Sí/No. Los pedidos ya creados no cambian. Riesgo alto: toca dinero o deja de atender clientes. [Guardar medios de pago](/admin/mirest?tab=pagos&campo=pagos-guardar)

## Errores y dudas comunes
- El cliente no ve un medio de pago: está apagado en esta pestaña.
- La carta muestra mi teléfono como Yape o Plin: el número de ese medio está vacío; escríbelo.
- Cambié el número y el voucher sale como dudoso: el número y el titular que compara la IA al leer vouchers se guardan aparte en [Lectura de vouchers con IA](/admin/mirest?tab=vouchers).

## Quien puede hacerlo
Solo el Administrador (ADMIN): entrar a Configuración del local exige el permiso local/ver y para cambiar datos, local/editar o configuracion/editar, que solo tiene el rol ADMIN. El cambio queda en el historial de auditoría.
