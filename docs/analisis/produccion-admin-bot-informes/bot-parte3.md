---
id: ANA-CAP-048
tipo: analisis
titulo: "INFORME TECNICO Y DE NEGOCIO: TIENDA WEB ANTIGUA, BOT DE TELEGRAM Y ESTRUCTURA DE CLIENTES FRENTE AL MOCKUP DE CAPRICHOS"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, produccion-admin-bot-informes]
---

# INFORME TECNICO Y DE NEGOCIO: TIENDA WEB ANTIGUA, BOT DE TELEGRAM Y ESTRUCTURA DE CLIENTES FRENTE AL MOCKUP DE CAPRICHOS

## 1. Resumen Ejecutivo y Enfoque del Analisis

El presente documento constituye la tercera parte de la evaluacion tecnica y de negocio sobre los desarrollos de software reales de la cafeteria Caprichos, contrastandolos contra los prototipos del sistema administrativo (`fuente/Admin.dc.html`), la carta web (`fuente/Main.dc.html`) y las actas de descubrimiento con el cliente Kevin Rosales (`fuente/acta-01-descubrimiento.md` y `fuente/acta-02-descubrimiento.md`).

El foco central de esta entrega comprende:
1. Las reglas de negocio codificadas en la tienda web previa del cliente (`bot/index.html` y los modulos en `bot/js/`: `app.js`, `cart.js`, `checkout.js`, `map.js`, `menu-data.js`, `zones.js`).
2. La arquitectura y logica operativa del bot de Telegram (`bot/bot.py`, `bot/client_db.py`, `bot/geo_utils.py` y `bot/sheet_sync.py`).
3. La estructura de los datos de cliente almacenados en disco y en el navegador, analizando los campos sin exponer datos personales ni valores sensibles.
4. La comparacion directa con nuestra carta web (`fuente/Main.dc.html`) y el panel administrativo (`fuente/Admin.dc.html`), identificando que reglas, textos o detalles de la tienda vieja deben conservarse o faltan en el mockup.
5. La deteccion pormenorizada de discrepancias de precios, opciones y catalogo entre `menu-data.js`, `menu_dinamico.txt` y nuestra carta web, ilustradas con ejemplos explicitos.

Conforme a las directrices metodologicas del proyecto, se omite cualquier uso de emojis, se clasifican los hallazgos entre confirmados en codigo/acta o suposiciones, y se detalla ubicacion, impacto para el negocio gastronomico y prioridad.

---

## 2. Reglas de Negocio de la Tienda Web Vieja (index.html y bot/js/)

La tienda web antigua corresponde a una aplicacion web monopoagina (SPA) disenada para navegadores moviles y de escritorio, orientada a la conversion rapida mediante la emision automatica de comandas hacia la API de WhatsApp (`https://wa.me/`). A continuacion se detallan sus reglas de negocio nucleares.

### 2.1. Gestion del Carrito de Compras (cart.js)
- Regla y Funcionamiento:
  - Clase `CartManager` persistida en el navegador bajo la clave `caprichos_cart_v1` en `localStorage`.
  - Agrupacion por Hash Unico (`generateItemHash`): Un producto no se agrupa con otro solo por su identificador. El sistema construye una firma digital uniendo: `productId`, `size.name`, `milk.id`, `sweetener.id`, la lista ordenada de identificadores de toppings `toppings.map(t => t.id).sort().join(',')`, y las notas de preparacion `notes.trim().toLowerCase()`. Si el cliente pide dos frappés iguales pero uno "sin azucar" y el otro "con azucar", o uno "con leche sin lactosa" y otro "con almendras", el carrito los separa en tarjetas independientes.
  - Modificacion de cantidades: Permite incremento y decremento unitario mediante `updateQuantity`. Si la cantidad llega a cero, el item se autoelimina.
  - Vaciado total mediante `clear`.
  - Subtotal: Suma matematica estricta de `unitPrice * quantity` de cada item. El precio unitario ya incluye los recargos acumulados de tamaño, tipo de leche y toppings adicionales seleccionados en el modal.
- Donde esta: `bot/js/cart.js` (clase `CartManager`, metodos `generateItemHash`, `addItem`, `updateQuantity`, `getSubtotal`).
- Por que importa para una cafeteria: En cafeterias artesanales, las bebidas personalizadas son criticas. Si el carrito agrupa por error un cafe con leche deslactosada junto a uno con leche entera, el cliente recibe un producto que puede generarle problemas de salud (alergias o intolerancias).
- Clasificacion: CONFIRMADO en el codigo de `cart.js`.
- Prioridad: Alta.

### 2.2. Regla de Delivery Gratis y Umbral de Consumo
- Regla y Funcionamiento:
  - En `cart.js` (metodo `getEffectiveDeliveryCost`), el delivery tiene un costo base asignado por la zona geoespacial (por defecto S/ 3.00 si no se ha fijado ubicacion).
  - Si la modalidad elegida es `recojo`, el flete es estrictamente S/ 0.00.
  - Si la modalidad es `delivery`, se valida: si el subtotal de productos consumidos es mayor o igual a S/ 70.00 (`subtotal >= 70.0 && subtotal > 0`), el costo de delivery se bonifica al 100%, retornando S/ 0.00.
  - Aviso dinámico en el footer (`updateCartUI` en `app.js`): Si el cliente tiene modalidad delivery y su subtotal es menor a S/ 70.00, se despliega una barra con el calculo exacto del faltante: "Agrega S/ [70 - subtotal] mas para tener Delivery GRATIS". Si alcanza o supera los S/ 70.00, la barra cambia a: "Felicidades! Tienes Delivery GRATIS en este pedido".
  - En la tienda web vieja NO existe bloqueo de pedido si no llega a S/ 14.50 (esta restriccion de minimo si existe en el bot y en el mockup, pero en la tienda web vieja se omitio el bloqueo de checkout para pedidos pequeños).
- Donde esta: `bot/js/cart.js` (`getEffectiveDeliveryCost`, `isFreeDelivery`) y `bot/js/app.js` (`updateCartUI`).
- Por que importa para una cafeteria: Es la palanca de incremento de ticket promedio mas efectiva. Motiva al cliente a sumar un postre de S/ 7.50 o S/ 9.50 para evitar pagar el flete de S/ 3.00 o S/ 5.00.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Alta.

