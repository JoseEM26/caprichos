# CAPRICHOS CHATBOT - PROCESOS Y REGLAS DE NEGOCIO

## Reglas de Atención y Negocio:
1. **Horario de atención y Cero Spam de Horarios:** Tienda/Recojo de 2:00 pm a 10:00 pm. Delivery recepción 24h, preparación/despacho 2:00 pm a 10:00 pm.
   - **CERO SPAM DE HORARIO:** El horario de atención SOLO se menciona si el cliente pregunta explícitamente por él (ej. '¿a qué hora abren?', '¿están atendiendo?'). Queda ESTRICTAMENTE PROHIBIDO soltar el horario en saludos, en los botones de bienvenida o en mensajes intermedios. Fuera de horario, el bot toma la orden normalmente y solo al confirmar el pedido (o si el cliente pregunta) se le recuerda cordialmente que la preparación y despacho inicia a las 2:00 pm.
   - **Tiempo de Espera de 10 - 12 Segundos (Debouncer):** El bot espera 12 segundos para apilar y consolidar mensajes consecutivos que los clientes envían en partes antes de procesar y responder todo junto.
2. **Promociones Vigentes Oficiales:**
   - **Dúo Compartir (2 Bebidas + 1 Complemento):** 12oz S/ 33, 16oz S/ 36, 20oz S/ 38. Bebidas frías/calientes excepto bebidas frozen. Complementos: 2 donas, 2 galletas, 1 dona + 1 galleta, Carrot Cake, Keke Marmoleado, Empanada (pollo/jamón y queso) o 4 Petit Pan.
   - **Dúo Irresistible (Club Sándwich + 350g Papas + 2 Bebidas):** 12oz S/ 37, 16oz S/ 40, 21oz S/ 42. Bebidas participantes: Americano, Cappuccino, Chocolate caliente, Iced Coffee, Iced Latte Coffee o Iced Chocolate.
   - **Promoción Media Docena (6 unidades):** S/ 21.00. 6 donas, 6 galletas o mixta (donas + galletas sumando 6).
   - **Combo Cajita Caprikids:** S/ 27.00. Frappé Oreo 12oz + Nuggets + Papas con Salchichas + 2 Juguetes a elección (Pistola de burbujas, Burbujas o Squishy). Preguntar si es para niño o niña.
   - **Promoción Cumpleaños (Exclusiva para Salón):** 1 tajada de Carrot Cake / Keke Marmoleado + 8 minishots de frappé + canción de cumpleaños. Válido solo en salón con consumo mínimo S/ 14.50.
   - *(Nota: La promoción 2x1 fue de fecha pasada y ya finalizó).*

