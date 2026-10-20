---
id: ANA-CAP-047
tipo: analisis
titulo: "INFORME TECNICO Y OPERATIVO: LOGICA DEL CHATBOT REAL (PARTE 2) FRENTE AL MOCKUP DE CAPRICHOS"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, produccion-admin-bot-informes]
---

# INFORME TECNICO Y OPERATIVO: LOGICA DEL CHATBOT REAL (PARTE 2) FRENTE AL MOCKUP DE CAPRICHOS

## 1. Resumen Ejecutivo y Alcance del Analisis

El presente informe constituye la segunda parte de la auditoria integral del codigo fuente del chatbot de la cafeteria Caprichos (`bot/bot_wa.py`, 5184 lineas en total). Este documento se concentra especificamente en la lectura completa, linea por linea, desde la linea 2600 hasta la linea final (5184), abarcando ademas los mecanismos transversales de soporte operativo como persistencia atomica, tareas programadas nocturnas, gestion de estados de sesion, notificaciones a cocina y administracion, y el panel web de control en tiempo real (`/admin`).

El analisis contrasta de forma minuciosa las capacidades reales operativas del bot frente al prototipo administrativo del sistema (`fuente/Admin.dc.html`), la carta digital (`fuente/Main.dc.html`), el simulador de chat (`fuente/Chatbot.dc.html`), el documento de flujo de pedidos (`fuente/flujo-de-pedidos.md`) y los testimonios brindados por el cliente Kevin Rosales en las reuniones de descubrimiento (`fuente/acta-01-descubrimiento.md`, `fuente/acta-02-descubrimiento.md` e `fuente/iniciativas-acta-02-evidencia.md`).

A traves de esta revision se confirma que el bot real no es un mero contestador conversacional, sino un centro de recepcion, triaje, despacho y puente administrativo. Cuenta con su propio panel web interactivo en tiempo real montado sobre FastAPI, con un sistema de alertas sonoras y visuales, clasificacion automatica de chats que requieren intervencion humana, modificacion dinamica de tiempos de entrega en alta demanda, persistencia atomica tolerante a fallos, archivado ciclico para control de memoria RAM y extraccion inteligente de pedidos para copiado directo al Punto de Venta (POS). El mockup actual simula la operacion de caja y KDS de forma avanzada, pero desconoce completamente la existencia de esta consola web de WhatsApp y sus herramientas criticas de operacion diaria.

---

## 2. Endpoints HTTP y Webhooks (FastAPI)

En este bloque se detallan todos los endpoints expuestos por la aplicacion FastAPI en `bot/bot_wa.py`, especificando nombre de funcion, metodo, funcionalidad, estado frente al mockup, ubicacion, relevancia operativa y clasificacion.

### 2.1. Webhook de Recepcion de Eventos Meta WhatsApp
- Nombre de funcion: `receive_webhook` (linea 2684).
- Metodo y ruta: `POST /webhook`.
- Que hace: Recibe el payload JSON enviado por Meta WhatsApp Cloud API. Valida que el campo `object` sea `whatsapp_business_account`. Mapea perfiles y nombres de contacto (`wa_id`, `name`), registra estados de entrega de mensajes (`sent`, `delivered`, `read`, `failed`), extrae mensajes entrantes (texto, interactivos, botones, notas de voz, ubicacion GPS, imagenes/vouchers, videos, stickers, documentos) y delega inmediatamente su procesamiento a la tarea en segundo plano `process_incoming_msg_wa` mediante `BackgroundTasks` de FastAPI, retornando de forma instantanea HTTP 200 con el texto `EVENT_RECEIVED`.
- Estado en el Mockup: No la tiene.
- Donde esta:
  - Bot: `bot_wa.py` (funcion `receive_webhook`).
  - Mockup: En `Chatbot.dc.html` los mensajes se simulan mediante un arbol de decisiones sincrono en memoria de JavaScript, sin recepcion asincrona de webhooks ni delegacion de tareas.
  - Acta: Acta 02, seccion de conectividad y recepcion 24h.
- Por que importa para una cafeteria: Si el servidor web tarda mas de 3 a 5 segundos en responder a Meta, Meta asume tiempo de espera agotado (timeout) y reenvia el mismo mensaje multiples veces, generando bucles de respuestas duplicadas, saturacion de OpenAI y costo computacional excesivo. El desacoplamiento mediante `BackgroundTasks` es obligatorio en produccion.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Alta.

### 2.2. Autenticacion del Panel de Administracion
- Nombre de funcion: `dashboard_login` (linea 2736).
- Metodo y ruta: `POST /api/dashboard/login`.
- Que hace: Recibe credenciales de usuario y clave en formato JSON. Las compara contra variables de entorno configuradas (`ADMIN_PANEL_USER` y `ADMIN_PANEL_PASSWORD`). Si son correctas, emite una cookie HTTP denominada `caprichos_admin_session` con el token de sesion `ADMIN_SESSION_TOKEN`, con un tiempo de expiracion de 30 dias (`max_age = 86400 * 30`), `path="/"`, `samesite="lax"`.
- Estado en el Mockup: La tiene a medias.
- Donde esta:
  - Bot: `bot_wa.py` (funcion `dashboard_login` y `is_admin_authenticated`).
  - Mockup: `Admin.dc.html` implementa seleccion rapida de rol visual (`s.role` en `ROLES`), pero no cuenta con mecanismo de sesion por cookie, token criptografico ni tiempo de expiracion persistente.
- Por que importa para una cafeteria: Permite que el personal de caja o administracion mantenga el panel de monitoreo abierto en tablets o PCs del local durante todo el mes sin que la sesion caduque a mitad del servicio de cocina.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Media.

### 2.3. Cierre de Sesion del Panel
- Nombre de funcion: `dashboard_logout` (linea 2759).
- Metodo y ruta: `POST /api/dashboard/logout`.
- Que hace: Destruye la sesion activa eliminando la cookie `caprichos_admin_session` con `resp.delete_cookie`.
- Estado en el Mockup: No la tiene.
- Donde esta:
  - Bot: `bot_wa.py` (funcion `dashboard_logout`).
  - Mockup: En `Admin.dc.html` existe un selector de perfiles (`view: 'perfil'`), pero no gestiona cookies de autenticacion reales.
- Por que importa para una cafeteria: Seguridad basica al cerrar turnos o compartir dispositivos de caja entre diferentes operarios.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Baja.

### 2.4. Consulta de Lista de Conversaciones Activas
- Nombre de funcion: `get_dashboard_chats` (linea 2766).
- Metodo y ruta: `GET /api/dashboard/chats`.
- Que hace: Endpoint central de sondeo del panel web. Consolida los telefonos de todas las fuentes en memoria (`user_sessions`, `user_names`, `chat_logs_history`, `requires_worker_chats`, `attended_chats`, `unread_chats`). Para cada cliente genera un objeto estructurado que incluye: nombre real de contacto saneado, celular en formato peruano (`9XX XXX XXX`), celular nacional (9 digitos limpios), extracto del ultimo mensaje, hora y fecha formateada, identificador de quien envio el ultimo mensaje (`client`, `bot`, `admin`), bandera de actividad en el dia de hoy (filtro estricto de 00:00:00 a 23:59:59 en zona horaria America/Lima), estado de pausa del bot, estado de chat atendido, estado de no leido, contador numerico de mensajes no leidos, indicador de alerta humana (`requires_worker`) con su motivo descriptivo, bandera de resumen de pedido disponible y cantidad total de mensajes en historial. Ordena la lista priorizando primero los chats que requieren atencion, luego los no leidos y finalmente por marca temporal descendente. Retorna tambien el estado global del modo Alta Demanda y el tiempo estimado de despacho.
- Estado en el Mockup: No la tiene.
- Donde esta:
  - Bot: `bot_wa.py` (funcion `get_dashboard_chats`).
  - Mockup: En `Admin.dc.html` no existe ninguna bandeja de chats de WhatsApp ni monitoreo en vivo de conversaciones con clientes.
  - Acta: Acta 02 (E-39 y testimonios de Kevin sobre el panel web del bot).
