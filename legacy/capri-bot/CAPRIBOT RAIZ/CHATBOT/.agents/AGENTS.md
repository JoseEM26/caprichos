# CAPRICHOS CHATBOT - PROCESOS Y REGLAS DE NEGOCIO

## Reglas de Atención y Negocio:
1. **Horario de atención:** Tienda/Recojo de 2:00 pm a 10:00 pm. Delivery recepción 24h, preparación/despacho 2:00 pm a 10:00 pm.
2. **Promoción Cumpleaños:** 1 tajada de Carrot Cake / Keke Marmoleado + 8 minishots de frappé + canción de cumpleaños. Válido solo en tienda con consumo mínimo S/ 14.50.
3. **Dúo Irresistible:** Solo entran Americano, Cappuccino, Chocolate, Iced Coffee, Iced Latte Coffee e Iced Chocolate.
4. **Dúo Compartir:** Bebidas frías/calientes excepto bebidas frozen. Complementos (7 opciones completas): 2 donas, 2 galletas artesanales, 1 dona + 1 galleta, 1 tajada de Carrot Cake, 1 tajada de Keke Marmoleado, 1 Empanada (de jamón y queso o de pollo casero) o 1 bandeja de 4 Petit Pan.
5. **Aprobación de Pedidos:** Pausa silenciosa automática del bot cuando el pedido va a validación en Telegram. El bot NUNCA aprueba pagos por sí solo ni promete tiempos de entrega; esa confirmación es EXCLUSIVA del Administrador al presionar Aprobar desde Telegram.
6. **Timeout por Inactividad:** Expiración automática tras 3 horas de inactividad.
7. **Regla de Azúcar y Stevia en Bebidas:** TODAS las bebidas llevan azúcar blanca excepto 9: Frappé Algarrolúcuma, Frappé Caramel clásico, Frappé Caramel chocolate, Chocolate caliente, Mocaccino, Choconube, Iced Berry, Latte Vainilla y Caramel Macchiato. El Frappé Fit SÍ lleva azúcar blanca. Si el cliente pide su bebida con Stevia o sin azúcar, se confirma con naturalidad sin disclaimers robóticos (las 9 excepciones no llevan ni azúcar ni stevia).
8. **Tamaños de Bebidas:** Presentar siempre los 3 tamaños completos (Regular, Grande y Extra con sus precios) sin omitir el tamaño Extra.
9. **Pedidos Realizados por la Página Web:** Si el cliente indica que ya hizo su pedido por la página web (ej. 'ya pedí por la página'), el bot responde confirmando que su pedido fue recibido en cocina y está en preparación. Si luego indica que desea 'cancelar' (pagar) o pide medios de pago, se le envían únicamente los datos de Yape/Plin/Transferencia para que adjunte su comprobante sin re-tomarle el pedido.
10. **Datos Obligatorios del Cliente:** Nombre, Apellido y Número de Celular antes de consultar modalidad, calcular total o cobrar.
11. **Consulta Obligatoria de Modalidad:** Preguntar siempre si el pedido será para Delivery 🛵, Recojo en Tienda 🛍️ o Consumo en el Local 🍽️.
12. **Ubicación GPS Obligatoria en Delivery:** Si el pedido es para Delivery (monto mínimo de productos S/ 14.50), solicitar obligatoriamente la ubicación GPS actual de WhatsApp antes de calcular el total final con delivery y antes de cobrar. Rechazar direcciones en texto.
13. **Combo Cajita Caprikids (S/ 27.00):** Contiene Frappé Oreo 12 oz, Nuggets artesanales, Papas nativas mini + Salchichas ahumadas y 2 Juguetes a elección (Pistola de burbujas, Burbujas o Squishy). Preguntar obligatoriamente si es para niño o niña y cuáles 2 juguetes elige. Válido para Salón, Recojo y Delivery.

14. **Envío de Fotos Referenciales de Productos (39 productos mapeados):** Cuando el cliente pregunte cómo es un producto o pida fotos de un waffle, frappé, frozen, postre, sándwich o la cajita caprikids, el bot ejecuta la herramienta `enviar_foto_producto` enviando la imagen nativa directamente al chat de WhatsApp.

15. **Promociones 2x1 del Día (HOY):**
    - **2x1 en Frappé de Café 12 oz (Regular) a S/ 14.50 total:** Válido ÚNICAMENTE para el sabor Frappé de Café y tamaño 12 oz. ESTRICTAMENTE PROHIBIDO aplicar a otros sabores o tamaños.
    - **2x1 en Cappuccino 12 oz (Regular) CALIENTE a S/ 9.50 total:** Válido ÚNICAMENTE para Cappuccino caliente tradicional y tamaño 12 oz. ESTRICTAMENTE PROHIBIDO aplicar a otras bebidas calientes, a versiones frías (Iced Latte Coffee) o a otros tamaños.
    - El bot debe informar activamente estas dos promociones si el cliente pregunta por promociones/ofertas de hoy y aplicarlas automáticamente al pedir los productos correspondientes.

16. **Tarifas Especiales / Descuentos Silenciosos de Delivery:** Si un cliente cuenta con una tarifa fija o beneficio especial en `clientes.json`, el sistema calcula y presenta el costo de delivery directamente con dicho precio (ej. S/ 2.50) de forma natural y transparente, sin mencionar explícitamente descuentos ni promociones.

17. **Presentaciones de Carrot Cake y Keke Marmoleado (Tajada S/ 8.00, Familiar S/ 59.00, Cumpleañero S/ 69.00):**
    - Si el cliente pide **"Carrot cake cumpleañero"**, **"keke cumpleañero"** o **"marmoleado cumpleañero"**, asignar inmediatamente el producto entero decorado a **S/ 69.00**. ESTÁ ESTRICTAMENTE PROHIBIDO cobrar S/ 8.00, mandar una simple tajada o confundirlo con la promoción de cortesía.
    - Si pide "Carrot cake familiar" o "Marmoleado familiar", es **S/ 59.00**.
    - Si pide "Tajada de carrot cake" o "Porción individual", es **S/ 8.00**.
    - Si pide "Carrot cake" o "Keke de zanahoria" sin especificar presentación, preguntar siempre en lista vertical con los 3 precios.

18. **Capturas de Pedidos de la Página Web y Notificación a Trabajadores:**
    - Si el cliente envía una captura de pantalla de un pedido, carrito o resumen de la página web (`caprichos.restaurant.pe`), el bot tiene ESTRICTAMENTE PROHIBIDO tratarlo como un comprobante de pago bancario (ni inventar códigos de operación) ni volver a tomarle el pedido.
    - Debe confirmar la recepción avisando que el equipo/trabajador lo revisará de inmediato: *"¡Hemos recibido la captura de tu pedido de la página web! 📱✨ Nuestro equipo lo está revisando para coordinar y atenderlo de inmediato. Denos un momento por favor ⏳"*.
    - El sistema envía la notificación con la foto a Telegram y activa la pausa silenciosa para que el personal/trabajador lo atienda.

