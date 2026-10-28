# Catálogo de Plantillas de WhatsApp — Caprichos

Este documento contiene las plantillas oficiales listas para copiar y solicitar aprobación en el panel de **Meta Business Suite** (WhatsApp Manager > Herramientas de la cuenta > Plantillas de mensajes).

Todas las plantillas pertenecen a la categoría **Utilidad (UTILITY)** y están diseñadas para notificaciones operativas relacionadas directamente con pedidos del cliente (Ley 29733 de Protección de Datos Personales y Políticas de Comercio de WhatsApp).

---

## Resumen del Catálogo

| Clave en Sistema | Nombre en Meta | Categoría | Idioma | Variables |
| :--- | :--- | :--- | :--- | :--- |
| `DELIVERY_SALIDA` | `caprichos_delivery_en_camino` | Utilidad | Español (`es`) | 3 |
| `DELIVERY_LLEGADA` | `caprichos_delivery_llegado` | Utilidad | Español (`es`) | 2 |
| `DELIVERY_INSISTENCIA` | `caprichos_delivery_insistencia` | Utilidad | Español (`es`) | 3 |
| `DELIVERY_ESPERA_AGOTADA` | `caprichos_delivery_reprogramacion` | Utilidad | Español (`es`) | 3 |
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

---

## 1. Salida de Delivery (En camino)

- **Nombre de plantilla:** `caprichos_delivery_en_camino`
- **Categoría:** Utilidad (Utility)
- **Idioma:** Español (`es` o `es_PE`)
- **Texto del cuerpo (Body):**
```text
Hola {{1}}, tu pedido {{2}} de Caprichos ya salio de nuestro local y va en camino. Tiempo estimado de entrega: {{3}} minutos.
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
Hola {{1}}, nuestro repartidor ya llego con tu pedido {{2}} y esta en la puerta. Por favor sal a recibirlo.
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
Hola {{1}}, nuestro repartidor sigue esperando en la puerta con tu pedido {{2}} desde hace {{3}} minutos. Por favor sal o comunicate con nosotros.
```
- **Ejemplo de variables para Meta:**
  - `{{1}}`: `Carlos`
  - `{{2}}`: `CP-4103`
  - `{{3}}`: `4`
- **Botones:** Ninguno

---

## 4. Espera Agotada y Reprogramación

- **Nombre de plantilla:** `caprichos_delivery_reprogramacion`
- **Categoría:** Utilidad (Utility)
- **Idioma:** Español (`es` o `es_PE`)
- **Texto del cuerpo (Body):**
```text
Hola {{1}}, se agoto el tiempo maximo de espera para tu pedido {{2}} y el repartidor debe retirarse. Puedes solicitar la reprogramacion del envio con un recargo adicional de {{3}}. Responde SI para reprogramar o NO si prefieres cancelarlo.
```
- **Ejemplo de variables para Meta:**
  - `{{1}}`: `Ana`
  - `{{2}}`: `CP-4099`
  - `{{3}}`: `S/ 0.00`
- **Botones de respuesta rápida (Quick Reply):**
  1. `Si reprogramar`
  2. `No gracias`

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
Hola {{1}}, tu pedido {{2}} ya esta listo para recoger en nuestro local. Te esperamos.
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
Hola {{1}}, recibimos tu pedido {{2}} de Caprichos. Ya lo estamos preparando.
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
Hola {{1}}, tu pedido {{2}} ya esta listo. Pronto sale con nuestro repartidor.
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
Hola {{1}}, el repartidor se retiro de la puerta con tu pedido {{2}} porque se agoto el tiempo de espera. Tu pedido queda reprogramado {{3}}. Te contactaremos para coordinar la nueva entrega.
```
- **Ejemplo de variables para Meta:** `{{1}}`: `María` · `{{2}}`: `CP-4102` · `{{3}}`: `con un recargo de S/ 5.00`
- **Botones:** Ninguno. `{{3}}` es `con un recargo de S/ 5.00` si `reparto_recargo_reprogramacion` es mayor que 0, o `sin recargo` si es 0.
- **Cuándo se envía:** cuando el planificador retira la movilidad tras `reparto_espera_max_min` más `reparto_insistencia_min` minutos en puerta.

---

## 15. Pedido Delivery Entregado (Agradecimiento)

- **Nombre de plantilla:** `caprichos_delivery_entregado`
- **Categoría:** Utilidad (Utility)
- **Idioma:** Español (`es`)
- **Texto del cuerpo (Body):**
```text
Hola {{1}}, tu pedido {{2}} fue entregado. Gracias por preferir Caprichos.
```
- **Ejemplo de variables para Meta:** `{{1}}`: `María` · `{{2}}`: `CP-4102`
- **Botones:** Ninguno. La encuesta posventa (sección 7) llega después, según `encuesta_espera_min`.

---

## Recomendaciones para la Aprobación en Meta

1. **Categoría estricta:** Seleccionar siempre **Utilidad**. No usar Marketing para estas notificaciones operativas; de lo contrario, Meta puede requerir doble opt-in promocional.
2. **Sin emojis:** Las plantillas están redactadas formalmente sin emojis ni signos excesivos, garantizando alta tasa de aprobación automática.
3. **Muestra de contenido:** Al solicitar cada plantilla, rellenar los valores de ejemplo exactamente como se describe en este documento.
