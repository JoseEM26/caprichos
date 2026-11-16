# Paridad Meta / Evolution: auditoría

Producción envía por EVOLUTION (WhatsApp no oficial por QR). Este informe lista lo que dependía de Meta, cómo se comporta con Evolution
y lo corregido en la rama `paridad-evolution`. Sin datos reales. Rutas relativas a `apps/api/src/modulos/`.

## Cómo sale un mensaje hoy

1. Los avisos automáticos se encolan en el outbox (`chatbot/servicios/outbox-whatsapp.service.ts`), salvo la factura (propio reintento) y lo que responde el bot en la conversación.
2. `OutboxWhatsappService.enviarFila` (l.289) consulta `PoliticaEvolutionService.evaluar` (`chatbot/evolution/politica-evolution.service.ts` l.43) y decide ENVIAR, DIFERIR (tope, pausa, desconexión: queda PENDIENTE con motivo) o DESCARTAR (queda DESCARTADO con motivo, visible en Salientes).
3. `WhatsAppEnrutadorAdaptador` (`chatbot/adaptadores/whatsapp-enrutador.adaptador.ts`) elige el proveedor al enviar. `WhatsAppEvolutionAdaptador` traduce: plantilla = texto del catálogo con variables (l.182), botones y listas = texto numerado «Responde 1, 2 o 3» (l.149), carrusel = lista numerada (l.172), documento por media propio `evo:` (l.193, l.215).
4. La respuesta numérica se mapea en el webhook (`chatbot/evolution/evolution-webhook.service.ts`, `menu-numerado.util.ts`) a la misma respuesta de botón o lista que habría mandado Meta; el menú vive 24 h en Redis o memoria (`menu-numerado.store.ts`).

## Tabla de paridad

Estado: OK = igual que Meta. Corregido = estaba roto o degradado y se arregló en esta rama. Falta = no existe con ningún proveedor.

