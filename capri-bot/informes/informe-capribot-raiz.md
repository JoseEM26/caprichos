# Informe de CAPRIBOT RAIZ

## 1. Resumen en 5 lineas (que es y para que sirve)
El directorio analizado contiene la solucion completa del chatbot de atencion y ventas de la cafeteria Caprichos.
Su proposito es atender clientes y gestionar pedidos de manera automatica mediante WhatsApp y Telegram utilizando inteligencia artificial de OpenAI.
Calcula con exactitud los costos de delivery mediante coordenadas geograficas y poligonos mapeados en formato GeoJSON.
Mantiene la carta de productos, precios y disponibilidad sincronizados directamente desde una hoja de calculo de Google Sheets.
Incluye una tienda web interactiva con catalogo visual, mapa y carrito de compras, ademas de un panel de administracion web para validar comprobantes y tickets de cocina.

## 2. Archivos principales (tabla: archivo | que hace)

| Archivo / Carpeta | Que hace |
| :--- | :--- |
| `CHATBOT/bot_wa.py` | Servidor principal con FastAPI (mas de 5100 lineas). Gestiona el webhook de WhatsApp Cloud API, la interaccion con OpenAI GPT-4o-mini, vision de comprobantes, botones interactivos, logica de sesiones y un panel web de administracion interno en la ruta `/admin`. |
| `CHATBOT/bot.py` | Bot alternativo para la plataforma Telegram basado en la biblioteca `python-telegram-bot`. Implementa consulta de productos, vision de comprobantes, extraccion de coordenadas GPS, calculo de delivery y envio de tickets con botones de aprobacion al grupo de cocina. |
| `CHATBOT/prompt.py` | Contiene el system prompt del modelo (`SYSTEM_PROMPT`). Establece la identidad de Capri, el tono empatico orientado a ventas, interpretacion de expresiones peruanas, las 5 fases de atencion, catalogo y reglas de despacho. |
| `CHATBOT/sheet_sync.py` | Script que descarga automaticamente la carta de productos y precios desde un enlace publico de Google Sheets en formato Excel mediante `pandas`, generando el archivo `menu_dinamico.txt`. |
| `CHATBOT/geo_utils.py` | Modulo geoespacial que carga los poligonos de reparto y, mediante la libreria `shapely`, verifica si unas coordenadas (latitud y longitud) caen dentro de las zonas delimitadas para asignar el costo de delivery. |
| `CHATBOT/client_db.py` | Capa de persistencia para clientes frecuentes. Gestiona la consulta y actualizacion de datos, ubicaciones previas, historial de pedidos aprobados y tarifas especiales de delivery en el archivo `clientes.json`. |
| `CHATBOT/LIMITES_DELIVERY.geojson` | Archivo de datos geoespaciales con los poligonos de cobertura y tarifas por zonas (Z2, Z3, Z4, Z5 y Z7) para el distrito y zonas aledanias en Lima. |
| `CHATBOT/menu_dinamico.txt` | Listado consolidado en texto plano con categorias, productos, tamanos y precios extraidos de la hoja de calculo, el cual se inyecta dinamicamente en el prompt del bot. |
| `CHATBOT/requirements.txt` | Lista de dependencias del entorno Python (FastAPI, Uvicorn, OpenAI, Python-Telegram-Bot, Shapely, Pytz, HTTPX, Python-Multipart). |
| `CHATBOT/desplegar.bat` | Script por lotes para Windows que transfiere los archivos del bot mediante SCP hacia una maquina virtual en Oracle Cloud y reinicia el servicio del sistema via SSH. |
| `CHATBOT/descargar_desde_servidor.bat` | Script por lotes para Windows que descarga copias de respaldo de las bases de datos locales, historial y codigo desde el servidor remoto a la computadora local. |
| `CHATBOT/index.html` | Pagina web del catalogo digital de Caprichos. Cuenta con visualizacion de categorias, buscador, modal de seleccion de tamanos/ingredientes, carrito de compras y mapa de ubicacion. |
| `CHATBOT/css/styles.css` | Hoja de estilos de la tienda web, responsiva para dispositivos moviles y escritorio, con el diseno visual de la cafeteria. |
| `CHATBOT/js/app.js` | Logica principal del catalogo web: carga dinamica de productos, buscador en tiempo real, filtros por categoria y gestion de modales. |
| `CHATBOT/js/menu-data.js` | Base de datos de productos en JavaScript para el catalogo web, con descripciones, imagenes, opciones de personalizacion y precios. |
| `CHATBOT/js/cart.js` | Modulo que gestiona los productos agregados, calculo de subtotales, cantidades y promocion de delivery gratis por montos superiores a 70 soles. |
| `CHATBOT/js/map.js` | Integracion del mapa interactivo con la libreria Leaflet y OpenStreetMap. Permite ubicar la tienda, mostrar poligonos de cobertura y arrastrar el pin de entrega. |
| `CHATBOT/js/zones.js` | Representacion en JavaScript de las zonas y poligonos de reparto para calcular el costo de envio directamente en el navegador del cliente. |
| `CHATBOT/js/checkout.js` | Administra el formulario de pedido (nombre, telefono, direccion, medio de pago), valida los campos y genera el enlace con el mensaje formateado hacia WhatsApp. |
| `CHATBOT/AGENTS.md` | Documento de referencia con las directivas operativas del negocio, debouncers, promociones vigentes, atencion fuera de horario y reglas para el personal. |
| `CHATBOT/assets/` | Carpeta con las fotografias e imagenes referenciales de los productos de la carta y avisos de contingencia. |
| Archivos protegidos (`.env`, `*.key`, `clientes.json`, `chat_history.json`, `chat_history_archive.json`, `user_sessions.json`, `special_notice_notified.json`, `uploads/`) | Archivos de configuracion, llaves de acceso, registros de clientes, sesiones activas, historial de mensajes y fotos de comprobantes. Su contenido no fue abierto por contener secretos y datos privados. |