### 2.3. Formulario de Checkout y Captura de Datos (checkout.js e index.html)
- Regla y Funcionamiento:
  - Selector excluyente de modalidad: `delivery` o `recojo`. Al pulsar `recojo`, el formulario oculta completamente el bloque del mapa, direccion y referencia, y muestra una caja informativa con el horario del local (2:00 pm a 10:00 pm) y costo de envio S/ 0.00. Al volver a `delivery`, reactiva el mapa y fuerza la invalidacion del tamano de Leaflet (`map.invalidateSize()`).
  - Campos obligatorios:
    - Nombres y Apellidos (`client-name`): Obligatorio.
    - Celular / WhatsApp (`client-phone`): Obligatorio, validado con formato de 9 digitos peruanos (remueve caracteres no numericos y el prefijo de pais "51" si el usuario lo digita).
    - Direccion exacta (`client-address`): Obligatorio solo si la modalidad es delivery.
    - Referencia de entrega (`client-reference`): Opcional.
  - Persistencia de datos del cliente: Casilla de verificacion marcada por defecto: "Guardar mis datos en este dispositivo para futuros pedidos". Al enviar la orden, si esta marcada, guarda un objeto JSON en `localStorage` bajo la clave `caprichos_customer_v1`. Al abrir la pagina en visitas futuras, rellena automaticamente nombre, celular, direccion y referencia.
  - Seleccion de Metodo de Pago:
    - Cuatro opciones visuales: Yape, Plin, Transferencia (BCP/BBVA) y Efectivo (contra entrega).
    - Regla de vuelto para Efectivo: Si el usuario selecciona "Efectivo", la interfaz despliega un campo numerico interactivo: "¿Con cuanto pagaras para tu vuelto? Ej: 50". Si el usuario ingresa un importe, este dato se incorpora explicitamente al ticket de compra.
- Donde esta: `bot/index.html` (lineas de formulario de checkout), `bot/js/checkout.js` (`setupListeners`, `loadCustomerData`, `saveCustomerData`).
- Por que importa para una cafeteria: En repartos a domicilio, la falta de cambio en efectivo para billetes de S/ 50 o S/ 100 ocasiona que los motorizados se queden varados buscando cambio en bodegas, retrasando todas las entregas posteriores.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Alta.

### 2.4. Generacion y Formateo del Mensaje de WhatsApp (checkout.js)
- Regla y Funcionamiento:
  - Al pulsar el boton "Enviar Pedido a WhatsApp", el sistema ejecuta `buildWhatsAppMessage()` y abre la URL `https://wa.me/{telefono}?text={mensaje_codificado}` en una pestaña nueva.
  - Estructura exacta del mensaje armado:
    1. Cabecera institucional: `*¡HOLA CAPRICHOS! DESEO REALIZAR UN PEDIDO:*`
    2. Detalle de productos (` *DETALLE DEL PEDIDO:*`):
       - Cantidad y nombre del producto con su tamaño entre parentesis: `• *{cant}x {nombre}* ({tamano})`.
       - Tipo de leche si aplica: `- Leche: {nombre}`.
       - Endulzante si aplica: `- Endulzante: {nombre}`.
       - Lista de toppings si fueron agregados: `- Toppings: {topping1, topping2}`.
       - Notas especiales si se redactaron: `- Nota especial: {notes}`.
       - Subtotal de la linea: `- Subtotal: S/ {precio * cantidad}`.
    3. Resumen financiero (` *RESUMEN DE CUENTA:*`):
       - `- Subtotal productos: S/ {subtotal}`.
       - Si es delivery y califica a gratis: `- Costo de Delivery: ¡GRATIS! (Promo compras > S/ 70)`.
       - Si es delivery con cobro: `- Costo de Delivery: S/ {fee} ({zona})`.
       - Si es recojo: `- Modalidad: Recojo en Tienda (S/ 0.00)`.
       - Total a pagar en negrita: `* TOTAL A PAGAR: S/ {total}*`.
    4. Datos del comensal (` *DATOS DEL CLIENTE:*`):
       - `- Nombre: {nombre}`.
       - `- Celular: {telefono}`.
       - Si es delivery: Modalidad a domicilio, direccion, referencia y el enlace exacto a Google Maps: `-  *Ubicación GPS:* https://maps.google.com/?q={lat},{lng}`.
       - Si es recojo: `- Modalidad: Recojo en Tienda Caprichos (2:00 pm - 10:00 pm)`.
    5. Metodo de pago:
       - ` *MÉTODO DE PAGO:* {Metodo}` (y si es Efectivo: `(Paga con: S/ {monto})`).
    6. Frase de cierre formal: `_Por favor confírmenme el pedido para enviarles la captura del pago y coordinar el despacho. ¡Muchas gracias!_`.
  - Herramienta Tester de WhatsApp: El header incluye un boton con icono de engranaje (`btn-open-wa-tester`) que abre un modal permitiendo sustituir en caliente el numero oficial de Caprichos (`51977503006`) por cualquier otro numero para pruebas operativas de desarrollo.
- Donde esta: `bot/js/checkout.js` (metodos `buildWhatsAppMessage`, `sendToWhatsApp`, `setCustomWhatsAppNumber`) y `bot/index.html`.
- Por que importa para una cafeteria: Elimina friccion humana. La orden entra completamente estructurada a la bandeja de entrada de WhatsApp, lista para ser leida por el bot o por una operadora sin repreguntar datos basicos.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Alta.

### 2.5. Mapa Interactivo y Geolocalizacion (map.js)
- Regla y Funcionamiento:
  - Integra la libreria Leaflet v1.9.4 sobre capas de teselas de OpenStreetMap (`tileLayer`).
  - Coordenadas de origen de la cafeteria Caprichos: Latitud `-12.0188`, Longitud `-76.9645` (San Juan de Lurigancho).
  - Marcador de la tienda: Marcador fijo con popup que informa el horario de atencion (2:00 pm a 10:00 pm).
  - Marcador del cliente: Marcador interactivo y arrastrable (`draggable: true`). El usuario puede arrastrar el pin o tocar cualquier punto del mapa para fijar su domicilio exacto.
  - Geocodificacion inversa automatica (Reverse Geocoding): Al cambiar la posicion del pin, invoca al API publica de Nominatim OpenStreetMap (`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat={lat}&lon={lng}`) y autocompleta el campo de texto de direccion (`client-address`) con el nombre de calle y numero aproximado, respetando si el usuario ya habia escrito manualmente su direccion (`data-manual="true"`).
  - Geolocalizacion por hardware: Boton "Usar mi ubicacion actual GPS" que invoca `navigator.geolocation.getCurrentPosition` con `enableHighAccuracy: true` y vuela con animacion suave (`map.flyTo`) al punto detectado.
  - Enlace externo de verificacion: Genera dinamicamente un enlace directo a Google Maps (`https://maps.google.com/?q={lat},{lng}`) para que el cliente o el repartidor lo abran con un solo toque.