| Funcionalidad | Dónde | Con Evolution | Estado |
|---|---|---|---|
| Pedido recibido (carta, caja, mozo, cargo libre, extra, programado) | `pedidos/pedidos.service.ts` l.1564 → `AvisosPedidoService.avisar('RECIBIDO')`; el pedido del bot/WhatsApp no lo manda (lo confirma el bot) | Salía si el número había escrito alguna vez o el celular tenía pedido en 24 h. Ahora solo con el cliente dentro de las 24 h; si no, DESCARTADO con motivo + botón en el pedido | Corregido |
| Pedido aceptado / pago confirmado | `chatbot/servicios/chatbot-planificador.service.ts` l.248 y l.402 → `avisar('ACEPTADO')` | Igual: ventana de 24 h o botón manual. Mismo texto (código, total, modalidad, tiempo) | Corregido |
| Pago recibido, validado, rechazado, voucher ilegible | `chatbot/servicios/whatsapp-webhook.service.ts` l.832 (origen VOUCHER), flujo `conversacion/flujos/pago` | Son respuesta a un mensaje del cliente: `ORIGENES_RESPUESTA` siempre sale. Botones = texto numerado con respuesta numérica | OK |
| Reprogramación (RETIRO, REENVIADO, REPROG_*) | `chatbot/servicios/reprogramacion.service.ts`, `avisos-pedido.service.ts` | Pregunta SÍ/NO sale numerada; ahora sujeta a la ventana de 24 h como todo aviso del pedido | Corregido |
| Delivery asignado | `ETAPAS_AVISO.ASIGNADO` (`avisos-pedido.service.ts` l.28) | Nadie lo dispara: el commit 61b0c86c lo retiró a propósito («ya no se avisa la asignación»). Es código muerto, igual con Meta | Falta (decisión previa) |
| Delivery salió, llegó, entregado | `repartos/repartos.service.ts` l.1437, l.1529, l.1668, l.2454; `pedidos-admin/pedidos-estado.service.ts` l.1479 | Ventana de 24 h; fuera de ella queda registrado y con botón manual | Corregido |
| Delivery insistencia, espera agotada, retiro | `chatbot-planificador.service.ts` l.260 a l.294 | Igual que el anterior | Corregido |
| Delivery cancelado, anulado, devuelto, reasignado | `pedidos-admin/anulacion-pagado.service.ts`, `repartos.service.ts` l.2829 | No existe aviso al cliente con ningún proveedor; la reasignación solo borra la etapa. No es pérdida por pasar a Evolution | Falta (ambos) |
| Lo que dispara el repartidor desde su app (Ya salió / Ya llegó / Entregar) | `repartos.service.ts` | Mismos avisos SALIDA, LLEGADA, ENTREGADO por el outbox | Corregido |
| Pedido listo, para recoger | `cocina/comandas.service.ts` l.681 a l.782, l.1106 | LISTO / LISTO_RECOJO por el outbox; ventana de 24 h + botón. «Comer en el local» nunca avisa (por diseño) | Corregido |
| Encuesta 1 a 5 y su respuesta | `chatbot-planificador.service.ts` l.480, `whatsapp-webhook.service.ts` l.1508 a l.1644 | Escala completa 1 a 5 numerada con emojis (`completarEscalaEncuesta`); «3» vale 3 | OK |
| Factura y boleta: envío automático del PDF | `comprobantes/factura-whatsapp.service.ts` `decidir` l.190 | Dentro de 24 h: documento PDF por media `evo:`. Fuera: antes intentaba una plantilla de Meta que Evolution no conoce (`PLANTILLA_NO_CONFIGURADA`); ahora queda «Sin ventana», se reintenta si el cliente escribe y hay botón «Enviar desde Mensajes» con el enlace al PDF | Corregido |
| Comprobante en el aviso del pedido | `ResumenRecibido.comprobante*` | Texto dentro del RECIBIDO | OK |
| Recuperar contraseña y código de verificación | `clientes/recuperar-clave.service.ts` l.118, `codigo-registro.service.ts` l.148 (origen CODIGO_CUENTA) | Los pide el cliente: no exige contacto previo. Texto de la plantilla con el código | OK |
| Aviso de cuenta creada | `clientes/aviso-cuenta.service.ts` | Igual | OK |
| Alertas internas al equipo (nuevo pedido, almacén, chat sin responder) | `chatbot/avisos-internos/*` | `ORIGENES_DEL_EQUIPO` no exige contacto previo. `avisos-internos.service.ts` l.923 manda a Evolution según su propia ventana | OK |
| Reservas (confirmada, recordatorio, actualización) | `reservas/reservas.service.ts` l.1302 y l.1422, `chatbot/servicios/recordatorio-reservas.tarea.ts` | El cliente la pidió: sale. Recordatorio sujeto a horario del local | OK |
| Reclamos | `reclamos`, `quejas-whatsapp.service.ts` | Texto libre | OK |
| Carrusel de carta | `chatbot/servicios/carrusel.util.ts` | Lista numerada sin imágenes por tarjeta; elegir número = «Pedir este» | Degradado (inherente a Evolution) |
| Ubicación | `pedidos-admin/ubicacion-whatsapp-pedido.service.ts` | Recibe `locationMessage`. El botón «Pedir ubicación» (acción de una persona) bloqueaba con «WhatsApp no deja escribirle» fuera de 24 h | Corregido |
| Reacciones | adaptador `reaccionar` l.222 | `sendReaction` de Evolution | OK |
| Imágenes y media entrante (voucher) | `whatsapp-webhook.service.ts` l.313 `descargarMediaSegura` | Descarga por Evolution (`evo:`) | OK |
| Plantillas con variables | `chatbot/catalogo/texto-plantilla.ts` | Texto equivalente; las 36 del catálogo tienen texto | OK |
| Mensajes con botones → texto numerado | `evolution/menu-numerado.util.ts` | 1 a 30 opciones; un texto normal posterior borra el menú (a propósito) | OK (ver riesgos) |
| Escribir desde Mensajes un humano | `mensajes/mensajes.service.ts` (6 puntos) | Daba `VENTANA_CERRADA` y exigía plantilla de Meta aunque el proveedor fuera Evolution: la persona no podía enviar la confirmación. Ahora con Evolution escribe siempre | Corregido |
| Reintentos del outbox | `outbox-whatsapp.service.ts` `ESPERAS_REINTENTO_MS` | 30 s, 2 min, 10 min, 1 h; error permanente o agotado = FALLIDO + campanita a Caja | OK |
| Límites anti-bloqueo | `evolution/anti-bloqueo.util.ts`, política (topes por minuto, hora y día, horario del local) | Exceso = DIFERIR (espera, no se pierde); fuera de horario = DESCARTADO con motivo | OK |
| «Solo escribir a quien ya escribió» | `PoliticaEvolutionService` | Antes: «alguna vez escribió» o «pidió en 24 h». Ahora el aviso del pedido exige ENTRANTE en 24 h; el resto de proactivos (encuesta, recordatorio de pago) sigue exigiendo contacto previo | Corregido |

