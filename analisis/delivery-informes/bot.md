---
id: ANA-CAP-029
tipo: analisis
titulo: "INFORME TECNICO Y DE NEGOCIO: LOGICA DEL CHATBOT REAL FRENTE AL MOCKUP DE CAPRICHOS"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, delivery-informes]
---

# INFORME TECNICO Y DE NEGOCIO: LOGICA DEL CHATBOT REAL FRENTE AL MOCKUP DE CAPRICHOS

## 1. Resumen Ejecutivo y Enfoque del Analisis

El presente informe evalua en profundidad la logica de negocio implementada en el chatbot real de la cafeteria Caprichos (localizado en el directorio `bot/`, compuesto principalmente por `bot_wa.py`, `bot.py`, `prompt.py`, `AGENTS.md`, `client_db.py`, `geo_utils.py` y `sheet_sync.py`) y la contrasta directamente con los prototipos del sistema administrativo (`fuente/Admin.dc.html`), la carta web (`fuente/Main.dc.html`), el simulador de chat (`fuente/Chatbot.dc.html`) y las actas de descubrimiento con el cliente Kevin Rosales (`fuente/acta-01-descubrimiento.md`, `fuente/acta-02-descubrimiento.md` e `fuente/flujo-de-pedidos.md`).

El chatbot real de Caprichos es un desarrollo funcional maduro basado en FastAPI, Meta WhatsApp Cloud API y OpenAI (GPT-4o-mini). Contiene reglas operativas muy especificas del rubro gastronomico limeño, producto de meses de aprendizaje con clientes reales (criterios de modismos peruanos, geometria geoespacial de reparto, debouncing de mensajes fragmentados, reglas de modificadores en bebidas artesanales y aprobacion manual en cocina). El mockup, por su parte, posee un modelo visual y operativo enfocado en la gestion administrativa integral (pantallas KDS, cajas, roles, pedidos presenciales y despacho), pero carece o simula parcialmente varias reglas de validacion y conversion critica desarrolladas para el bot.

---

## 2. Analisis Detallado de Reglas de Negocio del Bot frente al Mockup

A continuacion se examinan cada una de las reglas de negocio identificadas mediante inspeccion de codigo y terminos clave. Cada regla desglosa: que hace en el bot real, su estado en el mockup (La tiene, La tiene a medias, No la tiene), ubicacion exacta, impacto para una cafeteria, clasificacion entre confirmado y suposicion, y prioridad.

### 2.1. Horario de Atencion y Cero Spam de Horarios
- Que hace: En `bot_wa.py` (funcion `get_ai_response`) y `AGENTS.md` (Regla 1), el bot evalua la hora en Lima (`America/Lima`). La tienda y cocina atienden despachos de 2:00 PM a 10:00 PM. La recepcion de pedidos por WhatsApp opera las 24 horas. Aplica una regla estricta de "CERO SPAM DE HORARIO": el horario NUNCA se menciona en saludos, botones ni mensajes intermedios; SOLO se comunica si el cliente pregunta explicitamente o al confirmar un pedido fuera de horario, aclarando amablemente que la preparacion y despacho iniciaran a las 2:00 PM.
- Estado en el Mockup: La tiene a medias.
- Donde esta: 
  - Bot: `bot_wa.py` (en `get_ai_response`, variable `contexto_horario`) y `AGENTS.md` (Regla 1).
  - Mockup: `Admin.dc.html` y `Main.dc.html` (objeto `INFO` con `abre: '14:00', cierra: '22:00'`, funcion `statusNow`); `Chatbot.dc.html` (pregunta frecuente `d3` que devuelve el horario comercial).
  - Acta: Acta 02 (`00:03:55`), pedidos para hoy.
- Por que importa para una cafeteria: Si el bot suelta el horario en cada interaccion o bloquea pedidos fuera de hora, genera friccion de venta y frustra a clientes que desean programar un pedido anticipado de tarde o noche.
- Clasificacion: CONFIRMADO en el codigo y en el acta.
- Prioridad: Alta.

### 2.2. Fuera de Horario
- Que hace: Cuando entra un mensaje fuera del rango 14:00 - 22:00, el bot no interrumpe el flujo de toma de orden. Permite seleccionar productos, direccion y pago con normalidad, y recien al momento de emitir el resumen o ticket recuerda cordialmente que el despacho comenzara a las 2:00 PM.
- Estado en el Mockup: No la tiene.
- Donde esta:
  - Bot: `bot_wa.py` (en `get_ai_response`, directiva `contexto_horario`).
  - Mockup: En `Main.dc.html` y `Chatbot.dc.html`, el indicador de estado muestra simplemente la etiqueta cerrada ("Cerrado hoy"), pero no cuenta con la logica conversacional de captura diferida de pedidos 24h.
- Por que importa para una cafeteria: Captura ventas dormidas durante la mañana o madrugada para despachar en la apertura del turno de tarde.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Media.

### 2.3. Debouncer (Agrupamiento de Mensajes Consecutivos)
- Que hace: En WhatsApp, los clientes suelen enviar frases fragmentadas sucesivas ("hola", "quiero un frappe", "de lúcuma", "con leche sin lactosa"). En `bot_wa.py` (funciones `add_to_user_buffer_wa` y `process_debounced_messages_wa`), el sistema implementa una pausa de espera de 2.0 segundos (`DEBOUNCE_DELAY = 2.0`). Cada nuevo mensaje reinicia la tarea asincrona (`cancel()`). Al cumplirse la pausa, procesa todo el texto consolidado en un solo llamado a OpenAI. En Telegram (`bot.py`), el temporizador es de 10 segundos.
- Estado en el Mockup: No la tiene.
- Donde esta:
  - Bot: `bot_wa.py` (`process_debounced_messages_wa` y `add_to_user_buffer_wa`); `AGENTS.md` (Regla 1).
  - Mockup: `Chatbot.dc.html` es una maquina de estados de JavaScript en memoria que reacciona de forma sincrona e inmediata a eventos `onClick` de botones predefinidos; no procesa mensajes asincronos ni rafagas.
- Por que importa para una cafeteria: Evita respuestas atropelladas, saludos duplicados y reduce drasticamente el consumo de tokens y costos de OpenAI por mensajes aislados de una sola palabra.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Alta.

### 2.4. Promociones Vigentes: Duo Compartir
- Que hace: En `AGENTS.md` (Regla 2 y 9), `prompt.py` y `sheet_sync.py`: Promocion consistente en 2 Bebidas (frias o calientes, excepto frozen) mas 1 Complemento. Precios estructurados por tamaño de bebida: 12oz S/ 33, 16oz S/ 36, 20oz/21oz S/ 38. Complementos permitidos: 2 donas, 2 galletas, o 1 combinada (1 dona + 1 galleta); pero si el cliente elige un complemento unitario de mayor costo (Carrot Cake, Keke Marmoleado, Empanada de pollo/jamon o 4 Petit Pan), la regla impone que sea exclusivamente 1 unidad.
- Estado en el Mockup: La tiene a medias.
- Donde esta:
  - Bot: `AGENTS.md` (Regla 2 y 9), `prompt.py` y `sheet_sync.py` (lineas de formateo de combo Duo Compartir).
  - Mockup: En `Admin.dc.html` (`SEED`, pedido `CP-0102` "DUO PARA COMPARTIR" Regular S/ 33) y `Main.dc.html` (seccion `COMBOS`).
  - Acta: Acta 02 (`00:37:31`, Kevin explica la regla condicional de 2 donas vs 1 carrot cake que restaurant.pe no lograba configurar).