- Donde esta: `bot/js/map.js` (clase `DeliveryMapManager`, metodos `init`, `handleLocationChanged`, `reverseGeocode`, `useCurrentGPS`).
- Por que importa para una cafeteria: En distritos populosos como San Juan de Lurigancho, los nombres de calles o avenidas suelen repetirse o carecer de numeracion visible en fachada; el pin GPS garantiza que el motorizado llegue al punto geografico exacto.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Alta.

### 2.6. Motor de Zonas y Tarificacion Geoespacial en JavaScript (zones.js)
- Regla y Funcionamiento:
  - Almacena internamente en la variable `CAPRICHOS_GEOJSON` una coleccion FeatureCollection de poligonos vectoriales correspondientes a San Juan de Lurigancho y alrededores.
  - Algoritmo Ray-Casting (`isPointInPolygon`): Evalua algebraicamente la interseccion de rayos horizontales para determinar si el par de coordenadas `[lng, lat]` cae dentro de las coordenadas perimetrales de cada zona.
  - Jerarquia de Zonas y Precios:
    - Zona Z2: Costo S/ 2.00 (Tarifa reducida, color verde `#10b981`).
    - Zona Z3: Costo S/ 3.00 (Tarifa estandar central y Sector Este, color celeste `#0ea5e9`).
    - Zona Z4: Costo S/ 4.00 (Zona intermedia, color morado `#6366f1`).
    - Zona Z5: Costo S/ 5.00 (Zona ampliada, color naranja `#f59e0b`).
    - Zona Z7: Costo S/ 7.00 (Sector extendido, color rojo `#f43f5e`).
  - Tratamiento de "Fuera de Zona": Si las coordenadas no caen en ninguno de los poligonos delimitados, `evaluateDeliveryLocation` no bloquea la compra; retorna `inside: false`, etiqueta `Fuera de Cobertura Directa`, costo referencial de S/ 5.00 y un mensaje aclaratorio indicando que podra coordinar el envio especial por WhatsApp.
- Donde esta: `bot/js/zones.js` (`CAPRICHOS_GEOJSON`, `isPointInPolygon`, `evaluateDeliveryLocation`).
- Por que importa para una cafeteria: Proporciona tarificacion justa y transparente en milisegundos sin requerir llamadas costosas a APIs de Google Maps Distance Matrix.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Alta.

### 2.7. Opciones de Personalizacion y Catalogo Web (app.js y menu-data.js)
- Regla y Funcionamiento:
  - Categorias de navegacion: Calientes, Frappés, Iced & Frozen, Salados, Croissants, Waffles, Postres, y Promos & Combos.
  - Buscador reactivo en tiempo real: Filtra instantaneamente por nombre, descripcion o etiqueta de categoria.
  - Modal de producto con logica condicional segun flags del item:
    - Tamaños (`sizes`): Botones de seleccion exclusiva (Regular, Grande, Extra con sus precios respectivos).
    - Tipo de Leche (`allowsMilk`): Opciones Leche Entera (+S/ 0), Leche Sin Lactosa (+S/ 0), Leche de Almendras (+S/ 2.50).
    - Endulzante (`allowsSweetener`): Azucar Blanca (+S/ 0), Stevia Natural (+S/ 0), Sin Azucar (+S/ 0).
    - Toppings y Extras para Frappés (`allowsFrappeCustom`): Botones de seleccion multiple acumulativa: Topping Estandar (+S/ 0), Extra Oreo (+S/ 1.00), Extra Chispas (+S/ 1.00), Extra Chin Chin (+S/ 1.00), Extra Almendra (+S/ 1.00), Chantilly Extra (+S/ 2.00).
    - Instrucciones especiales (`notes`): Textarea libre ("Ej: poco hielo, helado aparte, sin cafe...").
    - Contador de unidades interactivo (- / +) que recalcula en tiempo real el precio total del boton "Agregar al Carrito".
- Donde esta: `bot/js/app.js` (`openProductModal`, `calculateModalUnitPrice`, `updateModalTotal`) y `bot/js/menu-data.js` (`BEVERAGE_CUSTOM_OPTIONS`).
- Por que importa para una cafeteria: Permite que el comensal configure su bebida con la misma libertad que en el mostrador fisico.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Alta.

---

## 3. Reglas de Negocio del Bot de Telegram (bot.py)

El archivo `bot/bot.py` es una implementacion completa de un bot conversacional para Telegram basado en `python-telegram-bot`, `AsyncOpenAI` (GPT-4o-mini), analisis geoespacial con `shapely` y vision artificial para vouchers bancarios. Sus reglas de negocio comprenden:

### 3.1. Agrupador de Mensajes y Debouncer (10 Segundos)
- Regla y Funcionamiento:
  - En Telegram los usuarios suelen enviar ideas en varias lineas cortas sucesivas.
  - La variable global `DEBOUNCE_DELAY = 10.0` establece una ventana de espera de 10 segundos.
  - Cada mensaje recibido cancela la tarea asincrona previa (`tg_user_debounce_tasks[chat_id].cancel()`) y acumula el texto en `tg_user_buffers[chat_id]`.
  - Recien al transcurrir 10 segundos continuos sin nuevos mensajes, se consolida todo el contenido y se envia a OpenAI en una sola llamada de inferencia.
- Donde esta: `bot/bot.py` (`DEBOUNCE_DELAY`, `process_debounced_messages_tg`, `add_to_user_buffer_tg`).
- Por que importa para una cafeteria: Reduce drásticamente la latencia de respuestas interrumpidas y ahorra costos de API de OpenAI.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Alta.

### 3.2. Sincronizacion de Carta Dinamica mediante Excel (/actualizar)
- Regla y Funcionamiento:
  - Consume el archivo de texto `menu_dinamico.txt` generado por `sheet_sync.py` a partir de un libro XLSX de Google Sheets.
  - La funcion `load_dynamic_menu` sustituye la etiqueta `{menu_texto}` dentro del `SYSTEM_PROMPT` cargado en memoria RAM.
  - El bot implementa el comando de administracion `/actualizar` (`cmd_actualizar`). Al ejecutarlo en Telegram, recarga la carta desde el archivo de texto al prompt del modelo sin requerir reinicio del proceso ni del servidor.
- Donde esta: `bot/bot.py` (`load_dynamic_menu`, `cmd_actualizar`) y `bot/sheet_sync.py`.
- Por que importa para una cafeteria: Permite que el dueño o administrador actualice precios de inmediato cuando suben los insumos o desactive productos agotados en tiempo real.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Media.