- Por que importa para una cafeteria: Es el corazon operativo que permite a la cajera ver en un solo monitor quien esta pidiendo, quien envio un voucher, quien tiene un problema y que pedidos estan pendientes de pasar al punto de venta.
- Clasificacion: CONFIRMADO en el codigo y en el acta.
- Prioridad: Alta.

### 2.5. Consulta de Historial Detallado de Mensajes por Cliente
- Nombre de funcion: `get_dashboard_messages` (linea 2836).
- Metodo y ruta: `GET /api/dashboard/messages/{phone}`.
- Que hace: Retorna la conversacion completa del cliente especificado, desglosando cada mensaje con su identificador unico, remitente (`client`, `bot`, `admin`), nombre mostrado, texto, imagenes adjuntas (con ruta local `/uploads/...`), enlaces a mapas Google Maps cuando hubo envio de coordenadas GPS, fecha y hora exacta. Ademas, entrega los estados de pausa, atencion, lectura, contador de no leidos, motivo de requerimiento de trabajador, enlace GPS directo del cliente, ultimo ticket o resumen de pedido generado, y las variables globales de alta demanda y tiempo estimado.
- Estado en el Mockup: No la tiene.
- Donde esta:
  - Bot: `bot_wa.py` (funcion `get_dashboard_messages`).
  - Mockup: Inexistente en `Admin.dc.html`.
- Por que importa para una cafeteria: Permite auditar exactamente que ofrecio la IA, que eligio el cliente, que voucher envio y en que punto de la conversacion intervino el personal.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Alta.

### 2.6. Consulta del Ultimo Resumen de Pedido para POS
- Nombre de funcion: `get_dashboard_order_summary` (linea 2878).
- Metodo y ruta: `GET /api/dashboard/order-summary/{phone}`.
- Que hace: Consulta y retorna el texto del ultimo ticket de cocina y resumen generado para el cliente desde el diccionario en memoria `latest_order_summaries`.
- Estado en el Mockup: No la tiene.
- Donde esta:
  - Bot: `bot_wa.py` (funcion `get_dashboard_order_summary`).
  - Mockup: El mockup genera comandas internamente (`ctTicket`), pero no tiene forma de consultar o conectar el resumen generado por el bot de WhatsApp.
- Por que importa para una cafeteria: Evita que el personal de caja tenga que leer y transcribir 20 mensajes de conversacion; obtiene la comanda ya calculada para digitar en el sistema.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Alta.

### 2.7. Generacion Bajo Demanda de Resumen de Pedido
- Nombre de funcion: `generate_dashboard_order_summary_api` (linea 2887).
- Metodo y ruta: `POST /api/dashboard/generate-summary`.
- Que hace: Permite que el operador fuerce la generacion inmediata del ticket de cocina mediante OpenAI invocando a la funcion `generate_kitchen_ticket(clean_p, c_name)`. Almacena el resultado en `latest_order_summaries` y persiste el historial en disco con `save_chat_history()`.
- Estado en el Mockup: No la tiene.
- Donde esta:
  - Bot: `bot_wa.py` (funcion `generate_dashboard_order_summary_api`).
  - Mockup: Inexistente.
- Por que importa para una cafeteria: Si el cliente hizo un pedido atipico o no envio comprobante formal pero confirmo por texto, el cajero puede pulsar este boton para que la IA estructure los productos y cantidades al instante sin tener que redactar la comanda a mano.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Media.

### 2.8. Marcar Conversacion como Leida
- Nombre de funcion: `mark_dashboard_chat_read` (linea 2902).
- Metodo y ruta: `POST /api/dashboard/mark-read`.
- Que hace: Retira el numero telefonico del conjunto de no leidos (`unread_chats.discard`), resetea su contador de mensajes entrantes a cero (`unread_counts[phone] = 0`) y persiste el estado en disco con `save_chat_history()`.
- Estado en el Mockup: No la tiene.
- Donde esta:
  - Bot: `bot_wa.py` (funcion `mark_dashboard_chat_read`).
  - Mockup: En `Admin.dc.html` las alertas tienen descarte (`closeNotif`), pero no existe un tracking de lectura de mensajes de clientes de mensajeria.
- Por que importa para una cafeteria: Evita duplicar esfuerzos entre cajeras o mozos; si una operadora ya abrio el chat, deja de parpadear en verde en los demas puestos de monitoreo.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Media.

### 2.9. Resolucion de Alerta de Trabajador Requerido
- Nombre de funcion: `resolve_worker_attention` (linea 2918).
- Metodo y ruta: `POST /api/dashboard/resolve-worker`.
- Que hace: Elimina la alerta de intervencion humana (`requires_worker_chats.pop`), permite opcionalmente marcar el chat como atendido (`attended_chats.add`), limpia el estado de no leido y despausa el bot si el operador asi lo decide (`unpause=True`). Guarda los cambios en disco y emite registro en logger.
- Estado en el Mockup: No la tiene.
- Donde esta:
  - Bot: `bot_wa.py` (funcion `resolve_worker_attention`).
  - Mockup: En `Admin.dc.html`, la bandeja de notificaciones maneja quejas y solicitudes de hablar con una persona (`cli-`), pero solo ofrece botones de llamada telefonica o enlace externo `wa.me`, sin resolucion programatica de alertas del bot.
- Por que importa para una cafeteria: Permite despejar la cola de emergencias del panel una vez que la cajera atendio la duda del cliente o ingreso el pedido.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Alta.

### 2.10. Pausa y Reanudacion Individual del Bot
- Nombre de funcion: `toggle_dashboard_pause` (linea 2944).
- Metodo y ruta: `POST /api/dashboard/toggle-pause`.
- Que hace: Conmuta la presencia del telefono en el conjunto `pending_validation_users_wa`. Si el bot estaba activo, lo pausa para que no interfiera mientras un humano chatea con el cliente; si estaba pausado, lo reanuda para que vuelva a responder con IA.
- Estado en el Mockup: No la tiene.
- Donde esta:
  - Bot: `bot_wa.py` (funcion `toggle_dashboard_pause`).
  - Mockup: Inexistente a nivel de cliente individual.
- Por que importa para una cafeteria: Cuando un cliente tiene un reclamo delicado o una peticion especial fuera de carta, la IA debe callarse de inmediato para no dar respuestas contradictorias mientras el administrador conversa con el cliente.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Alta.

### 2.11. Conmutacion de Chat Atendido
- Nombre de funcion: `toggle_dashboard_attended` (linea 2967).
- Metodo y ruta: `POST /api/dashboard/toggle-attended`.
- Que hace: Ejecuta una triple accion en una sola llamada: anade o quita el chat de `attended_chats`, resuelve cualquier alerta de `requires_worker_chats`, despausa al bot de `pending_validation_users_wa` y limpia los contadores de mensajes no leidos, guardando de inmediato en `chat_history.json` y `user_sessions.json`.
- Estado en el Mockup: No la tiene.
- Donde esta:
  - Bot: `bot_wa.py` (funcion `toggle_dashboard_attended`).
  - Mockup: Inexistente para chats de WhatsApp.
  - Acta: Acta 02 (Kevin destaca la funcion de 'Marcar como atendido' para archivar chats resueltos).
- Por que importa para una cafeteria: Flujo de 1 solo clic que limpia la bandeja de entrada, archiva la conversacion y deja el bot listo para futuras compras sin pasos manuales redundantes.
- Clasificacion: CONFIRMADO en el codigo y en el acta.
- Prioridad: Alta.

