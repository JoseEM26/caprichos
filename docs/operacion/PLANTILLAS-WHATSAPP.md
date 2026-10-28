# Catálogo de Plantillas de WhatsApp — Caprichos

Este documento contiene las plantillas oficiales listas para copiar y solicitar aprobación en el panel de **Meta Business Suite** (WhatsApp Manager > Herramientas de la cuenta > Plantillas de mensajes).

Todas las plantillas pertenecen a la categoría **Utilidad (UTILITY)** y están diseñadas para notificaciones operativas relacionadas directamente con pedidos del cliente (Ley 29733 de Protección de Datos Personales y Políticas de Comercio de WhatsApp).

---

## Resumen del Catálogo

> Pendiente de enviar a Meta: `DELIVERY_ESPERA_AGOTADA` (ahora sin botones), `DELIVERY_RETIRO` (ahora es la pregunta SÍ/NO), `DELIVERY_REPROG_RECIBIDA`, `DELIVERY_REENVIADO`, `DELIVERY_REPROG_CANCELADA` y `DELIVERY_REPROG_SIN_RESPUESTA`. Los textos de todas las plantillas de reparto se reescribieron con tono cálido y emojis; lo que está aquí es igual a `plantillas.catalogo.ts`.

| Clave en Sistema | Nombre en Meta | Categoría | Idioma | Variables |
| :--- | :--- | :--- | :--- | :--- |
| `DELIVERY_SALIDA` | `caprichos_delivery_en_camino` | Utilidad | Español (`es`) | 3 |

> `caprichos_delivery_en_camino`: la variable 3 (`tiempo_estimado`) es un rango por pedido, por ejemplo «25 a 30», calculado con la zona, la ruta del repartidor y el empaque (ver `eta_*` en Parámetros de operación). Si no hay datos suficientes sale el valor de `tiempo_prometido_min`.
| `DELIVERY_LLEGADA` | `caprichos_delivery_llegado` | Utilidad | Español (`es`) | 2 |
| `DELIVERY_INSISTENCIA` | `caprichos_delivery_insistencia` | Utilidad | Español (`es`) | 3 |
| `DELIVERY_ESPERA_AGOTADA` | `caprichos_delivery_espera_agotada` | Utilidad | Español (`es`) | 2 |
| `DELIVERY_ACEPTADO` | `caprichos_delivery_aceptado` | Utilidad | Español (`es`) | 2 |
| `DELIVERY_LISTO` | `caprichos_delivery_listo` | Utilidad | Español (`es`) | 2 |
| `DELIVERY_RETIRO` | `caprichos_delivery_retiro` | Utilidad | Español (`es`) | 3 |
| `DELIVERY_ENTREGADO` | `caprichos_delivery_entregado` | Utilidad | Español (`es`) | 2 |
| `PAGO_CONFIRMADO` | `caprichos_pago_confirmado` | Utilidad | Español (`es`) | 2 |
| `PEDIDO_LISTO_RECOJO` | `caprichos_pedido_listo_recojo` | Utilidad | Español (`es`) | 2 |
| `ENCUESTA_POSVENTA` | `caprichos_encuesta_posventa` | Utilidad | Español (`es`) | 2 |
| `REABRIR_CONVERSACION` | `caprichos_reabrir_conversacion` | Utilidad | Español (`es`) | 1 |
| `EQUIPO_NUEVO_PEDIDO` | `caprichos_equipo_nuevo_pedido` | Utilidad | Español (`es`) | 3 |
| `EQUIPO_ALERTA_ALMACEN` | `caprichos_equipo_alerta_almacen` | Utilidad | Español (`es`) | 3 |
| `AVISO_INTERNO` | `aviso_interno` | Utilidad | Español (`es`) | 2 |
| `CARTA_RECIBIDO_DIGITAL` | `caprichos_pedido_recibido_digital` | Utilidad | Español (`es`) | 3 |
| `CARTA_VOUCHER_RECORDATORIO` | `caprichos_pedido_voucher_recordatorio` | Utilidad | Español (`es`) | 2 |
| `CARTA_RECIBIDO_EFECTIVO` | `caprichos_pedido_recibido_efectivo` | Utilidad | Español (`es`) | 2 |
| `DELIVERY_REPROG_RECIBIDA` | `caprichos_delivery_reprog_recibida` | Utilidad | Español (`es`) | 2 |
| `DELIVERY_REENVIADO` | `caprichos_delivery_reenviado` | Utilidad | Español (`es`) | 2 |
| `DELIVERY_REPROG_CANCELADA` | `caprichos_delivery_reprog_cancelada` | Utilidad | Español (`es`) | 2 |
| `DELIVERY_REPROG_SIN_RESPUESTA` | `caprichos_delivery_reprog_sin_respuesta` | Utilidad | Español (`es`) | 2 |