### 3.3. Catalogo de Imagenes Referenciales y Herramienta enviar_foto_producto
- Regla y Funcionamiento:
  - Dispone de un diccionario `PRODUCT_IMAGE_MAP` con mas de 60 mapeos de nombres y sinonimos hacia archivos de imagen ubicados en la carpeta `assets/` (waffles, frappés, bebidas calientes, salados, croissants, postres, combos, cajita caprikids y termos).
  - La funcion `find_product_image` ejecuta una busqueda en tres niveles: busqueda exacta normalizada, busqueda por subcadena, y escaneo directo de nombres de archivo en disco.
  - Define la herramienta para OpenAI `enviar_foto_producto`. Cuando el cliente solicita ver fotos de un producto, la IA invoca la herramienta y el bot envia la imagen correspondiente al chat.
- Donde esta: `bot/bot.py` (`PRODUCT_IMAGE_MAP`, `find_product_image`, definicion de herramienta `enviar_foto_producto`).
- Por que importa para una cafeteria: En el rubro de pasteleria y cafeteria, el apetito entra por los ojos; mostrar fotos de waffles o frappés eleva la tasa de conversion.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Media.

### 3.4. Evaluacion de Horario Comercial y Aviso en Primer Mensaje
- Regla y Funcionamiento:
  - Valida la hora en la zona horaria oficial de Peru (`America/Lima`).
  - La tienda y despachos atienden de 2:00 PM a 10:00 PM (`14 <= now.hour < 22`).
  - Si el cliente escribe fuera de ese rango (madrugada o manana), el bot inyecta una directiva de sistema: si es el primer mensaje de la sesion, debe advertir obligatoriamente que el horario de atencion y reparto inicia a las 2:00 PM, pero no rechaza la recepcion de la comanda.
- Donde esta: `bot/bot.py` (`get_ai_response`, bloque `contexto_horario`).
- Por que importa para una cafeteria: Informa con claridad sobre tiempos de entrega sin frustrar ventas anticipadas.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Alta.

### 3.5. Memoria de Clientes Frecuentes y Tarifas Silenciosas
- Regla y Funcionamiento:
  - Consulta `client_db.py` al recibir el primer mensaje de un usuario.
  - Si el cliente ya existe en `clientes.json`, inyecta en el prompt: nombre, celular y total de pedidos aprobados, prohibiendo terminantemente volver a preguntarle su nombre o numero.
  - Regla de tarifas silenciosas: Si el registro del cliente contiene `costo_delivery_fijo` (ej. S/ 2.50) o `descuento_delivery` (ej. 0.50 para 50%), la funcion `get_client_delivery_cost` sobreescribe el costo calculado por el mapa y cotiza directamente la tarifa preferencial sin anunciarle que tiene un descuento.
- Donde esta: `bot/bot.py` (en `get_ai_response`, `handle_message`, `handle_location`) y `bot/client_db.py` (`get_client_delivery_cost`).
- Por que importa para una cafeteria: Agiliza la atencion y premia a clientes frecuentes o empresas cercanas sin alterar la carta publica.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Alta.

### 3.6. Control Dinamico de Stock: Pack Amarillo
- Regla y Funcionamiento:
  - Implementa la funcion `check_pack_amarillo_registered(chat_id)` que revisa en el historial de la conversacion si el usuario ya tenia reservado o acordado previamente el Pack Amarillo (promocion conmemorativa).
  - Si ya tenia registro previo: permite continuar coordinando detalles y pago sin cancelarlo.
  - Si NO tenia registro previo: inyecta directiva de sistema declarando la promocion totalmente agotada por alta demanda, prohibiendo anadirla al calculo matematico o invocar reservas.
- Donde esta: `bot/bot.py` (`check_pack_amarillo_registered`, directiva `contexto_promo_pack`).
- Por que importa para una cafeteria: Permite gestionar contingencias de stock agotado en campanas de alta afluencia (San Valentin, Dia de la Madre o flores amarillas) sin dejar colgados a quienes ya habian reservado.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Media.

### 3.7. Analisis Geoespacial y Extraccion Polivalente de Coordenadas
- Regla y Funcionamiento:
  - Soporta ubicacion geografica nativa de Telegram (`filters.LOCATION`).
  - Soporta extraccion por texto mediante `extract_coordinates_from_text`:
    1. Formato sexagesimal (grados, minutos, segundos en `parse_dms_coordinates`).
    2. Enlaces cortos de Google Maps (`maps.app.goo.gl`): Realiza una peticion HTTP con `httpx` siguiendo redirecciones (`follow_redirects=True`) para resolver la URL extendida y extraer las coordenadas.
    3. Patrones de coordenadas decimales en URL (`@lat,lon`, `search/lat,lon`, `q=lat,lon`, `!3dlat!4dlon`).
  - Invoca `calculate_delivery_cost` en `geo_utils.py` con `shapely`.
  - Si retorna `-1` (fuera de zona): Inyecta al sistema la instruccion obligatoria de informar amablemente que la direccion queda fuera de cobertura y ofrecer la alternativa de Recojo en Tienda.
- Donde esta: `bot/bot.py` (`extract_coordinates_from_text`, `parse_dms_coordinates`, `handle_location`, `handle_message`) y `bot/geo_utils.py`.
- Por que importa para una cafeteria: Elimina friccion cuando el cliente pega un enlace corto o escribe coordenadas en lugar de adjuntar la ubicacion nativa.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Alta.

### 3.8. Herramienta de Calculo Matematico y Delivery Gratis (calcular_total_pedido)
- Regla y Funcionamiento:
  - Define la funcion herramienta `calcular_total_pedido` para OpenAI.
  - La IA no calcula totales sumando texto; esta obligada a invocar esta herramienta pasando una lista estructurada de items (nombre, precio unitario, cantidad) y el costo de delivery.
  - La herramienta ejecuta la multiplicacion y suma matematica.
  - Regla de Delivery Gratis: Si la suma de productos supera los S/ 70.00 (`subtotal_productos > 70`), el costo de delivery se fija en 0.00 y se adjunta la leyenda: "- Delivery = S/ 0.00 (¡GRATIS por compra mayor a S/ 70!)".
- Donde esta: `bot/bot.py` (definicion y bloque de ejecucion de `calcular_total_pedido`).
- Por que importa para una cafeteria: Los LLM tienden a cometer errores aritmeticos basicos al sumar decimales; forzar el calculo determinista en Python previene cobros errados al comensal.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Alta.

### 3.9. Filtro de Seguridad Anti-Repeticion de Enlace Web
- Regla y Funcionamiento:
  - En `get_ai_response`, si la conversacion ya cuenta con un mensaje previo del asistente, inyecta una instruccion de sistema prohibiendo volver a enviar el enlace a la carta web (`https://caprichos.restaurant.pe`).
  - Como salvaguarda adicional de codigo, antes de devolver la respuesta generada por OpenAI, inspecciona si contiene la URL de la web. Si la contiene habiendose enviado antes, sobreescribe la respuesta con un texto cordial ofreciendo atender el pedido directamente por chat o compartir el catalogo de WhatsApp (`https://wa.me/c/51977503006`).