## 3. Como funciona el flujo de una conversacion (paso a paso, desde que llega el mensaje hasta que responde)

El flujo de atencion opera siguiendo estos pasos secuenciales:

1. **Llegada del mensaje:**
   - En WhatsApp (`bot_wa.py`, funcion `receive_webhook`, linea aprox. 2684): La plataforma Meta WhatsApp Cloud API envia una notificacion HTTP POST al endpoint `/webhook`. El servidor extrae el numero remitente, el identificador unico del mensaje (`wamid`), el tipo de mensaje (texto, boton interactivo, imagen o ubicacion GPS) y el contenido.
   - En Telegram (`bot.py`, funcion `main`, linea aprox. 1085): La aplicacion escucha las actualizaciones mediante sondeo continuo (`polling`).

2. **Agrupamiento de mensajes continuos (Debouncer):**
   - El sistema implementa una pausa intencional de espera (2 segundos en WhatsApp en `bot_wa.py`, linea aprox. 2167; 10 segundos en Telegram en `bot.py`, linea aprox. 912). Si el cliente manda multiples frases cortas sucesivas, el bot las acumula en un buzon temporal y las procesa juntas para evitar respuestas repetitivas o entrecortadas.

3. **Verificacion de sesion, horarios y estado operativo:**
   - Control de inactividad: Si han pasado mas de 3 horas desde la ultima interaccion del cliente, la conversacion previa se reinicia (`bot_wa.py`, linea aprox. 1285; `bot.py`, linea aprox. 370).
   - Pausa operativa: Si el usuario esta a la espera de validacion humana de un comprobante de pago o intervencion de un trabajador, el bot bloquea respuestas automaticas para no interrumpir al personal.
   - Verificacion horaria: Se consulta la hora local en Lima (zona horaria America/Lima). Se registra si se encuentra dentro de la franja de atencion regular (2:00 pm a 10:00 pm) para advertir al modelo si debe avisar que los despachos inician a las 2:00 pm.