### 2.12. Conmutacion Manual de Estado No Leido
- Nombre de funcion: `toggle_dashboard_unread` (linea 3003).
- Metodo y ruta: `POST /api/dashboard/toggle-unread`.
- Que hace: Permite al operador volver a marcar deliberadamente un chat como No Leido (activando el punto verde pulsante estilo WhatsApp y el contador visual de seguimiento), o retirarlo.
- Estado en el Mockup: No la tiene.
- Donde esta:
  - Bot: `bot_wa.py` (funcion `toggle_dashboard_unread`).
  - Mockup: Inexistente.
- Por que importa para una cafeteria: Si la cajera leyo un mensaje pero debe esperar confirmacion de cocina o de un motorizado, marca el chat como no leido para no olvidarlo entre decenas de mensajes.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Media.

### 2.13. Conmutacion Global de Modo Alta Demanda
- Nombre de funcion: `toggle_alta_demanda` (linea 3037).
- Metodo y ruta: `POST /api/dashboard/toggle-alta-demanda`.
- Que hace: Invierte el valor booleano de la variable global `alta_demanda_mode` y persiste el estado en `chat_history.json`. Esto modifica al instante el tiempo de entrega devuelto por `get_tiempo_estimado_str()` (pasa de "30 - 45 mnts." a "50 - 60 mnts.") y el texto explicativo de `get_tiempo_estimado_texto()` en todas las respuestas del bot y plantillas del panel.
- Estado en el Mockup: La tiene a medias.
- Donde esta:
  - Bot: `bot_wa.py` (funcion `toggle_alta_demanda`).
  - Mockup: En `Admin.dc.html`, existe un interruptor de alta demanda en la vista de Cocina (`kDemand`), pero solo afecta leyendas en la carta web y simulador; no cuenta con la logica dinamica de reemplazo en prompts y macros de mensajeria.
  - Acta: Acta 02 (E-39, Kevin explica el boton en la barra superior del panel).
- Por que importa para una cafeteria: En horas pico de fin de semana, prometer 30 minutos cuando la cocina esta desbordada destruye la reputacion del negocio. Cambiar el rango a 50-60 minutos con un clic alinea las expectativas del cliente.
- Clasificacion: CONFIRMADO en el codigo y en el acta.
- Prioridad: Alta.

### 2.14. Envio Manual de Mensajes por WhatsApp con Macros
- Nombre de funcion: `send_dashboard_manual_message` (linea 3049).
- Metodo y ruta: `POST /api/dashboard/send-message`.
- Que hace: Envia un mensaje de texto de WhatsApp directamente al cliente a traves de Meta Cloud API (`send_whatsapp_message_detailed`). Soporta 4 comandos abreviados (macros rapidas):
  1. `/listo`: Inserta mensaje de pedido en camino indicando el tiempo estimado dinamico (`get_tiempo_estimado_str()`) y recomendando estar atento a la llegada del repartidor.
  2. `/recojo`: Notifica que el pedido fue aceptado con exito y que se le avisara cuando este listo para recoger en tienda.
  3. `/ubicacion`: Solicita al cliente compartir su ubicacion exacta usando la funcion nativa de clip de WhatsApp para cotizar el delivery.
  4. `/pago`: Envia las cuentas oficiales (Yape/Plin al numero 977503006 a nombre de Maria Jose Morillo Ruiz, tarjeta contra entrega con POS o efectivo) solicitando el comprobante.
  Registra el mensaje en el historial como `admin` con nombre "Admin (Panel Web)", limpia el estado de no leido e inyecta una nota en el contexto de OpenAI (`user_sessions`) para que la IA sepa lo que el operador comunico.
- Estado en el Mockup: No la tiene.
- Donde esta:
  - Bot: `bot_wa.py` (funcion `send_dashboard_manual_message`).
  - Mockup: `Admin.dc.html` solo ofrece enlaces estaticos `https://wa.me/...` que intentan abrir la aplicacion externa de WhatsApp Web, sin capacidad de envio nativo ni insercion de macros desde el propio panel.
- Por que importa para una cafeteria: Permite que el personal responda en 2 segundos sin abandonar el sistema y sin cometer errores ortograficos o de datos bancarios.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Alta.

### 2.15. Envio Manual de Imagenes y Comprobantes
- Nombre de funcion: `send_dashboard_manual_image` (linea 3087).
- Metodo y ruta: `POST /api/dashboard/send-image`.
- Que hace: Recibe una imagen subida mediante formulario multipart (`UploadFile`) y un texto de pie de foto opcional (`caption`). Guarda el archivo en el directorio local `uploads/upload_<timestamp>.<ext>`, lo sube a los servidores de Meta WhatsApp Media API y lo remite al cliente. Registra el evento en `chat_logs_history` con `media_type="image"` y notifica a la sesion de OpenAI.
- Estado en el Mockup: No la tiene.
- Donde esta:
  - Bot: `bot_wa.py` (funcion `send_dashboard_manual_image`).
  - Mockup: Inexistente.
- Por que importa para una cafeteria: Permite enviar al cliente fotos de productos de vitrina del dia, comprobantes de pago POS, fotos de boletas o confirmaciones de entrega.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Media.

### 2.16. Eliminacion de Mensajes del Registro de Monitoreo
- Nombre de funcion: `delete_dashboard_message` (linea 3137).
- Metodo y ruta: `POST /api/dashboard/delete-message`.
- Que hace: Permite al administrador suprimir un mensaje especifico del historial visual del panel web mediante su identificador numerico unico `id`, recalculando la lista y persistiendo en disco con `save_chat_history()`.
- Estado en el Mockup: No la tiene.
- Donde esta:
  - Bot: `bot_wa.py` (funcion `delete_dashboard_message`).
  - Mockup: Inexistente.
- Por que importa para una cafeteria: Permite depurar mensajes con datos sensibles enviados por error o mensajes basura que ensucien la visualizacion de la orden.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Baja.

### 2.17. Servidor de Interfaz Web del Panel de Administracion
- Nombre de funcion: `serve_admin_panel` (linea 3413).
- Metodo y ruta: `GET /admin`.
- Que hace: Endpoint que despacha la aplicacion web de una sola pagina (SPA). Si la peticion carece de la cookie valida `caprichos_admin_session`, despacha el formulario HTML de login (`get_login_page_html()`). Si esta autenticado, entrega la consola completa de monitoreo en tiempo real con estilos CSS, scripts de sondeo periodico, sintesis de sonido, modal de extraccion de comandas y gestion de conversaciones.
- Estado en el Mockup: No la tiene.
- Donde esta:
  - Bot: `bot_wa.py` (funcion `serve_admin_panel`).
  - Mockup: `Admin.dc.html` es una aplicacion estatica de maquetacion sin conexion con la API del bot real.
- Por que importa para una cafeteria: Es la herramienta donde opera la cajera durante todo el turno para gestionar las ventas digitales.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Alta.

### 2.18. Recarga en Caliente de la Carta de Productos
- Nombre de funcion: `api_actualizar_carta` (linea 5171).
- Metodo y ruta: `POST /cmd/actualizar`.
- Que hace: Invoca a `load_dynamic_menu()` para leer el archivo `menu_dinamico.txt` desde el disco y actualizar la variable `CURRENT_PROMPT` con la nueva carta inyectada en el System Prompt de OpenAI, sin necesidad de reiniciar el proceso de Python ni interrumpir conexiones.
- Estado en el Mockup: No la tiene.
- Donde esta:
  - Bot: `bot_wa.py` (funcion `api_actualizar_carta` y `load_dynamic_menu`).
  - Mockup: En `Admin.dc.html`, los platos se gestionan en arrays estaticos de JavaScript en memoria local.
- Por que importa para una cafeteria: Si se agota un postre o sube un precio a mitad de la tarde, se actualiza el archivo de texto y se dispara este endpoint sin apagar el bot.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Media.

---

## 3. Panel Web de Administracion (`/admin`): Estructura, Botones y Operacion