- Donde esta: `bot/bot.py` (lineas de sanitizacion en `get_ai_response`).
- Por que importa para una cafeteria: Evita que el bot parezca un disco rayado repitiendo enlaces que el cliente ya vio o no desea usar.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Media.

### 3.10. Modo de Contingencia por Corte de Energia
- Regla y Funcionamiento:
  - Variables `SPECIAL_NOTICE_DATE`, `SPECIAL_NOTICE_TEXT` y archivo de registro `special_notice_notified_tg.json`.
  - Si la fecha actual coincide con el dia de la contingencia, al recibir el primer mensaje del cliente le envia por unica vez la foto `corte_luz.jpg` con el comunicado oficial y silencia el bot para ese usuario por el resto del dia.
- Donde esta: `bot/bot.py` (`is_special_notice_active`, `process_debounced_messages_tg`).
- Por que importa para una cafeteria: Gestiona imprevistos distritales de luz o agua sin que el personal deba contestar individualmente a decenas de personas.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Baja.

### 3.11. Vision Artificial para Vouchers y Extraccion Financiera
- Regla y Funcionamiento:
  - Cuando el cliente envia una foto (`MessageHandler(filters.PHOTO)`), el bot descarga los bytes del archivo, los codifica en base64 y los somete a GPT-4o-mini con instruccion de extraccion OCR.
  - La IA extrae: Monto pagado, Numero/Codigo de Operacion, y Fecha y Hora de la transaccion.
  - Estos datos se almacenan en el contexto para inyectarse directamente en el ticket final.
- Donde esta: `bot/bot.py` (`handle_photo`, `get_ai_response` en bloque `is_photo`).
- Por que importa para una cafeteria: Ahorra el tipeo manual del numero de operacion en caja.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Alta.

### 3.12. Compuerta de Validacion del Pedido (is_order_ready_for_telegram_tg)
- Regla y Funcionamiento:
  - Para evitar enviar tickets incompletos al grupo de administradores, la funcion `is_order_ready_for_telegram_tg` impone tres condiciones programaticas indispensables:
    1. La respuesta del bot debe contener frases de confirmacion ("pedido registrado" o "area encargada" con "validacion").
    2. El historial debe registrar la ejecucion exitosa de la herramienta `calcular_total_pedido` con el texto "total exacto a pagar".
    3. Si el pedido es para Delivery, es OBLIGATORIO que se haya recibido la ubicacion GPS (`chat_id in user_gps`); si no hay coordenadas, el envio a validacion queda estrictamente bloqueado.
- Donde esta: `bot/bot.py` (`is_order_ready_for_telegram_tg`).
- Por que importa para una cafeteria: Evita que entren ordenes de delivery a cocina sin direccion ni coordenadas para el repartidor.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Alta.

### 3.13. Flujo de Aprobacion y Rechazo con Botones Interactivos en Telegram
- Regla y Funcionamiento:
  - Genera el ticket con `generate_kitchen_ticket` y lo envia al canal o grupo administrativo (`GRUPO_PEDIDOS_ID`) acompanado de botones inline: `[Aprobar Pedido]` (`approve_{chat_id}`) y `[Rechazar (Monto Invalido)]` (`reject_{chat_id}`).
  - El cliente queda pausado en `pending_validation_users_tg` para que el bot no le responda mientras el personal valida la transaccion.
  - Si el administrador pulsa `Aprobar`:
    - Incrementa el contador de pedidos aprobados en `clientes.json` (`increment_approved_order_count`).
    - Actualiza el mensaje en el grupo de administracion a: "PEDIDO APROBADO (Pedido N° X de este cliente)".
    - Envia al cliente el mensaje oficial: si es delivery, "En un plazo aprox a 30 - 45 mnts. estara llegando su pedido..."; si es recojo, "Le avisaremos por aqui cuando su pedido este listo para su recojo".
    - Envia la ubicacion GPS nativa al grupo de pedidos para que el motorizado la use con Google Maps o Waze.
  - Si el administrador pulsa `Rechazar`:
    - Actualiza el mensaje en el grupo a "PEDIDO RECHAZADO".
    - Notifica al cliente: "lamentablemente hemos encontrado un problema con la validacion de su pago (el monto no coincide o no se pudo verificar)...".
- Donde esta: `bot/bot.py` (`check_and_send_ticket`, `button_callback`).
- Por que importa para una cafeteria: Otorga control financiero absoluto y sincroniza a cocina y delivery con la aceptacion real del pago.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Alta.

### 3.14. Reseteo por Inactividad (Timeout de 3 Horas)
- Regla y Funcionamiento:
  - `SESSION_TIMEOUT_HOURS = 3` (10,800 segundos).
  - Si un usuario deja de interactuar por mas de 3 horas, el sistema limpia su sesion en RAM, sus coordenadas temporales y lo despausa si habia quedado bloqueado, iniciando una conversacion limpia en su siguiente contacto.
- Donde esta: `bot/bot.py` (`get_ai_response`, evaluacion de `SESSION_TIMEOUT_SECONDS`).
- Por que importa para una cafeteria: Previene que pedidos inconclusos del dia anterior se mezclen con pedidos de un nuevo dia.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Media.

---

## 4. Estructura de Datos de Cliente Almacenados (Sin Valores Sensibles)

A continuacion se documenta la estructura formal de los datos de cliente recopilados por el software del negocio, analizando unicamente los nombres de campos y tipos de datos, sin reproducir valores reales ni informacion confidencial.

### 4.1. Base de Datos del Bot: clientes.json (client_db.py)
El archivo `clientes.json` opera como un diccionario clave-valor donde la clave principal de busqueda es el numero telefonico limpio (`phone_key`, tipo string). Cada entrada contiene los siguientes campos:

| Campo | Tipo | Descripcion Funcional |
| :--- | :--- | :--- |
| `nombre` | string | Nombre y apellido proporcionado por el comensal. Por defecto toma el valor generico "Cliente Caprichos". |
| `celular` | string | Numero telefonico de contacto asociado. |
| `total_pedidos_aprobados` | integer | Contador incremental de pedidos efectivamente aprobados por administracion. Se inicia en 0 y sube en 1 con cada aprobacion. |
| `fecha_registro` | string (formato `YYYY-MM-DD HH:MM:SS`) | Marca temporal de la creacion del registro. |
| `ultima_ubicacion` | dictionary | Objeto con coordenadas GPS (`lat`: float, `lon`: float). |
| `costo_delivery_fijo` | float (opcional) | Tarifa plana personalizada asignada a clientes corporativos o VIP (ej. 2.50). |
| `descuento_delivery` | float (opcional) | Fraccion decimal de descuento sobre la tarifa de envio calculada (ej. 0.50 para 50%). |