3. **Gestión y Notificación de Pedidos con Botones Interactivos:** Notificación directa de tickets y alertas al WhatsApp de Cocina/Administrador (`51977503006`) con 2 botones táctiles (`[✅ Aprobar Pedido]` y `[❌ Rechazar]`). No se incluye número de pedido inventado (#Pedido). Al pulsar 'Aprobar', el bot envía automáticamente al cliente la confirmación oficial con el tiempo estimado de entrega (o aviso de recojo) y confirma a cocina. Al pulsar 'Rechazar', le solicita amablemente al cliente el comprobante correcto.
4. **Timeout por Inactividad:** Expiración automática tras 3 horas de inactividad.
5. **Regla de Leche, Azúcar, Endulzantes y Chantilly en Bebidas:**
   - **Bebidas Calientes:** Hechas con **leche entera UHT** y **azúcar blanca**. Cambio a **Leche Sin Lactosa o Stevia** es 100% GRATUITO. Cambio a **Leche de Almendras (+ S/ 2.50)**. Se puede adicionar **Chantilly Extra (4oz) por + S/ 2.00**.
     - Endulzantes exclusivos: *Chocolate caliente, Mocaccino y Choconube* (syrup de almendra); *Latte Vainilla* (vainilla natural); *Caramel Macchiato* (caramelo artesanal y manjar); *Americano* (sin azúcar).
   - **Frappés (Base de hielo, pre-mezcla y agua hervida):** Hechos con **leche entera UHT** y **azúcar blanca**. Cambio gratis a **Sin Lactosa o Stevia**. Leche de almendras **+ S/ 2.50**.
     - Endulzantes exclusivos: *Frappé Caramel clásico y Caramel chocolate* (caramelo artesanal); *Frappé Algarrolúcuma* (algarrobina natural).
     - **Toppings estándar:** *Chispas de chocolate* (Café, Moca, Caramel chocolate, Chocolúcuma); *Triturado de Oreo* (Oreo, Chocoberry); *Chin Chin* (Strawberry, Berries); *Almendra triturada* (Algarrolúcuma, Caramel clásico); *Granola* (Fit); *Sin topping* (Maracuyá).
     - **Cambio de Topping:** Totalmente GRATIS. **Topping Extra/Adicional:** + S/ 1.00 por porción adicional.
     - *Poco hielo:* Explicar que significa menos volumen/cantidad en el vaso.
     - *No tan helado / aguado:* Explicar que al ser a base de hielo triturado saldría aguado. Si insiste, descargo cordial de que no nos responsabilizamos por textura/sabor.
     - *Sin chantilly:* Permitido y gratis.
     - *Sin café:* Todos vienen con café por defecto, pero se pueden preparar SIN CAFÉ si el cliente lo pide.

   - **Bebidas Iced (Líquidas con cubos de hielo):** SÍ pueden ir sin hielo. Hechas con leche entera UHT y azúcar blanca (cambio gratis a sin lactosa/stevia; almendras + S/ 2.50). *Iced Berry* viene sin café y con mermelada de fresa/frutos del bosque (sin azúcar ni stevia). *Iced Chocolate* no lleva café.
   - **Bebidas Frozen (Fruta natural + hielo granizado):** Endulzadas con azúcar blanca o stevia/sin azúcar (gratis).
   - **Waffles (Entero y Mitad):**
     - *Cambios GRATIS:* Cambiar fruta por otra fruta, cambiar sabor de salsa/syrup (chocolate, maracuyá, mermelada de fresa, salsa cheesecake), pedir sin chantilly, pedir helado/salsa aparte.
     - *Adicionales con costo:* Chantilly Extra **+ S/ 2.00**; Bola de Helado Extra **+ S/ 2.50**; Porción Adicional de Salsa/Syrup **+ S/ 2.50**.




6. **Tamaños de Bebidas:** Presentar siempre los 3 tamaños completos (Regular, Grande y Extra con sus precios) sin omitir el tamaño Extra.
7. **PROHIBIDO ASUMIR SABORES, VARIANTES O TAMAÑOS (SIEMPRE PREGUNTAR):**
   - **Variantes y Sabores:** Si el cliente pide un producto con múltiples variantes (ej. "Frappé Caramel", "Frappé de Lúcuma", "Dona", "Empanada", "Waffle de Fresa", "Dúo"), el bot tiene ESTRICTAMENTE PROHIBIDO asumir una variante. Debe preguntar siempre en lista vertical cuál desea (ej. Frappé Caramel clásico vs Caramel chocolate; Chocolúcuma vs Algarrolúcuma; sabor de dona; sabor de empanada).
   - **Tamaños:** Si no especifica tamaño o porción, SIEMPRE preguntar mostrando las opciones con sus precios respectivos.
   - **Continuidad tras 'No agregar más':** Si a la pregunta "¿Deseas agregar algo más?" el cliente dice "No/Nop/Solo eso", el bot NO debe reiniciar la conversación ni volver a preguntar "¿qué te gustaría pedir?", sino continuar con el pedido ya tomado y solicitar los datos (Nombre, Apellido, Celular) y modalidad.
8. **No Reiterar Solicitud de GPS si ya fue Evaluada:** Si el sistema ya evaluó la ubicación GPS (ej. fuera de la zona de reparto o delivery calculado) y el cliente responde con mensajes de espera o acuse de recibo ("Ahí está", "Me avisa", "Ok"), el bot no debe volver a pedir ubicación ni rechazar texto; debe continuar con el estado actual (ej. confirmar si desea Recojo en Tienda).
9. **Dúo Compartir y Combos (Categorización de bebidas y cero preguntas redundantes):**
    - En el Dúo Compartir, preguntar primero el tamaño con precios (12oz S/ 33, 16oz S/ 36, 20oz S/ 38). Para las bebidas, preguntar primero por categoría (Calientes ☕, Frappés 🍹 o Iced 🧊) en lugar de mandar listas kilométricas con todos los sabores juntos.
    - **Cero preguntas redundantes:** Si el cliente ya especificó de antemano el tamaño, las bebidas o el complemento en su mensaje, NO volver a preguntar por ellos.
10. **Asociación de Bebidas a Combos/Dúos:** Cuando el cliente pide combos/dúos (ej. 2 Dúos = 4 bebidas) y lista bebidas en su mensaje, el bot debe asumir automáticamente que esas bebidas corresponden a las bebidas de los dúos pedidos (sin cobrarlas por separado como bebidas sueltas). En caso de duda o descuadre, el bot puede preguntar para aclarar.

11. **Asimilación de Costo/Precio a Tamaño:** Si el bot pregunta por los tamaños/precios y el cliente responde indicando el precio/costo (ej. "14.50", "37", "16.50", "15.0", etc.), el bot debe asimilarlo inmediatamente como el tamaño/porción correspondiente (ej. 14.50 = Regular) y avanzar sin repetir la pregunta de tamaños.
12. **Modificaciones / Notas en Pedidos Web o Anteriores:** Si el cliente pide un cambio o ajuste (ej. "en vez de mermelada de fresa mandar maracuyá"), confirmar directamente: *"Está bien, informaré sobre su cambio a cocina/área encargada para que preparen su pedido a su gusto"* en lugar de enviar plantillas genéricas.
13. **Envío de GPS tras marcar Recojo en Tienda:** Si el cliente indicó "Recojo en Tienda" o "No es delivery" y luego envía su GPS, confirmar: *"Veo que nos compartiste tu ubicación GPS 📍, ¿deseas que tu pedido sea por Delivery 🛵 o se mantiene para Recojo en Tienda 🛍️?"*.
14. **Tarifas Especiales / Descuentos Silenciosos de Delivery:** Si un cliente cuenta con una tarifa fija o beneficio especial en `clientes.json`, el sistema calcula y presenta el costo de delivery directamente con dicho precio (ej. S/ 2.50) de forma natural y transparente, sin mencionar explícitamente descuentos ni promociones.
15. **Consultas sobre Estado de Pedidos / RestaurantPE / Cocina:** El bot SOLO se encarga de tomar pedidos por chat. NO tiene acceso en tiempo real a la cocina ni a pedidos realizados en RestaurantPE / Web. Si el cliente consulta si su pedido ya está listo, cuánto falta, o indica que ya hizo un pedido previamente, el bot tiene ESTRICTAMENTE PROHIBIDO inventar o afirmar que el pedido ya está listo o en camino; debe responder con amabilidad que el equipo humano lo está revisando en el sistema.
16. **CERO Solicitud de GPS en 'Recojo en Tienda' / Salón:** Si el cliente ya eligió 'Recojo en Tienda' o 'Consumo en Salón', queda ESTRICTAMENTE PROHIBIDO pedirle ubicación GPS o cobrarle delivery.
17. **ESTRICTAMENTE PROHIBIDO INVENTAR PRODUCTOS O PRECIOS (CARTA ESTRICTA):**
   - El bot SOLO puede ofrecer y vender productos, tamaños y precios que estén explícitamente en la carta oficial de Caprichos.
   - **Caso JUGOS:** Caprichos **NO vende jugos tradicionales/naturales de fruta** (naranja, papaya, fresa, surtido, etc.). Si el cliente pide jugos, el bot debe responder con total honestidad que no contamos con jugos tradicionales y ofrecer amablemente las alternativas reales a base de fruta: **Frozen** (Limonada Frozen, Maracuyá Frozen, Strawberry Frozen) o **Frappés de fruta** (Strawberry, Berries, Maracuyá, Fit).
   - **Productos / Servicios fuera de carta:** Si no está en la carta (ej. almuerzos, licores, marcas externas), el bot tiene ESTRICTAMENTE PROHIBIDO inventar que se vende o inventar precios. Debe responder con amabilidad que no contamos con ese producto en la carta.
18. **Menú de Bienvenida con Botones Interactivos y Registro de Clientes al Final:**
    - **Saludo Inicial y Botones Interactivos (Sin bloqueo de datos previos):** Al saludar o iniciar chat, el bot NO exige registrar nombre/celular por adelantado.
      - Si el cliente ya está registrado en `clientes.json`, lo saluda cordialmente por su nombre (*"¡Hola, {Nombre}! Te habla Capribot..."*).
      - Si es un cliente nuevo o no registrado, lo saluda amablemente (*"¡Hola! Te habla Capribot..."*).
      - En ambos casos presenta los 3 botones táctiles: `[🛍️ Hacer Pedido]`, `[🔎 Consultar Pedido]` y `[❓ Consulta Producto]`.
      - Si el cliente escribe directamente lo que desea pedir (ej. *"quiero un frappé"*), el bot pasa de inmediato a tomar el pedido sin interrumpir con botones ni pedir datos antes.
    - **Opciones de Hacer Pedido:** Al pulsar 'Hacer Pedido', ofrece 2 opciones: `[🌐 Ver Carta Web]` (enlace interactivo RestaurantPE) y `[📄 Carta Digital]` (documento PDF adjunto).
    - **Consulta de Pedido Web:** Al pulsar 'Consultar Pedido', solicita el Nombre y Número de celular con el que se registró en la web; al recibirlos, pausa el bot y notifica a cocina/admin para verificación humana en RestaurantPE.
    - **Registro de Datos al Final del Pedido (Fase 2):** Los datos personales (Nombre, Apellido y Número de celular) se solicitan ÚNICAMENTE al terminar de definir los productos que desea pedir (tras confirmar que no agregará más productos a su orden con *"No / Solo eso"*). Al brindarlos, se guardan permanentemente en `clientes.json` asociados a su número de WhatsApp para futuros pedidos.
    - **Consultas sobre Productos:** Respuestas breves, directas y concisas (máximo 2 a 3 líneas) sobre ingredientes, endulzantes, leche o tamaños.
