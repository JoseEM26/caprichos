---
id: FLU-CAP-002
tipo: analisis
titulo: Flujos de pedido por WhatsApp, ubicación, cambios y atención (bot y persona)
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza (desarrollo); validación pendiente de Kevin Rosales"
aprobadores: []
fecha: 2026-10-19
relacionados: [BRD-CAP-001, REG-CAP-001]
tags: [flujo, whatsapp, chatbot, ubicacion, mockup, v113-v135]
---

# Flujos de pedido por WhatsApp, ubicación, cambios y atención

> Documento de trabajo. Describe lo que hace hoy el **mockup** (versiones v113 a v135) y lo que se propone para el sistema real. Todo lo marcado como "no probado" se verificó solo con pruebas automáticas del mockup, nunca abierto en un navegador real ni conectado a WhatsApp. Por validar con Kevin Rosales.

## 1. Idea central

**El bot hace lo repetitivo y una persona decide lo importante.** El cliente nunca es obligado ni bloqueado; el equipo es quien clasifica la ubicación dentro de las zonas de reparto y quien aprueba o rechaza los pagos.

## 2. Pedido de la carta virtual (de principio a fin)

| Paso | Quién | Qué pasa |
|---|---|---|
| 1 | Cliente | Arma su pedido en la carta (delivery o para llevar). Si hay sesión, ve la campanita. |
| 2 | Cliente | Comparte su ubicación actual (opcional) o escribe su dirección. Ver sección 3. |
| 3 | Sistema | El pedido llega a Pedidos y caja como **Por confirmar** y se avisa al equipo. |
| 4 | Bot | Abre un chat y escribe al cliente: el **resumen del pedido** (cliente, contacto, modalidad, dirección, productos, envío, total) y la pregunta **¿Cómo prefieres pagar?** |
| 5 | Bot | Según el medio: Yape, Plin o transferencia, manda los datos de Configuración con el monto exacto y pide la captura; efectivo, pregunta con cuánto paga (vuelto); tarjeta, avisa que se lleva el POS. |
| 6 | Cliente | Envía la captura del pago. |
| 7 | Bot | Responde "Recibido, una persona del equipo verifica tu pago". El chat queda **Validar pago** y el bot **calla**. |
| 8 | Persona | Ve la tarjeta **Comprobante por revisar** (pedido, medio, monto a recibir) y toca **Aprobar y enviar a cocina** o **Rechazar**. |
| 9a | Sistema | **Aprobar**: registra el cobro (quién y a qué hora), el pedido pasa a las pantallas de cocina y el bot avisa al cliente el tiempo. |
| 9b | Bot | **Rechazar**: pide otra captura y vuelve a esperar. |

**Si el cliente no puso ubicación**, el resumen dice "Envío: lo confirma un asesor al ubicarte" y el segundo mensaje del bot es: *"En unos instantes un asesor se pondrá en contacto contigo para ayudarte a validar tu comprobante de pago y la ubicación de entrega. Gracias."*

**Quién puede aprobar o rechazar:** administrador, cajero, mozo y call center.
**Antes de este flujo** (v96 a v133) el equipo escribía al cliente y subía la captura a mano; sigue existiendo esa opción en el detalle del pedido (Confirmar pedido y pago).

### Lo que el bot no hace
- No verifica que el comprobante sea verdadero: solo una persona decide.
- No envía el pedido a cocina sin aprobación.
- No se aprueba un delivery sin ubicación (primero se ubica en el mapa).

## 3. Ubicación: nunca obligar, siempre ayudar

### Regla
- **Si el cliente comparte su ubicación actual:** se calcula el envío solo y la dirección escrita pasa a ser **opcional**.
- **Si no la comparte o falla** (permiso denegado, GPS dañado): la **dirección escrita es obligatoria** (distrito, calle, manzana y lote; ejemplo en pantalla). El mensaje dice "No hay problema… un asesor te ayudará a ubicarla".
- **Nunca** se le piden zonas al cliente ni se le muestran palabras como "Zona 3". Solo ve el costo del envío, o "lo confirmamos contigo", o el aviso de **fuera de cobertura** con la opción de recoger en la tienda.