### 4.2. Almacenamiento Local de la Tienda Web: caprichos_customer_v1
En el navegador del cliente, la tienda web vieja persiste un objeto JSON en `localStorage` bajo la clave `caprichos_customer_v1`:

| Campo | Tipo | Descripcion Funcional |
| :--- | :--- | :--- |
| `name` | string | Nombre completo ingresado en el formulario. |
| `phone` | string | Numero de celular depurado a 9 digitos peruanos. |
| `address` | string | Direccion de entrega escrita o autocompletada por geocodificacion inversa. |
| `reference` | string | Referencias de fachada, piso o timbre. |

### 4.3. Almacenamiento de Items del Carrito: caprichos_cart_v1
En `localStorage` bajo la clave `caprichos_cart_v1`, el carrito guarda una lista de objetos correspondientes a los productos seleccionados:

| Campo | Tipo | Descripcion Funcional |
| :--- | :--- | :--- |
| `cartId` | string | Identificador unico del item en sesion (`item_{timestamp}_{random}`). |
| `hash` | string | Firma de personalizacion (`productId|size|milk|sweetener|toppings|notes`). |
| `productId` | string | Codigo del producto en catalogo. |
| `name` | string | Nombre comercial del producto. |
| `category` | string | Categoria a la que pertenece. |
| `image` | string | Ruta relativa del archivo de imagen. |
| `size` | object o null | Objeto con `name` (string) y `price` (float). |
| `milk` | object o null | Objeto con `id`, `name` y `price` adicional. |
| `sweetener` | object o null | Objeto con `id` y `name`. |
| `toppings` | array de objetos | Lista de toppings agregados con `id`, `name` y `price`. |
| `notes` | string | Texto de especificaciones de cocina ingresadas por el cliente. |
| `unitPrice` | float | Precio unitario final calculado. |
| `quantity` | integer | Cantidad de unidades. |

### 4.4. Comparativa con el Modelo de Clientes del Mockup (Admin.dc.html)
En el mockup administrativo (`fuente/Admin.dc.html`), los clientes se gestionan en la vista `clientes` mediante la funcion `cliRows()`, con la siguiente estructura:
- `dni`: Documento Nacional de Identidad (enmascarado en la vista publica).
- `name`: Nombre y apellido.
- `tipo`: Clasificacion entre `cliente` y `trabajador`.
- `tel`: Telefono de contacto.
- `email`: Correo electronico para envio de promociones y estado de cuenta.
- `bday`: Fecha de cumpleanos (usado para el beneficio de cumpleanero).
- `pedidos`: Cantidad total de compras historicas.
- `points`: Saldo acumulado de puntos de fidelizacion (1 punto por cada S/ 1.00 consumido).
- `cred`: Booleano que indica si tiene linea de credito activa (habilitado exclusivamente para trabajadores).

Diferencias y vacios clave frente al bot real:
1. El mockup utiliza como identificador natural el `dni`, mientras que el bot real y la tienda web operan 100% sobre el `celular / WhatsApp`. En pedidos digitales por delivery, forzar al cliente a ingresar su DNI genera abandono de compra; el telefono es el identificador mas eficiente.
2. El mockup no registra coordenadas de geolocalizacion satelital (`ultima_ubicacion`) asociadas a la ficha del cliente.
3. El mockup carece de los campos para tarifas silenciosas de delivery (`costo_delivery_fijo` y `descuento_delivery`).

---

## 5. Comparativa Critica: Que Conviene Conservar o Falta en la Carta Web (Main.dc.html) y Admin

Al contrastar la carta web en desarrollo (`fuente/Main.dc.html`) y el panel administrativo (`fuente/Admin.dc.html`) contra la tienda vieja y el bot, se identifican las siguientes oportunidades de mejora y funciones faltantes:

### 5.1. Envio de Comanda Completa a WhatsApp frente a Cierre Estatico
- Que tiene la tienda vieja: En `checkout.js` (`sendToWhatsApp`), compila la comanda completa con formato estructurado, lista de modificadores, coordenadas GPS, metodo de pago y vuelto, y abre la conversacion de WhatsApp mediante `https://wa.me/51977503006?text=...`.
- Que tiene nuestra carta web (`Main.dc.html`): En la funcion `placeOrder`, solo muestra un dialogo modal que dice: "Un asesor te escribirá por WhatsApp para confirmarlo y ver el pago" y cambia el estado a `overlay: 'done'`, sin invocar a WhatsApp ni generar el texto estructurado del pedido.
- Por que conviene conservar o incorporar: La apertura directa de WhatsApp con el mensaje preformateado garantiza que el pedido llegue instantaneamente al telefono del negocio sin requerir que la cafeteria implemente un sistema de mensajeria saliente automatizada o que un operador busque al cliente desde cero.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Alta.

### 5.2. Geocodificacion Inversa Automatica (Reverse Geocoding)
- Que tiene la tienda vieja: En `map.js` (`reverseGeocode`), utiliza Nominatim de OpenStreetMap para traducir la latitud y longitud seleccionadas por el pin a una direccion con nombre de calle y distrito, completando el campo `client-address` de forma automatica.
- Que tiene nuestra carta web (`Main.dc.html`): En `getPos`, extrae la latitud y longitud del navegador (`navigator.geolocation`), pero no resuelve la direccion textual; el cliente tiene que escribir obligatoriamente a mano el texto de su direccion en el campo `addr`.
- Por que conviene conservar o incorporar: Ahorra tiempo al usuario y evita errores tipograficos en el domicilio.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Media.

### 5.3. Barra de Progreso Motivacional para Delivery Gratis
- Que tiene la tienda vieja: En `app.js` (`updateCartUI`), muestra un aviso dinamico: "Agrega S/ [falta] mas para tener Delivery GRATIS".
- Que tiene nuestra carta web (`Main.dc.html`): Muestra una etiqueta estatica en el resumen: "Delivery gratis desde s/ 70". Si falta para el pedido minimo obligatorio de delivery muestra "Faltan s/ [X] para el pedido mínimo", pero no cuenta con la barra de upsell orientada a alcanzar los S/ 70.00.
- Por que conviene conservar o incorporar: Estimula la adicion de items de impulso (galletas de S/ 4.00, donas o bebidas) aumentando el margen bruto por pedido.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Alta.