- Por que importa para una cafeteria: Es el combo insignia de mayor venta en parejas y oficinas. Si el software permite seleccionar 2 tortas o 2 empanadas al mismo precio promocional, destruye el margen de ganancia de la cocina.
- Clasificacion: CONFIRMADO en el codigo y en el acta.
- Prioridad: Alta.

### 2.5. Promociones Vigentes: Duo Irresistible, Media Docena y Cajita Caprikids
- Que hace:
  - Duo Irresistible: Club Sandwich gigante (4 pisos, 350g papas nativas) mas 2 Bebidas participantes (Americano, Cappuccino, Chocolate caliente, Iced Coffee, Iced Latte o Iced Chocolate). Precios: 12oz S/ 37, 16oz S/ 40, 21oz S/ 42.
  - Media Docena: S/ 21.00 por 6 unidades (6 donas, 6 galletas o combinacion sumando 6).
  - Cajita Caprikids: S/ 27.00. Frappe Oreo 12oz mas Nuggets caseros mas Papas con Salchichas mas 2 Juguetes a eleccion (Pistola de burbujas, Burbujas o Squishy). El bot pregunta obligatoriamente si es para niño o niña y que juguetes prefiere.
  - Promocion Cumpleaños: Salón exclusivo, consumo minimo S/ 14.50 (torta, 8 minishots de frappe y cancion). Promocion 2x1 finalizada. Pack Amarillo marcado como agotado.
- Estado en el Mockup: La tiene a medias.
- Donde esta:
  - Bot: `AGENTS.md` (Regla 2), `prompt.py`, `sheet_sync.py` y `bot_wa.py` (`check_pack_amarillo_registered`).
  - Mockup: `Main.dc.html` lista "Combos Duo" y productos basicos; `Admin.dc.html` contiene referencias a combos en su lista de productos. Sin embargo, no contiene la logica de seleccion de juguetes de Caprikids ni la regla de validacion de cumpleañero.
- Por que importa para una cafeteria: Diferencia la oferta familiar e infantil y dinamiza horarios valle.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Media.

### 2.6. Zonas de Reparto y Tarifas de Delivery Geoespaciales
- Que hace: `geo_utils.py` y `LIMITES_DELIVERY.geojson`. Utiliza la libreria geoespacial `shapely` (`Point` y `shape.contains`) para ubicar las coordenadas geograficas (latitud, longitud) del cliente dentro de poligonos mapeados. Asigna tarifas automaticas:
  - Zona Z2: S/ 2.00
  - Zona Z3: S/ 3.00 (tarifa estandar dentro del limite)
  - Zona Z4: S/ 4.00
  - Zona Z5: S/ 5.00
  - Zona Z7: S/ 7.00
  - Fuera de zona: retorna `-1`. El bot informa cordialmente que la direccion queda fuera de la zona de reparto y ofrece la alternativa de Recojo en Tienda.
- Estado en el Mockup: La tiene a medias.
- Donde esta:
  - Bot: `geo_utils.py` (`calculate_delivery_cost`), `LIMITES_DELIVERY.geojson`, `bot_wa.py` (`extract_coordinates_from_text`).
  - Mockup: `Main.dc.html` (geolocalizacion basica por navegador en `getPos`, pero costo de delivery fijo simulado); `Admin.dc.html` (configuracion global de envio en `INFO`, sin motor de poligonos GeoJSON).
  - Acta: Acta 02 (`00:44:29`, Kevin solicita tarificacion por rangos en mapa; compromiso de José en `02:08:12`).
- Por que importa para una cafeteria: Elimina disputas con clientes y motorizados por cobros arbitrarios de kilometraje en distritos extensos o zonas con quebradas como San Juan de Lurigancho.
- Clasificacion: CONFIRMADO en el codigo y en el acta.
- Prioridad: Alta.

### 2.7. Delivery Gratis y Pedido Minimo
- Que hace: 
  - Consumo minimo obligatorio en productos para acceder a delivery: S/ 14.50.
  - Delivery 100% GRATUITO (S/ 0.00) si el subtotal consumido en productos supera los S/ 70.00.
  - En `bot_wa.py` (linea dentro de `calcular_total_pedido`), esta regla se valida matematicamente: si `subtotal_productos > 70`, sobreescribe `delivery_cost = 0.0` e inyecta la leyenda explicativa.
- Estado en el Mockup: La tiene.
- Donde esta:
  - Bot: `bot_wa.py` (herramienta `calcular_total_pedido`), `prompt.py` (Fase 2) y `js/cart.js`.
  - Mockup: `Admin.dc.html` (objeto `INFO` con `envioGratis: '70', pedidoMin: '14.50'`); `Main.dc.html` (pie de pagina y calculo de checkout con envio gratis desde S/ 70 y minimo S/ 14.50).
- Por que importa para una cafeteria: Aumenta el ticket promedio empujando a los comensales a agregar postres o bebidas adicionales para alcanzar los 70 soles y exonerarse del flete.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Alta.

### 2.8. Cliente Frecuente, Memoria y Tarifas Silenciosas
- Que hace: Mediante `client_db.py`, el bot persiste clientes en `clientes.json`.
  - Registra: nombre, celular, total de pedidos aprobados, fecha de registro y ultima ubicacion GPS.
  - En `bot_wa.py` (`get_ai_response`), si el cliente ya existe, inyecta directivas en el sistema para saludarlo por su nombre ("¡Hola, {nombre}! Te habla Capri..."), prohibe volver a pedirle su nombre o celular, y consulta si se envia a su misma ubicacion guardada.
  - Tarifas silenciosas (`get_client_delivery_cost`): Si el cliente tiene asignado en su registro un `costo_delivery_fijo` (ej. S/ 2.50) o un `descuento_delivery` (ej. 0.50 para 50%), el sistema cotiza directamente ese monto sin publicitar que se trata de un descuento o tarifa especial.
- Estado en el Mockup: La tiene a medias.
- Donde esta:
  - Bot: `client_db.py`, `bot_wa.py` (en `get_ai_response`).
  - Mockup: `Admin.dc.html` tiene un modulo de clientes con historial de pedidos y programa de puntos/fidelidad; `Main.dc.html` recuerda telefono y direccion en `localStorage`. Sin embargo, no contempla tarifas silenciosas de delivery diferenciadas por cliente ni la adaptacion del saludo conversacional por IA.
  - Acta: Acta 02 (`01:07:16`, Kevin solicita que el sistema recuerde la direccion por telefono y pregunte "¿Es para su misma ubicacion?").
- Por que importa para una cafeteria: Reduce el tiempo de toma de pedidos a menos de 30 segundos para clientes recurrentes y fideliza cuentas corporativas o clientes VIP con tarifas preferenciales sin alterar la carta publica.
- Clasificacion: CONFIRMADO en el codigo y en el acta.
- Prioridad: Alta.

### 2.9. Medios de Pago Aceptados y Datos Bancarios
- Que hace: En `prompt.py` (Fase 5) y `bot_wa.py` (funcion `dashboard_login` / mensajes rapidos):
  - Billeteras digitales: Yape y Plin al numero oficial `977503006` a nombre de Maria Jose Morillo Ruiz.
  - Cuentas bancarias: BCP (Cta: 19197148281074, CCI: 00219119714828107455) e Interbank (Cta: 0913227414217, CCI: 00309101322741421764).
  - Efectivo: Valida el billete con el que pagara para enviar el vuelto exacto.
  - Tarjeta: Especifica que el pago es contra entrega mediante terminal POS inalambrico.