El panel web montado en `/admin` dentro de `bot/bot_wa.py` (lineas 3200 a 5160) es una aplicacion SPA autosuficiente construida con HTML5, CSS moderno (paleta oscura slate `#0f172a`, acentos naranja `#ff7a00` y verde WhatsApp `#25d366`) y JavaScript vanilla optimizado para cero consumo innecesario de DOM.

### 3.1. Pantalla de Inicio de Sesion (`get_login_page_html`)
- Que muestra: Tarjeta central con efecto cristal (backdrop blur), icono de cafeteria, titulo "Caprichos Cafeteria", subtitulo "Panel de Monitoreo WhatsApp", campos para Usuario y Contrasena con boton interactivo de alternar visibilidad de clave (icono de ojo), mensaje de error dinamico y boton "Ingresar al Panel".
- Botones:
  - `btnTogglePwd`: Alterna el atributo `type` entre `password` y `text`.
  - `btnLogin`: Realiza peticion `fetch` al endpoint `/api/dashboard/login` y recarga la pagina con la cookie establecida.
- Manejo de errores: Banner superior de depuracion (`#debugErrorBanner`) gobernado por `window.onerror` para atrapar fallos de JavaScript en navegadores antiguos de tablets.

### 3.2. Barra Superior (Header)
- Que muestra: Logotipo "Caprichos - Panel de Monitoreo WhatsApp", indicador de estado "Online" con punto verde, controles de alerta auditiva y conmutador operativo.
- Botones y funcionalidades:
  1. `btnSoundToggle` (Campana): Conmuta el estado de sonido global entre `ON` (verde) y `OFF` (rojo). Guarda la preferencia en el `localStorage` del navegador (`caprichos_sound`).
  2. `btn-sound-test` (Probar Sonido): Ejecuta `playChimeSound(true)` para desbloquear la politica de autoplay del navegador (`audioCtx.resume()`) y verificar los parlantes del local.
  3. `btnAltaDemanda` (Alta Demanda): Muestra el estado actual ("Alta Demanda: OFF (30-45m)" o "Alta Demanda: ON (50-60m)"). Al pulsarlo, llama a `/api/dashboard/toggle-alta-demanda` y actualiza las leyendas en pantalla en tiempo real.
  4. `btn-logout` (Salir): Pide confirmacion al operador y ejecuta peticion a `/api/dashboard/logout`, recargando la vista al formulario de login.

### 3.3. Barra Lateral (Sidebar de Conversaciones)
- Que muestra: Contador total de conversaciones activas, caja de busqueda en vivo, pestanas de filtro y lista scrolleable de chats con renderizado hiperoptimizado mediante firmas de estado (`currentSig === lastRenderedListSig`).
- Buscador en vivo (`chatSearchInput`):
  - Permite filtrar en tiempo real por nombre de cliente, numero telefonico (nacional o internacional) o texto del ultimo mensaje. Dispone de boton de borrado rapido `btnClearSearch`.
- Pestanas de filtrado (3 categorias principales):
  1. `tabWorker` ("Requiere Atencion"): Filtra unicamente los chats que tienen activa una alerta en `requires_worker_chats` (contador de chats con badge rojo/amarillo).
  2. `tabToday` ("Hoy"): Filtra chats cuya ultima interaccion ocurrio dentro del dia calendario en horario de Lima (00:00:00 a 23:59:59).
  3. `tabAll` ("Todos"): Muestra la totalidad de chats en la base de datos, con soporte de paginacion ("Mostrar mas conversaciones", anade 60 chats por clic).
- Elementos por cada tarjeta de chat (`chat-item`):
  - Nombre del cliente.
  - Punto verde pulsante animado con CSS (`pulse-green`) si tiene mensajes no leidos.
  - Etiqueta de telefono con boton de copia rapida de 9 digitos (`btn-quick-copy`) pensado para pegar en la aplicacion WhatsApp Business de la cafeteria (celular 977503006).
  - Extracto del ultimo mensaje.
  - Alerta amarilla parpadeante (`badge-worker`) con el motivo especifico si requiere atencion.
  - Hora del mensaje.
  - Insignia numerica verde con la cantidad exacta de mensajes no leidos (`unread-count-badge`).
  - Etiquetas de estado: `REQUIERE ATENCION`, `ATENDIDO`, `BOT ACTIVO` o `PAUSADO`.

### 3.4. Panel Principal de Chat y Supervisor en Vivo
- Estado vacio (`emptyState`): Ilustracion con mensaje de orientacion recordando que el sistema emitira un timbre sonoro cuando entre un nuevo mensaje.
- Vista activa de chat:
  - Banner superior de alerta (`workerAlertBanner`): Aparece en fondo dorado con parpadeo suave indicando el motivo de derivacion ("REQUIERE ATENCION DE UN TRABAJADOR: Pedido por preparar / Validar pago").
  - Cabecera del chat (`chat-header`):
    - Boton "Volver" para navegacion responsive en pantallas moviles o tablets.
    - Nombre del cliente activo.
    - Chip de celular peruano formateado con boton de copiado rapido ("Copiar Celular").
    - Enlace directo "Abrir en WhatsApp" (`https://wa.me/519XXXXXXXX`).
    - Boton "Ver GPS": Aparece unicamente si el cliente compartio ubicacion satelital, enlazando directamente a las coordenadas en Google Maps.
    - Boton "Ver Resumen Pedido" (`btnOrderSummary`): Con animacion de pulso si hay un pedido pendiente de transcripcion. Abre la ventana modal de comandas para el POS.
    - Boton "Marcar No Leido / Marcar Leido": Alterna el punto verde de recordatorio.
    - Boton "Marcar Atendido": Resuelve en un clic la atencion, despausa el bot y archiva el chat.
    - Boton "Pausar Bot / Reanudar Bot": Frena inmediatamente las respuestas automaticas de la IA.
  - Area de conversacion (`messagesContainer`):
    - Burbujas de mensajes diferenciadas: cliente (gris oscuro a la izquierda), bot Capri (azul oscuro a la derecha) y administrador (naranja degrade a la derecha).
    - Separadores de fecha automaticos estilo WhatsApp (`[Fecha]  Hoy`, `[Fecha]  Ayer`, o fecha DD/MM/AAAA).
    - Visualizador de imagenes recibidas o enviadas con funcion de clic para ampliar a pantalla completa.
    - Tarjeta de coordenadas GPS con boton para abrir la ruta de entrega en Google Maps.
    - Hora del mensaje y boton de papelera (`btn-delete-msg`) para suprimir mensajes del registro.
  - Barra de respuestas rapidas (`quick-replies-bar`):
    - Botones con un toque para insertar las plantillas: `[Rayo] /listo`, `[Recojo] ️ /recojo`, `[Ubicacion]  /ubicacion`, `[Pago]  /pago`.
  - Caja de entrada de mensajes (`chat-input-area`):
    - Boton para adjuntar archivos de imagen (`imageFileInput`).
    - Soporte nativo para pegar capturas de pantalla directamente con el teclado (`Ctrl+V` mediante listener en `window.addEventListener('paste')`).
    - Contenedor de previsualizacion de imagen adjunta con opcion de cancelacion.
    - Area de texto autoajustable con soporte de salto de linea con `Shift+Enter` y envio con `Enter`.
    - Selector rapido de emojis comunes.
    - Boton principal "Enviar por WhatsApp".