### El equipo ubica el pedido
1. Abre el pedido de delivery y toca **Ubicar en el mapa** (o **Corregir ubicación**).
2. Pantalla en dos columnas: a la izquierda el resumen del pedido (lo que escribió el cliente), la sugerencia y la dirección; a la derecha el mapa, el resultado y el botón de guardar.
3. **Sugerencia por número o por cuenta:** si el cliente ya pidió antes, se propone su dirección y, si tiene punto guardado, **Usar esa ubicación** lo pone en el mapa de un toque (el pedido más reciente que ya tenía ubicación).
4. Se toca el mapa: la **zona sale sola** del punto (las zonas son internas; no hay botones para elegirlas). Se ve el envío y cómo cambia el total.
5. Si el punto cae fuera de cobertura no se guarda y se ofrece recoger.
6. Guardar pide confirmación y recalcula zona, envío y total.

**Regla de control:** un delivery sin ubicación (ni zona) **no se puede confirmar ni aprobar**.

### Envío (cálculo)
- El costo es el número de la zona en soles (Z2 = s/ 2 … Z7 = s/ 7) según el polígono donde cae el punto; igual que el bot real (verificado: mismos polígonos y tarifas).
- **Envío gratis solo si los productos pasan de s/ 70** (valor por defecto, igual que el bot real; configurable a "desde" en Configuración > Entrega).
- **Tarifa especial por cliente** (como el bot real): monto fijo (s/) o descuento (%) en la ficha del cliente; solo el administrador los edita. El fijo prevalece sobre el porcentaje; el envío gratis prevalece sobre ambos.
- Pedido mínimo para delivery: s/ 14.50 (configurable).

## 4. Bot y persona no se cruzan

**Cada chat tiene un solo dueño a la vez: Bot o Persona.**

| Situación | Qué ocurre |
|---|---|
| Llega la captura | El bot calla; el chat queda sin dueño y pide ser tomado. |
| La persona escribe, aprueba o rechaza | Se vuelve su dueña automáticamente. |
| Otra persona quiere escribir | No puede hasta tocar **Tomar el chat** (confirmación); la primera deja de poder escribir. |
| El cliente escribe mientras lo atienden | El mensaje llega, **el bot no responde**. |
| El cliente escribe «urgente» o pide un asesor | El bot cede al instante, el chat se marca **URGENTE**. |
| La persona termina | **Soltar el chat** o **Marcar atendido** devuelve el chat al bot. |

**Pendiente:** liberación automática por inactividad (propuesta: 15 minutos); en el mockup no corre ningún reloj.

## 5. El cliente escribe después de pedir

El chatbot (simulador) entiende lo básico en texto libre y decide según el **estado real del pedido**. Los cambios los hace siempre una persona; el bot solo avisa.

| Estado del pedido | Cambiar la dirección | Cambiar o cancelar | ¿Cuánto falta? |
|---|---|---|---|
| Por confirmar | Se puede; avisa a un asesor | Se puede; avisa a un asesor | "Está por confirmar; al confirmarse tarda unos X min" |
| En preparación | Un asesor revisa (puede cambiar el envío) | Un asesor revisa | Estado y tiempo prometido; si ya pasó, se disculpa y avisa |
| En camino | El bot no cambia nada; aviso **urgente** al asesor y al repartidor | No se puede modificar | "Va en camino" |
| Entregado | Pasa a una persona | Pasa a una persona | Pasa a una persona |

- "Hola, quiero pedir algo" (o cualquier pedido nuevo) empieza el pedido.
- Mensaje que no entiende: repregunta una vez con opciones; a la segunda **pasa a una persona**.
- Cada aviso se guarda y aparece en **Mensajes de WhatsApp** como chat **Requiere atención** con una tarjeta (tipo, detalle, estado, botón Abrir el pedido) y en el pedido como "Escribió por WhatsApp".
- El simulador interpreta con palabras clave; el bot real con IA lo haría mejor y se le conectaría el estado real del pedido por una herramienta (la decisión de si se puede la toma el código, no la IA).

## 6. Ejemplos de chat (Mensajes de WhatsApp)

Los cuatro chats de ejemplo se generan ejecutando el propio mockup del chatbot (flujo por botones y listas): delivery con Yape (con captura por revisar), para recoger con efectivo, consulta de lactosa y paso a una persona. Los datos de pago son de ejemplo.

Nota: el bot real de hoy saluda con dos botones (**Carta** y **Ya sé qué pedir**): *Carta* manda el enlace de la carta web; *Ya sé qué pedir* manda dos imágenes de la carta y sigue en texto libre con IA (reglas en `prompt.py`: pide tamaño y sabor, ofrece reutilizar la ubicación guardada, pide nombre y celular, manda el resumen, da datos de pago solo tras la conformidad). El mockup propone el flujo completo por opciones.

## 7. Otras funciones agregadas al mockup