- Estado en el Mockup: La tiene.
- Donde esta:
  - Bot: `prompt.py` (Fase 5), `bot_wa.py` (lineas de envio de datos de pago).
  - Mockup: `Admin.dc.html` y `Main.dc.html` (constante `PAYS` con Efectivo, Yape, Plin, Tarjeta POS y Transferencia; datos bancarios configurables en `INFO`).
  - Acta: Acta 02 (`00:05:03`, Kevin exige Yape y Plin visibles independientes y botones de copiar y pegar).
- Por que importa para una cafeteria: En Peru, Yape y Plin concentran mas del 70% de las transacciones informales y gastronomicas.
- Clasificacion: CONFIRMADO en el codigo y en el acta.
- Prioridad: Alta.

### 2.10. Criterio Peruano: Pago en Efectivo y Vuelto ("Cancelo con...")
- Que hace: Regla estricta en `prompt.py` y `bot_wa.py` (en `get_ai_response`). En Peru el verbo "cancelar" denota pagar una cuenta. Si el cliente escribe *"cancelo con 100 soles"*, *"cancelo con 50"* o *"cancelo en efectivo"*, el bot tiene TERMINANTEMENTE PROHIBIDO interpretar la frase como anulacion o cancelacion del pedido. El bot debe registrar el metodo como Efectivo, anotar la denominacion del billete y calcular el vuelto necesario.
- Estado en el Mockup: No la tiene.
- Donde esta:
  - Bot: `prompt.py` (seccion interpretacion peruana), `bot_wa.py` (instruccion obligatoria del sistema).
  - Mockup: `Chatbot.dc.html` y `Main.dc.html` solo tienen selectores estaticos de metodo de pago con un campo numerico para ingresar con cuanto abona; no procesan lenguaje natural ni modismos peruanos.
- Por que importa para una cafeteria: Es el error tipico de modelos de lenguaje entrenados en español neutro, los cuales cancelan la orden cuando el comensal dice "cancelo con 100", arruinando la venta.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Alta.

### 2.11. Comprobante de Pago y Vision con Inteligencia Artificial
- Que hace: Cuando el cliente envia una foto de su voucher (Yape, Plin, transferencia bancaria), `bot_wa.py` descarga la imagen mediante Meta Graph API (`get_whatsapp_media_bytes`), la convierte a base64 y la somete a OpenAI GPT-4o-mini con una directiva de vision artificial.
  - La IA extrae: Monto (S/ ...), Numero/Codigo de Operacion, y Fecha/Hora exacta.
  - El bot responde con una plantilla estricta de recepcion: *"¡Pedido registrado! Hemos recibido su comprobante por S/ {monto} (Op. {num_operacion}). Estamos enviando su orden al área encargada para su validación. Denos un momento por favor"*.
  - Prohibicion expresa: La IA tiene prohibido afirmar que el pedido ya esta confirmado o prometer tiempos de entrega antes de que un humano de cocina lo apruebe.
- Estado en el Mockup: La tiene a medias (con filosofia inversa).
- Donde esta:
  - Bot: `bot_wa.py` (`get_ai_response`, bloque `is_photo`).
  - Mockup: En `Admin.dc.html` (`sel.hasPayImg`, `sel.payRef`), el operador humano visualiza el comprobante y el codigo de operacion. Sin embargo, segun `fuente/flujo-de-pedidos.md` (reunion del 18/10/2026), se decidio que el cliente no suba el comprobante en la web ni en el chatbot de ejemplo, sino que un asesor humano abre WhatsApp, le pide la constancia y es el cajero o mozo quien sube la foto al sistema.
- Por que importa para una cafeteria: Automatiza la lectura del monto y numero de operacion liberando a la cajera de tipear datos, pero mantiene la aprobacion financiera final en manos del personal.
- Clasificacion: CONFIRMADO en el codigo y en el acta.
- Prioridad: Alta.

### 2.12. Aprobacion y Rechazo de Pedidos por Cocina / Administrador
- Que hace: En `bot_wa.py` (`handle_admin_order_action_wa`) y `bot.py` (`button_callback`):
  - Al completar el pedido y recibir el comprobante (o acordar pago en efectivo/POS), se envia un ticket con botones interactivos `[ Aprobar Pedido]` y `[ Rechazar]` al WhatsApp de cocina/administracion (`51977503006`) o al grupo de Telegram (`GRUPO_PEDIDOS_ID`).
  - Si el administrador pulsa `Aprobar`:
    - Incrementa el contador de pedidos aprobados del cliente en `clientes.json` (`increment_approved_order_count`).
    - Despausa al cliente de `pending_validation_users_wa`.
    - Envia automaticamente al cliente por WhatsApp el mensaje oficial con el tiempo estimado: si es delivery, *"En un plazo aprox a {tiempo_estimado} estará llegando su pedido..."*; si es recojo en tienda, *"Le avisaremos por aquí cuando su pedido esté listo para su recojo"*.
  - Si el administrador pulsa `Rechazar`:
    - Notifica al cliente: *"Hola, lamentablemente hemos encontrado un problema con la validación de su pago (el monto no coincide o no se pudo verificar). Por favor, revise e intente enviar el comprobante correcto nuevamente"*.
- Estado en el Mockup: La tiene.
- Donde esta:
  - Bot: `bot_wa.py` (`handle_admin_order_action_wa`, `send_admin_order_notification_with_buttons`), `bot.py` (`button_callback`), `AGENTS.md` (Regla 3).
  - Mockup: `Admin.dc.html` (modal "Confirmar pedido y pago" con botones de aceptar y rechazar, registrando usuario y hora de confirmacion).
  - Documento de flujo: `fuente/flujo-de-pedidos.md` (Seccion 3: confirmar o rechazar).
- Por que importa para una cafeteria: Impide que entren comandas a cocina sin confirmacion de pago real en la cuenta bancaria.
- Clasificacion: CONFIRMADO en el codigo y en el documento de flujo.
- Prioridad: Alta.

### 2.13. Reglas de Modificadores en Bebidas (Leche, Endulzantes, Chantilly y Toppings)
- Que hace: `AGENTS.md` (Regla 5) y `prompt.py`:
  - Leche: Leche entera UHT por defecto. Cambio a Leche Sin Lactosa es 100% GRATUITO. Cambio a Leche de Almendras tiene recargo de + S/ 2.50.
  - Endulzante: Azucar blanca por defecto. Cambio a Stevia o sin azucar es GRATUITO.
  - Endulzantes de receta exclusiva: Chocolate caliente, Mocaccino y Choconube llevan syrup de almendra; Latte Vainilla lleva vainilla natural; Caramel Macchiato lleva caramelo artesanal y manjar; Americano se ofrece sin azucar.
  - Chantilly: Chantilly Extra (porcion de 4oz) tiene recargo de + S/ 2.00. Opcion sin chantilly es permitida y gratuita.
  - Toppings en Frappes: Vienen incluidos segun la receta (Chispas de chocolate, Oreo triturado, Chin Chin, Almendra triturada, Granola). Cambio de topping por otro sabor es GRATIS. Topping adicional/extra: + S/ 1.00 por porcion.
  - Textura y temperatura de hielo:
    - Si piden "poco hielo": el bot debe advertir que implicara menor volumen/cantidad de bebida en el vaso.
    - Si piden "no helado / aguado": el bot debe advertir que por ser a base de hielo triturado saldra aguado y formula un descargo cordial de textura.
    - Opcion "sin cafe": los frappes vienen con cafe por defecto pero se pueden preparar sin cafe si el cliente lo solicita.
  - Bebidas Iced: Liquidas con cubos de hielo, si pueden prepararse sin hielo.
  - Waffles: Cambios de fruta o de salsas son gratuitos. Adicionales con costo: Chantilly extra (+ S/ 2.00), Bola de helado extra (+ S/ 2.50), Porcion adicional de salsa (+ S/ 2.50).