### 3.5. Modal Ultraligero de Resumen de Pedido para POS (`summaryModalBackdrop`)
- Que muestra: Ventana modal con fondo desenfocado disenada especificamente para resolver la friccion operativa entre el chatbot de WhatsApp y el sistema de punto de venta (POS) del restaurante.
- Funcionalidades y botones:
  1. `summaryTextBox`: Muestra el ticket formal de cocina generado por OpenAI con el desglose del pedido. Si no existe, realiza una peticion asincrona a `/api/dashboard/generate-summary` para estructurarlo en tiempo real.
  2. `btn-copy-pos` ("Copiar Solo Productos (POS)"): Algoritmo en JavaScript (`copyOnlyProductsForPos`) que analiza linea por linea el ticket, descarta encabezados, datos del cliente, costos de delivery, montos totales y metodos de pago, y extrae UNICAMENTE las lineas con productos y cantidades (por ejemplo: `1x Frappe Lucuma 16oz`, `1x Croissant de Pollo`). Copia esta lista limpia al portapapeles y emite un toast de confirmacion para que la cajera solo tenga que pegar o digitar los items en la pantalla de pedidos.
  3. `btn-copy-full` ("Copiar Todo"): Copia el ticket integro con direccion, celular y total para comprobantes manuales.
  4. Boton "Marcar Atendido": Cierra la modal y marca el chat como procesado en un solo paso.

### 3.6. Sistema de Alertas Sonoras y Notificaciones Web
- Sintesis de sonido nativa: En lugar de depender de archivos `.mp3` o `.wav` pesados que pueden fallar por problemas de ruta o red, el panel utiliza la API Web Audio del navegador (`window.AudioContext`). Genera sinteticamente un timbre armonico de dos notas:
  - Nota 1: D5 (Re 5, 587.33 Hz) con envolvente de ganancia descendente de 0.35 segundos.
  - Nota 2: A5 (La 5, 880.00 Hz) reproducida 120 ms despues con duracion de 0.6 segundos.
- Activacion del sonido: Se dispara de forma automatica e instantanea cuando:
  1. Ingresa un nuevo mensaje de un cliente (`chat.last_sender === 'client'`).
  2. Un chat pasa al estado de Requiere Atencion (`hasNewWorkerAlert`).
- Notificaciones de escritorio (Browser Push Notifications): Mediante `Notification.requestPermission()`, el panel emite alertas flotantes en el sistema operativo mostrando el remitente y el contenido del mensaje, e inserta contadores dinamicos en el titulo de la pestana del navegador (`(1) Mensaje Nuevo - Caprichos Panel` o `([Alerta]️) Requiere Trabajador`).
- Sondeo en segundo plano: Un ciclo recursivo asincrono (`runChatPoll()`) consulta `/api/dashboard/chats` cada 3.5 segundos (`setTimeout(runChatPoll, 3500)`) garantizando una sincronizacion fluida sin recargar la pagina.

---

## 4. Evaluacion Comparativa: Panel Web del Bot frente al Admin del Mockup

Esta comparacion desglosa que tiene la consola web del bot que el prototipo `Admin.dc.html` no posee, y que capacidades avanzadas tiene el mockup que el bot no contempla.

| Caracteristica o Funcion | Panel Web del Bot (`/admin`) | Admin del Mockup (`Admin.dc.html`) | Evaluacion y Diagnostico de Negocio |
| :--- | :--- | :--- | :--- |
| **Bandeja de chat interactivo 2 vias** | Si, nativa con recepcion y envio en tiempo real. | No, solo ofrece botones con enlaces externos a `wa.me`. | En el bot la cajera chatea directamente desde el sistema; en el mockup se ve forzada a abrir WhatsApp Web en otra pestana. |
| **Pausa/Reanudacion de IA por cliente** | Si, boton con conmutacion inmediata (`toggle-pause`). | No la tiene. | Critico para evitar que el bot responda cosas inapropiadas durante un reclamo o atencion personalizada. |
| **Boton de Alta Demanda dinamico** | Si, conmuta de 30-45m a 50-60m en prompts y macros. | A medias (existe el interruptor pero solo cambia texto estatico). | El bot altera la promesa de entrega conversacional de la IA; en el mockup no tiene impacto en flujos externos. |
| **Copiado rapido de productos para POS** | Si, algoritmo que aisla unicamente items y cantidades. | No, el mockup asume que el pedido ya esta digitado en su propio POS. | Resuelve la queja principal de Kevin sobre el tiempo muerto de copiar pedidos de WhatsApp a restaurant.pe. |
| **Envio de imagenes / vouchers desde web** | Si, soporta subida de archivos y pegado con Ctrl+V. | No, solo permite subir comprobantes locales a un pedido ya creado. | El bot permite enviar fotos de vitrina o vouchers al cliente por WhatsApp desde el teclado de la PC. |
| **Alertas sonoras sintetizadas en navegador** | Si, generadas por Web Audio API (D5 + A5) sin archivos de audio. | A medias (dispone de `testKsnd` para campana de cocina). | El panel del bot suena ante mensajes entrantes de clientes; el mockup solo ante comandas de cocina. |
| **Macros de respuesta rapida** | Si (`/listo`, `/recojo`, `/ubicacion`, `/pago`). | No la tiene. | Acelera la digitacion de mensajes estandarizados de despacho y cobro. |
| **Gestion multirrol (Mozo, Cocina, Caja)** | No, es una pantalla unica de monitoreo general. | Si, control de acceso completo para 8 perfiles operativos. | El mockup es muy superior en organizacion interna del salon y estaciones de trabajo. |
| **Pantalla KDS (Cocina) con estaciones** | No, solo muestra tickets de texto plano en modal. | Si, KDS visual completo con barras de progreso y tiempos. | El mockup resuelve la preparacion fisica; el bot solo la recepcion y el triaje. |
| **Caja, Arqueo y Facturacion Sunat** | No, carece de modulo contable, boletas o control de turnos. | Si, modulo de caja completo con apertura, cierre y comprobantes. | El bot requiere apoyarse en un sistema transaccional como el del mockup o restaurant.pe. |
| **Control de Stock, Recetas y Mermas** | No, solo lee `menu_dinamico.txt` como texto plano. | Si, gestion de insumos minimos, recetas y descontado de stock. | En el bot no hay conexion con existencias reales; en el mockup se descuenta cada insumo. |
| **Modulo de Repartidores y Mapa de Calor** | No, solo link individual a Google Maps por cliente. | Si, despacho de riders, estados de entrega y mapa de calor. | El mockup ofrece monitoreo logistico avanzado de la flota de reparto. |
| **Modo Offline con sincronizacion local** | No, si el VPS o la red caen, el panel queda inaccesible. | Si, arquitectura con persistencia local y aviso de sin red. | Fortaleza del mockup ante cortes de internet en Campoy. |

---

## 5. Tareas Programadas y Automatizaciones de Fondo

### 5.1. Tarea Nocturna de Auto-Reanudacion y Limpieza (`midnight_auto_resume_task`)
- Que hace: Tarea asincrona continua iniciada durante el evento `@app.on_event("startup")` (linea 2145).
- Logica temporal: Obtiene la hora actual en Lima (`America/Lima`). Calcula los segundos exactos restantes hasta las 00:00:05 horas del dia siguiente (`next_midnight`). Ejecuta una pausa asincrona no bloqueante (`await asyncio.sleep(sleep_seconds)`).
- Acciones a medianoche:
  1. Vacia completamente el conjunto de usuarios pausados (`pending_validation_users_wa.clear()`), garantizando que ningun cliente quede silenciado al dia siguiente por olvido del personal.
  2. Limpia todas las alertas acumuladas de intervencion humana (`requires_worker_chats.clear()`).
  3. Limpia el conjunto de clientes en espera de consulta de pedidos (`waiting_order_query_users.clear()`).
  4. Guarda el estado limpio en `user_sessions.json` y `chat_history.json`.
  5. Emite registros detallados en consola informando cuantos chats fueron despausados y cuantas alertas fueron purgadas.
- Estado en el Mockup: No la tiene.
- Donde esta:
  - Bot: `bot_wa.py` (funcion `midnight_auto_resume_task` y `startup_event`).
  - Mockup: En `Admin.dc.html`, el reloj virtual avanza minutos con `tick()`, pero no implementa un cron nocturno de despausa automatica ni limpieza de colas.