4. **Inyeccion de memoria del cliente y catalogo:**
   - El sistema consulta `clientes.json` a traves de `client_db.py`. Si el cliente ya esta registrado con pedidos anteriores, se agrega una instruccion de sistema que le indica a la IA saludarlo por su nombre y le prohibe expresamente volver a solicitarle su nombre o numero de celular.
   - Se inyecta la carta actualizada proveniente de `menu_dinamico.txt` dentro del `SYSTEM_PROMPT`.

5. **Procesamiento de datos especiales (GPS o Fotos):**
   - Si el cliente envio una ubicacion GPS: El modulo `geo_utils.py` evalua la latitud y longitud contra los poligonos de `LIMITES_DELIVERY.geojson`. Si la direccion queda fuera de cobertura, genera una directiva interna de sistema avisando que esta fuera de zona para ofrecer recojo en tienda. Si esta dentro, calcula la tarifa correspondiente.
   - Si el cliente envio una imagen: El archivo se descarga desde Meta o Telegram, se codifica en base64 y se envia a OpenAI con una instruccion interna de vision para que extraiga datos del comprobante (monto pagado, codigo de operacion, fecha y hora).

6. **Llamada al modelo de OpenAI y ejecucion de herramientas:**
   - Se realiza la solicitud a OpenAI (`model="gpt-4o-mini"`).
   - Si el modelo decide invocar una herramienta externa (`tools`), se ejecutan las funciones en Python:
     - `calcular_total_pedido`: Suma matematicamente el valor de los productos y valida la regla de delivery gratuito si el subtotal de productos supera los 70 soles.
     - `enviar_foto_producto`: Localiza la foto del plato o bebida en `assets/` y coordina su envio.
     - `derivar_reserva_promo_amarilla`: Registra alertas de reservas especiales.
   - Tras procesar las herramientas, el modelo genera la respuesta conversacional final.

7. **Generacion de tickets y notificacion al equipo:**
   - Si el bot detecta que la orden esta cerrada y con pago recibido, la funcion `generate_kitchen_ticket` genera un ticket estructurado y notifica a los administradores mediante WhatsApp o al grupo de Telegram con botones interactivos (`Aprobar Pedido` y `Rechazar`).
   - El bot desactiva las respuestas al cliente hasta que un administrador presione alguno de los botones.

8. **Envio de respuesta al cliente y persistencia:**
   - La respuesta se entrega al usuario a traves de Meta Cloud API o Telegram.
   - Se persisten los cambios en `user_sessions.json`, `chat_history.json` y `clientes.json`.

## 4. Integraciones externas (OpenAI, WhatsApp Cloud API, Telegram, Google Sheets u otras)

1. **OpenAI API:**
   - Para que se usa: Razonamiento del lenguaje natural, interpretacion de pedidos, atencion comercial, vision artificial para leer imagenes de comprobantes bancarios (Yape, Plin, BCP) y ejecucion de herramientas matematicas.
   - Modelo: `gpt-4o-mini` (configurable mediante la variable `OPENAI_MODEL`).
   - Endpoint: API oficial de OpenAI a traves del SDK asincrono `AsyncOpenAI` (`client.chat.completions.create`).

2. **WhatsApp Cloud API (Meta Graph API):**
   - Para que se usa: Recepcion de mensajes de usuarios via webhook, envio de respuestas de texto, imagenes de platos, documentos PDF de la carta digital y botones interactivos para aprobacion de pedidos. Tambien se utiliza para descargar las imagenes adjuntas que envian los clientes.
   - Endpoints utilizados:
     - `https://graph.facebook.com/v20.0/{WHATSAPP_PHONE_ID}/messages` (envio de mensajes, imagenes, documentos y botones).
     - `https://graph.facebook.com/v20.0/{WHATSAPP_PHONE_ID}/media` (subida de archivos multimedia).
     - `https://graph.facebook.com/v20.0/{media_id}` (descarga de fotos enviadas por usuarios).