---

## 1. Salida de Delivery (En camino)

- **Nombre de plantilla:** `caprichos_delivery_en_camino`
- **Categoría:** Utilidad (Utility)
- **Idioma:** Español (`es` o `es_PE`)
- **Texto del cuerpo (Body):**
```text
¡Hola {{1}}! 🛵 Tu pedido {{2}} ya salió de nuestro local y va en camino. Tiempo estimado: {{3}} minutos. ¡Gracias por tu paciencia! 😊
```
- **Ejemplo de variables para Meta:**
  - `{{1}}`: `María`
  - `{{2}}`: `CP-4102`
  - `{{3}}`: `25`
- **Botones:** Ninguno

---

## 2. Llegada de Repartidor a Destino

- **Nombre de plantilla:** `caprichos_delivery_llegado`
- **Categoría:** Utilidad (Utility)
- **Idioma:** Español (`es` o `es_PE`)
- **Texto del cuerpo (Body):**
```text
¡Hola {{1}}! 🛵 Nuestro repartidor ya llegó con tu pedido {{2}} y te espera en la puerta. ¿Podrías salir a recibirlo? 😊
```
- **Ejemplo de variables para Meta:**
  - `{{1}}`: `Carlos`
  - `{{2}}`: `CP-4103`
- **Botones:** Ninguno

---

## 3. Insistencia en la Puerta

- **Nombre de plantilla:** `caprichos_delivery_insistencia`
- **Categoría:** Utilidad (Utility)
- **Idioma:** Español (`es` o `es_PE`)
- **Texto del cuerpo (Body):**
```text
¡Hola {{1}}! 😊 Nuestro repartidor sigue en la puerta con tu pedido {{2}} desde hace {{3}} minutos. Cuando puedas, sal a recibirlo o escríbenos por aquí, con gusto te ayudamos. 🙏
```
- **Ejemplo de variables para Meta:**
  - `{{1}}`: `Carlos`
  - `{{2}}`: `CP-4103`
  - `{{3}}`: `4`
- **Botones:** Ninguno

---

## 4. Espera Agotada y Reprogramación

- **Nombre de plantilla:** `caprichos_delivery_espera_agotada`
- **Categoría:** Utilidad (Utility)
- **Idioma:** Español (`es` o `es_PE`)
- **Texto del cuerpo (Body):**
```text
¡Hola {{1}}! 😊 Ya llevamos un buen rato en la puerta con tu pedido {{2}}. Si no logramos encontrarte, nuestro repartidor tendrá que retirarse en unos minutos. ¿Podrías salir a recibirlo? 🙏
```
- **Ejemplo de variables para Meta:**
  - `{{1}}`: `Ana`
  - `{{2}}`: `CP-4099`
- **Botones:** Ninguno. El aviso solo informa; la pregunta de reprogramar llega al retirarse el repartidor (ver sección 14).

---

## 5. Pago Confirmado por Caja

- **Nombre de plantilla:** `caprichos_pago_confirmado`
- **Categoría:** Utilidad (Utility)
- **Idioma:** Español (`es` o `es_PE`)
- **Texto del cuerpo (Body):**
```text
Hola {{1}}, recibimos tu pago. Tu pedido {{2}} esta en preparacion.
```
- **Ejemplo de variables para Meta:**
  - `{{1}}`: `Lucía`
  - `{{2}}`: `CP-4105`
- **Botones:** Ninguno

---

## 6. Pedido Listo para Recoger (Para llevar)

- **Nombre de plantilla:** `caprichos_pedido_listo_recojo`
- **Categoría:** Utilidad (Utility)
- **Idioma:** Español (`es` o `es_PE`)
- **Texto del cuerpo (Body):**
```text
¡Hola {{1}}! 🥳 Tu pedido {{2}} ya está listo para recoger en nuestro local. ¡Te esperamos con gusto! 😊
```
- **Ejemplo de variables para Meta:**
  - `{{1}}`: `Jorge`
  - `{{2}}`: `CP-4106`
