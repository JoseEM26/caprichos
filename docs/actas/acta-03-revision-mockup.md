# Acta 03: Revisión del mockup con el cliente, Caprichos

| Campo | Detalle |
| :-- | :-- |
| **Fecha** | Martes 20 de octubre de 2026, 20:31 a 22:46 (hora de Lima) |
| **Modalidad** | Videollamada con pantalla compartida |
| **Participantes** | Kevin Rosales (Caprichos, cliente y dueño). Por momentos opina su esposa, que trabaja en el local. José Ángel Espinoza Morales (desarrollador) |
| **Etapa del marco de trabajo** | Revisión del mockup navegable (G2 en preparación) |
| **Fuente** | Transcripción automática de la reunión. Tiene errores de reconocimiento de voz; lo dudoso se marca con (?). La transcripción completa no se guarda en el repositorio porque menciona a personas del local (Ley 29733); este resumen recoge todo lo acordado |
| **Decisiones que salen de aquí** | DT-55 a DT-67 y pendientes D-25 a D-30 en `analisis/decisiones.md` |

José recorrió el mockup (carta, pedidos y caja, cocina, reparto, almacén, administrativo). Kevin fue validando y pidiendo cambios. Abajo van **por módulo**: lo que se mostró, lo que se acordó y lo que queda por confirmar.

## 1. Carta virtual

**Se mostró y quedó bien:** la foto del producto se abre en grande y se adapta a productos anchos o altos; las opciones del producto (tamaño regular, grande, extra; tipo de leche; azúcar o estevia; shot); la vista en celular; el carrito con delivery o para recoger.

**Acordado:**
- **Ubicación con mapa y confirmación.** «Usar mi ubicación actual» ubica por GPS y muestra el mapa con el punto. Debajo, el cliente **confirma** que es ahí o **mueve el punto** (por ejemplo, la puerta de atrás o la otra calle, en zonas con escaleras donde la moto no llega). Problema que resuelve: en OlaClick el cliente no veía el mapa, solo un texto («Cercado de Lima»), y había direcciones repetidas en distintos distritos (calle Las Águilas en Carrión y en Huachipa) que hacían perder el viaje al repartidor.
- **La ubicación no es obligatoria.** Si el cliente no puede dar su ubicación, el asesor la pide por WhatsApp.
- **Los límites de las zonas de reparto no se muestran al cliente.** Según Kevin, entre el 15 y el 20 % de los clientes movía el punto a la zona más barata y luego decía «vivo más arriba».
- **El método de pago se elige en la carta** (obligatorio). Si se deja para WhatsApp, recarga al personal. Kevin enviará la lista de métodos.
- **El comprobante de pago (captura) no se pide en la carta.** Lo pide el asesor por WhatsApp.
- **Al terminar el pedido llega un mensaje automático al WhatsApp** con el resumen y el método de pago, y **el pedido pasa directo a comandas** («directo, directo»), sin esperar la captura.
- **Novedades:** el subtítulo («Lo nuevo en Caprichos», promociones) es un texto editable, no un banner. Las imágenes también son editables.
- **Entrar a la cuenta es opcional;** se puede seguir como invitado. Solo quien quiere acumular puntos entra. Como el cliente puede olvidarse, **al final del pedido se le recuerda** si desea acumular puntos y se le muestra cuántos ganaría.
- **Nombre por bebida.** Si pide varias bebidas (por ejemplo, cinco capuchinos), la carta pide para cada una: «Ingresa el nombre de la persona que tomará esta bebida», con una imagen de referencia. Kevin aclara que si se pregunta solo «coloca el nombre», la gente escribe «capuchino».

## 2. Puntos

- Los puntos sirven para canjear en lo que el cliente quiera de Caprichos. No es dinero que se pueda retirar.
- **Se gana un porcentaje del total de la compra: 5 % por defecto**, editable por el administrador (antes usaron 7 % y 3 %). Ejemplo de Kevin: compra de S/ 70 → 3,5 puntos.
- **El porcentaje es general para toda la carta,** no por producto como en restaurant.pe, para que el cliente entienda fácil cuánto acumula.
- **Excepciones:** productos o promociones que no suman (por ejemplo, un 2×1 de campaña muy ajustado). Se marcan en el producto: «No suma puntos ni aplica cupones».
- **Al terminar el pedido:** resumen con los puntos ganados en esta compra y el total acumulado.
- **Canje en el pedido:** «¿Cuántos puntos deseas usar?», con «Tus puntos disponibles: X» debajo; al escribir se ve cuánto queda, y un botón **Aplicar**.