3. **Telegram Bot API:**
   - Para que se usa: Canal de comunicacion alternativo para atencion a clientes y canal interno de alertas de cocina donde los administradores reciben el ticket y aprueban o rechazan ordenes mediante botones en linea.
   - Metodo: Biblioteca `python-telegram-bot` en modo sondeo continuo (`run_polling`).

4. **Google Sheets:**
   - Para que se usa: Actualizacion centralizada de la carta de productos, precios y disponibilidad de stock por parte del personal de la cafeteria.
   - Mecanismo: Descarga por solicitud HTTP en formato Excel desde la direccion publica de exportacion (`<enlace publico de exportacion de Google Sheets>`), leida con `pandas` sin necesidad de credenciales de Google Cloud (`sheet_sync.py`, linea aprox. 4).

5. **OpenStreetMap y Leaflet:**
   - Para que se usa: Renderizado del mapa interactivo en la tienda web (`index.html`), visualizacion de la ubicacion del local y dibujo de las zonas de cobertura de delivery.

## 5. Variables de entorno que el codigo lee (solo nombres y para que sirve cada una)

A continuacion se detallan unicamente los nombres de las variables que el codigo lee mediante `os.getenv`:

- `OPENAI_API_KEY`: Clave de autorizacion para realizar consultas al servicio de OpenAI.
- `OPENAI_MODEL`: Especifica el modelo de lenguaje de OpenAI que utilizara el bot (por defecto asigna `gpt-4o-mini`).
- `WHATSAPP_TOKEN`: Token de autenticacion de Meta para autorizar el envio de mensajes por WhatsApp Cloud API.
- `WHATSAPP_PHONE_ID`: Identificador numerico del numero de WhatsApp en la plataforma Meta for Developers.
- `WHATSAPP_VERIFY_TOKEN`: Token secreto configurado en el Webhook de Meta para validar la autenticidad de la URL del servidor.
- `ADMIN_WHATSAPP_NUMBERS`: Lista de numeros telefonicos de los administradores y personal de cocina para recibir alertas de pedidos.
- `ADMIN_PANEL_USER`: Nombre de usuario para iniciar sesion en el panel administrativo web `/admin`.
- `ADMIN_PANEL_PASSWORD`: Contrasena para iniciar sesion en el panel administrativo web `/admin`.
- `TELEGRAM_TOKEN`: Token de autorizacion del bot de Telegram entregado por BotFather.
- `GRUPO_PEDIDOS_ID`: Identificador del grupo o chat de Telegram donde el bot envia los tickets de pedidos para su revision.

## 6. Datos que guarda y donde (archivos json, bases de datos, historial) y que tipo de datos personales maneja

### Archivos de almacenamiento local:
- `clientes.json`: Archivo JSON gestionado por `client_db.py`. Registra el numero telefonico como clave, nombre del cliente, fecha de registro, total de pedidos aprobados, coordenadas de la ultima ubicacion GPS confirmada y posibles tarifas fijas o porcentajes de descuento personalizados.
- `chat_history.json`: Archivo JSON gestionado por `bot_wa.py`. Almacena el registro activo de los mensajes intercambiados (con un maximo de 25 mensajes por chat en memoria activa), nombres asignados, contador de mensajes no leidos, estados de atencion y resumenes de pedidos.
- `chat_history_archive.json`: Archivo JSON de archivo historico donde se transfieren los mensajes antiguos que superan el limite de 25 entradas por cliente para no sobrecargar la memoria.
- `user_sessions.json`: Archivo JSON en `bot_wa.py` que guarda el estado de conversacion de OpenAI, coordenadas GPS recientes, marcas de tiempo de actividad y listas de usuarios en espera de aprobacion para evitar que el bot pierda el hilo tras un reinicio.
- `special_notice_notified.json` y `special_notice_notified_tg.json`: Archivos JSON que registran que usuarios ya recibieron el aviso diario de contingencia (como corte de energia) para no repetir el mensaje.
- Carpeta `uploads/`: Directorio donde se guardan en disco las imagenes recibidas desde WhatsApp (comprobantes bancarios y capturas).