- **Botones:** Ninguno

---

## 7. Encuesta Posventa

- **Nombre de plantilla:** `caprichos_encuesta_posventa`
- **Categoría:** Utilidad (Utility)
- **Idioma:** Español (`es` o `es_PE`)
- **Texto del cuerpo (Body):**
```text
Hola {{1}}, gracias por tu compra en Caprichos (pedido {{2}}). ¿Como calificarias tu atencion del 1 al 5? Responde directamente con un numero del 1 al 5.
```
- **Ejemplo de variables para Meta:**
  - `{{1}}`: `Paola`
  - `{{2}}`: `CP-4100`
- **Botones de respuesta rápida (Quick Reply) - Alternativa según límite de Meta:**
  1. `1-2 Malo`
  2. `3 Regular`
  3. `4-5 Excelente`

---

## 8. Reapertura de Conversación (Fuera de ventana de 24 horas)

- **Nombre de plantilla:** `caprichos_reabrir_conversacion`
- **Categoría:** Utilidad (Utility)
- **Idioma:** Español (`es` o `es_PE`)
- **Texto del cuerpo (Body):**
```text
Hola {{1}}, nos comunicamos de Caprichos para dar seguimiento a tu consulta. ¿En que podemos ayudarte?
```
- **Ejemplo de variables para Meta:**
  - `{{1}}`: `Carlos`
- **Botones:** Ninguno

---

## 9. Aviso Interno al Equipo: Nuevo Pedido (Fuera de ventana 24h)

- **Nombre de plantilla:** `caprichos_equipo_nuevo_pedido`
- **Categoría:** Utilidad (Utility)
- **Idioma:** Español (`es` o `es_PE`)
- **Texto del cuerpo (Body):**
```text
Aviso para el equipo de Caprichos: se ha registrado el nuevo pedido {{1}} ({{2}}) por un total de S/ {{3}}. Por favor revisarlo en el sistema.
```
- **Ejemplo de variables para Meta:**
  - `{{1}}`: `CP-W015`
  - `{{2}}`: `Delivery - Ana Pérez`
  - `{{3}}`: `42.50`
- **Botones:** Ninguno

---

## 10. Aviso Interno al Equipo: Alerta de Almacén (Fuera de ventana 24h)

- **Nombre de plantilla:** `caprichos_equipo_alerta_almacen`
- **Categoría:** Utilidad (Utility)
- **Idioma:** Español (`es` o `es_PE`)
- **Texto del cuerpo (Body):**
```text
Aviso de almacen de Caprichos: el insumo {{1}} se encuentra en estado {{2}} (Stock: {{3}}). Por favor coordinar su reposicion.
```
- **Ejemplo de variables para Meta:**
  - `{{1}}`: `Leche Evaporada`
  - `{{2}}`: `Agotado`
  - `{{3}}`: `0.00 UND`
- **Botones:** Ninguno

---

## 11. Aviso Interno al Equipo: Alerta General del Sistema (Fuera de ventana 24h)

- **Nombre de plantilla:** `aviso_interno`
- **Categoría:** Utilidad (Utility)
- **Idioma:** Español (`es` o `es_PE`)
- **Texto del cuerpo (Body):**
```text
Aviso interno de Caprichos: *{{1}}*

{{2}}
```
- **Ejemplo de variables para Meta:**
  - `{{1}}`: `Voucher sin revisar (15 min)`
  - `{{2}}`: `Comprobante de pago sin decision por mas de 15 min. Chat marcado urgente: https://caprichos.pe/admin/mensajes`
- **Botones:** Ninguno

---

## 12. Pedido Delivery Aceptado (Caja)

- **Nombre de plantilla:** `caprichos_delivery_aceptado`
- **Categoría:** Utilidad (Utility)
- **Idioma:** Español (`es`)
- **Texto del cuerpo (Body):**
```text
¡Hola {{1}}! 😊 Gracias por tu pedido {{2}}. Ya lo estamos preparando con mucho cariño.
```
- **Ejemplo de variables para Meta:** `{{1}}`: `María` · `{{2}}`: `CP-4102`
- **Botones:** Ninguno
- **Cuándo se envía:** cuando Caja pasa el pedido delivery a preparación, o cuando se confirma su pago en COLA.