- Por que importa para una cafeteria: Si una cajera pauso a un cliente a las 9:30 PM para resolver una duda y luego cerro el local sin reanudarlo, ese cliente amaneceria con el bot completamente mudo. La tarea nocturna garantiza que a las 00:00 el sistema se resetee y este listo para recibir pedidos de madrugada o primera hora del dia siguiente.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Alta.

### 5.2. Agrupador de Mensajes Consecutivos (Debouncer Asincrono)
- Que hace: Funcion `add_to_user_buffer_wa` y `process_debounced_messages_wa` (lineas 2170 y 2446). Implementa una pausa de espera de 2.0 segundos (`DEBOUNCE_DELAY = 2.0`). Cada nuevo mensaje de un mismo cliente cancela la tarea asincrona previa (`cancel()`) y reinicia el contador. Al completarse los 2 segundos de silencio, concatena todos los textos en una sola entrada y realiza un unico llamado a OpenAI.
- Estado en el Mockup: No la tiene.
- Donde esta:
  - Bot: `bot_wa.py` (funciones `process_debounced_messages_wa` y `add_to_user_buffer_wa`).
  - Mockup: En `Chatbot.dc.html` las interacciones son eventos de clic sincronos individuales.
- Por que importa para una cafeteria: En WhatsApp los clientes escriben en rafagas de mensajes cortos ("hola", "tienen queque", "de zanahoria", "a cuanto"). Sin debouncer, el bot dispararia 4 llamadas paralelas a OpenAI generando respuestas atropelladas y cuadruplicando el costo de tokens.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Alta.

---

## 6. Gestion de Estados de Sesion y Flujos de Conversacion

El bot administra variables de estado en memoria RAM que se sincronizan con archivos JSON en cada modificacion relevante:

### 6.1. Variables y Conjuntos de Estado
1. `user_sessions`: Diccionario (`phone` -> lista de mensajes con OpenAI). Mantiene el hilo conversacional. Para evitar sobrecostos y desbordamientos de contexto, almacena los roles `system`, `user`, `assistant` y llamadas a `tool`.
2. `pending_validation_users_wa`: Conjunto de telefonos cuyos mensajes no deben ser procesados por la IA. Se activa cuando el cliente envia comprobante, pide atencion humana o es pausado desde el panel web.
3. `requires_worker_chats`: Diccionario (`phone` -> texto del motivo). Almacena los chats que requieren atencion inmediata de la cajera, mostrandose con alta prioridad en el panel web.
4. `attended_chats`: Conjunto de telefonos cuyos pedidos o consultas ya fueron resueltos por el personal de cafeteria.
5. `unread_chats` y `unread_counts`: Estructuras que rastrean que clientes tienen mensajes nuevos pendientes de lectura y la cantidad exacta de los mismos.
6. `recently_approved_chats`: Conjunto de telefonos cuyos pedidos acaban de ser aprobados por la cocina/admin, permitiendo que si el cliente responde "gracias" u "ok", el bot solo emita una respuesta breve de cortesia sin volver a iniciar la toma de orden.
7. `waiting_order_query_users`: Clientes que pulsaron el boton de consultar estado de pedido y el sistema espera que proporcionen su nombre y celular.
8. `user_gps`: Diccionario que asocia el telefono con la latitud y longitud satelital compartida por WhatsApp.

### 6.2. Clasificacion de Tipos de Mensajes Entrantes (`process_incoming_msg_wa`)
El bot implementa manejadores especificos segun el payload de Meta:
- Texto (`text`): Extrae coordenadas escritas si existen, detecta si el usuario envio direcciones en texto plano para exigir el envio de ubicacion GPS nativa mediante clip, y evalua intenciones de compra o saludos.
- Botones interactivos (`interactive`): Procesa pulsaciones de botones de bienvenida, carta o atencion humana. Intercepta ademas las respuestas de administradores (`approve_` y `reject_`).
- Botones simples (`button`): Manejo de compatibilidad con respuestas de botones rapidos de Meta.
- Notas de voz y audios (`audio`, `voice`): Descarga el binario desde los servidores de Meta mediante `get_whatsapp_media_bytes` y lo transcribe a texto con Whisper mediante `transcribe_audio_bytes`. Si la calidad no es suficiente, solicita amablemente redactar el pedido por texto.
- Ubicacion nativa (`location`): Extrae latitud y longitud exactas, calcula el poligono de delivery con `calculate_delivery_cost(lat, lon)` y formula el enlace a Google Maps.
- Imagenes (`image`): Descarga la foto, la convierte a base64 y la guarda en la carpeta local `uploads/`. La envia a OpenAI Vision (`gpt-4o-mini`) para validar si corresponde a un voucher de pago de Yape/Plin o transferencia bancaria.
- Stickers, Videos y Documentos (`sticker`, `video`, `document`): Saluda amablemente y orienta la conversacion hacia la carta o consulta si es un comprobante de pago en PDF.

---

## 7. Notificaciones al Personal, Aprobacion y Tickets de Cocina

### 7.1. Generacion de Comandas de Cocina (`generate_kitchen_ticket`)
- Que hace: Linea 1703 de `bot_wa.py`. Cuando el pedido esta completo o se detecta pago, la funcion inyecta un prompt a OpenAI exigiendo generar un ticket con formato estricto:
  - Nombre del cliente y celular.
  - Modalidad: Delivery (con enlace GPS de Google Maps) o Recojo en Tienda / Consumo en Salon.
  - Lista de productos con opciones y complementos.
  - Total a pagar y metodo de pago (Yape, Plin, Efectivo, Tarjeta POS).
  - Fecha y hora exacta.
- Estado en el Mockup: La tiene a medias.
- Donde esta:
  - Bot: `bot_wa.py` (funcion `generate_kitchen_ticket`).
  - Mockup: En `Admin.dc.html`, la funcion interna de comanda (`ctTicket`) formatea pedidos locales, pero no cuenta con la conversion automatizada desde lenguaje natural conversacional.
- Por que importa para una cafeteria: Elimina la ambiguedad en cocina; estandariza lo que el cliente pidio de forma coloquial en una comanda legible para los baristas y cocineros.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Alta.

### 7.2. Envio de Notificacion a WhatsApp del Personal con Botones Interactivos
- Nombre de funcion: `send_admin_order_notification_with_buttons` (linea 1795).
- Que hace: Envia a los numeros registrados en `ADMIN_WHATSAPP_NUMBERS` un mensaje enriquecido que contiene:
  1. Imagen del comprobante de pago adjunta.
  2. Texto completo del ticket de cocina.
  3. Enlace directo al chat del cliente (`wa.me/...`).
  4. Enlace al mapa satelital si es delivery.
  5. Dos botones interactivos nativos de WhatsApp: `approve_{session_id}` ("Aprobar Pedido") y `reject_{session_id}` ("Rechazar").
- Estado en el Mockup: No la tiene.
- Donde esta:
  - Bot: `bot_wa.py` (funcion `send_admin_order_notification_with_buttons`).
  - Mockup: El mockup depende de campanas y notificaciones dentro de su propia interfaz web; no envia pedidos a dispositivos WhatsApp del personal.
- Por que importa para una cafeteria: Permite que el dueno o el jefe de cocina valide pedidos desde su telefono personal mientras se desplaza por el local sin estar frente a una computadora.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Alta.