### Tipo de datos personales que maneja:
- Nombres y apellidos reales de los clientes.
- Numeros de telefono y cuentas de WhatsApp.
- Ubicaciones geograficas exactas (coordenadas de latitud y longitud, enlaces a Google Maps).
- Direcciones de entrega y referencias domiciliarias.
- Informacion financiera sensible: Imagenes de comprobantes de transferencias bancarias que contienen nombres de titulares, montos de transacciones, codigos de operacion bancaria, fecha y hora de transferencias.
- Habitos de consumo y registro de compras de cada cliente.

## 7. Como se despliega y se ejecuta (scripts .bat, .sh, servicios, tuneles)

- **Infraestructura de ejecucion:**
  - El sistema esta disenado para ejecutarse en un servidor virtual en la nube (Oracle Cloud VPS con sistema operativo Ubuntu), alojado bajo la ruta `/home/ubuntu/chatbot/`.
- **Servicio en segundo plano (Systemd):**
  - El bot de WhatsApp corre como un servicio del sistema Linux denominado `caprichos-bot`, administrado mediante `systemctl`.
- **Proceso de despliegue automatizado (`desplegar.bat`):**
  - El desarrollador ejecuta el script desde Windows.
  - El script se conecta mediante `scp` utilizando una llave privada SSH para transferir los archivos de codigo, recursos estaticos web, dependencias e incluso el archivo de variables de entorno al servidor.
  - Posteriormente ejecuta una sesion `ssh` remota que activa el entorno virtual de Python (`source venv/bin/activate`), instala dependencias (`pip install -r requirements.txt`) y reinicia el servicio con `sudo systemctl restart caprichos-bot`.
- **Proceso de sincronizacion inversa (`descargar_desde_servidor.bat`):**
  - Permite descargar mediante `scp` los archivos JSON generados en el servidor hacia la maquina local a modo de copia de respaldo.
- **Red y puertos:**
  - El servidor FastAPI escucha en el puerto 8000 para el webhook (`/webhook`) y para el panel de monitoreo (`/admin`).
  - No se observan scripts de tuneles como ngrok o cloudflared; la arquitectura apunta a recibir trafico en dicho puerto. La existencia de un proxy inverso con certificados SSL como Nginx no esta verificada en esta carpeta.

## 8. Reglas de negocio y prompt (resumen de lo que el prompt le ordena al bot; menu, precios o cotizacion si aplica)

Las directivas del negocio estan estipuladas en `prompt.py` y `AGENTS.md`:

1. **Personalidad y rol:**
   - La asistente se llama Capri, con un tono amable, rapido y orientado a ventas.
   - Regla obligatoria de cierre: Todo mensaje del bot debe terminar obligatoriamente con una pregunta orientada a concretar el pedido (doble alternativa o confirmacion).

2. **Criterio de lenguaje peruano:**
   - La frase "cancelo con [monto]" significa pagar en efectivo y solicitar vuelto para ese billete. Queda estrictamente prohibido anular o cancelar el pedido ante esa frase.
   - El termino "extra" debe asociarse de inmediato al tamano de bebida Extra Grande (21oz) o a ingredientes adicionales.