---

## 13. Pedido Delivery Listo (Cocina)

- **Nombre de plantilla:** `caprichos_delivery_listo`
- **Categoría:** Utilidad (Utility)
- **Idioma:** Español (`es`)
- **Texto del cuerpo (Body):**
```text
¡Hola {{1}}! 🎉 Tu pedido {{2}} ya está listo. Pronto sale con nuestro repartidor. 🛵
```
- **Ejemplo de variables para Meta:** `{{1}}`: `María` · `{{2}}`: `CP-4102`
- **Botones:** Ninguno
- **Cuándo se envía:** cuando cocina termina todas las áreas del pedido delivery (queda LISTO).

---

## 14. Retiro de Movilidad y Reprogramación

- **Nombre de plantilla:** `caprichos_delivery_retiro`
- **Categoría:** Utilidad (Utility)
- **Idioma:** Español (`es`)
- **Texto del cuerpo (Body):**
```text
¡Hola {{1}}! 😔 Nuestro repartidor tuvo que retirarse con tu pedido {{2}} porque se agotó el tiempo de espera. ¿Te gustaría reprogramar la entrega? {{3}} Responde SÍ para reprogramar o NO si prefieres cancelarlo. 🙏
```
- **Ejemplo de variables para Meta:** `{{1}}`: `María` · `{{2}}`: `CP-4102` · `{{3}}`: `Volver a enviarlo tiene un costo de S/ 5.00 (el mismo del delivery), que pagarías en la puerta o a Caja.` (si el costo es 0: `Volver a enviarlo no tiene costo adicional.`). La variable `{{3}}` es el monto exacto que luego se cobra al reenviar; la calcula el servidor con `reprog_recargo_modo`.
- **Botones de respuesta rápida (Quick Reply):** 1. `Sí, reprogramar` 2. `No, cancelar`. Si la ventana de 24 h está abierta se envían como botones; si no, el cliente responde escribiendo SÍ o NO.
- **Cuándo se envía:** cuando el planificador retira la movilidad tras `reparto_espera_max_min` más `reparto_insistencia_min` minutos en puerta. La respuesta SÍ pasa el pedido a «Por reprogramar»; NO o sin respuesta en `reprog_respuesta_min` minutos lo cancela.

---

## 15. Pedido Delivery Entregado (Agradecimiento)

- **Nombre de plantilla:** `caprichos_delivery_entregado`
- **Categoría:** Utilidad (Utility)
- **Idioma:** Español (`es`)
- **Texto del cuerpo (Body):**
```text
¡Hola {{1}}! 🎉 Tu pedido {{2}} fue entregado. ¡Gracias por preferir Caprichos, esperamos verte pronto! 💛
```
- **Ejemplo de variables para Meta:** `{{1}}`: `María` · `{{2}}`: `CP-4102`
- **Botones:** Ninguno. La encuesta posventa (sección 7) llega después, según `encuesta_espera_min`.

---

## 16. Pedido Recibido desde la Carta: pago digital (Yape, Plin o transferencia)

- **Estado:** pendiente de enviar a Meta (no aprobada todavía).
- **Nombre de plantilla:** `caprichos_pedido_recibido_digital`
- **Categoría:** Utilidad (Utility)
- **Idioma:** Español (`es`)
- **Texto del cuerpo (Body):**
```text
¡Hola {{1}}! 😊 Recibimos tu pedido {{2}}, ¡gracias! En unos momentos un asesor te escribirá por este chat para revisar el voucher de tu pago por {{3}}. 🙏
```
- **Ejemplo de variables para Meta:** `{{1}}`: `María` · `{{2}}`: `CP-W012` · `{{3}}`: `Yape` (o `Plin` / `transferencia`)
- **Botones:** Ninguno
- **Cuándo se envía:** al crear un pedido desde la carta virtual con celular y pago Yape, Plin o transferencia, si la ventana de 24 horas está cerrada. Deja la conversación para una persona de Caja (VALIDAR_PAGO, urgente).

---

## 17. Pedido Recibido desde la Carta: pago en efectivo