### 7.3. Procesamiento de Decisiones de Aprobacion y Rechazo (`handle_admin_order_action_wa`)
- Que hace: Linea 1838 de `bot_wa.py`. Procesa la pulsacion de los botones por parte del personal:
  - Si pulsa "Aprobar":
    1. Incrementa el contador historico del cliente en `client_db.py` (`increment_approved_order_count`).
    2. Retira al cliente de usuarios pausados y alertas humanas.
    3. Registra el chat en `recently_approved_chats`.
    4. Determina si es recojo o delivery. Si es delivery, toma el tiempo estimado dinamico (`get_tiempo_estimado_str()`) y envia un mensaje formal de confirmacion al cliente: "Gracias... En un plazo aprox a 30 - 45 mnts. (o 50 - 60 mnts.) estara llegando su pedido...". Si es recojo, envia mensaje informando que se le avisara cuando este listo.
    5. Confirma al administrador que aprobo el pedido con el historial de compras del cliente.
  - Si pulsa "Rechazar":
    1. Despausa el chat.
    2. Envia un mensaje cordial al cliente explicandole que hubo un problema con la validacion de su pago (monto incorrecto o no verificado) solicitando el reenvio del comprobante adecuado.
    3. Confirma al administrador el rechazo de la orden.
- Estado en el Mockup: No la tiene.
- Donde esta:
  - Bot: `bot_wa.py` (funcion `handle_admin_order_action_wa`).
  - Mockup: Inexistente en `Admin.dc.html`.
- Por que importa para una cafeteria: Es el circuito formal de cobro y despacho seguro para pagos por billeteras digitales (Yape/Plin).
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Alta.

---

## 8. Almacenamiento de Datos, Formatos y Archivo Nocturno

El sistema de almacenamiento del bot fue disenado con precauciones estrictas para evitar corrupcion de archivos y desbordamiento de memoria RAM en servidores pequenos:

### 8.1. Escritura Atomica de Archivos (`atomic_json_dump`)
- Que hace: Linea 355 de `bot_wa.py`. Para evitar que un reinicio imprevisto o corte de energia deje un archivo JSON a medio escribir o corrupto:
  1. Escribe primero los datos en un archivo temporal con sufijo `.tmp`.
  2. Ejecuta un reemplazo atomico a nivel de sistema de archivos con `os.replace(tmp_file, filepath)`.
  3. Si ocurre una excepcion de sistema operativo, recurre a `shutil.move` o guardado directo con captura de errores y remocion de temporales huerfanos.
- Estado en el Mockup: No la tiene (el mockup usa el almacenamiento local del navegador `localStorage`).
- Prioridad: Alta.

### 8.2. Archivo Continuo de Historial y Control de RAM (`MAX_ACTIVE_LOGS_PER_CHAT = 25`)
- Que hace: Lineas 330 a 352, 440 a 480 y 700 a 703 de `bot_wa.py`.
  - El bot impone un limite maximo de 25 mensajes activos por cliente en memoria RAM (`MAX_ACTIVE_LOGS_PER_CHAT = 25`).
  - Cuando una conversacion supera los 25 mensajes (por ejemplo, en clientes frecuentes que conversan a diario), la funcion `log_chat_message` y la carga en `load_chat_history` cortan los mensajes mas antiguos y los trasladan de forma acumulativa al archivo `chat_history_archive.json` mediante `archive_old_chat_logs`.
  - En RAM y en `chat_history.json` unicamente se retienen los ultimos 25 registros.
- Estado en el Mockup: No la tiene.
- Prioridad: Media.

### 8.3. Extraccion de Imagenes Base64 hacia Almacenamiento en Disco
- Que hace: Lineas 445 a 465 y 503 a 525 de `bot_wa.py`.
  - Cuando se procesa una imagen o comprobante, esta no se almacena como texto base64 dentro de los archivos JSON.
  - En `load_chat_history`, si detecta un string `data:image`, lo decodifica y lo guarda en el disco como archivo binario en `uploads/client_photo_{phone}_{id}.jpg`, reemplazando el valor en memoria por la ruta relativa `/uploads/...`.
  - En `save_user_sessions`, la funcion auxiliar `_clean_session_for_storage` limpia los objetos `image_url` pesados del contexto de OpenAI, sustituyendolos por el texto liviano `[Comprobante/Foto procesada]`.
- Estado en el Mockup: No la tiene.
- Prioridad: Alta.

### 8.4. Archivos de Persistencia y Estructura de Datos
1. `chat_history.json`:
   - Formato: JSON estructurado.
   - Campos: `alta_demanda_mode` (booleano), `chat_logs_history` (diccionario de telefono a lista de mensajes con id, sender, name, text, media_type, media_url, location_url, timestamp), `user_names` (diccionario de nombres de clientes), `attended_chats` (lista de telefonos atendidos), `unread_chats` (lista de telefonos no leidos), `unread_counts` (diccionario de contadores), `requires_worker_chats` (diccionario de alertas con su razon), `latest_order_summaries` (diccionario de tickets generados).
2. `chat_history_archive.json`:
   - Formato: JSON acumulativo de mensajes historicos archivados por telefono.
3. `user_sessions.json`:
   - Formato: JSON con sesiones conversacionales de OpenAI, ubicaciones GPS (`user_gps`), marcas de ultima actividad y conjuntos de estado (`pending_validation_users_wa`, `recently_approved_chats`, `waiting_order_query_users`).
4. `clientes.json` (gestionado por `client_db.py`):
   - Formato: Base de datos relacional/JSON de clientes de la cafeteria con nombre, celular, costo de delivery habitual, direccion de entrega, coordenadas GPS, notas especiales y contador de compras aprobadas.
5. `special_notice_notified.json`:
   - Formato: Registro con fecha y lista de telefonos notificados ante eventos extraordinarios (como cortes de luz programados).
6. Directorio `uploads/`:
   - Almacena comprobantes de pago de Yape/Plin, capturas de pedidos e imagenes enviadas por la administracion.

---

## 9. Limites de Uso, Rendimiento y Seguridad Operativa

1. Agrupamiento de mensajes (Debounce): Pausa calibrada de 2.0 segundos para consolidar rafagas de texto antes de llamar a las APIs de OpenAI, optimizando la latencia de respuesta entre 2 y 4 segundos totales.
2. Memoria conversacional limitada: 25 mensajes activos por cliente para evitar degradacion de memoria del servidor.
3. Paginacion en el panel web: Inicialmente se renderizan 60 conversaciones (`displayedChatsLimit = 60`), con carga incremental bajo demanda para evitar el congelamiento del navegador en dispositivos moviles.
4. Frecuencia de sondeo (Polling): Intervalo estricto de 3500 milisegundos (`runChatPoll`), con proteccion contra solapamiento mediante la bandera `isPollingChats`.
5. Autenticacion persistente: Cookie HTTP de 30 dias con politicas `samesite="lax"`.
6. Proteccion de inyeccion HTML: Funcion `escapeHtml()` en el panel web que sanitiza cadenas entrantes previniendo ataques de Cross-Site Scripting (XSS) mediante mensajes maliciosos de WhatsApp.

---

## 10. Manejo de Errores, Tolerancia a Fallos y Reintentos

1. Retorno inmediato HTTP 200 en Webhook: Cumplimiento de la regla de Meta de responder en menos de 5 segundos; cualquier fallo en la IA o en el procesamiento no afecta el codigo HTTP entregado a WhatsApp.
2. Fallback de botones interactivos: Si Meta rechaza el envio de botones interactivos (por politicas de formato o incompatibilidad del cliente receptor), las funciones `send_whatsapp_interactive_buttons_detailed` capturan el error y envian de inmediato un mensaje de texto plano con opciones numeradas (`1️⃣ Carta, 2️⃣ Ya sé qué pedir...`).
3. Fallback de notas de voz Whisper: Si la descarga del audio de WhatsApp falla o el modelo Whisper no logra transcribir el audio por baja calidad, el bot no se cuelga; envia un mensaje cordial pidiendo al cliente redactar su pedido por texto.
4. Prevencion de cuelgues en el panel web: Control global de errores con `window.onerror` y `unhandledrejection`, que reporta visualmente la linea y columna exacta del error en un banner rojo en lugar de dejar la pantalla en blanco.
5. Escritura redundante de archivos: En caso de que el comando atomico del sistema operativo falle, `atomic_json_dump` atrapa la excepcion y ejecuta un intento de escritura directa para no perder datos en memoria.