- Estado en el Mockup: La tiene a medias.
- Donde esta:
  - Bot: `AGENTS.md` (Regla 5) y `prompt.py`.
  - Mockup: `Main.dc.html`, `Chatbot.dc.html` y `Admin.dc.html` manejan grupos de opciones para leche entera, sin lactosa (+0), almendras (+2.50), azucar, stevia, chantilly (+2.00) y bola de helado (+2.50). Sin embargo, el mockup no implementa las advertencias culinarias de volumen por "poco hielo", la regla de "cambio de topping gratis pero extra a S/ 1.00", ni las recetas exclusivas de endulzantes.
- Por que importa para una cafeteria: Protege la calidad del producto y la satisfaccion del cliente. Evita que un cliente reclame que su frappe le vino a medio llenar cuando el mismo pidio "poco hielo".
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Media.

### 2.14. Prohibicion Estricta de Asumir Sabores, Variantes o Tamaños
- Que hace: `AGENTS.md` (Reglas 6, 7 y 11) y `prompt.py` (Fase 1):
  - El bot tiene terminantemente prohibido suponer que variante o sabor desea el cliente. Si pide "un frappe caramel", debe preguntar si desea Caramel clasico o Caramel chocolate; si pide "empanada", debe preguntar pollo o jamon y queso; si pide "dona", preguntar sabor; si pide "waffle con fresa", preguntar entre Fresa Split o Frutos del Bosque.
  - En bebidas, debe presentar siempre los 3 tamaños oficiales con sus precios respectivos: Regular 12oz, Grande 16oz, Extra 21oz.
  - Asimilacion de precio a tamaño: si el cliente responde indicando el precio (ej. "14.50" o "33"), el bot debe interpretarlo de inmediato como el tamaño correspondiente (Regular) sin volver a preguntar.
- Estado en el Mockup: La tiene a medias.
- Donde esta:
  - Bot: `AGENTS.md` (Regla 7 y 11), `prompt.py` (Fase 1).
  - Mockup: `Chatbot.dc.html` desglosa variantes mediante botones en cascada (tamaño -> leche -> dulce -> extras). Pero si se pide por texto o en la carta web, no cuenta con el mecanismo de asimilar un precio digitado al tamaño correspondiente.
- Por que importa para una cafeteria: Previene errores de produccion en barra y reprocesos por preparar sabores equivocados.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Media.

### 2.15. Regla de "No Jugos Tradicionales" (Carta Estricta)
- Que hace: `AGENTS.md` (Regla 17). Caprichos NO vende jugos naturales tradicionales (naranja, papaya, fresa, surtido, etc.). El bot tiene estrictamente prohibido inventar que se venden o inventar precios. Debe aclarar con honestidad que no se preparan jugos naturales y ofrecer de inmediato las alternativas de fruta reales de la carta: bebidas Frozen (Limonada Frozen, Maracuya Frozen, Strawberry Frozen) o Frappes de fruta (Strawberry, Berries, Maracuya, Fit).
- Estado en el Mockup: No la tiene.
- Donde esta:
  - Bot: `AGENTS.md` (Regla 17).
  - Mockup: Ningun archivo del mockup documenta ni implementa la regla de descarte y sustitucion sugerida de jugos tradicionales.
- Por que importa para una cafeteria: Muchos clientes en Lima piden jugos para desayunos o lonches; si el asistente no sabe que no hay extractor ni fruta para jugos sueltos, puede vender algo inexistente en cocina.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Media.