- **Estado:** pendiente de enviar a Meta (no aprobada todavía).
- **Nombre de plantilla:** `caprichos_pedido_recibido_efectivo`
- **Categoría:** Utilidad (Utility)
- **Idioma:** Español (`es`)
- **Texto del cuerpo (Body):**
```text
¡Hola {{1}}! 😊 Recibimos tu pedido {{2}}, ¡gracias por tu compra! Ya está en proceso. 🙏
```
- **Ejemplo de variables para Meta:** `{{1}}`: `María` · `{{2}}`: `CP-W012`
- **Botones:** Ninguno
- **Cuándo se envía:** al crear un pedido desde la carta virtual con celular y pago en efectivo, si la ventana de 24 horas está cerrada. No toca la conversación.

---

## 18. Reprogramación: solicitud recibida

- **Nombre de plantilla:** `caprichos_delivery_reprog_recibida`
- **Categoría:** Utilidad (Utility)
- **Idioma:** Español (`es`)
- **Estado:** pendiente de enviar a Meta (no enviada todavía)
- **Texto del cuerpo (Body):**
```text
¡Gracias, {{1}}! 😊 Recibimos tu solicitud para reprogramar tu pedido {{2}}. Te escribiremos por aquí para confirmarte la nueva entrega. 🛵
```
- **Ejemplo de variables para Meta:** `{{1}}`: `María` · `{{2}}`: `CP-4102`
- **Botones:** Ninguno.
- **Cuándo se envía:** Confirma al cliente que su SÍ quedó registrado (ventana abierta: texto libre; si está cerrada, usa esta plantilla).

---

## 19. Pedido Reprogramado y Reenviado a Reparto

- **Nombre de plantilla:** `caprichos_delivery_reenviado`
- **Categoría:** Utilidad (Utility)
- **Idioma:** Español (`es`)
- **Estado:** pendiente de enviar a Meta (no enviada todavía)
- **Texto del cuerpo (Body):**
```text
¡Buenas noticias, {{1}}! 🎉 Tu pedido {{2}} fue reprogramado y ya lo volvemos a enviar. Te avisaremos cuando salga. 🛵
```
- **Ejemplo de variables para Meta:** `{{1}}`: `María` · `{{2}}`: `CP-4102`
- **Botones:** Ninguno.
- **Cuándo se envía:** Avisa que el pedido volvió a salir a reparto tras confirmación del admin.

---

## 20. Reprogramación: pedido cancelado (el cliente dijo NO)

- **Nombre de plantilla:** `caprichos_delivery_reprog_cancelada`
- **Categoría:** Utilidad (Utility)
- **Idioma:** Español (`es`)
- **Estado:** pendiente de enviar a Meta (no enviada todavía)
- **Texto del cuerpo (Body):**
```text
Hola {{1}}, entendemos. 💛 Tu pedido {{2}} queda cancelado. Gracias por preferir Caprichos; cuando quieras pedir de nuevo, aquí estaremos. 😊
```
- **Ejemplo de variables para Meta:** `{{1}}`: `María` · `{{2}}`: `CP-4102`
- **Botones:** Ninguno.
- **Cuándo se envía:** Cierre cuando el cliente no quiere reprogramar.

---

## 21. Reprogramación: cancelado por falta de respuesta

- **Nombre de plantilla:** `caprichos_delivery_reprog_sin_respuesta`
- **Categoría:** Utilidad (Utility)
- **Idioma:** Español (`es`)
- **Estado:** pendiente de enviar a Meta (no enviada todavía)
- **Texto del cuerpo (Body):**
```text
Hola {{1}}, no recibimos tu respuesta sobre el pedido {{2}}, así que lo dejamos cancelado por ahora. 💛 Si quieres, escríbenos y con gusto te ayudamos a hacer uno nuevo. 😊
```
- **Ejemplo de variables para Meta:** `{{1}}`: `María` · `{{2}}`: `CP-4102`
- **Botones:** Ninguno.
- **Cuándo se envía:** Cierre cuando el cliente no responde en `reprog_respuesta_min` minutos.

---

## Recomendaciones para la Aprobación en Meta

1. **Categoría estricta:** Seleccionar siempre **Utilidad**. No usar Marketing para estas notificaciones operativas; de lo contrario, Meta puede requerir doble opt-in promocional.
2. **Sin emojis:** Las plantillas están redactadas formalmente sin emojis ni signos excesivos, garantizando alta tasa de aprobación automática.
3. **Muestra de contenido:** Al solicitar cada plantilla, rellenar los valores de ejemplo exactamente como se describe en este documento.