### 5.4. Captura de Vuelto en Efectivo ("¿Con cuanto pagaras?")
- Que tiene la tienda vieja: En `index.html` y `checkout.js`, al marcar "Efectivo", despliega el campo `cash-amount-input` y envia en el ticket `(Paga con: S/ 50)`.
- Que tiene nuestra carta web (`Main.dc.html`): En la constante `PAYS` existe el metodo `Efectivo` y en el estado existe `cash` (`setCash`), pero no se traslada al ticket de WhatsApp saliente.
- Por que conviene conservar o incorporar: Es un detalle operativo indispensable para que el cajero entregue el vuelto exacto al motorizado antes de salir del local.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Alta.

### 5.5. Hashing de Items para Separar Personalizaciones en Carrito
- Que tiene la tienda vieja: La funcion `generateItemHash` en `cart.js` genera una firma basada en producto, tamaño, leche, endulzante, toppings y notas.
- Que tiene nuestra carta web (`Main.dc.html`): El carrito de `Main.dc.html` identifica items por su configuracion de opciones seleccionadas. Sin embargo, conviene verificar que las notas especiales de preparacion ("sin hielo", "bien caliente") tambien separen las lineas para que cocina distinga que una bebida lleva la especificacion y la otra no.
- Por que conviene conservar o incorporar: Asegura exactitud en el KDS de cocina y en el ticket de comanda.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Media.

### 5.6. Boton de Cambio de Numero para Pruebas (Tester de WhatsApp)
- Que tiene la tienda vieja: El modal `tester-modal` en `index.html` y `app.js` permite a cualquier evaluador o tester cambiar temporalmente el numero de recepcion de pedidos sin tocar una sola linea de codigo JavaScript.
- Que tiene nuestra carta web (`Main.dc.html`): El numero de WhatsApp proviene de la configuracion fija `INFO.whatsapp`.
- Por que conviene conservar o incorporar: Facilita enormemente las pruebas de homologacion con los duenos del restaurante sin saturar el numero oficial de produccion.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Baja.

### 5.7. Funciones del Bot Ausentes en el Mockup Administrativo
- Del bot de Telegram y WhatsApp destacan herramientas maduras que deben incorporarse al backend del sistema:
  1. Parser de formatos sexagesimales y expansor de enlaces cortos de Google Maps (`maps.app.goo.gl` con HTTP redirect).
  2. Configuracion de tarifas silenciosas por cliente (`costo_delivery_fijo` y `descuento_delivery`) en el modulo Clientes de `Admin.dc.html`.
  3. Modo de contingencia para avisos especiales por corte de energia o agua con silenciado temporal de notificaciones.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Media.

---

## 6. Discrepancias de Precios, Opciones y Catalogo entre Fuentes

A partir de la revision cruzada entre `bot/js/menu-data.js` (tienda vieja), `bot/menu_dinamico.txt` (sincronizado desde Google Sheets) y `fuente/Main.dc.html` (nuestra carta web), se identificaron discrepancias concretas que requieren atencion.

### 6.1. Tabla Resumen de Discrepancias Detectadas

| Producto / Opcion | En menu-data.js | En menu_dinamico.txt | En Main.dc.html | Estado / Analisis de Discrepancia |
| :--- | :--- | :--- | :--- | :--- |
| **Carrot Cake (Tortas Enteras)** | NO EXISTE (Solo tajada a S/ 8.00). | Entero clasico: S/ 59.00.<br>Entero cumpleañero: S/ 69.00. | Tajada: S/ 8.00.<br>Entero clasico: S/ 59.00.<br>Entero cumpleañero: S/ 69.00. | La tienda web vieja carecia de tortas enteras; `Main.dc.html` y `menu_dinamico.txt` coinciden en S/ 59 y S/ 69. |
| **Marmoleado Chips (Tortas Enteras)** | NO EXISTE (Solo tajada a S/ 8.00). | Entero clasico: S/ 59.00.<br>Entero cumpleañero: S/ 69.00. | Tajada: S/ 8.00.<br>Entero clasico: S/ 59.00.<br>Entero cumpleañero: S/ 69.00. | Idem anterior; tortas enteras faltaban en la tienda web antigua. |
| **Entremets y Tartaleta** | NO EXISTE. | S/ 9.50. | Unidad: S/ 9.50. | Omitido en la tienda web vieja; presente en hoja de calculo y en nuestra carta. |
| **Shots de Espresso Extra** | NO EXISTEN en los modales de bebidas. | 1 shot (34ml): S/ 0.00.<br>2 shots (68ml): S/ 2.00.<br>3 shots (102ml): S/ 4.00. | 1 shot extra: S/ 0.00.<br>2 shots extra: S/ 2.00.<br>3 shots extra: S/ 4.00. | La tienda web vieja no ofrecia shots extras en su modal; `Main.dc.html` y el bot si los integran. |
| **Toppings de Frappés** | Extra Oreo (+S/ 1.00), Chispas (+S/ 1.00), Chin Chin (+S/ 1.00), Almendra (+S/ 1.00), Chantilly (+S/ 2.00). | En seccion EXTRAS no lista los triturados individuales de S/ 1.00. | Chantilly (+S/ 2.00), Syrop cacao (+S/ 2.50), Syrop maracuya (+S/ 2.50), Syrop fresa (+S/ 2.00), Bola helado (+S/ 2.50). | Diferencia de modelo: la tienda vieja permitia toppings secos de S/ 1.00; `Main.dc.html` ofrece siropes y helado. |
| **Inconsistencia Leche de Almendras** | + S/ 2.50 en todas las bebidas. | En EXTRAS aparece listada a S/ 2.50 (lineas 97 y 102) y a S/ 3.00 (linea 116). | + S/ 2.50. | Error de tipeo en la hoja de calculo original del cliente; el precio real consolidado es S/ 2.50. |
| **Inconsistencia Chantilly** | Chantilly Extra: + S/ 2.00. | En EXTRAS aparece listado a S/ 2.00 (lineas 98 y 114) y a S/ 2.50 (linea 103). | Chantilly: + S/ 2.00. | Inconsistencia en la hoja de calculo; el valor oficial es S/ 2.00. |
| **Adicionales de Salados** | NO EXISTEN en la tienda web vieja (solo campo de notas). | Huevo (+S/ 2.00), Tocino (+S/ 2.00), Jamon (+S/ 1.00), Queso (+S/ 1.50), Carne (+S/ 9.50), Pollo (+S/ 7.50). | Huevo (+S/ 2.00), Tocino (+S/ 2.00), Jamon (+S/ 1.00), Queso (+S/ 1.50), Carne (+S/ 9.50), Pollo (+S/ 7.50). | La tienda web vieja no permitia cobrar adicionales en salados; `Main.dc.html` si lo implementa correctamente. |
| **Cremas para Salados** | NO EXISTEN (solo texto libre). | No figuran en el Excel. | Tartara (+S/ 0), Honey (+S/ 0), Aji amarillo (+S/ 0), Chimichurri (+S/ 0). | Mejora incorporada en `Main.dc.html` con base en el Acta 02. |
| **Nombre: Waffle Nutella** | Waffle Nutella (Entero S/ 21, Mitad S/ 15). | Nutella (Entero S/ 21, Mitad S/ 15). | NUTEWAFFLE (1/2: S/ 15, Completo: S/ 21). | Diferencia menor de nomenclatura comercial. Precios 100% coincidentes. |
| **Nombre: Latte Vainilla** | Latte Vainilla (12oz: 12, 16oz: 13.5, 20oz: 14.5). | Late Vainilla (12oz: 12, 16oz: 13.5, 20oz: 14.5). | LATTE VAINILLA (12oz: 12, 16oz: 13.5, 21oz: 14.5). | Error ortografico en Google Sheets ("Late"); corregido en el codigo. |
| **Umbral de Delivery Gratis** | `subtotal >= 70.0` (incluye S/ 70.00). | En prompts menciona "> 70". | `subtotal < Number(INFO.envioGratis)` (aplica gratis si subtotal >= 70). | En Python (`bot.py`) la condicion fue escrita como `subtotal_productos > 70`, lo que cobra delivery en S/ 70.00 exactos; en la web se usa `>= 70`. |