## 3. Cupones

- **Cupones impresos en el ticket** (como McDonald's): de 1 a 3 por ticket, para la **siguiente compra**, con código **único** que genera el sistema, vigencia desde que se emite (por ejemplo, 15 días) y **un solo uso**. Lo puede usar quien traiga el código, en el local o desde la carta.
- **Cupones de campaña:** un mismo código para volantes o una transmisión en vivo, con **tope de usos** (por ejemplo, los primeros 20 o 50).
- **Reglas:** cuántos cupones salen por ticket, días de vigencia y texto. No acumula puntos, no se junta con otras promociones y es uno por compra.

## 4. WhatsApp y chatbot

- La ventana de WhatsApp del administrativo usa el **mismo número de Caprichos** que hoy (la API de Meta está vinculada a ese número).
- El bot actual **sigue funcionando aparte** hasta que salga el nuevo; el chatbot no entra en la primera entrega (faltan unos 10 días).

## 5. Pantalla de cocina y despacho

- **Solo un botón: Despejar.** Kevin pide quitar «empezar a preparar»: cuando llega, ya lo están preparando. Se despeja cuando está terminado, para no ocupar al barista con clics.
- **Los pedidos ocupan toda la pantalla** (Kevin vio espacio vacío en «preparación»).
- **Historial** para ver lo despejado y **devolverlo** si se despejó por error. También para saber si una comanda llegó, porque hoy hay comandas que no llegan.
- **Despacho:** la esposa de Kevin pide una pantalla o impresión que junte **todo el pedido** de todas las áreas. Hoy el despacho tiene que ir a caja a pedir que impriman el voucher para saber qué sale.

## 6. Reparto (delivery)

Fue el tema más largo. Kevin tomó como referencia el mapa de OlaClick y lo mejoró.

- **Pantalla principal: el mapa a pantalla completa** en el celular, con un **zoom automático** que abarca todos los pedidos listos (dos pedidos cerca → zoom cerca; diez pedidos en Campoy, Mangomarca y Huachipa → zoom amplio). Sigue existiendo la **vista de lista** (doble vista).
- **Cada punto lleva el nombre completo del cliente** y debajo, en chico, el **código del pedido**. Kevin primero pidió números correlativos 1, 2, 3; luego eligió nombres, porque el repartidor pide a despacho «dame el de Rosa y el de Diego». El código evita confusiones cuando hay dos Diegos o varias Yomaras.
- **Colores por tiempo de espera,** desde que el cliente terminó el pedido: **verde** dentro de rango (lo ideal es entregar en 25 minutos), **naranja** con retraso desde los 35 minutos, **rojo palpitando fuerte** crítico desde los 50 minutos. Los colores son por tiempo, no por zona.
- **Zonas:** se agrupan para que el repartidor sepa qué puede llevar en una misma ruta.
- **Ruta sugerida:** el sistema sugiere el orden (primero el más cercano, luego el intermedio). Es **solo una sugerencia**, sin preguntas ni encuestas; decide el repartidor (calles cerradas, tráfico). Ejemplo de Kevin: unas donas listas a media cuadra se llevan antes que un pedido con más retraso en El Agustino.
- **Al tocar un punto** aparece abajo el resumen: código, cliente, **Llamar**, **WhatsApp** (Kevin: «ahí te luciste») y Google Maps o Waze.
- **Estados con un botón grande, fácil de pulsar en la moto:** **Tomar pedido** → **En camino** → **He llegado** → **Entregado**.
- **Cada repartidor tiene su usuario,** y se sabe quién tiene cada pedido. Son dos repartidores (tres cuando Kevin apoya). Dos no pueden tomar el mismo pedido.
- **Mensajes automáticos al cliente:**
  1. Al pulsar **En camino**: «Tu pedido está en camino, por favor atento a tu celular para recibir la llamada».
  2. Si el cliente no responde (en minuto y medio o dos minutos): «Por favor, ¿nos confirmas si estás en tu ubicación?».
  3. Si sigue sin responder: «Recuerda que el tiempo máximo de espera una vez que el repartidor llega es de 10 minutos, para que tus productos lleguen en su mejor estado. Si no estás, el repartidor regresará al local con tu pedido y habrá que coordinar un nuevo envío».
  - Si el cliente responde, no se envían los siguientes. El mensaje lleva botones de respuesta (sí o no).
  - Kevin pide que los **textos sean editables** y enviará su plantilla.
  - En la conversación se mezcló «estamos cerca» con «he llegado»; el momento exacto de los mensajes 2 y 3 queda por confirmar (D-27).
- **Ubicación del repartidor en tiempo real: descartada** por el costo de la API.
- **No se le da al cliente un tiempo de espera fijo de golpe,** porque el repartidor tiende a llegar al tope.

## 7. Pedidos desde caja y mozo

- **Plano de mesas editable;** se elige la mesa y el número de personas.
- **Cantidades con opciones distintas:** Kevin pregunta si al pedir 3 frappés se puede elegir la leche de cada uno (dos con leche entera, uno con leche de almendra), para un solo tamaño.
- **Sugerencia de promoción:** si el pedido califica (por ejemplo, dos Ice Coffee → 2×1), el sistema avisa y el mozo le pregunta al cliente si la quiere. La promoción es una combinación de productos, no solo un nombre.
- **Pedido del personal** con su 25 % de descuento, que se acumula para descontarse de su pago.

## 8. Caja y cierre

- Cierre igual al de restaurant.pe: movimientos, ingresos, egresos, ventas cobradas, pendientes y conteo de efectivo y billeteras.
- **Cierre ciego:** el cajero ingresa lo que cuenta en efectivo, Yape, Plin, tarjeta y transferencia **sin ver los totales esperados**, y ve solo el resultado. Motivo: si ve que faltan S/ 4, puede anular una galleta de S/ 4 para cuadrar. Kevin espera que casi nunca sobre (sobra cuando no se procesó un pedido o no se anotó un egreso) y que pueda faltar (pedido no anulado a tiempo).
- **El detalle por método de pago solo se ve si no cuadra y con la supervisora** (rol administrador), para darle seguimiento con el historial de ventas.
- **Anulación:** el cajero puede anular, con **motivo obligatorio** y la aprobación de la supervisora con su **PIN de 6 dígitos** ingresado **en persona en la caja**, no por notificación (podría estar en otro lugar sin saber qué aprueba). Así hay dos responsables. La supervisora no debe compartir su PIN; si lo hace, la responsabilidad es suya, y todo queda en la auditoría.
- **Yape y Plin** usan el mismo número; Plin se deja aunque casi siempre esté en cero.

## 9. Auditoría

- Kevin la calificó de «bestial» e «importantísima». Se registra todo: ver el DNI completo, PIN incorrecto, anulaciones, ocultar o desactivar un producto…
- **Caso real:** un cajero marcó un producto como agotado, nadie lo reactivó al día siguiente y estuvieron dos días sin venderlo. Marcar como agotado es a veces necesario; lo que se pide es saber quién lo hizo y que no quede olvidado.

## 10. Cocina (extras)

- **Alta demanda:** sin congestión le dicen al cliente que la entrega es de **25 a 35 minutos**. La alta demanda **suma** minutos a ese rango (por ejemplo, 30 más), se ve en tiempo real en todas las áreas, en la carta y en el bot, y cualquier área puede activarla.
- **Merma:** qué productos, de qué área (cocina, barra, producción) y destino (desecho, donación, personal).
- **Pedir al almacén** desde cocina o barra (leche, café, galletas…).

## 11. Almacén y compras

- **Aviso al almacén:** pantalla prendida que **suena hasta que alguien marque «Recibido»**, y también por **WhatsApp**.
- **Descansos:** el almacenero descansa un día a la semana y otra persona lo cubre (y a veces otros días). El aviso debe llegarle a quien está de turno. Kevin también propuso elegir a quién enviarlo («Marvel o Jeffrey»).
- **Salidas propias:** en la mañana no hay almacenero y la repostera saca harina y otros insumos. Cada uno registra sus salidas **con su propio usuario**; los usuarios son personales para saber quién hizo qué.
- **Compras:** proveedor, fecha, serie opcional, factura o boleta, contado, productos con cantidad y unidad y costo por unidad. **El lote no sirve** (el almacén es chico y no usan código de barras). La fecha de vencimiento tampoco se distingue entre compras.
- **Stock:** niveles y «pedir lo que falta a los proveedores». A cada proveedor se le envía su propio WhatsApp; WhatsApp no cierra la sesión del otro chat.

## 12. Reservas

- Llegan por WhatsApp. Se eligen una o varias mesas en el plano (por ejemplo, dos de dos para cuatro personas). **La reserva no bloquea la mesa:** es un aviso, porque la gente cancela o no llega.

## 13. Clientes y créditos del personal

- Clientes: todo lo que pidieron sin crear su usuario.
- **Créditos del personal: por semana,** porque pagan semanal, y también por **rango de fechas** (antes era por mes).

## 14. Productos

- Productos simples (media docena) y con opciones y tamaños (café americano: endulzado con azúcar o estevia, shot de expreso).
- Campo nuevo: **«No suma puntos ni aplica cupones»** (punto 2).

## 15. Promociones

- Tres tipos (de lo que compartió el cliente):
  - **Combos:** varios productos por un precio fijo; el cliente elige dentro de lo permitido (dos bebidas y un complemento por S/ 33).
  - **Lleva más, paga menos:** 2×1, 3×1, 4×2, de un solo producto, con un precio que no tiene que ser la mitad exacta.
  - **Descuentos:** porcentaje o monto sobre un producto, una categoría o toda la carta, con compra mínima opcional.
- Para cada una: días de la semana, horas opcionales (por ejemplo, de 1 a 5 de la tarde), vigencia, canales (web, local, WhatsApp) y límite de usos (los 10 primeros, y luego se desactiva sola). Kevin lo aprobó («bacán»).

## 16. Impresión

- Se mostró la vista previa del ticket, la etiqueta general, la etiqueta por área (salado, bebidas) y la etiqueta por bebida.
- **Etiqueta de bebida:** el **nombre de la persona como protagonista**, luego la bebida o sabor (capuchino) y luego «contiene» (expreso, leche, espuma), que Kevin aprobó.

## 17. Informes e indicadores

- Resumen del día, ventas por día y por producto con filtros, pedidos rechazados, cierres de caja, y espacio para más informes.
- Mapa de calor de entregas y zonas que vienen del bot actual. José encontró en OlaClick un hueco entre dos zonas donde no le cobraron delivery; las zonas no deben dejar huecos y sus límites no se muestran al cliente (punto 1).

## 18. Diseño de la carta

- Carta editable, con temas por fecha (Halloween, Navidad, San Valentín) que se cambian con un botón, y paletas de colores nuevas. Novedades se ve como Instagram.

## 19. Configuración del local

- Datos del local (nombre, lema, dirección, enlace de Google Maps, redes sociales).
- **Reseñas de Google Maps:** Kevin propuso mostrar en la carta las mejores de sus 778 opiniones, con nombre y foto, para dar confianza. José advirtió que el nombre y la foto son datos personales. **Decisión posterior del desarrollador (21/10): se descarta hasta tener una revisión legal** (DT-66).

## 20. Usuarios

- Usuarios del personal y clientes con cuenta: puntos, historial de pedidos.
- **DNI visible solo para el administrador;** igual el **RUC**, que Kevin considera importante para facturas.
- **Exportar a Excel:** se usa en casos puntuales para indicadores que no están en los resúmenes, y para sacar los números de los clientes e importarlos a Google Contactos.
- **Listas de difusión masivas: descartadas.** Hoy cuestan caro y pueden hacer que bloqueen la cuenta. Kevin: «era una idea al aire».
- **Agregar automáticamente al cliente a los contactos** del WhatsApp: José lo va a investigar (D-28).

## 21. Servidor (VPS)

- José explicó que el servidor es una computadora vacía en la nube que hay que configurar, con pago mensual (unos S/ 30).
- Se eligió **Contabo** (Kevin preguntó por qué no otro: los más caros dan servicios que no se necesitan). Kevin prefería pagar 12 meses; José propuso **un mes de prueba** del plan de **12 GB de RAM**, para poder cambiar de plan si no aguanta. Ubicación Estados Unidos central, Ubuntu 24.04, 200 GB.
- Kevin preguntó por la copia en tiempo real. José explicó que las capturas (*snapshots*) copian el servidor entero, y que la copia de la base de datos se guarda **en otro lugar**. El **Auto Backup** mensual de Contabo no se contrató. Ya registrado en DT-30, COS-CAP-001 y PCN-CAP-001.

## Compromisos

| Quién | Qué |
| --- | --- |
| Kevin | Enviar la lista de métodos de pago aceptados |
| Kevin | Enviar la plantilla de los mensajes de reparto |
| José | Documentar todo lo acordado (olas D1 a D6) y luego ajustar el mockup |
| José | Investigar si se puede agregar al cliente a los contactos del WhatsApp de forma automática (D-28) |

---
Generado por IA: resumen de la transcripción automática de la reunión del 20/10/2026 — Revisado por: *(pendiente)*
