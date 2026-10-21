---
id: ANA-CAP-032
tipo: analisis
titulo: "Flujo de pedidos: en el local y fuera del local"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-19
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, analisis]
---

# Flujo de pedidos: en el local y fuera del local

> Decisión de la reunión del 18/10/2026 con el cliente. Por validar con Kevin Rosales. Lo vivo en el mockup (v96): Pedidos y caja, carta virtual y chatbot.

> **Actualización del 19/10/2026 (mockup v134):** el paso 3 de «Pedido fuera del local» ahora lo hace primero el **bot**: escribe al cliente con el resumen, pregunta cómo paga, manda los datos de pago y espera la captura; la persona solo entra cuando llega el comprobante y **aprueba o rechaza**. También cambian la ubicación (nunca obligatoria; un asesor ubica en el mapa) y la atención (un solo dueño por chat). Detalle completo en `flujo-pago-whatsapp-y-ubicacion.md`. Lo de abajo sigue valiendo como el flujo manual de respaldo.

## 1. Dos caminos

| | Pedido en el local | Pedido fuera del local |
|---|---|---|
| Quién lo toma | El mozo, con su tablet | El cliente (carta virtual o chatbot) o una persona del equipo por teléfono |
| Modalidad | En el local (mesa) | Delivery o para recoger |
| ¿Pasa por caja? | **No**, no hay validación | No, pero **una persona debe confirmarlo** |
| Estado al crearse | En cocina | Por confirmar |
| ¿Cuándo va a las pantallas? | De inmediato | Cuando se confirma el pago |
| Pago | Se cobra al final, en caja | Se verifica antes de enviarlo a cocina |

## 2. Pedido en el local (mozo)
1. El mozo elige En el local, la mesa y los productos.
2. Confirma con Sí. El pedido va **directo a las pantallas de cocina**; se descuentan los productos y se imprimen la comanda y las etiquetas.
3. Al terminar, caja cobra la mesa.

## 3. Pedido fuera del local
1. El cliente hace el pedido en la carta (o por el chatbot). Elige solo su **forma de pago preferida**; **no paga ni envía capturas**.
2. El pedido llega a Pedidos y caja como **Por confirmar** (aviso en notificaciones a caja, mozo y call center).
3. Una persona del equipo abre **Confirmar pedido y pago**:
   - **Paso 1:** abre WhatsApp con el cliente. El mensaje sale prellenado con el **resumen del pedido** (código, productos con sus opciones, nota, entrega con dirección y referencia si es delivery, total y pago preferido) y se ve antes de enviarlo, confirma el pedido y la dirección, y marca *Ya hablé con el cliente*.
   - **Paso 2:** elige el medio de pago: efectivo, Yape, Plin, transferencia o tarjeta.
   - **Paso 3:** con Yape, Plin o transferencia **sube el comprobante** (obligatorio) y puede anotar el código de operación. Con efectivo (con cuánto paga, para el vuelto) o tarjeta, que se cobran al entregar o recoger, no hace falta comprobante.
4. Confirma con Sí. El pedido pasa a cocina, queda como cobrado con **quién confirmó y a qué hora**, y el comprobante queda en la pestaña Cobro del pedido.
5. Si no se puede confirmar, la persona lo **rechaza**.

Quién puede confirmar: caja, mozo, call center y administrador.

## 4. Qué cambió respecto a lo anterior
- Antes, todo pedido pasaba por caja, que lo "aceptaba". Ahora el mozo en el local no pasa por caja.
- Antes, el cliente pagaba por Yape o Plin y enviaba la captura. Ahora no: el cliente espera el mensaje del asesor.
- Un cliente puede enviar cualquier imagen como captura; ahora el comprobante lo sube quien verifica.

## 5. Por confirmar con Kevin
1. ¿Los pedidos de llevar o delivery que toma una persona por teléfono también deben confirmarse así? (en el mockup, sí).
2. ¿Quién da el check del pago: solo caja o también el mozo? (en el mockup, ambos).
3. ¿Cuánto tiempo puede esperar un pedido por confirmar antes de avisar al administrador?
4. ¿Qué pasa si el cliente no contesta? (propuesta: rechazar o dejar una nota de contacto).
5. ¿El cliente puede pagar por adelantado el mismo día de la entrega o siempre al recoger?