### 2.16. Generacion de Ticket de Cocina
- Que hace: `bot_wa.py` (funcion `generate_kitchen_ticket`). Cuando la conversacion concluye con exito, el bot recopila la orden y solicita a GPT-4o-mini generar una comanda estructurada sin inventar codigos (#Pedido), con el siguiente formato exacto:
  - Modalidad: Delivery / Recojo en Tienda / Consumo Local.
  - Cliente: Nombre completo.
  - Celular: Numero telefonico.
  - Ubicacion (GPS): Enlace de Google Maps con coordenadas.
  - Productos y detalle de preparacion.
  - Subtotal, Costo de Delivery, y Total a Pagar.
  - Forma de Pago (Yape, Plin, Efectivo indicando billete, o Tarjeta POS).
  - N° de Operacion y Fecha/Hora del comprobante.
  - Guarda este ticket en `latest_order_summaries[phone]` para su consulta y copia rapida al software de caja (POS/restaurant.pe).
- Estado en el Mockup: La tiene.
- Donde esta:
  - Bot: `bot_wa.py` (`generate_kitchen_ticket`, `latest_order_summaries`).
  - Mockup: `Admin.dc.html` genera y muestra la comanda en pantalla KDS (`view: 'cocina'`), con soporte para envio a impresoras termicas de tickets y etiqueteras de stickers autoadhesivos para vasos.
  - Acta: Acta 02 (`00:29:47`, etiquetas en vasos estilo Starbucks; `01:48:00`, ticket y comanda).
- Por que importa para una cafeteria: Es el documento operativo con el que cocina y despacho elaboran las bebidas sin cometer equivocaciones.
- Clasificacion: CONFIRMADO en el codigo y en el acta.
- Prioridad: Alta.

### 2.17. Modificaciones y Notas en Pedidos ("Cambio de salsa o ingrediente")
- Que hace: `AGENTS.md` (Regla 12) y `prompt.py`. Si el cliente solicita un cambio especifico en una nota de comanda (ej. "en vez de salsa de fresa poner maracuya" o "el club sandwich sin tomate"), el bot no debe responder con textos evasivos o plantillas genericas. Debe confirmar directamente: *"Está bien, informaré sobre su cambio a cocina/área encargada para que preparen su pedido a su gusto"* y adjuntarlo a la comanda.
- Estado en el Mockup: La tiene.
- Donde esta:
  - Bot: `AGENTS.md` (Regla 12).
  - Mockup: `Admin.dc.html` y `Main.dc.html` incluyen el campo de texto `note` ("Sin hielo en el frappe", notas especiales de preparacion) asociado a cada item del pedido.
- Por que importa para una cafeteria: Atiende casos de alergias, preferencias alimentarias o gustos particulares.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Media.

### 2.18. Transcripcion de Notas de Voz (Audios)
- Que hace: `bot_wa.py` (funcion `transcribe_audio_bytes` y en el webhook bloque `msg_type == "audio"`). Cuando un cliente envia un mensaje de voz o audio por WhatsApp, el bot descarga el archivo multimedia desde Meta Cloud API y lo envia a la API de Whisper de OpenAI para obtener la transcripcion textual. Luego inyecta el texto transcrito al buffer de mensajes del cliente como si hubiera sido escrito.
- Estado en el Mockup: No la tiene.
- Donde esta:
  - Bot: `bot_wa.py` (`transcribe_audio_bytes`).
  - Mockup: No existe soporte para recepcion de audios ni transcripcion por voz en los prototipos.
- Por que importa para una cafeteria: En Peru, un alto porcentaje de usuarios prefiere enviar notas de voz por WhatsApp mientras camina o maneja en lugar de redactar textos extensos.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Media.

### 2.19. Handoff y Asistencia Humana ("Requiere Atencion" y Pausa Operativa)
- Que hace: En `bot_wa.py` (diccionario `requires_worker_chats`, conjunto `pending_validation_users_wa`, y rutas `/api/dashboard/resolve-worker`, `/api/dashboard/toggle-pause`):
  - El bot se pausa automaticamente bajo tres disparadores:
    1. El cliente pide hablar con un humano o asesor.
    2. El bot registra un comprobante de pago o completa un pedido y requiere validacion humana de caja.
    3. Ocurre un fallo critico de saldo en OpenAI (error 429) o excepcion no recuperable.
  - Al pausarse, el chat se traslada a la pestaña "Requiere Atencion" con una alerta visual en el panel web. Mientras el chat permanezca pausado, el bot se mantiene en silencio absoluto ante cualquier nuevo mensaje entrante del cliente para no interrumpir la gestion del empleado.
  - Timeout por inactividad: Si transcurren mas de 3 horas sin mensajes (`SESSION_TIMEOUT_SECONDS = 10800`), la sesion y la pausa se limpian automaticamente para no dejar a clientes bloqueados al dia siguiente.
- Estado en el Mockup: La tiene a medias.
- Donde esta:
  - Bot: `bot_wa.py` (`requires_worker_chats`, `pending_validation_users_wa`, `process_debounced_messages_wa`).
  - Mockup: `Chatbot.dc.html` incluye el boton "Hablar con un asesor" que emite `SYS = 'SE REQUIERE ATENCIÓN · pasó a una persona'` y el texto `HUMAN`; `Admin.dc.html` incluye notificaciones de pedidos por confirmar. No implementa el timeout de 3 horas ni la logica de despausa automatica.
  - Acta: Acta 02 (`00:59:49`, boton de asesor humano; `02:07:02`, punto rojo "Se requiere atencion").
- Por que importa para una cafeteria: Evita que el robot responda incoherencias mientras un cajero o administrador esta negociando o coordinando manualmente por WhatsApp con el comensal.
- Clasificacion: CONFIRMADO en el codigo y en el acta.
- Prioridad: Alta.

### 2.20. Modo de Alta Demanda Dinamico
- Que hace: `bot_wa.py` (variable global `alta_demanda_mode`, ruta `/api/dashboard/toggle-alta-demanda`, funciones `get_tiempo_estimado_str` y `get_tiempo_estimado_texto`). Permite al personal activar con un solo clic el interruptor de alta demanda desde el panel de control:
  - Modo Normal: Tiempo estimado prometido al cliente es de 30 a 45 minutos.
  - Modo Alta Demanda: Tiempo estimado prometido al cliente se eleva automaticamente a 50 a 60 minutos. El bot inyecta esta advertencia al modelo si el cliente pregunta por demoras o al confirmar el despacho.
- Estado en el Mockup: La tiene.
- Donde esta:
  - Bot: `bot_wa.py` (`alta_demanda_mode`, `toggle_alta_demanda_api`).
  - Mockup: `Admin.dc.html` y `Main.dc.html` (propiedad `altaDem` en la configuracion del local con minutos adicionales y aviso visual de alta demanda).
  - Acta: Acta 02 (`02:09:18`, interruptor de alta demanda explicado por Kevin).
- Por que importa para una cafeteria: En horas punta (viernes o domingos por la tarde), la cocina colapsa de pedidos; subir dinamicamente el tiempo prometido previene reclamos por retrasos en delivery.
- Clasificacion: CONFIRMADO en el codigo y en el acta.
- Prioridad: Alta.

### 2.21. Mantenimiento de Carta Vigente mediante Google Sheets (Hoja de Calculo)
- Que hace: `sheet_sync.py` y `bot_wa.py` (`load_dynamic_menu`, ruta `/cmd/actualizar`). Descarga la carta de productos desde una URL publica de Google Sheets exportada en formato Excel (.xlsx). Con `pandas`, recorre las hojas de categorias, filtra filas donde `Disponible == 'SI'`, extrae nombres, descripciones y precios por tamaño, formatea el texto consolidado y lo guarda en `menu_dinamico.txt`. Luego `load_dynamic_menu` lo inyecta dinamicamente en el `{menu_texto}` del `SYSTEM_PROMPT`.
- Estado en el Mockup: No la tiene.
- Donde esta:
  - Bot: `sheet_sync.py`, `menu_dinamico.txt`, `bot_wa.py` (`load_dynamic_menu`, `/cmd/actualizar`).
  - Mockup: En `Admin.dc.html`, la carta se administra mediante formularios internos en el propio navegador con persistencia en `localStorage`; no consume ni sincroniza con Google Sheets.
- Por que importa para una cafeteria: Permite que el dueño o administrador actualice precios o desactive productos desde una hoja de calculo en su celular sin ingresar a paneles tecnicos complejos.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Media.

### 2.22. Encuesta de Posventa y Seguimiento a Clientes
- Que hace: En el codigo actual de `bot_wa.py` NO esta implementado un cron de posventa. Sin embargo, en el Acta 02 de descubrimiento, Kevin establecio el requerimiento formal:
  - Enviar un mensaje de posventa automatico por WhatsApp exactamente 2 horas despues de la entrega del pedido ("Hola, queremos saber si tu pedido llegó todo bien y está todo en orden").
  - Si la respuesta es positiva: invitarlo a dejar una opinion en Google Maps (con incentivo).
  - Si la respuesta es negativa: transferir inmediatamente el chat a un asesor y enviar una alerta al WhatsApp de gerencia para mitigar el malestar del cliente.
- Estado en el Mockup: No la tiene (pendiente en el prototipo interactivo).
- Donde esta:
  - Bot: No existe en el codigo de `bot/` (solo la tarea `midnight_auto_resume_task` para medianoche).
  - Mockup: Registrado conceptualmente en `fuente/iniciativas-acta-02.md` (seccion 8: items `D-35`, `D-37`, `D-38`), pero no codificado en `Chatbot.dc.html` ni `Admin.dc.html`.
- Por que importa para una cafeteria: Eleva el posicionamiento en Google Maps mediante resenas organicas y contiene quejas de comida o empaque antes de que se vuelvan publicas en redes sociales.
- Clasificacion: CONFIRMADO en el acta; PENDIENTE tanto en el bot como en el mockup.
- Prioridad: Media.

### 2.23. Recordatorios y Avisos Especiales de Contingencia
- Que hace: En `bot_wa.py` (funciones `load_special_notice_notified`, `save_special_notice_notified` e `is_special_notice_active`), el bot implementa un mecanismo de contingencia para dias con imprevistos graves (ej. corte programado de energia electrica). Al recibir el primer mensaje de un cliente en esa fecha, le envia por unica vez un aviso con imagen y texto de contingencia, silencia al bot para ese usuario durante todo el dia y lo registra en `special_notice_notified.json` para evitar envios repetitivos.
- Estado en el Mockup: No la tiene.
- Donde esta:
  - Bot: `bot_wa.py` (`is_special_notice_active`, `process_debounced_messages_wa`).
  - Mockup: Inexistente en `Admin.dc.html`, `Main.dc.html` y `Chatbot.dc.html`.
- Por que importa para una cafeteria: Gestiona emergencias operativas (cortes de luz o agua en el distrito) sin tener que apagar los servidores ni contestar cientos de mensajes manualmente.
- Clasificacion: CONFIRMADO en el codigo.
- Prioridad: Baja.

---

## 3. Flujo Completo de un Pedido en el Bot y Comparativa de Estados

### 3.1. Flujo Paso a Paso en el Chatbot Real

1. **Recepcion e Identificacion Inicial:**
   - El cliente envia un mensaje por WhatsApp. Entra por el webhook (`/webhook`).
   - El debouncer retiene el procesamiento durante 2 segundos para consolidar mensajes consecutivos.
   - Si es un cliente registrado en `clientes.json`, la IA lo saluda cordialmente por su nombre ("¡Hola, {nombre}! Te habla Capri...") y recupera su direccion historica. Si es nuevo, presenta bienvenida institucional con botones interactivos o atiende directamente el producto escrito.

2. **Fase 1: Toma y Configuracion de Productos:**
   - La IA interroga especificamente por tamaño (Regular 12oz, Grande 16oz, Extra 21oz), sabores y modificadores (leche, dulce, toppings) sin asumir variables.
   - En combos (Duo Compartir), valida complementos permitidos y asocia las bebidas a la promocion sin cobrar suplementos.
   - Pregunta de cierre obligatoria: "¿Deseas agregar algo más a tu pedido?".

3. **Fase 2: Modalidad y Cotizacion de Delivery:**
   - Opciones: Delivery, Recojo en Tienda o Consumo en Salon.
   - Si es Recojo o Salon: flete S/ 0.00; prohibido solicitar coordenadas GPS.
   - Si es Delivery: valida pedido minimo de S/ 14.50. Si ya tiene direccion registrada, pide confirmarla; si no, solicita ubicacion GPS de WhatsApp.
   - El modulo geoespacial evalua latitud/longitud en `LIMITES_DELIVERY.geojson`. Si esta dentro, asigna S/ 2 a S/ 7; si esta fuera (-1), ofrece recojo en tienda.
   - Si el cliente tiene tarifa fija o descuento silencioso en `clientes.json`, se aplica dicha tarifa.

4. **Fase 3: Captura de Datos de Contacto:**
   - Si el cliente no esta registrado previamente, el bot solicita obligatoriamente el Nombre Completo y Numero de Celular de contacto de la persona que recibira.

5. **Fase 4: Resumen y Calculo Matematico Estricto:**
   - La IA invoca la herramienta `calcular_total_pedido`. Si el subtotal de productos supera S/ 70.00, el delivery se convierte en S/ 0.00 (Gratis).
   - El bot remite la plantilla estructurada de resumen detallado y espera la confirmacion expresa del comensal antes de brindar cuentas bancarias.

6. **Fase 5: Cobro y Cierre:**
   - Si es Yape/Plin o transferencia bancaria, envia cuentas oficiales. Al recibir la captura, GPT-4o-mini con vision extrae monto y codigo de operacion.
   - Si es efectivo, confirma billete y vuelto exacto. Si es tarjeta, anota cobro con POS contra entrega.
   - El bot emite mensaje formal de recepcion y traslada inmediatamente el chat a "Requiere Atencion", pausando respuestas automaticas.

7. **Notificacion a Cocina y Resolucion Humana:**
   - Se compila el ticket de cocina con `generate_kitchen_ticket`.
   - Se envia al canal de administracion o se refleja en el panel web con botones de aprobacion/rechazo.
   - El administrador verifica el pago y presiona `Aprobar` o `Rechazar`. El bot envia el mensaje oficial final al cliente con el tiempo de entrega y se despausa.

### 3.2. Comparativa de Estados: Bot Real vs Mockup

| Estado en el Mockup (`Admin.dc.html`) | Definicion en el Mockup | Equivalente en el Bot Real (`bot_wa.py` / `bot.py`) | Analisis de Brecha |
| :--- | :--- | :--- | :--- |
| **Por confirmar** (`nuevo`) | Pedido ingresado por web o bot; pago pendiente de verificacion humana por WhatsApp. | Chat en estado `pending_validation_users_wa` ("Requiere Atención - Pedido por preparar / Validar pago"). | Coincidencia funcional total en la necesidad de intervencion humana. La diferencia radica en que el bot ya extrajo monto y voucher con IA. |
| **En cocina · nuevo** (`cola`) | Pago validado; comanda entra a la cola de produccion en pantallas KDS de cocina y barra. | Pedido aprobado tras pulsar `[Aprobar Pedido]`. Contador incrementado en `clientes.json`. | El bot aqui culmina su ciclo; no tiene integracion con KDS de cocina y depende de que la cajera transcriba o pegue el ticket al sistema de caja. |
| **Preparando** (`prep`) | Cocinero o barista pulsa comanda en KDS para marcar elaboracion activa. | No existe en el bot. | El bot carece de estados de preparacion interna. Si el cliente pregunta si su pedido esta listo, el bot tiene orden de no inventar y derivar a un humano. |
| **Listo** (`listo`) | Comida o bebida lista en bandeja o empaquetada para recojo o despacho. | No existe en el bot (salvo respuesta rapida manual en el panel web). | En recojo en tienda, el bot prometio avisar cuando este listo, pero en el codigo real este aviso se emite solo manualmente por el operador. |
| **En camino / Ruta** (`ruta`) | Motorizado asignado y pedido en transito hacia el domicilio del cliente. | No existe en el bot. | El bot no rastrea motorizados ni emite alertas automaticas de salida de pedido. |
| **Entregado** (`entregado`) | Despacho completado satisfactoriamente y orden archivada. | No existe en el bot (salvo archivo nocturno a las 3 horas de inactividad). | El bot no recibe confirmacion de entrega del repartidor ni dispara encuestas en el codigo actual. |
| **Rechazado** (`rechazado`) | Pedido descartado por pago invalido o falta de respuesta. | Accion `reject` en `handle_admin_order_action_wa` (notifica al cliente que reenvie el voucher). | Coincidencia conceptual. Ambos modelos descartan la orden y alertan del comprobante fallido. |

---

## 4. Validacion del Pago en el Bot y Rol de la Intervencion Humana

### 4.1. Como valida el bot el pago
1. **Deteccion Multimedia:** Al llegar un webhook de WhatsApp de tipo `image`, el servidor descarga el archivo binario desde los servidores de Meta mediante `get_whatsapp_media_bytes`.
2. **Extraccion con IA de Vision:** El archivo binario se almacena localmente en la carpeta `uploads/` y se envia codificado en base64 al modelo `gpt-4o-mini` con instrucciones estrictas de extraccion financiera:
   - Lectura de texto en imagen para extraer: Monto pagado en soles, Codigo/Numero de operacion bancaria, y Fecha y hora del movimiento.
3. **Respuesta Formal Preprogramada:** El bot no aprueba la transaccion. Emite un acuse de recibo estandarizado indicando el monto y la operacion leida, comunicando que la orden pasa a revision del area encargada.
4. **Pausa Preventiva:** La funcion `is_order_ready_for_ticket` detecta frases gatillo de comprobante o pago y activa `check_and_send_ticket_to_whatsapp_admin`. El chat se agrega a `pending_validation_users_wa` y se silencia para evitar que la IA interactue mientras el pago no este ratificado.

### 4.2. Que rol humano interviene
La validacion del pago en el bot real es **100% supervisada por personas**. El bot actua unicamente como un asistente de captura y extraccion optica. La intervencion humana se divide en tres pasos:
1. **Cotejo Bancario:** El administrador, cajero o encargado de cocina recibe en su WhatsApp, Telegram o panel web `/admin` la foto del voucher junto con los datos extraidos y el ticket de venta. El humano abre la aplicacion bancaria del negocio (Yape Comercial, Plin o Banca Movil BCP/Interbank) y verifica que el dinero haya ingresado efectivamente a la cuenta corriente, descartando vouchers editados con Photoshop o transferencias falsas.
2. **Accion de Aprobacion o Rechazo:** El personal presiona fisicamente un boton interactivo:
   - `[Aprobar Pedido]`: Desbloquea la orden, incrementa las metricas del cliente, despacha la comanda y dispara el WhatsApp de tiempo estimado al cliente.
   - `[Rechazar]`: Notifica al cliente el error de importe o ilegibilidad del voucher para que vuelva a enviarlo.
3. **Transcripcion al POS:** Debido a que el bot actual no esta conectado directamente a la base de datos de restaurant.pe ni a la impresora de comandas, el humano debe copiar el ticket generado por el bot y crearlo en el software de caja del restaurante.

---

## 5. Mantenimiento de la Carta Vigente (Google Sheets) y Propuesta para el Sistema

### 5.1. Como se mantiene actualmente en el bot (Hoja de Calculo)
1. **Fuente Externa:** El negocio mantiene un archivo en Google Sheets accesible mediante una URL publica de exportacion XLSX (`sheet_sync.py`, variable `EXCEL_URL`).
2. **Proceso de Extraccion (`sheet_sync.py`):**
   - Utiliza `pandas.ExcelFile` para descargar y procesar las pestañas del libro de calculo.
   - Omite pestañas auxiliares (como `PRODUCTOS`).
   - Filtra filas basandose en la columna `Disponible == 'SI'` o `DISPONIBLE == 'SI'`.
   - Lee dinamicamente columnas de precios: `PRECIO REGULAR 14 OZ`, `PRECIO GRANDE 16 OZ`, `PRECIO EXTRA 20OZ`, `PRECIO ENTERO`, `PRECIO MITAD` o `PRECIO`.
   - Incorpora descripciones, adiciones fijas para combos (Duo Compartir, Duo Irresistible, Cajita Caprikids) y postres.
   - Compila todo en un archivo de texto estructurado denominado `menu_dinamico.txt`.
3. **Inyeccion en el Modelo:** Al arrancar el bot o al invocarse la ruta `/cmd/actualizar`, la funcion `load_dynamic_menu` en `bot_wa.py` lee `menu_dinamico.txt` y reemplaza la etiqueta `{menu_texto}` en el `SYSTEM_PROMPT` de OpenAI.

### 5.2. Como se debe hacer desde nuestro sistema administrativo unificado
Depender de un enlace publico de Google Sheets representa una fragilidad tecnica importante para una operacion profesional. La propuesta de integracion en nuestro sistema contempla:
1. **Base de Datos Centralizada como Fuente Unica de la Verdad:**
   - La carta de productos, variantes, insumos, modificadores y precios debe residir en la base de datos transaccional del sistema administrativo (la misma que alimenta a Pedidos y Caja, Cocina KDS y Carta Web en `Admin.dc.html`).
2. **Conmutador de Stock en Tiempo Real ("Apagado de Producto"):**
   - Cuando en cocina o barra se agote un producto o insumo (por ejemplo, fresa o leche de almendras), el cocinero o cajero desactiva el producto desde el panel KDS o administrativo con un solo toque.
3. **Sincronizacion Automatizada hacia el Chatbot:**
   - Al guardar cualquier cambio en el modulo de Carta del panel administrativo (cambio de precio, creacion de promocion o desactivacion por stock agotado), un webhook o evento de aplicacion regenera la representacion textual del catalogo e invoca internamente la recarga del contexto del bot sin necesidad de reiniciar el servicio ni consultar hojas de calculo externas.
4. **Respaldo Bidireccional (Opcional):**
   - Si la administracion de Caprichos prefiere continuar manipulando listas masivas en hojas de calculo, el panel administrativo incorporara funciones de `Importar/Exportar Catalogo en Excel/CSV`, pero el bot leera siempre de la API interna del sistema, asegurando coherencia total entre la web, el bot y las pantallas de cocina.

---

## 6. Datos del Cliente Almacenados y Datos Sensibles

### 6.1. Datos que almacena el bot y ubicacion fisica
- `clientes.json` (mediante `client_db.py`):
  - Numero telefonico de WhatsApp (clave de identificacion).
  - Nombre completo proporcionado por el usuario.
  - Celular de contacto.
  - Total historico de pedidos aprobados (contador entero).
  - Fecha y hora del primer registro.
  - Ultima ubicacion GPS confirmada (diccionario con latitud y longitud).
  - Tarifas especiales personalizadas (`costo_delivery_fijo` o `descuento_delivery`).
- `chat_history.json` y `chat_history_archive.json` (mediante `bot_wa.py`):
  - Historial integro de mensajes de texto (turnos de conversacion completos entre cliente, bot y respuestas manuales del panel).
  - Nombres de remitentes, marcas temporales con precision de segundos, identificadores de mensaje de WhatsApp (`wamid`), estados de lectura y resumenes de ordenes.
- `user_sessions.json` (mediante `bot_wa.py`):
  - Historial de memoria conversacional para OpenAI (mensajes en formato JSON con roles de usuario, asistente, llamadas a herramientas y respuestas del sistema).
  - Coordenadas geograficas temporales en memoria RAM.
- Carpeta `uploads/` (directorio en disco del servidor):
  - Imagenes en formato JPG descargadas desde WhatsApp: fotos de comprobantes bancarios, capturas de transferencias, capturas de pantalla de la carta y fotografias enviadas por los clientes.

### 6.2. Cuales de estos datos son sensibles
1. **Comprobantes Bancarios / Vouchers de Pago (Extremadamente Sensibles):**
   - Las fotografias almacenadas en `uploads/` y transcriptas en los historiales contienen informacion financiera confidencial: nombre y apellidos completos del titular de la cuenta bancaria, numero telefonico personal asociado a Yape o Plin, numero de cuenta bancaria o codigo de cuenta interbancario (CCI), saldo bancario remanente (que muchas aplicaciones bancarias muestran al finalizar la transaccion), numero de operacion y sellos de tiempo exactos.
2. **Geolocalizacion Satelital Exacta y Direccion Domiciliaria (Altamente Sensibles):**
   - Las coordenadas de latitud y longitud almacenadas en `clientes.json` y `user_gps`, sumadas a las referencias escritas ("porton verde, frente al parque"), exponen la direccion de residencia exacta de los clientes y sus familias en Lima.
3. **Numero de Telefono y Perfil de WhatsApp (Dato Personal Protegido):**
   - Constituye un dato de caracter personal segun la Ley de Proteccion de Datos Personales (Ley N° 29733 en Peru). No debe ser expuesto ni compartido con terceros.
4. **Habitos de Consumo y Frecuencia de Compra:**
   - La correlacion entre historial de consumo, horarios y volumen de gasto diario permite elaborar perfiles de comportamiento del comensal.

---

## 7. Riesgos de Seguridad y Robustez en el Diseño Actual

Sin revelar claves, tokens ni datos personales existentes en la instalacion, se identifican las siguientes vulnerabilidades arquitectonicas en el bot actual:

1. **Almacenamiento Desprotegido en Texto Plano (Severidad Critica):**
   - Todos los datos personales, historiales de chat, ubicaciones GPS y fotografias de vouchers residen en archivos JSON en texto plano y en un directorio `uploads/` sin cifrado en reposo (encryption at rest). Un acceso no autorizado al servidor expone inmediatamente la totalidad de los datos de los comensales.
2. **Concurrencia Fragil y Riesgo de Corrupcion de Archivos JSON (Severidad Alta):**
   - La persistencia se realiza mediante reescrituras integras en disco con `json.dump` en archivos monoliticos (`clientes.json`, `chat_history.json`, `user_sessions.json`). Cuando varios comensales envian mensajes simultaneamente, no existen bloqueos transaccionales ni colas de escritura ACID, lo que puede provocar condiciones de carrera (race conditions), bloqueo de operaciones de entrada/salida o corrupcion y truncamiento del archivo si el servidor se interrumpe durante el guardado.
3. **Valores por Defecto Inseguros en Credenciales del Panel Web (Severidad Alta):**
   - En `bot_wa.py`, si las variables de entorno de autenticacion no estan presentes, el sistema asigna valores hardcodeados de texto plano por defecto para el usuario y la contraseña del panel web `/admin` y para el token de verificacion del webhook.
4. **Trafico Expuesto en HTTP sin Encriptacion Obligatoria (Severidad Alta):**
   - El servidor FastAPI expone los endpoints en el puerto 8000. Si no se dispone de un proxy inverso configurado con TLS/HTTPS estricto, las sesiones administrativas, las contraseñas del panel web y los datos de clientes viajan desprotegidos a traves de la red.
5. **Vulnerabilidad a Sobrecostos o Negativa de Servicio por Consumo de API (Severidad Media):**
   - El bot reenvia mensajes complejos y fotos a OpenAI sin limites estrictos de tasa (rate limiting) por usuario. Un atacante podria bombardear el numero de WhatsApp con imagenes o textos extensos, agotando la cuota monetaria de OpenAI en pocas horas e interrumpiendo el servicio para todos los clientes (como ya ocurrio historicamente segun el Acta 02).
6. **Fragilidad de la Sincronizacion con Google Sheets (Severidad Media):**
   - El script `sheet_sync.py` depende de la disponibilidad de un enlace publico de Google Docs y de nombres exactos de columnas ("PRECIO REGULAR 14 OZ"). Si un empleado renombra inadvertidamente una columna o altera la estructura de la hoja, la sincronizacion falla o produce un catalogo incompleto.
7. **Arquitectura Monolitica de Gran Extension (`bot_wa.py` con mas de 5000 lineas) (Severidad Media):**
   - Concentrar en un solo archivo servidores web, endpoints REST, logica de inteligencia artificial, procesamiento geoespacial, plantillas HTML/CSS en cadenas de texto y acceso a disco obstaculiza el mantenimiento, las pruebas automatizadas y eleva la probabilidad de introducir errores colaterales ante cualquier modificacion.

---

## 8. Lista Priorizada de Reglas del Bot que Conviene Incorporar al Sistema

A partir del contraste operativo, se presenta la lista priorizada de reglas y mecanismos probados en el bot real que deben ser adoptados por el nuevo sistema de Caprichos (en `Admin.dc.html`, `Main.dc.html` y el servicio backend del chatbot):

### 8.1. Prioridad Alta (Indispensables para la Operacion y Conversion)
1. **Motor de Calculo Geoespacial con Poligonos GeoJSON:** Incorporar el motor de clasificacion por zonas (Z2 a Z7) y deteccion de fuera de cobertura en el backend para calcular con precision milimetrica las tarifas de delivery a partir de las coordenadas del cliente.
2. **Regla de Delivery Gratis por Consumo Mayor a S/ 70 y Minimo de S/ 14.50:** Estandarizar esta regla en todos los canales de venta (Carta Web, Chatbot y Call Center), garantizando que el flete se descuente automaticamente al alcanzar el monto objetivo en productos.
3. **Mecanismo de Debouncer para Mensajeria:** Implementar en el conector de WhatsApp la ventana de consolidacion de 2 a 3 segundos para fusionar mensajes fragmentados antes de derivar la peticion al motor conversacional.
4. **Criterio Semantico Peruano ("Cancelo con [monto]"):** Configurar el procesamiento del bot para interpretar indefectiblemente el verbo "cancelar" como pago en efectivo con solicitud de vuelto, erradicando cancelaciones indebidas de ordenes.
5. **Reutilizacion Proactiva de Ubicacion Anterior:** Recordar la direccion y coordenadas asociadas al numero telefonico para preguntar "¿Lo enviamos a tu misma direccion anterior?" tanto en la carta web como en el chat, agilizando la compra recurrente.
6. **Mecanismo Dinamico de Alta Demanda:** Integrar un conmutador visible en el panel administrativo que aumente de inmediato los tiempos prometidos de entrega (de 30-45 min a 50-60 min) en la web y en las respuestas del bot durante horas saturadas.
7. **Pausa Operativa y Timeout por Inactividad (Handoff Robusto):** Silenciar de forma automatica al bot cuando el chat requiera atencion humana o este en revision de pago, complementado con un reseteo por inactividad tras 3 horas para evitar chats huerfanos.

### 8.2. Prioridad Media (Experiencia de Usuario y Calidad de Produccion)
8. **Reglas de Combinacion y Equivalencia del Duo Compartir:** Programar la logica condicional que permite elegir 2 donas/galletas, pero restringe a 1 unidad si se selecciona un complemento pesado (Carrot Cake, empanada o petit pan) sin alterar el costo del combo.
9. **Asociacion Automatica de Bebidas a Combos:** Asumir que las bebidas listadas por el cliente pertenecen a los combos solicitados antes de cobrarlas como articulos individuales adicionales.
10. **Reglas Estrictas de Modificadores en Bebidas:** Incorporar en la carta web y bot las politicas de leche sin lactosa / stevia gratis, almendras a + S/ 2.50, chantilly extra a + S/ 2.00, y cambio de topping gratis con porcion extra a + S/ 1.00.
11. **Advertencias Culinarias sobre Hielo y Textura:** Configurar avisos amables cuando el cliente solicite "poco hielo" (explicando que saldra menor volumen en vaso) o "no tan helado" (advirtiendo que el frappe quedara aguado).
12. **Politica de Cero Spam de Horarios y Recepcion 24h:** Permitir la toma continua de pedidos las 24 horas del dia sin atosigar al usuario con horarios en mensajes intermedios, advirtiendo unicamente el inicio de despacho a las 2:00 PM cuando corresponda.
13. **Tarifas Silenciosas para Clientes Frecuentes:** Soportar en la base de datos de clientes la asignacion de tarifas fijas o descuentos porcentuales de delivery que se apliquen sin emitir mensajes de descuento publicos.
14. **Asimilacion de Precios Digitados a Tamaños:** Interpretar respuestas numericas (ej. "14.50" o "16.50") como la seleccion inmediata del tamaño de bebida correspondiente.

### 8.3. Prioridad Baja (Optimizaciones Accesorias y Futuras)
15. **Soporte de Transcripcion de Notas de Voz (Whisper):** Mantener la capacidad de procesar audios cortos de WhatsApp convirtiendolos a texto para no perder clientes que compran por voz.
16. **Asistencia Optica de Comprobantes (Vision AI para Caja):** Utilizar la extraccion de monto y numero de operacion con IA como una sugerencia prellenada en la pantalla de cobro del cajero, manteniendo la ratificacion humana final.
17. **Encuesta de Posventa a las 2 Horas:** Programar el envio diferido del mensaje de satisfaccion para derivar resenas positivas a Google Maps y quejas a la gerencia del local.

---

INFORME LISTO