3. **Fases secuenciales de atencion:**
   - *Fase 1 (Productos):* Prohibido asumir sabores o variantes. Debe preguntarse especificamente (tipo de waffle, sabor de dona, empanada, etc.). Presentar siempre los tres tamanos de bebida (Regular 12oz, Grande 16oz, Extra 21oz) con sus precios.
   - *Fase 2 (Modalidad y entrega):* Opciones de Delivery, Recojo en Tienda o Consumo en Salon. Si es recojo o salon, el costo de delivery es cero y esta prohibido pedir GPS. Si es delivery, se exige un consumo minimo de productos de S/ 14.50. Si el consumo en productos supera los S/ 70.00, el delivery es gratuito. Si el cliente ya tiene una ubicacion registrada anteriormente, se le pide confirmarla en lugar de volver a pedir el GPS desde cero.
   - *Fase 3 (Datos de contacto):* Justo antes del resumen final, pedir nombre y celular de quien recibe, a menos que ya sea un cliente frecuente registrado en la base de datos.
   - *Fase 4 (Resumen y cotizacion):* Invocar la herramienta de calculo matematico, presentar el resumen con detalle y esperar la confirmacion expresa del cliente antes de enviar cuentas de pago.
   - *Fase 5 (Cobro):* Enviar cuentas autorizadas de Yape, Plin y bancos. Al recibir la foto del comprobante, avisar que un asesor humano validara la operacion y pausar el bot. Si es efectivo, registrar el vuelto requerido. Si es tarjeta, avisar que el pago se efectua contra entrega con terminal POS inalambrico.

4. **Horarios de atencion y regla anti-spam:**
   - Atencion en tienda y despachos: 2:00 pm a 10:00 pm. Recepcion de pedidos: 24 horas.
   - Regla de cero spam: Esta prohibido mencionar el horario de atencion en saludos de bienvenida o mensajes intermedios, a menos que el cliente pregunte expresamente por el o al momento de confirmar un pedido fuera de horario.

5. **Insumos y adicionales en bebidas:**
   - Preparadas con leche entera y azucar blanca por defecto.
   - Cambio gratuito a leche sin lactosa o edulcorante stevia.
   - Opcion con recargo: leche de almendras (+ S/ 2.50) y porcion extra de chantilly (+ S/ 2.00).

## 9. Riesgos y problemas que ves (seguridad, secretos en carpeta, datos personales, cosas fragiles) ordenados por gravedad

A continuacion se presentan los riesgos identificados, ordenados de mayor a menor gravedad:

1. **Gravedad Critica - Llave privada SSH y secretos en la carpeta de trabajo:**
   - Se localizo un archivo de llave privada SSH (`ssh-key-*.key`) y el archivo `.env` en la misma carpeta del proyecto. Los scripts `.bat` transfieren estos archivos directamente. Si esta carpeta se comparte, sincroniza o sube a un repositorio Git sin exclusion estricta en `.gitignore`, cualquier persona obtendra acceso administrativo total al servidor en la nube y a las APIs externas.

2. **Gravedad Critica - Valores por defecto sensibles en el codigo fuente:**
   - En `bot_wa.py` (lineas aprox. 250 a 255), variables como el token de verificacion de WhatsApp, el usuario y la contrasena de ingreso al panel de administracion web `/admin` cuentan con valores de texto plano asignados por defecto si la variable de entorno no existe. Si alguien ejecuta el bot sin configurar variables, el panel queda protegido por credenciales predecibles.

3. **Gravedad Alta - Exposicion de datos personales y financieros de clientes:**
   - Los archivos `clientes.json`, `chat_history.json`, `user_sessions.json` y la carpeta `uploads/` residen en texto plano sin cifrado en disco. Contienen nombres, numeros telefonicos, ubicaciones domiciliarias exactas y comprobantes de pago de personas reales. Una filtracion de estos archivos comprometeria la privacidad de los clientes segun las normativas de proteccion de datos personales.

4. **Gravedad Alta - Transmision sin cifrado evidente (HTTP):**
   - El script `desplegar.bat` expone las rutas del Webhook y del Panel de Administracion bajo el protocolo `http://` en el puerto 8000. Sin una capa HTTPS obligatoria, las credenciales del panel administrativo y los datos transmitidos pueden ser interceptados en la red.