---

## 11. Reglas y Funciones que Faltan en el Mockup (Priorizadas)

A continuacion se presentan las capacidades confirmadas en el codigo del bot y en las actas de descubrimiento que el prototipo actual de Caprichos (`Admin.dc.html`, `Main.dc.html`, `Chatbot.dc.html`) no tiene implementadas o solo simula de forma precaria:

### Prioridad Alta
1. Consola web de atencion y monitoreo de WhatsApp en tiempo real:
   - Que falta: El mockup asume que el personal gestiona WhatsApp abriendo la aplicacion externa en un telefono fisico o pestana separada. Falta integrar una vista o modulo de mensajeria interna donde el cajero vea las conversaciones entrantes, pause el bot, responda textos y resuelva alertas de clientes.
   - Donde esta: Confirmado en `bot_wa.py` (lineas 3413-5160) y en Acta 02 (E-39 y testimonios de Kevin sobre el panel del bot).
   - Por que importa: Es la herramienta donde el cliente pasa el 80% de su tiempo atendiendo pedidos digitales.
2. Extraccion automatica de productos para el POS ("Copiar Solo Productos"):
   - Que falta: Un mecanismo que tome el resumen conversacional de la comanda y extraiga exclusivamente las lineas de productos y cantidades para cargarlas al punto de venta sin tener que transcribirlas manualmente.
   - Donde esta: Confirmado en `bot_wa.py` (funcion `copyOnlyProductsForPos` y `get_dashboard_order_summary`).
   - Por que importa: Resuelve el cuello de botella de transcripcion de pedidos senalado por Kevin en la reunion.
3. Conmutador dinamico de Alta Demanda con ajuste de promesas de entrega:
   - Que falta: Aunque el mockup tiene un switch visual de alta demanda en cocina, este no altera la logica de toma de pedidos ni modifica los tiempos ofrecidos al cliente en la carta o en los mensajes automaticos.
   - Donde esta: Confirmado en `bot_wa.py` (funcion `toggle_alta_demanda` y `get_tiempo_estimado_str`) y en Acta 02 (E-39).
   - Por que importa: Evita cancelaciones y reclamos por demoras en horas punta de fin de semana.
4. Protocolo de Aprobacion / Rechazo con botones interactivos y confirmacion formal:
   - Que falta: Un flujo donde la cocina o caja apruebe o rechace formalmente una orden recibida con comprobante Yape/Plin, disparando un mensaje oficial con el tiempo de entrega al cliente.
   - Donde esta: Confirmado en `bot_wa.py` (funciones `handle_admin_order_action_wa` y `send_admin_order_notification_with_buttons`).
   - Por que importa: Brinda certeza al cliente de que su pago fue verificado y su pedido entro a preparacion.
5. Tarea automatica de medianoche (Auto-resume de chats):
   - Que falta: Un proceso de limpieza que a las 00:00 despause clientes silenciados y limpie colas de atencion para no arrastrar bloqueos al dia siguiente.
   - Donde esta: Confirmado en `bot_wa.py` (funcion `midnight_auto_resume_task`).
   - Por que importa: Garantiza la operatividad continua del servicio 24/7 sin intervencion tecnica manual.

### Prioridad Media
6. Copiado rapido de celular peruano formateado a 9 digitos:
   - Que falta: Un boton en cada ficha de cliente que limpie el prefijo internacional `51` y copie los 9 digitos limpios al portapapeles para pegarlos de inmediato en el buscador de contactos de WhatsApp Business.
   - Donde esta: Confirmado en `bot_wa.py` (funcion `copyCustomerPhone` y `getNationalPhone`).
   - Por que importa: Facilita llamadas de emergencia del repartidor o busqueda rapida en telefonos fisicos.
7. Alertas sonoras sintetizadas en navegador sin dependencias de archivos:
   - Que falta: Implementacion de Web Audio API para emitir tonos de campana ante eventos criticos de clientes en el panel administrativo sin requerir la carga de archivos de audio externos.
   - Donde esta: Confirmado en `bot_wa.py` (funcion `playChimeSound`).
   - Por que importa: Asegura que el personal escuche los pedidos incluso si los archivos multimedia no cargan o la conexion es inestable.
8. Macros de respuesta rapida predefinidas:
   - Que falta: Botones de insercion inmediata de plantillas para `/listo`, `/recojo`, `/ubicacion` y `/pago`.
   - Donde esta: Confirmado en `bot_wa.py` (funcion `send_dashboard_manual_message` y `quick-replies-bar`).
   - Por que importa: Ahorra tiempo y estandariza la comunicacion del personal.
9. Deteccion de consultas de demora y enlace con RestaurantPE:
   - Que falta: Captura inteligente de frases sobre demora ("no llega mi pedido", "cuanto falta") para pausar el bot de inmediato y alertar al personal con prioridad alta.
   - Donde esta: Confirmado en `bot_wa.py` (lineas 2360 a 2395).
   - Por que importa: Evita que la IA de respuestas genericas cuando un cliente esta molesto por tardanza de su comida.

### Prioridad Baja
10. Soporte de pegado de imagenes desde portapapeles (Ctrl+V):
    - Que falta: Capacidad de pegar capturas directamente en la interfaz del chat para enviarlas al cliente.
    - Donde esta: Confirmado en `bot_wa.py` (evento `paste` en linea 4220).
    - Por que importa: Comodidad operativa para el operador de computadora.
11. Paginacion y desborde ciclico de historial de conversaciones:
    - Que falta: Estrategia de archivado que retenga solo 25 mensajes en memoria activa y traslade el resto a un archivo secundario.
    - Donde esta: Confirmado en `bot_wa.py` (funcion `archive_old_chat_logs`).
    - Por que importa: Protege la estabilidad del sistema a largo plazo.

---

## 12. Riesgos Tecnicos y Operativos Identificados

1. Disparidad entre el Modelo Mental de Kevin y el Mockup:
   - Kevin Rosales ya opera con un panel web funcional que le permite monitorear WhatsApp, pausar bots, ver alertas amarillas y conmutar alta demanda. Si el sistema definitivo reemplaza este flujo por completo obligandolo a usar solo pantallas de POS y KDS sin una consola de chat integrada, el cliente percibira una perdida de control operativo sobre sus clientes de WhatsApp.
2. Sobreescritura de Estados Concurrentes:
   - Si multiples computadoras abren el panel web `/admin` y envian peticiones concurrentes de marcado de atendido o modificacion de mensajes, el guardado atomico basado en lectura y reescritura de archivos JSON completos (`chat_history.json`) podria generar condiciones de carrera perdiendo actualizaciones menores. Se recomienda migrar estas estructuras a una base de datos embebida transaccional (como SQLite con modo WAL).
3. Dependencia de Tokens de Meta sin Autorenovacion Visible:
   - La integracion de WhatsApp depende de tokens de Meta Cloud API. Si los tokens no son permanentes (System User Token de larga duracion), el servicio fallara silenciosamente impidiendo la recepcion y envio de mensajes.
4. Desconexion del Bot con el Inventario Real:
   - El bot real continua ofreciendo productos basados en un archivo plano `menu_dinamico.txt` desvinculado de las existencias fisicas de cocina. Si se agota un insumo critico en el local, el bot seguira vendiendolo a menos que alguien edite manualmente el archivo de texto y dispare el endpoint `/cmd/actualizar`.
5. Ruptura de Contexto por Sobredesarrollo de la Memoria:
   - Al limitar el historial activo a 25 mensajes, clientes muy conversadores podrian perder detalles de pedidos acordados lineas arriba si no se confirma la orden dentro del rango de memoria activa.

---

INFORME LISTO