## ¿Se pierde algo en silencio?

- DESCARTADO por la política (fuera de 24 h, fuera de horario, número sin contacto): queda en Salientes con `motivo_descarte` legible. Nuevo: si es aviso de un pedido, `GET /admin/whatsapp/avisos-pedido-pendientes` lo expone y Caja, Pedidos y Mis pedidos muestran el botón con el motivo.
- FALLIDO (número inválido, Evolution caído, error permanente o agotado): campanita a Caja (`notificarFallido`) y fila en Salientes; también aparece como botón en el pedido.
- DIFERIDO (desconexión, pausa, tope): PENDIENTE con `ultimo_error`; sale solo al reconectar.
- Factura: `factura_whatsapp_envio` con estado SIN_VENTANA, ERROR, OMITIDO; etiqueta visible en la lista de electrónicos.
- Único hueco que se mantiene: delivery cancelado, anulado y devuelto no avisan al cliente con ningún proveedor.

## Cambios

1. `politica-evolution.service.ts`: aviso del pedido solo con mensaje ENTRANTE del cliente en 24 h (`FUERA_DE_VENTANA_24H`, motivo «Fuera de las 24 h…»). Sigue dependiendo de `evolution_exigir_contacto_previo = si`; en «no» sale todo.
2. `ventana-24h.service.ts`: `esEvolution()` y `puedeEscribirPersona()` (con Evolution una persona escribe siempre; con Meta, ventana). Usado en Mensajes, Pedir ubicación y chat del repartidor.
3. `mensajes.service.ts` / `mensajes.controller.ts`: `POST /admin/mensajes/conversaciones/iniciar` abre o crea el chat de un celular sin enviar nada.
4. `chatbot/servicios/avisos-manuales.service.ts` y `controladores/avisos-manuales.controller.ts`: avisos del pedido pendientes de envío manual con el texto ya escrito; desaparecen si una persona ya escribió al cliente o si hubo BAJA.
5. `comprobantes/factura-whatsapp.service.ts`: con Evolution no intenta plantilla fuera de la ventana.
6. Web: `mensajes/BotonEnviarConfirmacionWhatsapp.tsx` (consulta agrupada en una sola petición) en Caja (tarjeta), detalle del pedido y Mis pedidos; `MensajesView` lee `?telefono=&texto=`, inicia el chat si no existe y deja el mensaje en la caja de texto. Factura: botón «Enviar desde Mensajes (fuera de las 24 h)».

## Riesgos y notas

- Pedidos hechos por la carta web a un cliente que nunca escribió por WhatsApp ya no reciben avisos solos (decisión del dueño): todos pasan por el botón manual.
- El botón solo aparece a quien tiene `mensajes/enviar`. El mozo normalmente no lo tiene: ve su pedido, pero la confirmación la envía Caja.
- Un texto normal enviado tras un menú numerado borra ese menú (diseño para que un «2» suelto no se confunda): un aviso de texto que llegue entre una pregunta numerada y su respuesta invalida la respuesta. Probabilidad baja.
- El texto prehecho es el que se guardó al encolar el aviso; no se recalcula si el pedido cambió después.
- Con proveedor META elegido a mano nada cambia: la política devuelve ENVIAR y `puedeEscribirPersona` usa la ventana de Meta.