| Tema | Resumen |
|---|---|
| Bandeja Mensajes de WhatsApp | Aspecto de WhatsApp, buscador, pestañas (Todos, Por atender, Con el bot, Atendidos), franja que explica qué hacer, respuestas rápidas, zoom 60 a 140 %, pantalla completa. |
| Botón Pulir | Muestra cómo quedaría el mensaje más amable y bien escrito; la persona elige Usar o Dejar el mío; nunca se envía solo. En el mockup lo hacen reglas fijas; con IA real sería opcional y por uso. |
| Pedido del personal | Dentro de Nuevo pedido: se elige el usuario activo y local o para llevar; el descuento de crédito y el plazo se configuran en Configuración del local > Operación (25 % y 15 días de ejemplo; no se aplica a combos, promociones ni docenas). |
| Un solo botón | Pedidos y caja tiene solo **Nuevo pedido**; el pedido del personal está dentro. |
| Reservar mesa | Un formulario: nombre, personas, hora exacta, mesas. Dura la tolerancia (15 min) y se anula sola; la marca R es **solo visual**, no bloquea. Acepta **varias mesas** (suma asientos y avisa si faltan). |
| Juntar mesas | En el plano, modo **Juntar varias mesas**: un pedido ocupa todas, se muestra "Mesa 1 + Mesa 2" y se liberan juntas al cobrar. |
| Cuenta del cliente | Cumpleaños con calendario, **obligatorio** para personas (solo día y mes); correo personal opcional. |
| Campanita | Con sesión: cupón de cumpleaños en el mes del cumpleaños, aviso del mes en que llegará, pedir la fecha si falta, puntos. Las nuevas se marcan al abrir. |
| Propuesta comercial | Total **S/ 3,500** en cuatro partes (600, 800, 1,000 y 1,100), 12 láminas con lo agregado. |

## 7.1 Alta demanda (pantalla de cocina)

Interruptor para cuando hay muchísimos pedidos o una emergencia:
- **Activar alta demanda:** la carta y el chatbot avisan que la entrega tarda más: tiempo normal (13 min de ejemplo) + los minutos que se elijan. Atajos de +5, +10, +15, +20, +30, +45 y +60, y un campo **Otro (min)** de 1 a 180. El mismo tiempo se usa en lo que el bot promete al aprobar un pago.
- **Pausar pedidos:** además, la carta muestra «Pausamos los pedidos por el momento por alta demanda» y el chatbot pasa a un asesor. Solo vale mientras la alta demanda está activada; al apagarla todo vuelve a la normalidad.
- Corrección (v137): antes la pausa seguía bloqueando la carta aunque la alta demanda se hubiera apagado.

## 8. Costos a considerar (WhatsApp y IA)

- **WhatsApp Business API:** se cobra por mensaje de **plantilla** (iniciado por el negocio); leer y recibir no cuesta; las respuestas dentro de las 24 horas desde el último mensaje del cliente son gratis. El primer mensaje del bot tras un pedido de la carta es un mensaje de plantilla (necesita plantilla aprobada por Meta). Tarifa para Perú **sin confirmar**.
- **Panel de pruebas del equipo del bot:** réplica propia en HTML; no genera cobro de WhatsApp por sí mismo (solo las llamadas reales a la API).
- **IA para Pulir:** una llamada corta por clic (unos cientos de tokens); fracciones de centavo con un modelo pequeño. Opcional.

## 9. No verificado y pendiente

- Nada se abrió en un navegador real: solo pruebas automáticas del mockup. Falta revisar a ojo el diseño, el celular, el zoom y la pantalla completa.
- La ubicación real del navegador depende del permiso del cliente y de abrir la carta con https.
- Liberación automática de chats por inactividad; conexión real con WhatsApp y con la base de datos.
- Las solicitudes de reserva que llegan por WhatsApp se aprueban con una sola mesa.
- Los puntos y el crédito del personal siguen ligados a la lista de clientes de tipo Personal, distinta a los usuarios del sistema.
- Cupón de cumpleaños: en el mockup es uno solo para todos; en el real se emitiría por cliente.
- Reparto del monto entre partes y plazos de la propuesta: elegidos por desarrollo; revisar.
- Decisiones de Kevin: tiempo prometido (13 min vs 30 a 45 del bot), texto y plazo del Libro de Reclamaciones, boleta y factura electrónica, plazo de espera de un pedido por confirmar.
- Seguridad: cambiar la contraseña del panel de pruebas compartida en el chat y rotar las llaves del bot.