### 6.2. Analisis Detallado con Ejemplos Concretos

1. **El caso de las Tortas Enteras y Cumpleañeras:**
   - En `bot/js/menu-data.js`, el cliente solo podia comprar tajadas individuales: `pos-carrot-cake` a S/ 8.00 y `pos-keke-marmoleado` a S/ 8.00.
   - En cambio, tanto en `menu_dinamico.txt` como en `fuente/Main.dc.html`, estos productos ofrecen la presentacion de torta completa: Entero Clasico a S/ 59.00 y Entero Cumpleañero a S/ 69.00.
   - Conclusion: La carta web nueva (`Main.dc.html`) es superior a la tienda vieja porque permite la venta de tortas familiares y para eventos, las cuales representan el ticket individual mas alto de la pasteleria.

2. **Divergencia en el Grupo de Modificadores de Frappés:**
   - En la tienda web vieja (`BEVERAGE_CUSTOM_OPTIONS.toppings`), el cliente podia anadir toppings triturados por S/ 1.00 cada uno:
     - `extra_oreo`: Triturado de Oreo (+ S/ 1.00)
     - `extra_chispas`: Chispas de chocolate (+ S/ 1.00)
     - `extra_chinchin`: Mini Chin Chin (+ S/ 1.00)
     - `extra_almendra`: Almendra triturada (+ S/ 1.00)
   - En `Main.dc.html`, el grupo `TOPPINGS` no incluye los triturados secos de S/ 1.00, sino salsas liquidas y helado: Chantilly (+ S/ 2.00), Syrop de cacao (+ S/ 2.50), Syrop de maracuya (+ S/ 2.50), Syrop de fresa (+ S/ 2.00) y Bola de helado (+ S/ 2.50).
   - En `AGENTS.md` (Regla 5 del bot real), se indica explicitamente: *"Toppings en Frappés: cambio de sabor de topping es gratis, topping adicional/extra tiene costo de + S/ 1.00 por porcion"*.
   - Recomendacion: Se recomienda mantener en la carta web ambos conceptos: la adicion de toppings secos (Oreo, chispas, chin chin, almendra) a S/ 1.00 y los adicionales liquidos/helado a S/ 2.00 - S/ 2.50.

3. **Inconsistencias en la Hoja de Calculo de Origen (Google Sheets):**
   - En `sheet_sync.py`, la hoja de calculo del cliente posee filas redundantes en la pestana `EXTRAS` con valores contradictorios:
     - Fila "Leche de almendras": S/ 2.50 en la fila superior, pero en la fila inferior S/ 3.00.
     - Fila "Chantilly": S/ 2.00 en dos filas y S/ 2.50 en otra fila.
   - En el codigo JavaScript de la tienda web y en `Main.dc.html` se valido que el precio real cobrado es S/ 2.50 para Leche de almendras y S/ 2.00 para Chantilly.
   - Esto evidencia que el negocio sufria desajustes de precios al sincronizar desde Google Sheets, validando la necesidad de que nuestro sistema administrativo (`Admin.dc.html`) sea la unica fuente centralizada de la verdad.

4. **Discrepancia en la Condicion de Borde de Delivery Gratis:**
   - En `bot/bot.py` (linea 530) y `bot_wa.py`:
     `if subtotal_productos > 70:`
   - En `bot/js/cart.js` (linea 151):
     `if (subtotal >= 70.0 && subtotal > 0)`
   - Si un cliente compra exactamente S/ 70.00 en productos (por ejemplo, dos Dúos Compartir de 12oz a S/ 33.00 sumando S/ 66.00 mas una galleta de S/ 4.00 = S/ 70.00 exactos):
     - En la tienda web vieja el delivery le salia GRATIS (S/ 0.00).
     - En el chatbot de Telegram y WhatsApp la condicion estricta `> 70` evaluaba falso y le cobraba el delivery (S/ 3.00).
   - En `fuente/Main.dc.html` la regla opera como `>= 70`. Debe estandarizarse formalmente como `>= 70.00` en todo el ecosistema.

---

## 7. Conclusiones y Hoja de Ruta de Integracion

1. **Conservacion del Flujo WhatsApp:** La tienda web antigua poseia una experiencia de usuario sumamente efectiva al construir el ticket de WhatsApp completo y lanzarlo con `wa.me`. `Main.dc.html` debe mantener esta misma capacidad de generacion de texto para los clientes que eligen pagar por WhatsApp.
2. **Adopcion de Geocodificacion Inversa:** La inclusion de OpenStreetMap Nominatim en `map.js` de la tienda vieja demostro que es factible resolver nombres de calle sin costos de API; se recomienda integrarlo a la carta web.
3. **Unificacion de Catalogo:** Las discrepancias entre `menu-data.js`, `menu_dinamico.txt` y `Main.dc.html` demuestran que la cafeteria manejaba versiones desalineadas entre su hoja de calculo y su web. El modulo de Productos de `Admin.dc.html` resolvera definitivamente este problema actuando como la base de datos maestra que distribuya en tiempo real hacia la web, el bot y las pantallas de cocina.

INFORME LISTO
