---
id: FLU-CAP-005
tipo: analisis
titulo: Entregas fallidas: el repartidor no encuentra la dirección o el cliente no contesta
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza (desarrollo); validación pendiente de Kevin Rosales"
aprobadores: []
fecha: 2026-10-19
relacionados: [BRD-CAP-001, REG-CAP-001, FLU-CAP-002, FLU-CAP-004]
tags: [delivery, repartidor, entrega-fallida, whatsapp, mockup]
---

# Entregas fallidas

> Decisión del 19/10/2026. Por validar con Kevin Rosales. Probado solo con pruebas automáticas del mockup, no en un navegador real. **Todo lo marcado como configurable se cambia en Configuración del local > Entregas fallidas.**

## 1. Idea central
Una entrega fallida se resuelve **hablando con el cliente por WhatsApp**. El sistema avisa, deja corregir la dirección, lleva la cuenta de los intentos y, si no se logra, devuelve el pedido a la tienda para **decidir con calma** qué se hace.

## 2. Flujo

| Paso | Quién | Qué pasa |
|---|---|---|
| 1 | Repartidor | En la dirección toca **«Cliente no contesta»** o **«No encuentro la dirección»**. El sistema cuenta el intento («Intento 1 de 2») y dice cuánto esperar (**10 minutos**, configurable). |
| 2 | Sistema | Avisa a **caja, call center y administrador** («Entrega con problema») con el cliente, el teléfono, la dirección y un botón para escribirle por WhatsApp. El pedido **sigue con el repartidor**. |
| 3 | Repartidor, caja o call center | **Escriben la dirección corregida** (campo en la tarjeta del reparto). La dirección del pedido se actualiza y el repartidor la ve. Caja también puede usar **Ubicar en el mapa** para mover el punto. |
| 4a | Repartidor | Si se resuelve: **«Ya se resolvió: sigo con la entrega»**. El aviso se cierra; los intentos quedan contados. |
| 4b | Repartidor | Si no se resuelve y se pasó el tiempo: **«Devolver a la tienda»**. Cuando ya se llegó al máximo de intentos (**2**, configurable) el botón lo dice («ya fueron 2 intentos»). |
| 5 | Sistema | El pedido vuelve a la tienda **sin repartidor** y en **«coordinación con el cliente»**: ningún repartidor puede tomarlo todavía. Llega la notificación «Pedido devuelto a la tienda» a caja, call center y administrador. |
| 6 | Caja o call center | Hablan con el cliente por WhatsApp (botón con el mensaje ya escrito) para saber por qué no contestó, y **concluyen** (sección 3). Plazo para concluir: **120 minutos**, configurable. |

## 3. Cómo se cierra una entrega fallida

El panel «Entrega fallida» aparece en el detalle del pedido (Pedidos y caja). Primero se elige **qué se hace con lo preparado** (Desecho, Personal o Donación), porque un frappé ya hecho no se revende: queda frío o derretido. Luego, la conclusión:

| Conclusión | Qué hace el sistema |
|---|---|
| **Reprogramar la entrega** | El pedido vuelve a la lista de repartos, sin repartidor, con los intentos en cero. Si hay **recargo** configurado (s/ 0 por defecto) se suma al envío y al total. |
| **Devolver el dinero (anular)** | Abre la anulación con el motivo **«Cliente no recibió»** (reglas de siempre: administrador o PIN del administrador; si el cobro ya estaba en un cierre, queda como egreso en el turno abierto). Lo preparado se registra como merma. **Es la opción recomendada por defecto.** |
| **Cobrar igual** | Solo si ya estaba pagado. El pedido se cierra como no entregado pero cobrado y lo preparado se registra como merma. |

**Qué se recomienda** (devolver o cobrar igual) lo define el administrador: **Sí = recomendar devolver el dinero** (por defecto), **No = recomendar cobrar igual**. En todo caso la decisión final es de la persona, después de hablar con el cliente.

## 4. Merma por entrega fallida (importante)
Los insumos del frappé **ya se descontaron al aceptar el pedido** (según su receta). Por eso, cuando un pedido no se entrega, la merma se registra como **movimiento informativo** (tipo Merma, origen **Reparto**, destino «desecho / personal / donación (no se entregó)») **sin descontar el stock otra vez**. Sirve para saber cuánto cuesta lo que no se pudo entregar.

## 5. Lo configurable (Configuración del local > Entregas fallidas)

| Campo | Valor de ejemplo |
|---|---|
| Tiempo que espera el repartidor en la dirección | 10 minutos |
| Intentos de entrega antes de devolver el pedido a la tienda | 2 |
| Plazo para coordinar con el cliente por WhatsApp | 120 minutos |
| Recargo por reprogramar una entrega | s/ 0 |
| Si el cliente no recibe: recomendar devolver el dinero (Sí) o cobrar igual (No) | Sí (devolver) |

## 6. No verificado y pendiente
- El mockup **no cuenta** el tiempo de espera ni el plazo de 120 minutos: son datos que se muestran, sin reloj que los haga cumplir.
- El recargo se suma al total pero no se cobra aparte (el cobro de ese extra queda a cargo de caja).
- Con «Devolver el dinero» no hay aún un paso que pregunte el medio de devolución (Yape, efectivo): se maneja por WhatsApp.
- Decisiones de Kevin: cuánto esperar, cuántos intentos, si hay recargo y qué se recomienda cuando el cliente no recibe.