5. **Gravedad Media - Fragilidad y concurrencia de la persistencia en archivos JSON:**
   - Toda la informacion operativa se escribe directamente en archivos JSON mediante reescrituras completas en disco. Ante un volumen creciente de mensajes concurrentes, este esquema puede generar bloqueos de entrada/salida, condiciones de carrera o perdida parcial de datos si el proceso se interrumpe durante el guardado.

6. **Gravedad Media - Archivo monolítico de gran tamano (`bot_wa.py`):**
   - El archivo principal supera las 5100 lineas, conteniendo logica de servidor web, controladores de webhook, interfaz de usuario HTML/CSS inyectada en cadenas de texto, integracion con OpenAI y utilidades auxiliares. Esta concentracion de responsabilidades dificulta el mantenimiento, la realizacion de pruebas unitarias y eleva la probabilidad de regresiones ante cambios menores.

7. **Gravedad Baja - Dependencia de enlace publico de Google Sheets:**
   - La sincronizacion de la carta depende de que un documento de Google Sheets se mantenga accesible publicamente y conserve la misma estructura de columnas. Cualquier alteracion accidental en los titulos de las columnas de la hoja de calculo podria impedir la actualizacion del catalogo.

## 10. Que se podria aprovechar para el chatbot Capri del mockup de Caprichos (ideas concretas)

1. **Motor de calculo geoespacial con poligonos GeoJSON:**
   - La logica implementada en `geo_utils.py` y `LIMITES_DELIVERY.geojson` es sumamente practica. Permite que el chatbot determine de forma automatica y transparente la zona de reparto y el costo exacto del envio basandose en la ubicacion compartida por el cliente, evitando discrepancias de tarifas.

2. **Estructura de atencion en 5 fases del prompt:**
   - La division rigurosa del flujo de conversacion (Seleccion -> Modalidad -> Datos de contacto -> Resumen con calculo -> Cobro) impide que el bot se salte pasos indispensables para el despacho o cobre importes incorrectos.

3. **Uso de Function Calling para operaciones aritmeticas:**
   - Delegar la suma del pedido y la aplicacion del delivery gratuito a la herramienta `calcular_total_pedido` en Python en lugar de dejar el calculo a la generacion de texto del modelo de lenguaje elimina errores matematicos y cobros inconsistentes.

4. **Sincronizacion de carta con Google Sheets:**
   - El enfoque de `sheet_sync.py` permite que el personal administrativo o de tienda actualice productos, costos y stock sin depender de desarrolladores ni de paneles complejos, manteniendo el bot siempre al dia.

5. **Agrupamiento temporal de mensajes (Debouncer):**
   - La rutina que espera unos segundos antes de responder para consolidar frases fragmentadas es clave para la experiencia de usuario en aplicaciones de mensajeria instantanea.

6. **Componentes visuales del catalogo web (`js/cart.js` y `js/checkout.js`):**
   - La tienda web ligera proporciona un excelente flujo para clientes que prefieren elegir visualmente sus productos en una pagina y luego enviar su pedido preformateado a WhatsApp con un solo clic.

## 11. Preguntas abiertas / no verificado

- **Proxy inverso y certificados SSL:** No verificado en los archivos locales si el servidor en Oracle Cloud cuenta con Nginx, Caddy o certificados SSL (Let's Encrypt) para proteger con HTTPS el puerto 8000 y satisfacer los requisitos de seguridad de Meta en produccion.
- **Configuracion del servicio systemd:** No verificado el archivo de definicion del servicio (`caprichos-bot.service`) en el servidor remoto para constatar con que comando exacto y parametros de entorno se ejecuta la aplicacion en Linux.
- **Concurrencia de bots:** No verificado si en produccion se ejecuta unicamente `bot_wa.py` o si `bot.py` corre de manera simultanea en un proceso independiente.
- **Volumen y desempeno real:** No verificado el tamano de las bases de datos reales ni el volumen diario de pedidos procesados por el sistema, en cumplimiento estricto con las reglas de privacidad de este analisis.
