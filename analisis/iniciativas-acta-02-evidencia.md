---
id: ANA-CAP-035
tipo: analisis
titulo: "Evidencia de la extracción: acta 02"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-15
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, analisis]
---

# Evidencia de la extracción: acta 02

Salida bruta de los 5 agentes Antigravity (sin deduplicar), con la cita textual de cada elemento. Sirve para comprobar de dónde sale cada entrada de [`iniciativas-acta-02.md`](iniciativas-acta-02.md). Tramos por líneas de la transcripción: A 1–360, B 340–700, C 680–1040, D 1020–1400, E 1380–1749 (con solape de 20 líneas).

## Tramo A

### A-01 · Visita técnica para evaluar pantallas de cocina y flujo de trabajo actual
- **Área según el agente:** COCINA, PANTALLAS E IMPRESIÓN
- **Tipo:** Compromiso · **Quién:** Kevin · **Hora:** 00:00:00
- **Detalle:** Kevin indica que en ese momento se encuentran saturados en el local, por lo que plantea coordinar para un día por la tarde una visita presencial de José para que observe en vivo el funcionamiento de las pantallas de cocina y el flujo de trabajo operativo con el sistema actual.
- **Cita:** "Yo creo que lo vamos a manejar en la tarde, de repente ahí coordinamos el día para que veas cómo son las pantallas de cocina, o sea, cómo es este el flujo de trabajo con el sistema actual, ¿no?"
- **Prioridad:** Próximo · **Confianza:** Alta

### A-02 · Filtros de búsqueda y navegación en la Carta Web
- **Área según el agente:** CARTA WEB (cliente)
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 00:00:54
- **Detalle:** José muestra en la maqueta de la carta web opciones de ordenamiento y filtrado por rango de precios, un filtro para mostrar exclusivamente productos en promoción, y categorías especializadas como "100% cacao" para facilitar la navegación del cliente tanto en PC como en móviles.
- **Cita:** "el orden, si quieres hacer unos filtros, eh unos filtros con los precios, eh mostrar solo con promoción, 100% cacao"
- **Prioridad:** Próximo · **Confianza:** Alta

### A-03 · Atributos de personalización y notas especiales por producto en Carta Web
- **Área según el agente:** CARTA WEB (cliente)
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 00:00:54
- **Detalle:** En la carta web se contemplan opciones de configuración para bebidas como frappés: selección de tamaño (regular, grande), tipo de leche (entera, deslactosada), tipo de endulzante, y un campo de notas adicionales u observaciones para que el cliente detalle especificaciones antes de añadir el producto al carrito.
- **Cita:** "los frapés puede hacer la compra regular, grande, leche entera, lactosa, dulzante... Nota sí lo agrega y todo se va al carrito."
- **Prioridad:** Inmediato · **Confianza:** Alta

### A-04 · Opción de número de mesa para consumo en local desde Carta Web
- **Área según el agente:** MESAS, PEDIDOS EN SALA Y RESERVAS
- **Tipo:** Regla de negocio · **Quién:** José · **Hora:** 00:00:54
- **Detalle:** Al seleccionar la modalidad de pedido para consumo en el local, la carta web solicita los datos del cliente (nombre, apellido) e incluye el número de mesa asignada, confirmando José que mantendrá dicho campo activo para pedidos en sala.
- **Cita:** "Si es del para llevar el local. Y según esto ya elige el mismo cliente, su nombre, su apellido, número de mesa. Bueno, número de mesa no lo va a quitar. número deja."
- **Prioridad:** Próximo · **Confianza:** Alta

### A-05 · Carrito de compras multi-producto para pedidos con delivery
- **Área según el agente:** CARTA WEB (cliente)
- **Tipo:** Regla de negocio · **Quién:** Kevin · **Hora:** 00:00:54
- **Detalle:** Kevin consulta si el servicio de delivery se aplica al consolidado del carrito de compras. José ratifica que el cliente tiene la capacidad de incorporar múltiples productos de diversas categorías en un único pedido antes de procesar el despacho por delivery.
- **Cita:** "y el delivery este lo estás colocando ahorita es es en el carrito de todo el pedido, de todo... sí, todo. Puede hacer varios pedidos, todos los pedidos que quieran."
- **Prioridad:** Inmediato · **Confianza:** Alta

### A-06 · Incorporación de toppings y complementos en la personalización de productos
- **Área según el agente:** CARTA WEB (cliente)
- **Tipo:** Pedido del cliente · **Quién:** Kevin · **Hora:** 00:01:59
- **Detalle:** Kevin señala que además de tamaño, leche y endulzante, en Caprichos se manejan toppings y complementos adicionales (por ejemplo en frappés o combos como el dúo compartir), por lo que solicita que la plataforma permita seleccionarlos y agregarlos al producto.
- **Cita:** "Ah, sí, hay este toping, pero eso se agrega, es manejable, pues, ¿no?... Los topics son tus complementos. Claro."
- **Prioridad:** Inmediato · **Confianza:** Alta

### A-07 · Captura de ubicación y dirección para entrega por delivery
- **Área según el agente:** CARTA WEB (cliente)
- **Tipo:** Pedido del cliente · **Quién:** Kevin · **Hora:** 00:01:59
- **Detalle:** Kevin remarca que al elegir la opción de delivery en la web, el sistema debe desplegar los campos necesarios para ingresar la ubicación o dirección exacta de entrega del cliente, junto con el tiempo estimado de entrega.
- **Cita:** "y cuando colocas delivery, bueno, me imagino que después se desarrolla, ¿no? Ingresa tu ubicación, etcétera, etcétera."
- **Prioridad:** Inmediato · **Confianza:** Alta

### A-08 · Regla de negocio: pedidos 100% para hoy y eliminación de selección forzada de fecha
- **Área según el agente:** DECISIONES Y REGLAS CONFIRMADAS
- **Tipo:** Regla de negocio · **Quién:** Kevin · **Hora:** 00:03:55
- **Detalle:** Kevin critica severamente el sistema restaurant.pe por exigir al usuario seleccionar una fecha de entrega al iniciar. Establece formalmente que en Caprichos el 100% de los pedidos son para consumo inmediato en el mismo día, por lo que resulta un obstáculo innecesario exigir fecha (a lo sumo podría dejarse opcional, pero nunca obligatorio al inicio).
- **Cita:** "Eso, eso es lo que no me gusta. ¿Quién va a agendar el 100% de los pedidos son para hoy? ¿Para qué pedirle la fecha?"
- **Prioridad:** Inmediato · **Confianza:** Alta

### A-09 · Eliminación de login obligatorio y solicitud forzosa de correo electrónico
- **Área según el agente:** CARTA WEB (cliente)
- **Tipo:** Pedido del cliente · **Quién:** Kevin · **Hora:** 00:03:55
- **Detalle:** Kevin manifiesta su desacuerdo con obligar al cliente a registrarse, iniciar sesión o ingresar correo electrónico para comprar, calificándolo como un trámite engorroso pensado solo para el comercio y no para la experiencia del usuario. Pide un flujo de compra directo sin barreras de registro obligatorio.
- **Cita:** "te pide correo. Es una es un protocolo que no está optimizado para el cliente, solamente para comercio."
- **Prioridad:** Inmediato · **Confianza:** Alta

### A-10 · Revisión y catálogo de productos existente en restaurant.pe
- **Área según el agente:** CARTA WEB (cliente)
- **Tipo:** Dato del negocio · **Quién:** José · **Hora:** 00:03:55
- **Detalle:** José y Kevin repasan la estructura del menú vigente de Caprichos en restaurant.pe, que incluye combos fríos, postres calientes, salados, promociones, carta general, caja feliz, frappés, y artículos de merchandising de la marca como el termo Caprichos 20.
- **Cita:** "tenemos combos fríos, postres calientes, salados, promociones también tiene, me imagino. Mira, carta, caja feliz, docena objetos también tiene termo, caprichos 20. Ya, frapz"
- **Prioridad:** Próximo · **Confianza:** Alta

### A-11 · Visualización directa e independiente de Yape y Plin en métodos de pago
- **Área según el agente:** CARTA WEB (cliente)
- **Tipo:** Pedido del cliente · **Quién:** Kevin · **Hora:** 00:05:03
- **Detalle:** En restaurant.pe las billeteras digitales Yape y Plin están ocultas dentro del botón de transferencia bancaria, provocando que un 30% de los clientes se confunda y pregunte si aceptan dichos medios de pago. Kevin exige que Yape y Plin figuren como opciones de pago directas, visibles e independientes desde el primer nivel de selección.
- **Cita:** "ellos yaeplin lo tienen dentro de la categoría transferencia bancaria y casi y la gente el 30% se confunde y prefieren hacer, o sea, nos consultan, no, no tienen y pero tú le das en transferencia bancaria y recién se abre una barra... O sea, yo le pondría o este Yape PL"
- **Prioridad:** Inmediato · **Confianza:** Alta

### A-12 · Flujo de pago sin carga forzosa de comprobante en web y confirmación por WhatsApp
- **Área según el agente:** CARTA WEB (cliente)
- **Tipo:** Pedido del cliente · **Quién:** Kevin · **Hora:** 00:06:11
- **Detalle:** Kevin rechaza que el sistema web obligue al cliente a cargar un comprobante de pago o voucher (ya que el software no valida transferencias de forma automática). Prefiere un flujo ágil donde tras hacer el pedido aparezca el mensaje 'Estamos esperando tu pago, te contactaremos por WhatsApp para que puedas enviarnos constancia', derivando el envío de la captura al canal de WhatsApp para coordinar y hacer seguimiento.
- **Cita:** "No, no, no que lo mande. Este, en este caso estamos esperando tu pago, te contactaremos por WhatsApp para que puedas enviarnos constancia, algo así. Sí. O sea, hacerle la vida fácil al cliente, que pida fácil y que envíe la captura al WhatsApp."
- **Prioridad:** Inmediato · **Confianza:** Alta

### A-13 · Notificación proactiva e inmediata del bot por WhatsApp al ingresar pedido web
- **Área según el agente:** CHATBOT WHATSAPP
- **Tipo:** Idea del cliente · **Quién:** Kevin · **Hora:** 00:06:11
- **Detalle:** Kevin destaca una funcionalidad de Hola Click que desea replicar: cuando entra un pedido web, el bot de WhatsApp toma de inmediato el número telefónico registrado por el cliente y le envía un mensaje instantáneo informando 'Hemos recibido tu pedido', abriendo el hilo de conversación proactivamente. José confirma que se integrará fácilmente mediante la API de WhatsApp.
- **Cita:** "hola, Click, tiene algo bien bonito que se que es un bot que cuando el pedido, nosotros por ejemplo recibimos el pedido de forma automática, el bot lo que hace es que le envía, 'Hemos recibido tu pedido.' de arranque al WhatsApp, de golpe al WhatsApp, ya el bot se adelanta y inicia la conversación por el WhatsApp."
- **Prioridad:** Inmediato · **Confianza:** Alta

### A-14 · Datos de pago: cuenta y número telefónico con opción de copiar y pegar sin QR
- **Área según el agente:** CARTA WEB (cliente)
- **Tipo:** Pedido del cliente · **Quién:** Kevin · **Hora:** 00:07:13
- **Detalle:** Al momento de pagar con Yape o transferencia desde el celular, mostrar un código QR resulta incómodo e impráctico para el cliente. Kevin y José acuerdan mostrar claramente el número de teléfono y nombre del titular junto a una función o botón de copiar y pegar para que el cliente lo transfiera directamente a su aplicación bancaria.
- **Cita:** "Número no más costo... El número para que copie y lo pegue. Listo. Listo. - Sí, también copi pega más fácil."
- **Prioridad:** Inmediato · **Confianza:** Alta

### A-15 · Adopción del flujo de pedido de Hola Click: productos primero, datos al final
- **Área según el agente:** DECISIONES Y REGLAS CONFIRMADAS
- **Tipo:** Pedido del cliente · **Quién:** Kevin · **Hora:** 00:10:34
- **Detalle:** Kevin define la regla para el flujo de la carta web: tomar como modelo a Hola Click, donde el usuario visualiza los productos y arma su orden directamente, solicitándole sus datos de despacho e identificación únicamente al final del proceso de compra, sin interrupciones previas.
- **Cita:** "De hola click me gusta mucho porque te arranque haces el pedido y último te pide los datos... La idea de vender es darle facilidad de compra al cliente y en programación también es hacerlo fácil, intuitivo."
- **Prioridad:** Inmediato · **Confianza:** Alta

### A-16 · Imágenes de producto: formato cuadrado, alta resolución y función de zoom
- **Área según el agente:** CARTA WEB (cliente)
- **Tipo:** Pedido del cliente · **Quién:** Kevin · **Hora:** 00:11:41
- **Detalle:** Queja respecto a restaurant.pe porque fuerza todas las imágenes a un formato rectangular u horizontal de baja resolución que no se puede ampliar. Kevin solicita usar formato cuadrado (como en Hola Click) y con suficiente calidad para que el cliente pueda abrir y apreciar el producto. José se compromete expresamente a incorporar la funcionalidad de zoom interactivo en las imágenes.
- **Cita:** "Las imágenes son en horizontal todas las que tú subes. Así tú subas una cuadrada, todas son horizontales... el cliente no le puede dar clic a la imagen para verlo más grande y para poder eh entre comillas saborearlo... Y aparte eh no le puedes dar zoom ni nada... - No, pero ya eso me lo va adicional hacerle un zoom ya"
- **Prioridad:** Inmediato · **Confianza:** Alta

### A-17 · Banner publicitario en Carta Web para campañas y promociones
- **Área según el agente:** MARKETING, POSVENTA Y OPINIONES
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 00:12:35
- **Detalle:** José propone incorporar un banner publicitario destacado en la parte superior o en espacios libres de la carta web para comunicar promociones, campañas de temporada o lanzamientos especiales, aspecto que Kevin valida como altamente beneficioso para el negocio.
- **Cita:** "quién sabe un poco más de publicidad, un banner grande... un banner publicitario podría ser por acá. Porque mira, acá veo que es sobre espacio. Podríamos aprovecharlo."
- **Prioridad:** Próximo · **Confianza:** Alta

### A-18 · Frecuencia de novedades del negocio: lanzamiento mensual de Caprichos del mes
- **Área según el agente:** MARKETING, POSVENTA Y OPINIONES
- **Tipo:** Dato del negocio · **Quién:** Kevin · **Hora:** 00:12:35
- **Detalle:** Kevin explica que Caprichos mantiene una dinámica de marketing constante donde mensualmente introducen uno o dos productos o pedidos especiales nuevos denominados 'Caprichos del mes', los cuales requieren difusión mediante el banner o sección promocional.
- **Cita:** "Sí, porque tenemos caprichos del mes, por ejemplo, en siempre al mes sacamos uno o dos pedidos nuevos, dos productos, perdón, productos."
- **Prioridad:** Inmediato · **Confianza:** Alta

### A-19 · Referencia web de Starbucks para la configuración de bebidas personalizadas
- **Área según el agente:** INVESTIGAR O REVISAR (referencias)
- **Tipo:** Idea del cliente · **Quién:** Kevin · **Hora:** 00:13:29
- **Detalle:** Kevin recomienda como referencia de diseño y flujo a la página web de Starbucks Perú, destacando cómo estructura la selección inicial del método de entrega (recoger, delivery) y la parametrización de bebidas (tamaños, tipo de leche, café batido, opciones). Kevin comparte el enlace a José durante la llamada.
- **Cita:** "Y lo otro es que una referencia sería la página de Starbucks también, que es una buena referencia también para mí porque su página es personalizada... Eso es una referencia muy buena en cuanto a bebidas. Ahí te la estoy pasando."
- **Prioridad:** Inmediato · **Confianza:** Alta

### A-20 · Sección institucional "Conócenos" en la web inspirada en Starbucks
- **Área según el agente:** CARTA WEB (cliente)
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 00:14:23
- **Detalle:** Al analizar la referencia de Starbucks, José propone crear un apartado informativo de marca para Caprichos ('Lo que tienes que saber de Caprichos' o sección 'Conócenos') que transmita la identidad y propuesta de valor de la cafetería artesanal a los clientes.
- **Cita:** "Me gusta el lo que tiene que saber sobre Star, lo que tiene que saber de caprichos, o sea, como un conócenos muy bueno."
- **Prioridad:** Futuro · **Confianza:** Alta

### A-21 · Regla de negocio: operación exclusiva en local único
- **Área según el agente:** DECISIONES Y REGLAS CONFIRMADAS
- **Tipo:** Dato del negocio · **Quién:** José · **Hora:** 00:14:23
- **Detalle:** Durante la revisión de interfaces se confirma que Caprichos cuenta con una sola sede o cafetería en funcionamiento, por lo que no es necesario implementar selectores complejos de locales o sucursales en la carta web.
- **Cita:** "Bueno, en locales solamente hemos uno, así que no."
- **Prioridad:** Inmediato · **Confianza:** Alta

### A-22 · Gestión dinámica de visibilidad de banners desde el panel administrativo
- **Área según el agente:** ADMINISTRATIVO Y ROLES
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 00:14:23
- **Detalle:** José detalla que la presencia del banner publicitario en la carta será totalmente configurable desde el panel de administración: si en determinada época no hay campañas activas o no se desea publicar contenido promocional, el banner se desactivará automáticamente para no dejar espacios vacíos.
- **Cita:** "hasta la publicidad, quién sabe, hay un tiempo que no hay publicidad, se va a desactivar, no siempre se va a ver. sabe por ahí no hay nada que publicar, se desactiva. Yo en la parte administrativa que ahorita la vo a mostrar, hay un poco más de cómo se va a configurar todo esto."
- **Prioridad:** Próximo · **Confianza:** Alta

### A-23 · Optimización visual móvil: diseño compacto de catálogo para evitar saturación
- **Área según el agente:** CARTA WEB (cliente)
- **Tipo:** Pedido del cliente · **Quién:** Kevin · **Hora:** 00:15:23
- **Detalle:** Kevin observa en la maqueta móvil que las tarjetas de los productos son excesivamente grandes y advierte que causarán fatiga visual y mareo al cliente mientras navega. Solicita que la vista de exploración sea compacta y con elementos reducidos, reservando el formato grande únicamente para el momento en que se selecciona un producto específico.
- **Cita:** "pero la carta en en el modo de celular Este se van a marear mucho si es así de grande tienes que ponerlo más pequeño... para ver navegar los productos tiene que ser más pequeño para navegar... Sí, lo visualmente lo va a desgastar el cliente."
- **Prioridad:** Inmediato · **Confianza:** Alta

### A-24 · Reducción del tamaño de fuente en los filtros para dispositivos móviles
- **Área según el agente:** CARTA WEB (cliente)
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 00:15:23
- **Detalle:** José identifica que en pantallas de celular la tipografía empleada en los botones de filtro resulta demasiado grande y desborda la interfaz, por lo que ajustará las dimensiones del texto para asegurar una correcta visualización en pantallas reducidas.
- **Cita:** "Y los filtros que se mantengan ahí. Ya. Acá se pierde un poquito. Es muy grande las letras. Ya, eso sería la parte de la carta"
- **Prioridad:** Inmediato · **Confianza:** Alta

### A-25 · Nombre oficial del asistente virtual de WhatsApp: Capri
- **Área según el agente:** CHATBOT WHATSAPP
- **Tipo:** Regla de negocio · **Quién:** José · **Hora:** 00:16:22
- **Detalle:** José confirma con Kevin que el bot conversacional de WhatsApp responderá oficialmente bajo el nombre de 'Capri', saludando a los usuarios con la frase de bienvenida identificativa del café.
- **Cita:** "Le dice Lola a Capri, se va a llamar Capri. Así le están llamando, ¿no? - y sí, sí. Ajá."
- **Prioridad:** Inmediato · **Confianza:** Alta

### A-26 · Flujo guiado por botones para la toma de pedidos en el Chatbot Capri
- **Área según el agente:** CHATBOT WHATSAPP
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 00:16:22
- **Detalle:** José presenta la secuencia guiada del bot: Saludo -> Opciones iniciales [Ver carta] o [Hacer pedido] -> Modalidad (Delivery, Para llevar, En local) -> Selección de categoría y producto (Frappé caliente, waffle salado, mocaccino, cappuccino) -> Personalización (tamaño, tipo de leche: deslactosada o almendrada, endulzante: azúcar o stevia) -> Acción siguiente: [Agregar otro producto] o [Finalizar pedido].
- **Cita:** "Al bots ya le dice ver carta o hacer pedido. Hacer pedido. Te pregunta dely para llevar en local... Opciones. ¿Qué quiere? Frapé caliente, waffle salado caliente, mocasino, capuchino. Ya. Y las demás opciones que hay. El tamaño, el lácteo, lactosa, bebida almendrada, ya, azúcar, estevia. Si quiere agregar otro producto o finalizar y pedir solamente eso."
- **Prioridad:** Inmediato · **Confianza:** Alta

### A-27 · Carrito multi-producto con cálculo de monto total en el Chatbot de WhatsApp
- **Área según el agente:** CHATBOT WHATSAPP
- **Tipo:** Pedido del cliente · **Quién:** Kevin · **Hora:** 00:17:12
- **Detalle:** Kevin recalca la necesidad de que el cliente pueda pedir varios artículos distintos en una sola sesión de chat. José demuestra en la maqueta cómo el bot permite añadir por ejemplo un waffle y luego un frappé oreo grande con leche deslactosada, consolidándolos en una pantalla de resumen que calcula y muestra el monto total a pagar.
- **Cita:** "va a poder agregar más como un carrito. Y si digamos no quiere agregar otro, ya resumen de frente le agrega otro más... Quiero frapé, quiero oreo grande, lactosa y ya ver resumen. Y ahí están los dos, hasta los dos están ahí y sale el total."
- **Prioridad:** Inmediato · **Confianza:** Alta

### A-28 · Solicitud de comprobante de pago por WhatsApp al finalizar el pedido en el bot
- **Área según el agente:** CHATBOT WHATSAPP
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 00:17:12
- **Detalle:** Como cierre del flujo automatizado de pedido en WhatsApp, el bot solicitará al usuario adjuntar su comprobante con un mensaje de validación: 'Sube tu voucher de pago y en unos momentos estaremos confirmando tu compra'.
- **Cita:** "Lo que faltaría, creo que es sube tu voucher de pago y en unos momentos estaremos confirmando tu compra, algo así, ¿no? También."
- **Prioridad:** Inmediato · **Confianza:** Alta

### A-29 · Integración de IA en WhatsApp para resolver dudas abiertas y dar recomendaciones
- **Área según el agente:** CHATBOT WHATSAPP
- **Tipo:** Compromiso · **Quién:** José · **Hora:** 00:18:05
- **Detalle:** Kevin consulta si el bot responderá preguntas no estructuradas del cliente (por ejemplo, si tiene gripe y busca bebidas adecuadas, si es intolerante a la lactosa, o consultar qué opciones calientes hay disponibles). José se compromete expresamente a integrar capacidades de inteligencia artificial para responder dudas y formular recomendaciones personalizadas.
- **Cita:** "Y en cuanto al consultas y dudas también lo va a responder de forma automática... Quién sabe le dice, 'Estoy estoy con la gripe o no sé, estoy mal de la planta, soy intolerante a la lactosa.' Ya, esto lo voy a hacer."
- **Prioridad:** Inmediato · **Confianza:** Alta

### A-30 · Soporte para clientes que omiten botones y solicitan productos directamente por texto
- **Área según el agente:** CHATBOT WHATSAPP
- **Tipo:** Dato del negocio · **Quién:** Kevin · **Hora:** 00:18:05
- **Detalle:** Kevin describe la conducta real de los usuarios en WhatsApp: muchos ignoran intencionalmente los menús de botones y escriben directamente lo que desean (ej. 'Hola, quiero un frappé de Oreo'). El sistema debe ser capaz de procesar estas peticiones en lenguaje natural sin forzar un reinicio del flujo.
- **Cita:** "el cliente a veces te pregunta este... de arranque inicia la conversación. Hola, quiero un frapé de Oreo. No, y no y obvia la parte de repente los botones"
- **Prioridad:** Inmediato · **Confianza:** Alta

### A-31 · Falla detectada en bot actual: omisión de cobro de delivery por la IA
- **Área según el agente:** CHATBOT WHATSAPP
- **Tipo:** Queja o problema actual · **Quién:** Kevin · **Hora:** 00:18:05
- **Detalle:** Kevin comparte un error crítico ocurrido ese mismo día con el bot de IA en producción: le enviaron una captura demostrando que el bot tomó un pedido de despacho a domicilio pero omitió cobrar el recargo correspondiente al costo de delivery.
- **Cita:** "ahorita este, ¿cómo has visto el bot actual? Porque es es la IA, pero hay a veces comete errores. Por ejemplo, hoy día me mandaron un un captura de que no le cobré el delivery a un cliente, ¿no?"
- **Prioridad:** Inmediato · **Confianza:** Alta

### A-32 · Problema en bot actual: desorientación y consumo excesivo de tokens ante errores tipográficos
- **Área según el agente:** CHATBOT WHATSAPP
- **Tipo:** Queja o problema actual · **Quién:** José · **Hora:** 00:19:08
- **Detalle:** Al hacer pruebas en vivo solicitando un sándwich parrillero con variantes informales o faltas ortográficas ('un parry', 'con un parryo'), el bot actual se confunde por completo, no deduce el producto y genera un consumo excesivo e ineficiente de procesamiento y tokens.
- **Cita:** "Quiero un parrillero. A ver. un parrillero. Bueno, acá sí se pierde y es mucho consumo por todo eso que está un parrillero. Ya. A ver, quiero otro parry, pero con un parryo. Quiz hay gente que no no escribe correctamente"
- **Prioridad:** Inmediato · **Confianza:** Alta

### A-33 · Regla operativa de stock: productos de panadería y repostería sin disponibilidad diaria fija
- **Área según el agente:** ALMACÉN, STOCK, RECETAS Y COMPRAS
- **Tipo:** Dato del negocio · **Quién:** José · **Hora:** 00:20:36
- **Detalle:** Se identifica un factor operativo clave en Caprichos: determinados productos de repostería y panadería artesanal como las donas (en sus diversas variedades), pitipanes y empanadas no se elaboran ni se encuentran disponibles todos los días en el local.
- **Cita:** "pide más que todo las donas, porque las donas no están disponibles todos los días, todas... Pitipan, empanadas, no, no hay todos los días."
- **Prioridad:** Inmediato · **Confianza:** Alta

### A-34 · Sincronización en tiempo real del Chatbot con el inventario y stock de la base de datos
- **Área según el agente:** ALMACÉN, STOCK, RECETAS Y COMPRAS
- **Tipo:** Regla de negocio · **Quién:** Kevin · **Hora:** 00:20:36
- **Detalle:** Kevin destaca el problema actual de que los clientes piden y pagan productos que no tienen stock físico disponible ('va a pedir por las puras'). Se acuerda como requisito crítico que el nuevo chatbot esté enlazado y sincronizado en tiempo real con la base de datos de stock: si un producto se agota o se desactiva desde el panel administrativo, el bot debe actualizar su oferta al instante.
- **Cita:** "Claro, porque va a pedir por la fura. En cambio, el otro el otro bot va a estar sincronizado con el stock en tiempo real. - Sí, con la base de datos va a estar sincronizado... Sa que el chatbot se va a ir actualizando también automáticamente conforme uno vaya administrando el el panel administrativo de del menú."
- **Prioridad:** Inmediato · **Confianza:** Alta

### A-35 · Gestión de productos agotados en Chatbot: ocultamiento o aviso explícito de sin stock
- **Área según el agente:** CHATBOT WHATSAPP
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 00:21:34
- **Detalle:** Cuando no haya existencias de un producto determinado (como el sándwich parrillero), José plantea dos alternativas para el bot: no mostrarlo dentro de las opciones ofrecidas, o presentarlo acompañado de un aviso claro de 'No hay stock' o 'No disponible por ahora' para prevenir que el usuario intente comprarlo.
- **Cita:** "Sí, quién sabe, no hay stock de, no sé, de un parrillero, eh, no lo va a mostrar el chatbot, o sea, o podríamos hacer que lo muestre, pero que diga, 'No, no hay stock o no, no es disponible por ahora.'"
- **Prioridad:** Próximo · **Confianza:** Alta

### A-36 · Integración de promociones estacionales (campaña de Navidad) en el Chatbot
- **Área según el agente:** MARKETING, POSVENTA Y OPINIONES
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 00:20:36
- **Detalle:** José propone que el chatbot incorpore de manera dinámica ofertas y campañas especiales de temporada (como promociones navideñas), de modo que el asistente virtual las promocione activamente en las interacciones comerciales.
- **Cita:** "¿Quién sabe? Por ahí hay un hay promoción de Navidad. Bueno, esa sería bueno también poner el chat las promociones de Navidad. - Exacto, exacto, exacto."
- **Prioridad:** Próximo · **Confianza:** Alta

### A-37 · Arquitectura híbrida del Chatbot: IA para atención conversacional y botones para pedidos
- **Área según el agente:** CHATBOT WHATSAPP
- **Tipo:** Pedido del cliente · **Quién:** Kevin · **Hora:** 00:21:34
- **Detalle:** Kevin y José definen el diseño operativo de Capri como un modelo híbrido: la inteligencia artificial se encargará de brindar recomendaciones, responder inquietudes de salud, ingredientes y preguntas abiertas, mientras que la captura y estructuración del pedido se efectuará mediante cuestionarios y botones interactivos, eliminando el esfuerzo de tipear y agilizando la venta.
- **Cita:** "Sí, podríamos este combinar lo que está ahorita, o sea, las respuestas que tienes ahorita, que es con y los botones, que los botones me parece algo mucho más fácil para cliente, ¿no? La hace pensar tanto... no la hace escribir... le agregaremos el el botcito para que pueda dar recomendaciones, porque el pedido sí lo va a hacer de manera por por cuestionarios, por botones"
- **Prioridad:** Inmediato · **Confianza:** Alta

### A-38 · Fuga de gas refrigerante en mesa refrigerada durante labores de limpieza
- **Área según el agente:** INFRAESTRUCTURA Y OPERACIÓN
- **Tipo:** Dato del negocio · **Quién:** Kevin · **Hora:** 00:07:53
- **Detalle:** Kevin interrumpe la reunión durante dos minutos debido a una contingencia imprevista en cocina: personal de limpieza (mencionando a María Carlos) manipuló indebidamente una mesa refrigerada, originando una fuga de gas refrigerante en las instalaciones del café.
- **Cita:** "Este, lo que pasa es que estado limpiando y no y no han tenido precaución y han parece que se ha botado un gas de una mesa refrigerada... Dame unos segundos. Dame 2 minutos por favor paraar porque si está botando el gas caballero, ese gas se va a votar no más este."
- **Prioridad:** Inmediato · **Confianza:** Alta

### A-39 · Referencia de sistema: Hola Click (experiencia de usuario y flujo de pedidos)
- **Área según el agente:** INVESTIGAR O REVISAR (referencias)
- **Tipo:** Idea del cliente · **Quién:** Kevin · **Hora:** 00:01:59
- **Detalle:** Aunque la cuenta de Hola Click que tenía Caprichos ya no se encuentra activa, Kevin insiste en tomarla como la principal referencia de interfaz y flujo comercial (pedido directo, datos mínimos solicitados al final, notificación automática vía WhatsApp e imágenes cuadradas).
- **Cita:** "pero como te dije con una referencia de la interfaz y el flujo de Hola, click. Te te diste referencia... lo que pasa es que el Lola Click es antiguo, ya no lo usamos, no está activo... la interfaz puedes colocarle la más intuitiva, la más dinámica, accesible para el cliente, la más fácil, pero el flujo, el proceso me gusta mucho."
- **Prioridad:** Inmediato · **Confianza:** Alta

### A-40 · Referencia de sistema: restaurant.pe (catálogo activo y deficiencias operativas)
- **Área según el agente:** INVESTIGAR O REVISAR (referencias)
- **Tipo:** Queja o problema actual · **Quién:** Kevin · **Hora:** 00:03:55
- **Detalle:** Kevin y José analizan el menú web actual de Caprichos provisto por restaurant.pe. Si bien es la fuente fidedigna y actualizada de productos y precios, presenta serios problemas de conversión: exige fecha y correo antes de ver la carta, esconde Yape/Plin dentro de transferencias, pide subir comprobantes manuales y no permite ampliar imágenes.
- **Cita:** "actualmente lo tenemos todo en el menú online de de restaurant.p... sí, esa está actualizada toda rest y restaurant.P... pero de verdad, prefiero la interfaz de hola click."
- **Prioridad:** Inmediato · **Confianza:** Alta

### A-41 · Compromiso de envío de páginas web gastronómicas de referencia por parte del cliente
- **Área según el agente:** PENDIENTES DEL CLIENTE
- **Tipo:** Compromiso · **Quién:** Kevin · **Hora:** 00:14:23
- **Detalle:** Kevin se compromete a compartir con José enlaces de páginas web de referencia de otros comercios de comida y bebidas que tengan interfaces destacadas, habiéndole enviado durante la misma llamada el enlace de la web de Starbucks.
- **Cita:** "Si usted tiene así que digamos ejemplo de otros, no sé, otras páginas web de comidas, me lo puede pasar y yo lo veo y me adapto a eso... - Yo te voy a pasarte café battida. Claro... Ahí te la estoy pasando."
- **Prioridad:** Inmediato · **Confianza:** Alta

### A-42 · Compromiso del desarrollador: extraer catálogo completo de restaurant.pe y replicar flujo de Hola Click
- **Área según el agente:** PENDIENTES DEL DESARROLLADOR
- **Tipo:** Compromiso · **Quién:** José · **Hora:** 00:11:41
- **Detalle:** José se compromete a adoptar íntegramente la lógica y el flujo de navegación de Hola Click para la carta digital, y a extraer la totalidad del catálogo, categorías, descripciones y precios vigentes desde la plataforma de restaurant.pe.
- **Cita:** "Entonces, me copio el flujo de hola click y la carta lo saco todo de restaur de rest.P, ya que la cta es la más actualizada, ¿no es así? - Sí, esa está actualizada toda rest y restaurant.P. - Esa es la actualizada. Está bien."
- **Prioridad:** Inmediato · **Confianza:** Alta

### A-43 · Compromiso del desarrollador: corregir visualización de imágenes cortadas en el prototipo
- **Área según el agente:** PENDIENTES DEL DESARROLLADOR
- **Tipo:** Compromiso · **Quién:** José · **Hora:** 00:00:54
- **Detalle:** Al mostrar la maqueta inicial de la carta web, José advierte que las imágenes de los productos se encuentran desalineadas o cortadas en la interfaz y se compromete explícitamente a ajustar el encuadre para que se aprecien completas.
- **Cita:** "La imagen sí lo voy a arreglar para que esté completo. Si me dado cuenta."
- **Prioridad:** Inmediato · **Confianza:** Alta

### Sección del agente: Datos del negocio que se mencionaron
- **Local único:** Caprichos opera actualmente con una única sede o local físico en Lima; no requieren selector de múltiples sucursales.
- **Temporalidad de pedidos:** El 100% de los pedidos atendidos corresponden al mismo día de la solicitud; no manejan agenda anticipada de pedidos estándar.
- **Estrategia comercial mensual:** Lanzan entre 1 y 2 productos o especialidades nuevas cada mes bajo el concepto "Caprichos del mes".
- **Comportamiento en métodos de pago:** El 30% de los clientes se desorienta o consulta si aceptan Yape o Plin debido a que están agrupados de forma no visible bajo "transferencia bancaria".
- **Variabilidad de producción y stock:** Productos tradicionales de pastelería y panadería artesanal como donas (en distintos sabores), pitipanes y empanadas no cuentan con producción diaria fija ni stock continuo garantizado.
- **Catálogo y productos nombrados:** Combos fríos, postres calientes, salados (sándwich parrillero), frappés (frappé oreo, frappé café batido), waffle salado caliente, mocaccino, capuccino, caja feliz, termo Caprichos 20 (merchandising), dúo compartir.
- **Opciones de personalización gastronómica:** Tamaños (regular, grande), tipos de leche (leche entera, deslactosada, bebida almendrada), endulzantes (azúcar, stevia), toppings y complementos adicionales.
- **Personal de sala/operación mencionado:** María Carlos (mencionada durante la limpieza del área de frío).
- **Identidad del bot de atención:** Nombre establecido para el asistente virtual conversacional: "Capri".



### Sección del agente: Enlaces, páginas o sistemas nombrados
- **restaurant.pe** (nombrado como "restaurant.p", "rest.P", "rest"): sistema gastronómico y menú en línea actualmente contratado por Caprichos; fuente de datos actualizada para el catálogo.
- **Hola Click** (nombrado como "Hola, click", "Lola Click", "do click", "una click"): software de pedidos web usado anteriormente por Caprichos; referente prioritario para el flujo de pedido, formato de imágenes y mensajería inmediata.
- **Starbucks (Perú)**: sitio web de Starbucks citado y compartido por enlace durante la reunión por Kevin como estándar de personalización de bebidas y sección institucional de marca ("Conócenos").
- **WhatsApp / API de WhatsApp** (mencionada como "P de WhatsApp"): canal de mensajería para el chatbot Capri, confirmaciones inmediatas y recepción de capturas de pago.
- **Yape y Plin** (mencionado como "yaeplin", "Pepín"): aplicativos móviles peruanos de pago electrónico directo solicitados como botones visibles independientes.



### Sección del agente: Ruido descartado
- Conversaciones incidentales domésticas y familiares de fondo con menores ("mira pepino", "necesito piña", "tiela Pepequela", "no le toques la ropa") e interrupción de 2 minutos para verificar un escape de gas de refrigeración en cocina.



### Sección del agente: Cobertura
- Se analizaron minuciosamente las 361 líneas del archivo `segmento-a.txt`. Se identificó contenido útil y accionable en aproximadamente 320 líneas efectivas de conversación entre las marcas de tiempo 00:00:00 y 00:21:34. No se dejó ninguna sugerencia, iniciativa, pedido, pendiente o referencia técnica/comercial sin registrar.


## Tramo B

### B-01 · Actualización automática de promociones y menú en el chatbot
- **Área según el agente:** CHATBOT WHATSAPP
- **Tipo:** Idea del cliente · **Quién:** Kevin · **Hora:** 00:21:34
- **Detalle:** Kevin plantea que el chatbot de WhatsApp debe sincronizarse y actualizarse automáticamente en tiempo real cada vez que se modifique o administre el catálogo, los precios y las promociones desde el panel administrativo del menú (por ejemplo, promociones festivas como las de Navidad o productos rotativos como empanadas y pitipanes).
- **Cita:** "Sa que el chatbot se va a ir actualizando también automáticamente conforme uno vaya administrando el el panel administrativo de del menú."
- **Prioridad:** Próximo · **Confianza:** Alta

### B-02 · Gestión de productos sin stock en el chatbot
- **Área según el agente:** CHATBOT WHATSAPP
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 00:21:34
- **Detalle:** José plantea cómo debe reaccionar el chatbot cuando un producto se quede sin existencias (menciona como ejemplo un parrillero): se puede optar por ocultarlo del menú del bot o mantenerlo visible pero con una etiqueta clara que indique "No hay stock" o "No disponible por ahora".
- **Cita:** "Sí, quién sabe, no hay stock de, no sé, de un parrillero, eh, no lo va a mostrar el chatbot, o sea, o podríamos hacer que lo muestre, pero que diga, 'No, no hay stock o no, no es disponible por ahora.'"
- **Prioridad:** Próximo · **Confianza:** Alta

### B-03 · Interfaz del chatbot basada en botones interactivos para facilitar el pedido
- **Área según el agente:** CHATBOT WHATSAPP
- **Tipo:** Pedido del cliente · **Quién:** Kevin · **Hora:** 00:21:34
- **Detalle:** Kevin prefiere y solicita que el flujo del chatbot de WhatsApp combine respuestas de texto con botones interactivos de selección. Destaca que los botones son mucho más amigables y accesibles para los clientes porque agilizan el proceso, evitan que tengan que redactar mensajes largos y simplifican la toma de decisiones.
- **Cita:** "los botones me parece algo mucho más fácil para cliente, ¿no? La hace pensar tanto pa piña no la hace escribir."
- **Prioridad:** Inmediato · **Confianza:** Alta

### B-04 · Asistente IA para asesoramiento y formularios estructurados para el pedido
- **Área según el agente:** CHATBOT WHATSAPP
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 00:21:34
- **Detalle:** José define la arquitectura del bot de WhatsApp: contará con un agente conversacional inteligente para brindar recomendaciones y resolver consultas de los comensales, mientras que el proceso formal de compra y pedido se canalizará de manera guiada y estructurada mediante cuestionarios, botones y formularios.
- **Cita:** "le agregaremos el el botcito para que pueda dar recomendaciones, porque el pedido sí lo va a hacer de manera por por cuestionarios, por botones, formularios."
- **Prioridad:** Próximo · **Confianza:** Alta

### B-05 · Esquema de roles y permisos en el panel administrativo
- **Área según el agente:** ADMINISTRATIVO Y ROLES
- **Tipo:** Regla de negocio · **Quién:** José · **Hora:** 00:22:38
- **Detalle:** José presenta la estructura de perfiles de usuario contemplada para el sistema: administrador (con acceso total a la configuración y métricas), cajero, cocina, barra y mozo. Adicionalmente, señala que revisó el sistema restaurant.pe y constató que también incorporan roles de call center, almacén y repartidor, los cuales podrían sumarse según las necesidades de la cafetería.
- **Cita:** "va a tener estos roles administrador, cajero, cocina barra mozo. He visto que también tiene call center en el rest.p almacén y repartidor."
- **Prioridad:** Inmediato · **Confianza:** Alta

### B-06 · Paneles y dashboards estadísticos configurables para el administrador
- **Área según el agente:** ADMINISTRATIVO Y ROLES
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 00:22:38
- **Detalle:** José describe el dashboard de la vista de administrador, el cual será configurable. Incluirá estadísticas y gráficos de ventas discriminadas por canal (consumo en salón, delivery, recojo en tienda, pedidos por WhatsApp), desglose de ventas por hora y por tiempo, valor promedio diario, tiempos promedio de entrega, ranking de productos más vendidos y alertas de productos con bajo stock.
- **Cita:** "Ventas por canal. ¿Quién sabe que ve la venta por salón, por delivery, por recojo, quién sabe por WhatsApp?... Acá va a poder ver todas esas estadísticas por hora, por tiempo, el promedio del día, entrega promedios, los productos más vendidos y quién sabe por ahí se quedó en en bajo stock"
- **Prioridad:** Inmediato · **Confianza:** Alta

### B-07 · Compromiso de desarrollo de dashboards a medida
- **Área según el agente:** PENDIENTES DEL DESARROLLADOR
- **Tipo:** Compromiso · **Quién:** José · **Hora:** 00:22:38
- **Detalle:** José se compromete explícitamente con Kevin a programar e incorporar cualquier métrica, indicador o gráfico adicional que el negocio requiera visualizar en el panel de control.
- **Cita:** "tú me consultas y yo lo agrego."
- **Prioridad:** Próximo · **Confianza:** Alta

### B-08 · Inclusión de filtros temporales y rangos de fecha en reportes
- **Área según el agente:** PENDIENTES DEL DESARROLLADOR
- **Tipo:** Compromiso · **Quién:** José · **Hora:** 00:23:20
- **Detalle:** Kevin consulta si el dashboard permite filtrar los datos por fechas y rangos específicos. José admite que aún no están incluidos en la maqueta actual, pero se compromete a implementar filtros por rango de fechas, día exacto, día de la semana, mes y año.
- **Cita:** "Sí, no está, pero sí lo voy a agregar más filtros por fecha, por día, por año y todo eso."
- **Prioridad:** Próximo · **Confianza:** Alta

### B-09 · Plano interactivo con distribución física de mesas del local
- **Área según el agente:** MESAS, PEDIDOS EN SALA Y RESERVAS
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 00:23:20
- **Detalle:** José muestra un módulo de pedidos y caja que incorpora un plano interactivo configurable para reflejar la distribución real del salón de Caprichos (por ejemplo, ubicando con precisión las mesas situadas junto a la puerta de ingreso) para orientar y facilitar la labor de los mozos al tomar y llevar comandas.
- **Cita:** "Yo le adicioné esto de acá para que pueda diseñarlo según su cómo está cómo está caprichos. Quién sabe la mesa está por allá... por la puerta para que se pueda guiar más que todo el el mozo."
- **Prioridad:** Próximo · **Confianza:** Alta

### B-10 · Mecanismo de detección y visualización de mesas ocupadas vs libres
- **Área según el agente:** DUDAS ABIERTAS
- **Tipo:** Pregunta · **Quién:** José · **Hora:** 00:24:07
- **Detalle:** José expone que aún tiene pendiente definir cómo el sistema determinará y mostrará si una mesa está ocupada o libre, señalando que debe evaluar la mejor manera técnica y operativa de implementarlo.
- **Cita:** "Lo que sí me faltaría ver acá es eh cómo va a ver si está ocupada o no está ocupada una mesa o quién sabe, no se va a poner así. Tengo que ver la manera que se que podamos implementar esto."
- **Prioridad:** Próximo · **Confianza:** Alta

### B-11 · Conflicto operativo por liberación prematura de mesa en cobro anticipado
- **Área según el agente:** MESAS, PEDIDOS EN SALA Y RESERVAS
- **Tipo:** Queja o problema actual · **Quién:** Kevin · **Hora:** 00:24:07
- **Detalle:** Kevin describe la lógica de ocupación actual: al abrir una comanda la mesa queda vinculada al nombre del cliente. En restaurant.pe la mesa se libera automáticamente en el momento en que se procesa el cobro. Dado que en Caprichos acostumbran cobrar de forma adelantada al momento de pedir, el sistema borra y libera la mesa de inmediato, provocando un desfase entre el estado digital del salón y los clientes que continúan físicamente consumiendo en la mesa.
- **Cita:** "Cuando hacen un pedido, la mesa se queda registrada con el nombre del cliente... cuando el cliente paga la mesa, eh, ahí es donde se libera actualmente cuando paga, pero porque al final en la mayoría de comercio paga el último, pero a nosotros no. Aquí paga primero. Entonces a veces este está ahí la mesa y paga y se borró, se liberó la mesa, pero el sigue ahí."
- **Prioridad:** Inmediato · **Confianza:** Alta

### B-12 · Política comercial de cobro adelantado con flexibilidad y estímulo al pago al retirarse
- **Área según el agente:** DECISIONES Y REGLAS CONFIRMADAS
- **Tipo:** Regla de negocio · **Quién:** Kevin · **Hora:** 00:24:52
- **Detalle:** Kevin explica que instruye a su equipo a solicitar el cobro por adelantado con amabilidad (mencionando como ejemplo: "sería 25 soles, ¿cancela con Yape o en efectivo?"), pero aclara que si un cliente solicita pagar al final de su estancia, se le concede sin problema. José sugiere no forzar pero sí incentivar al comensal a pagar al final para que la liberación de la mesa en el plano coincida con su partida física real. Kevin aprueba esta directriz.
- **Cita:** "Cobro primero. Yo le digo, cobren adelantado... Y si un cliente quiere pagar al final, no hay ningún problema... pero sí incitar al cliente de pagar último para que podamos tener esta regla de las mesas liberadas. - Claro. Está bien. Me gusta."
- **Prioridad:** Próximo · **Confianza:** Alta

### B-13 · Filtro de visualización de pedidos en sala por canal de origen
- **Área según el agente:** ADMINISTRATIVO Y ROLES
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 00:25:48
- **Detalle:** José plantea que en el módulo de mesas y pedidos se incorpore un filtro para diferenciar el origen de cada comanda: pedidos generados desde la carta web, enviados vía WhatsApp, ingresados por el mozo desde la tablet o digitados directamente por caja.
- **Cita:** "¿quién sabe? ¿Quiere filtrarlo por canal por la web? ¿Quién sabe pidió por la carta? ¿Quién sabe? ¿Lo pedido por WhatsApp, por mozo o por caja? Porque también por caja hacen pedidos"
- **Prioridad:** Próximo · **Confianza:** Alta

### B-14 · Restricción de cobro a mozos y circuito de precuenta para control de dinero
- **Área según el agente:** DECISIONES Y REGLAS CONFIRMADAS
- **Tipo:** Regla de negocio · **Quién:** Kevin · **Hora:** 00:26:48
- **Detalle:** Kevin detalla una regla estricta de seguridad financiera: el usuario con rol de mozo no tiene permisos para cobrar en el sistema. El único responsable de registrar el cobro y manipular dinero es el cajero. El mozo solo puede imprimir o emitir una precuenta con el desglose del consumo, acudir a la mesa a cobrarle al cliente con ese documento, trasladar el dinero en efectivo o comprobante digital a la caja, y es allí donde el cajero valida el ingreso y expide el comprobante fiscal definitivo.
- **Cita:** "actualmente el sistema no nos permite no le permite al mozo realizar el cobro... porque el único responsable de cobrar es caja. Entonces, hermoso lo que puede hacer es precuentas, sacar precuentas y con eso cobrar al cliente con la precuenta. Y una vez cobrado al cliente en mesa, el mozo llega a caja, paga y recién el cajero recibe el dinero y emite el comprobante de pago"
- **Prioridad:** Inmediato · **Confianza:** Alta

### B-15 · Soporte dual en salón: pedidos mediante QR y atención asistida por mozo
- **Área según el agente:** MESAS, PEDIDOS EN SALA Y RESERVAS
- **Tipo:** Pedido del cliente · **Quién:** Kevin · **Hora:** 00:26:48
- **Detalle:** Al evaluar la toma de pedidos mediante códigos QR en mesa, Kevin señala que en su zona muchos comensales son grupos familiares o personas mayores que no se sienten cómodas escaneando QR y prefieren la atención personalizada tradicional, siendo el QR más adecuado para jóvenes. José propone que la plataforma brinde ambas opciones: auto-pedido escaneando el QR de la mesa, o asistencia del mozo mostrando el catálogo en su tablet o ingresando el número de mesa directamente.
- **Cita:** "en la mayoría de clientes hemos probado con QR, pero no como viene a veces familia, viene a veces señores, este, que son un poco mayorcitos... el QR es más para los jóvenes... en la aplicación que le salga las dos, QR o número, quién sabe, ya tiene el abierto y le muestra la misma tablet."
- **Prioridad:** Inmediato · **Confianza:** Alta

### B-16 · Inclusión de clave Wi-Fi en el ticket o voucher impreso
- **Área según el agente:** COCINA, PANTALLAS E IMPRESIÓN
- **Tipo:** Pedido del cliente · **Quién:** Kevin · **Hora:** 00:27:49
- **Detalle:** José consulta si actualmente imprimen el acceso Wi-Fi en el comprobante. Kevin indica que actualmente no figura en el voucher impreso, pero solicita que se configure el formato de ticket para imprimir la red y contraseña de Wi-Fi de forma automática.
- **Cita:** "Nos gustaría ponerle, pero no está, creo, la contraseña en el voucher ahorita. Sería bueno ponerle"
- **Prioridad:** Próximo · **Confianza:** Alta

### B-17 · Portal cautivo de Wi-Fi con credenciales temporales generadas por ticket
- **Área según el agente:** INFRAESTRUCTURA Y OPERACIÓN
- **Tipo:** Idea del cliente · **Quién:** Kevin · **Hora:** 00:27:49
- **Detalle:** Kevin sugiere implementar a futuro un servidor de autenticación de red (portal cautivo) que asocie usuarios y contraseñas temporales al ticket de compra del cliente. Explica que esto evitaría que vecinos o personas ajenas al establecimiento obtengan la clave compartida y congestionen el ancho de banda del local.
- **Cita:** "después sería bueno implementar un servidor. Este, hay un servidor, este, no me acuerdo el nombre. Pero para usuarios y contraseñas asociados al ticket para controlar más el la red wifi, ¿no? O sea, para que solo sean clientes entre comillas. Porque imagínate si yo le doy la clave esto, el vecino del costado sabe... se saturan demasiado."
- **Prioridad:** Futuro · **Confianza:** Alta

### B-18 · Dependencia crítica de la red inalámbrica para dispositivos de operación
- **Área según el agente:** INFRAESTRUCTURA Y OPERACIÓN
- **Tipo:** Queja o problema actual · **Quién:** Kevin · **Hora:** 00:28:46
- **Detalle:** Kevin fundamenta por qué no resulta viable cambiar periódicamente la contraseña del Wi-Fi en el router: múltiples dispositivos operativos esenciales operan por Wi-Fi (tablets de mozos, tablet para el registro de asistencia/ingreso-salida del personal y una impresora fotográfica para eventos). Cambiar la clave inalámbrica implica reconfigurar manualmente equipo por equipo, generando paralizaciones operativas.
- **Cita:** "cambiar la contraseña es, imagínate, algunos las tablets están conectadas con Wi-Fi y tenemos una impresora que está conectada por Wi-Fi también, que imprime fotografías y todo en los eventos... la tablet de marcar registro, ingreso, salida, o sea, es una gestión. lo podría cambiar diario si todo fuera cableado... pero detrás de eso hay bast hay algunos equipos que nos retrasan en el tema de la configuración."
- **Prioridad:** No se sabe · **Confianza:** Alta

### B-19 · Impresión de comandas en etiquetas autoadhesivas para vasos de bebidas
- **Área según el agente:** COCINA, PANTALLAS E IMPRESIÓN
- **Tipo:** Pedido del cliente · **Quién:** Kevin · **Hora:** 00:29:47
- **Detalle:** Kevin solicita que el nuevo sistema soporte impresoras de stickers/etiquetas autoadhesivas para que la comanda de barra se imprima en una etiqueta adhesiva y se pegue directamente en el vaso de la bebida, emulando la metodología de trabajo de Starbucks (tanto en sucursales locales como en Estados Unidos).
- **Cita:** "Me gustaría que haya eh ese comprobante que tú estás haciendo, pero nosotros tener impresoras eh de sticker de las que tienen autoadhesivo y y ahí que salga la comanda para pegarlo nosotros en el vaso de la bebida... como Star... en Star en algunos sucursales hacen eso. En Estados Unidos hacen eso."
- **Prioridad:** Próximo · **Confianza:** Alta

### B-20 · Personalización de etiquetas de vasos según festividades o fechas especiales
- **Área según el agente:** MARKETING, POSVENTA Y OPINIONES
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 00:29:47
- **Detalle:** José sugiere complementar la propuesta de los stickers autoadhesivos para vasos de bebidas permitiendo que el diseño o contenido de la etiqueta se adapte automáticamente según el día festivo o fecha cívica especial (campañas de temporada). Kevin se muestra complacido con la idea.
- **Cita:** "sería bueno eso y asociarlo dependiendo el día festivo. Claro, era muy bueno."
- **Prioridad:** Futuro · **Confianza:** Alta

### B-21 · Pantallas de cocina web (KDS) vinculadas por URL y código de seguridad
- **Área según el agente:** COCINA, PANTALLAS E IMPRESIÓN
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 00:32:04
- **Detalle:** José detalla la solución arquitectónica para las pantallas de cocina: se accederá mediante un navegador web a una URL. Al ingresar por primera vez, el sistema solicitará un código de vinculación. El administrador, desde el panel administrativo, autorizará dicho código para habilitar la pantalla y comenzar a desplegar las comandas en tiempo real.
- **Cita:** "cuando intenta ingresar solamente con la URL le va a pedir el código de vinculación y ese código de vinculación... van a venir acá a la parte administrativa, por acá tengo el módulo de pantalla y lo van a probar y automáticamente lo va a liberar y va a permitir ver todos los pedidos"
- **Prioridad:** Inmediato · **Confianza:** Alta

### B-22 · Inestabilidad de app de escritorio de restaurant.pe y migración a KDS web en red local
- **Área según el agente:** COCINA, PANTALLAS E IMPRESIÓN
- **Tipo:** Queja o problema actual · **Quién:** Kevin · **Hora:** 00:32:04
- **Detalle:** Kevin relata que desde que comenzaron a operar usaban el aplicativo de escritorio de restaurant.pe instalado en las computadoras para las pantallas de cocina, pero sufría de constantes errores y fallas. Ante sus reclamos técnicos, el proveedor les configuró recientemente una versión de pantalla de cocina web que funciona mediante URL sobre la red local.
- **Cita:** "desde que iniciamos era a través del aplicativo instalado en la computadora y te ibas a la categoría a la opción de pantalla de cocina, pero eh siempre ha tenido fallas, siempre ha tenido errores... con un reclamo que hemos hecho, lo que nos han colocado es la pantalla de cocina, pero web a través de una URL que está conectada, ¿no? A la a la a la red, nada más a la red local."
- **Prioridad:** Inmediato · **Confianza:** Alta

### B-23 · Uso de 3 televisores Smart TV en salón para avisos de pedidos a clientes
- **Área según el agente:** COCINA, PANTALLAS E IMPRESIÓN
- **Tipo:** Dato del negocio · **Quién:** Kevin · **Hora:** 00:33:09
- **Detalle:** Kevin precisa la infraestructura de pantallas del establecimiento: cuentan con tres (3) televisores Smart TV ubicados en el salón principal para que los comensales visualicen la cola de pedidos (pedidos por preparar, en preparación y listos para entrega). Aclara que no se utilizan en la cocina interna, sino de cara al cliente en salón.
- **Cita:** "los tres Smart TV que tenemos eh para el cliente. Sí, es eso, dices, para que los pedidos eh los pedidos listos salgan en pantalla... para el cliente dices."
- **Prioridad:** Próximo · **Confianza:** Alta

### B-24 · Estructura de producción en tres áreas independientes con PCs dedicadas
- **Área según el agente:** DECISIONES Y REGLAS CONFIRMADAS
- **Tipo:** Regla de negocio · **Quién:** Kevin · **Hora:** 00:33:09
- **Detalle:** Kevin establece formalmente que la producción de Caprichos está dividida en tres áreas de trabajo independientes: 1) Salados, 2) Postres y 3) Bebidas. Cada área dispone de su propia computadora fija con pantalla KDS para gestionar sus comandas específicas.
- **Cita:** "todas las pantallas de cocina que tenemos son computadoras... tenemos el área de salados, postres y bebidas, esas tres áreas de producción. Entonces, hay una hay una por hay una por cada área, ¿no?"
- **Prioridad:** Inmediato · **Confianza:** Alta

### B-25 · Incapacidad de restaurant.pe para segmentar ítems de combos en pantallas de cocina
- **Área según el agente:** COCINA, PANTALLAS E IMPRESIÓN
- **Tipo:** Queja o problema actual · **Quién:** Kevin · **Hora:** 00:34:01
- **Detalle:** Kevin expone una limitación crítica de restaurant.pe con la promoción "Dúo Compartir" (2 bebidas y 2 complementos). Debido a la rigidez del módulo de combos, debieron configurarlo como producto simple. Al ser producto simple, el sistema no permite desglosar los ítems entre estaciones de trabajo: la orden completa se envía a Bebidas y no se visualiza en Postres. Si el área de Postres activa la visualización de Bebidas para ver su parte, su pantalla se satura con todas las comandas de bebidas ajenas.
- **Cita:** "el sistema Restaurant.pado no se ha adaptado a nuestro flujo de trabajo. Porque en el dúo compartir... en restaurant.P, El dúo compartir no lo puedo colocar yo como combo, yo lo coloco como producto, porque como combo no me da tantas posibilidades... el tuo compartir, por ejemplo, le sale a bebidas y no le y en la pantalla de cocina de postres no sale. tiene que seleccionar que quiere ver los también quiere ver las bebid la el área de bebidas y postres... pero también postre se satura con los las comandas de bebidas que llegan que no le corresponde preparar"
- **Prioridad:** Inmediato · **Confianza:** Alta

### B-26 · Despacho segmentado por pantalla de área y visualización de modificadores
- **Área según el agente:** COCINA, PANTALLAS E IMPRESIÓN
- **Tipo:** Pedido del cliente · **Quién:** Kevin · **Hora:** 00:36:29
- **Detalle:** Kevin exige que cada pantalla de estación reciba exclusivamente los productos que le corresponde elaborar (salados a cocinera, postres a repostería, cafés/bebidas al barista), junto con sus especificaciones y modificadores (azúcar, stevia, sin salsas, etc.), sin saturar visualmente a los operarios con productos de otras áreas durante horas pico.
- **Cita:** "así debería ser porque de esa manera no saturamos visualmente a a la persona que está preparando los pedidos, al barista, la cocinera, a la que está haciendo postres... qué me hace llegando a mí un queque, qué me hace llegando a mí un club sándwich si yo no me encargo de despachar eso ni de cocinar eso, ¿no?"
- **Prioridad:** Inmediato · **Confianza:** Alta

### B-27 · Incorporación de pantalla o etiquetera central para despacho consolidado
- **Área según el agente:** COCINA, PANTALLAS E IMPRESIÓN
- **Tipo:** Pedido del cliente · **Quién:** Kevin · **Hora:** 00:36:29
- **Detalle:** Kevin anuncia que adquirirán una pantalla adicional o una etiquetera dedicada específicamente al área de despacho final. En este punto de salida sí se requiere que aparezca la comanda completa con todos los productos consolidados (bebidas, postres y salados) para validar y ensamblar el pedido antes de entregarlo a la mesa, al cliente de recojo o al repartidor.
- **Cita:** "vamos a comprar otra pantalla de despacho donde o una etiquetera despacho donde solamente salgan ahí sí salga todo junto, ¿no? Pero darnos la opción de que de que este en el producto dúo compartir, por ejemplo, que yo seleccione que salga en postres y en y en bebidas"
- **Prioridad:** Próximo · **Confianza:** Alta

### B-28 · Reglas comerciales complejas y equivalencias en el "Dúo Compartir"
- **Área según el agente:** CARTA WEB (cliente)
- **Tipo:** Regla de negocio · **Quién:** Kevin · **Hora:** 00:37:31
- **Detalle:** Kevin explica detalladamente la lógica de negocio del Dúo Compartir que los propios técnicos de restaurant.pe no lograron parametrizar: la promoción incluye 2 bebidas a elección y un conjunto condicional de complementos. Permite elegir 2 donas, 2 galletas o 1 dona + 1 galleta; pero si el comensal opta por un producto de mayor costo o tamaño (como una porción de queque/carrot cake, una empanada o una bandeja de pitipanes), la regla exige que sea exactamente una (1) sola unidad y no dos. El sistema debe permitir esta lógica condicional de selección y aplicar el precio promocional sin descuadrar.
- **Cita:** "nosotros tenemos en el dúo compartir, lo complicado del dúo compartir es que tenemos eh dos bebidas a elección, que es manejable, puede coger en el sistema de combo, pero lo que no puede coger es eh los complementos, porque a veces son dos donas, dos galletas o una dona, una galleta, pero si no es ninguna de esas es un carro K que puedes coger un queque o puedes coger una empanada, una bandeja de PP pano, no dos. Ahí es donde se cruza el restaurant rey. No puede hacer eso."
- **Prioridad:** Inmediato · **Confianza:** Alta

### B-29 · Continuidad comercial de combos ante quiebre de stock de complementos
- **Área según el agente:** DECISIONES Y REGLAS CONFIRMADAS
- **Tipo:** Regla de negocio · **Quién:** Kevin · **Hora:** 00:38:39
- **Detalle:** Ante la pregunta de José sobre si un combo se desactiva cuando se termina un insumo (por ejemplo, las donas), Kevin estipula la regla comercial: el combo NUNCA debe desactivarse si aún cuenta con otros complementos disponibles. El software debe mantener activo el combo y permitir que el cliente elija entre los complementos que aún tienen existencias (galletas, queques o empanadas).
- **Cita:** "el combo no se desactiva. El combo sigue activado, pero con el con lo restante, ¿no? que permite que incluya el combo. O sea, si se agotan las donas, que el combo incluya galletas y que incluya queques o empanadas... un cambio de complemento, porque si no hay donas tenemos que seguir vendiendo el combo."
- **Prioridad:** Inmediato · **Confianza:** Alta

### B-30 · Sincronización en tiempo real de agotamiento de insumos frescos y sugerencias
- **Área según el agente:** ALMACÉN, STOCK, RECETAS Y COMPRAS
- **Tipo:** Regla de negocio · **Quién:** Kevin · **Hora:** 00:39:36
- **Detalle:** Kevin indica que trabajan con pulpa de fruta fresca procesada diariamente (por ejemplo, lúcuma fresca para el batido "Chocolúcuma"). Si en un día se agota la fruta, ese producto debe inhabilitarse de inmediato en la carta web y sincronizarse en tiempo real con el bot de WhatsApp, ofreciendo alternativas o recomendaciones al comensal para concretar la venta. José confirma que la sincronización con WhatsApp será en tiempo real.
- **Cita:** "Se acabó el chocolma, ya no hay porque se nos agotó la lugma. Entonces, como trabajamos con lumas, este, también frescas... Pero como eso se va a sincronizar, me dices, en con el bot en tiempo real o con el WhatsApp. - Sí, sí, el WhatsApp también va a estar va a estar sincronizado con eso."
- **Prioridad:** Inmediato · **Confianza:** Alta

### B-31 · Revisión en vivo de comandas reales en pantalla de cocina de restaurant.pe
- **Área según el agente:** COCINA, PANTALLAS E IMPRESIÓN
- **Tipo:** Queja o problema actual · **Quién:** Kevin · **Hora:** 00:40:50
- **Detalle:** A las 21:55 Kevin comparte pantalla mostrando la operación en tiempo real del KDS de restaurant.pe. Revisa comandas activas: una dona artesanal enviada hace 4 minutos, un club sándwich (ticket 4931) y un consumo en sala de la trabajadora Alexandra en la mesa M01. Señala como problema recurrente que el personal de cocina no despeja oportunamente los pedidos terminados en pantalla.
- **Cita:** "mira este si te comparto mi pantalla para que veas tú ahorita... Este es lo que están usando ahorita en cocina, ¿no? Ahorita hace 4 minutos ingresó una onda artesanal... Ahí no lo despejan. No lo despejan... club sándwich, por ejemplo, el 4931... Alexandra, el M01, la mesa 01 también debe estar preparándolo en el local, dice Alexandra. Ella es ella seguridad trabajadora."
- **Prioridad:** Inmediato · **Confianza:** Alta

### B-32 · Eliminación de barras de desplazamiento (scroll) en pantalla KDS táctil
- **Área según el agente:** COCINA, PANTALLAS E IMPRESIÓN
- **Tipo:** Pedido del cliente · **Quién:** Kevin · **Hora:** 00:42:00
- **Detalle:** Kevin critica severamente que la pantalla de cocina de restaurant.pe requiera desplazarse verticalmente con scroll para ver las comandas. Explica que los cocineros y baristas manipulan alimentos y tienen las manos húmedas o con guantes, por lo que resulta impráctico hacer scroll. La interfaz debe mostrar todas las tarjetas de un vistazo y permitir despejarlas con un solo clic o toque en pantalla.
- **Cita:** "Esto de acá tiene para desplazar, ¿no? Entonces, que imagínate que va a estar haciendo eso, pues con la mano mojada... es una pantalla para ver nada más y para dar clic y despejar, ¿no? Pero para estar bajando el scroll, todo esto."
- **Prioridad:** Inmediato · **Confianza:** Alta

### B-33 · Datos indispensables en la comanda de cocina: notas, mozo, ticket y cronómetro
- **Área según el agente:** DECISIONES Y REGLAS CONFIRMADAS
- **Tipo:** Regla de negocio · **Quién:** Kevin · **Hora:** 00:43:10
- **Detalle:** Analizando las comandas en pantalla, Kevin y José validan los elementos informativos imprescindibles que debe portar cada tarjeta de KDS: nombre del plato con modificador detallado (ej. frutos del bosque en medio waffle, dona rellena de manjar blanco), comentarios de personalización (ej. sin tomate, sin mayonesa), nombre del mozo que atendió, número identificador de ticket y cronómetro con el tiempo transcurrido desde la orden.
- **Cita:** "abajo sale el modificador, o sea, fruto del bosque es medio waffle en realidad. Dona acá a la derecha. Dona es dona de manjar blanco. Y acá me sale salado... Si acá hay sin tomate sin mayonesa. Hay este comentarios... el nombre del mozo, también tiene el número de ticket, el tiempo que va ir corriendo. Ya es un dato muy importante."
- **Prioridad:** Inmediato · **Confianza:** Alta

### B-34 · Deficiencia operativa del módulo de Call Center en restaurant.pe
- **Área según el agente:** ADMINISTRATIVO Y ROLES
- **Tipo:** Queja o problema actual · **Quién:** Kevin · **Hora:** 00:44:29
- **Detalle:** Kevin indica que restaurant.pe dispone de un módulo rotulado como call center para la recepción de pedidos telefónicos y delivery, pero califica su funcionamiento de inefectivo y engorroso para el ritmo de atención del negocio.
- **Cita:** "tienen un tienen un este módulo de call center que la verdad que no es efectivo."
- **Prioridad:** Próximo · **Confianza:** Alta

### B-35 · Flujo rápido de registro con campos obligatorios en Call Center
- **Área según el agente:** ADMINISTRATIVO Y ROLES
- **Tipo:** Regla de negocio · **Quién:** Kevin · **Hora:** 00:44:29
- **Detalle:** Kevin demuestra cómo opera la captura de un pedido asistido: primero se ingresa el número telefónico para verificar si el cliente ya está registrado (utiliza de prueba su propio teléfono 946 388 934). Si el cliente no existe, el formulario de alta rápida debe exigir únicamente dos datos indispensables marcados con asterisco: Nombre y Teléfono, permitiendo pasar inmediatamente a definir la dirección y armar la orden.
- **Cita:** "yo pongo acá mi número 946 388 934. Ya, busca el cliente, le encuentra... registrar un nuevo cliente... tengo que ingresar el nombre, el y el número de la persona, el teléfono, sí o sí. Todo lo que está en este disco es sí o sí, esos dos. Y de ahí guardar y continuar."
- **Prioridad:** Inmediato · **Confianza:** Alta

### B-36 · Cálculo tarifario de delivery según rangos de distancia en mapa
- **Área según el agente:** CARTA WEB (cliente)
- **Tipo:** Regla de negocio · **Quién:** Kevin · **Hora:** 00:44:29
- **Detalle:** Kevin señala que al fijar el punto de entrega en el mapa del pedido a domicilio, el sistema debe cotizar y cargar automáticamente el costo del servicio de delivery en función de rangos o polígonos de distancia establecidos por el negocio.
- **Cita:** "acá sí me sale para colocar la ubicación y acá va a colocar el precio según el rango, ¿no?"
- **Prioridad:** Inmediato · **Confianza:** Alta

### B-37 · Falla de georreferenciación en restaurant.pe vs soporte de Google Plus Codes
- **Área según el agente:** ADMINISTRATIVO Y ROLES
- **Tipo:** Queja o problema actual · **Quién:** Kevin · **Hora:** 00:45:38
- **Detalle:** Kevin expone una falla crítica en el módulo de mapas de restaurant.pe: el mapa que emplean no permite pegar coordenadas geográficas ni reconoce los Plus Codes de Google Maps que los clientes envían por WhatsApp, obligando al cajero a buscar manualmente la dirección navegando por las calles. Contrasta esto con su anterior sistema (Hola Click), donde bastaba con copiar el código Plus del cliente y pegarlo en el sistema para ubicar el destino exacto al instante.
- **Cita:** "lo que nosotros hacemos hacíamos en el hola click era copiar el código plus y pegarlo en aquí y ya nos solucionar el problema. No se puede acá porque este es otro mapa. Google Maps y aparte hemos intentado trabajar con este mapa en particular... pero igualito no pega las coordenadas, no funciona su sistema, o sea, tienes que buscar manualmente dónde es."
- **Prioridad:** Inmediato · **Confianza:** Alta

### B-38 · Propósito del módulo de Call Center: captura de pedidos manuales y asistidos
- **Área según el agente:** ADMINISTRATIVO Y ROLES
- **Tipo:** Regla de negocio · **Quién:** Kevin · **Hora:** 00:46:53
- **Detalle:** Ante la pregunta de José sobre cuándo se justifica emplear el call center, Kevin aclara que no se concibe para una central telefónica compleja, sino como una herramienta de toma manual de pedidos para atender a aquellos clientes que no desean utilizar la carta web ni interactuar con los botones del bot de WhatsApp, prefiriendo llamar por teléfono o enviar su lista de productos por mensaje escrito.
- **Cita:** "No tanto para call center, sino este, bueno, sí, call center se podría llamar, ¿no? Para tomar pedidos manualmente en caso de que el cliente no quiera hacerlo ni por el bot ni por los botones, quiera hacerlo o por llamadas o quiera o nos mande, ¿no?, su pedido. nosotros tengamos que procesarlo manualmente."
- **Prioridad:** Inmediato · **Confianza:** Alta

### B-39 · Referencia a Hola Click por su compatibilidad con Google Plus Codes
- **Área según el agente:** INVESTIGAR O REVISAR (referencias)
- **Tipo:** Idea del cliente · **Quién:** Kevin · **Hora:** 00:45:38
- **Detalle:** Kevin cita como buena práctica la plataforma Hola Click (la cual usaban previamente), destacando que permitía pegar directamente el código Plus de Google Maps en el buscador para fijar la ubicación exacta del domicilio sin pérdida de tiempo ni errores de tipeo.
- **Cita:** "lo que nosotros hacemos hacíamos en el hola click era copiar el código plus y pegarlo en aquí y ya nos solucionar el problema."
- **Prioridad:** Próximo · **Confianza:** Alta

### B-40 · Referencia al modelo de etiquetado de bebidas en vasos de Starbucks
- **Área según el agente:** INVESTIGAR O REVISAR (referencias)
- **Tipo:** Idea del cliente · **Quién:** Kevin · **Hora:** 00:29:47
- **Detalle:** Kevin toma como referente el flujo de barra de Starbucks en Estados Unidos y algunas sucursales locales, donde las comandas de café y bebidas se expiden en etiquetas adhesivas que se adhieren al vaso, sugiriendo replicar este estándar operativo en Caprichos.
- **Cita:** "como Star... en Star en algunos sucursales hacen eso. En Estados Unidos hacen eso."
- **Prioridad:** Próximo · **Confianza:** Alta

### B-41 · Referencia a catálogo de roles operativos en restaurant.pe
- **Área según el agente:** INVESTIGAR O REVISAR (referencias)
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 00:22:38
- **Detalle:** José referencia la arquitectura de permisos del panel de restaurant.pe ("rest.p"), mencionando que revisó sus roles de call center, almacén y repartidor para evaluar cuáles aplican al modelo de negocio de Caprichos.
- **Cita:** "He visto que también tiene call center en el rest.p almacén y repartidor."
- **Prioridad:** Próximo · **Confianza:** Alta

### B-42 · Descarte temporal de televisores Smart TV en cocina en favor de computadoras
- **Área según el agente:** APLAZADO, DESCARTADO O A FUTURO
- **Tipo:** Regla de negocio · **Quién:** Kevin · **Hora:** 00:33:09
- **Detalle:** Aunque José diseñó la vista de KDS pensando en su eventual proyección en pantallas Smart TV de cocina, Kevin descarta utilizar Smart TVs en las zonas de preparación por el momento, confirmando que seguirán operando con computadoras de escritorio dedicadas en cada área (salados, postres y bebidas).
- **Cita:** "en cocina este no tenemos todavía, pero está bien que estés preparándolo para un Smart TV, pero todas las pantallas de cocina que tenemos son computadoras"
- **Prioridad:** Futuro · **Confianza:** Alta

### Sección del agente: Datos del negocio que se mencionaron
- **Hora y contexto de la revisión:** Eran las 9:55 p. m. (21:55) al momento de compartir la pantalla en vivo de la cocina; el salón ya estaba casi vacío (solo una mesa con una pareja y un cliente por pedir para llevar).
- **Áreas de producción en cocina:** Existen tres (3) estaciones de trabajo de producción independientes: Salados, Postres y Bebidas.
- **Equipamiento de pantallas:** El local dispone de 3 Smart TVs orientados a los clientes en salón para avisar el estado de preparación de pedidos. En cocina interna no usan televisores, sino computadoras fijas en cada una de las 3 áreas de producción. Planean adquirir una pantalla o etiquetera adicional para el área de despacho final.
- **Personal y colaboradores nombrados:**
  - "Alexandra": Colaboradora del local (mencionada como personal de seguridad/trabajadora) que registraba un consumo interno en la mesa M01.
  - "María": Personal en caja atendiendo el cambio de monedas.
  - Roles operativos del equipo: Baristas, cocineras de salados, pasteleras/postres, mozos y cajeros.
- **Política de cobranza y precios en mesa:**
  - Se instruye al personal a cobrar por adelantado en mesa con trato cordial, ofreciendo cancelación con Yape o efectivo. Si el cliente insiste en pagar al retirarse, se le concede.
  - Ejemplo de cobro citado en la conversación: 25 soles.
  - Los mozos tienen prohibido cobrar en sistema; únicamente imprimen o emiten precuentas para cobrar en efectivo/digital y rinden cuentas en caja, siendo el cajero el único que emite el comprobante de pago.
- **Dispositivos dependientes de Wi-Fi:** Tablets de mozos para comandas, tablet fija para marcación de asistencia (ingreso y salida del personal) e impresora Wi-Fi para impresión fotográfica en eventos especiales.
- **Perfil de comensales en salón:** Gran afluencia de familias y personas adultas mayores que rechazan el código QR y demandan atención asistida o tradicional, mientras que el público joven adopta fluidamente el código QR.
- **Promoción emblemática "Dúo Compartir":**
  - Incluye dos (2) bebidas a elección y complementos con reglas complejas de equivalencia.
  - Regla de complementos regulares: Permite elegir dos (2) donas, dos (2) galletas o una combinación de una (1) dona y una (1) galleta.
  - Regla de complementos especiales de mayor valor: Si el cliente selecciona carrot cake (queque), empanada o una bandeja de pitipanes, la porción se restringe obligatoriamente a una (1) sola unidad.
- **Insumos frescos y producción del día:**
  - Procesamiento artesanal de lúcuma fresca para el batido "Chocolúcuma", producto sujeto a quiebre de stock si se agota la fruta en el día.
  - Elaboración y venta rotativa de donas artesanales (rellenas de manjar blanco), waffles con frutos del bosque, galletas, tortas/queques, empanadas y pitipanes.
- **Modificadores frecuentes en comandas:** Indicaciones de azúcar, stevia, modificadores de tamaño/porción (medio waffle con frutos del bosque) y exclusión de ingredientes (sin tomate, sin mayonesa).
- **Ejemplos reales de comandas y tickets:** Ticket N.º 4931 (Club Sándwich), orden de dona artesanal (ingresada hacía 4 minutos) y comanda de mesa M01.
- **Datos de prueba para Call Center:** Teléfono 946 388 934 (número telefónico de Kevin utilizado para buscar y dar de alta clientes). Los únicos datos obligatorios para el registro son Nombre y Teléfono. Tarifación de delivery calculada automáticamente según rangos de distancia en el mapa.



### Sección del agente: Enlaces, páginas o sistemas nombrados
- **restaurant.pe** (mencionado como "restaurant.p", "rest.p", "restaurant.pado", "restaurant rey"): Sistema POS y de gestión gastronómica en uso actualmente en Caprichos. Se analizaron sus roles (administrador, mozo, caja, cocina, call center, almacén, repartidor), su aplicación de escritorio con historial de cuelgues, su KDS web en red local, su módulo de combos rígido y su mapa con deficiencias.
- **Hola Click** (mencionado como "hola click", "do click"): Plataforma de pedidos digitales utilizada con anterioridad por Caprichos; se destacó positivamente su integración con mapas que permitía pegar Google Plus Codes para fijar la ubicación exacta.
- **Google Maps y Google Plus Codes (códigos Plus):** Sistema de georreferenciación de Google utilizado para ubicar entregas de delivery mediante códigos alfanuméricos directos.
- **Starbucks** (mencionado como "Star"): Cadena internacional de cafeterías citada como estándar de referencia por su mecanismo de rotulado de vasos mediante stickers autoadhesivos con la comanda.
- **WhatsApp:** Canal de comunicación y pedidos que integrará un asistente con inteligencia artificial para recomendaciones y formularios/botones estructurados para la compra y sincronización de stock en tiempo real.
- **Smart TVs / KDS Web:** Navegadores en pantallas Smart TV y computadoras de cocina conectados mediante URL web pública y autenticados a través de códigos de vinculación administrados desde el panel central.



### Sección del agente: Ruido descartado
- Conversaciones de fondo con familiares o personal del establecimiento ajenas a la definición del proyecto ("mamita", "papá", "¿dónde está la mam?", petición de cambio de monedas a María).



### Sección del agente: Cobertura
- El tramo analizado abarca desde la línea 1 hasta la 362 de `segmento-b.txt`. Hay contenido operativo y técnico relevante a partir de la línea 6 y hasta la línea 362 (aproximadamente 355 líneas con valor informativo). Se revisó el material minuciosamente en dos pasadas y no se omitió ninguna sugerencia, idea, queja, regla comercial ni referencia técnica.


## Tramo C

### C-01 · Registro rápido de clientes en toma manual con nombre y teléfono obligatorios
- **Área según el agente:** ADMINISTRATIVO Y ROLES
- **Tipo:** Pedido del cliente · **Quién:** Kevin · **Hora:** 00:45:38
- **Detalle:** Al tomar un pedido de delivery de forma manual (por llamada o por mensaje de WhatsApp), se busca primero si el cliente ya existe por su número de teléfono (por ejemplo, el 946 388 934). Si el cliente no existe, se abre una ventana rápida para registrarlo como nuevo cliente. En este formulario es indispensable y obligatorio ingresar únicamente dos campos: el nombre y el número telefónico (marcados con asterisco). Tras ingresar estos datos, se puede ubicar la dirección en el mapa, calcular la tarifa y continuar con el pedido.
- **Cita:** "tengo que ingresar el nombre, el y el número de la persona, el teléfono, sí o sí. Todo lo que está en este disco es sí o sí, esos dos. Y de ahí guardar y continuar."
- **Prioridad:** Inmediato · **Confianza:** Alta

### C-02 · Búsqueda por Plus Code o coordenadas para ubicar entregas de delivery
- **Área según el agente:** CARTA WEB (cliente)
- **Tipo:** Queja o problema actual · **Quién:** Kevin · **Hora:** 00:45:38
- **Detalle:** En el flujo habitual de delivery, el cliente envía su ubicación por WhatsApp y aparece un punto rojo en el mapa. En la plataforma anterior (Hola Click), el personal simplemente copiaba el Plus Code (código alfanumérico de Google Maps) y lo pegaba en el buscador del sistema, ubicando la casa al instante. En el sistema actual utilizan un mapa alternativo (cuyo nombre Kevin tiene guardado) donde no se pueden pegar coordenadas ni códigos plus, obligando a buscar la calle manualmente en el mapa, lo cual resulta ineficiente y propenso a errores. Se necesita poder buscar por coordenadas o Plus Codes de Google Maps.
- **Cita:** "lo que nosotros hacíamos en el hola click era copiar el código plus y pegarlo en aquí y ya nos solucionar el problema. No se puede acá porque este es otro mapa."
- **Prioridad:** Próximo · **Confianza:** Alta

### C-03 · Cálculo de costo de delivery según rangos de distancia
- **Área según el agente:** CARTA WEB (cliente)
- **Tipo:** Regla de negocio · **Quién:** Kevin · **Hora:** 00:45:38
- **Detalle:** Al colocar la ubicación de entrega del cliente en el mapa interactivo durante la toma de pedido, el sistema debe fijar automáticamente la tarifa del delivery en función del rango o radio de cobertura geográfica en el que se encuentre el punto de entrega.
- **Cita:** "acá sí puedo colocar, mira, acá sí me sale para colocar la ubicación y acá va a colocar el precio según el rango, ¿no?"
- **Prioridad:** Inmediato · **Confianza:** Alta

### C-04 · Integración de toma de pedidos manuales en módulos de Mozo y Caja
- **Área según el agente:** ADMINISTRATIVO Y ROLES
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 00:46:53
- **Detalle:** Ante la existencia de una pantalla separada de Call Center para tomar pedidos telefónicos o manuales de clientes que no usan el bot ni la web, José propone no crear un módulo aislado de Call Center, sino dotar al módulo de Mozo o al de Caja de la capacidad de ingresar pedidos manuales con selección de ubicación de delivery. Kevin concuerda en que puede estar en Caja o Mozo.
- **Cita:** "yo lo puedo adicionar en el en del mozo para que en vez que para que pueda hacer también pedidos tal cual acá y puedo poner la ubicación y ya no existiría call center, sino el mozo tendría una nueva funcionalidad."
- **Prioridad:** Próximo · **Confianza:** Alta

### C-05 · Restricción de rol: el repartidor de delivery no toma pedidos
- **Área según el agente:** DECISIONES Y REGLAS CONFIRMADAS
- **Tipo:** Regla de negocio · **Quién:** Kevin · **Hora:** 00:46:53
- **Detalle:** Al evaluar qué usuarios del sistema deberían tener acceso a la toma manual de pedidos, José consultó si el repartidor de delivery podría hacerlo. Kevin fue tajante: el personal de reparto nunca toma pedidos; esa responsabilidad está restringida exclusivamente al cajero y a los mozos.
- **Cita:** "El delivery no toma P."
- **Prioridad:** Inmediato · **Confianza:** Alta

### C-06 · Descarte de tótems de autoservicio (Self Service) por dimensiones del local
- **Área según el agente:** APLAZADO, DESCARTADO O A FUTURO
- **Tipo:** Idea del cliente · **Quién:** Kevin · **Hora:** 00:48:05
- **Detalle:** Al revisar el panel de Delivery Pro, se observó la opción de Self Service (tótems interactivos de autoservicio como los que utilizan locales de gran escala como McDonald's). Kevin aclaró que no lo necesitan ni piensan implementarlo actualmente debido a que las dimensiones físicas del local de Caprichos son reducidas, quedando relegado únicamente como una posibilidad a futuro lejano.
- **Cita:** "No, no, no, no, no lo necesitamos. El tamaño local no, no es tan grande. Eso es a futuro."
- **Prioridad:** Futuro · **Confianza:** Alta

### C-07 · Mapa de calor y radio de ventas para campañas de marketing offline
- **Área según el agente:** MARKETING, POSVENTA Y OPINIONES
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 00:49:10
- **Detalle:** Al visualizar en el panel una gráfica de radio de distribución de clientes frecuentes y ventas, José señala que dicha información geográfica es clave para planificar marketing directo fuera de línea: identificar los vecindarios o radios con mayor concentración de pedidos delivery para enviar personal a repartir volantes (flyers) y pegar afiches publicitarios. Kevin valida y aprueba el enfoque.
- **Cita:** "Esa radio sería bueno porque ustedes saben dónde se vende más y podrían hacer publicidad y entregar volantes, pegar afiches."
- **Prioridad:** Próximo · **Confianza:** Alta

### C-08 · Fragmentación y desorden en interfaces de delivery de Restaurant.pe
- **Área según el agente:** ADMINISTRATIVO Y ROLES
- **Tipo:** Queja o problema actual · **Quién:** Kevin · **Hora:** 00:50:20
- **Detalle:** Kevin manifiesta su disconformidad con el sistema actual (Restaurant.pe / Delivery Pro) debido a la proliferación innecesaria de ventanas distintas para gestionar un mismo pedido de delivery: existe una pantalla en Delivery Pro, otra en el menú Caja -> Ventas -> Pedidos en Caja -> Delivery, y otra distinta en el módulo de Call Center. Cada una tiene una interfaz gráfica diferente, lo cual desorienta al personal, entorpece el seguimiento en tiempo real y propicia errores como pedidos duplicados o anulaciones involuntarias.
- **Cita:** "tiene tantas ventanas para delivery, o sea, esta es una, por ejemplo, este es otro... todos tienen interfaz diferente... Se pierde."
- **Prioridad:** Próximo · **Confianza:** Alta

### C-09 · Conflicto de pedidos concurrentes en la misma mesa y artificio de 30 mesas
- **Área según el agente:** MESAS, PEDIDOS EN SALA Y RESERVAS
- **Tipo:** Queja o problema actual · **Quién:** Kevin · **Hora:** 00:52:16
- **Detalle:** El salón de Caprichos cuenta físicamente con aproximadamente 8 mesas. Sin embargo, en el software tuvieron que configurar artificialmente 30 mesas. Esto ocurrió porque los mozos usaban las mesas 1 al 8 y el cajero las mesas 9 al 30. Si el mozo y el cajero tomaban un pedido simultáneamente seleccionando la misma mesa vacía (por ejemplo, la mesa 02), el sistema actual no alertaba de la concurrencia: al guardar, las comandas de clientes distintos se fusionaban en una sola cuenta o el segundo pedido se perdía.
- **Cita:** "usualmente el mozo agarra del uno al ocho porque son ocho mesas más o menos del uno al 8 y el de caja agarra del 9 al 30... se juntan y uno de esos dos clientes se queda ahí... Hay conflicto. Se mezcla."
- **Prioridad:** Inmediato · **Confianza:** Alta

### C-10 · Actualización en tiempo real del plano y bloqueo con aviso de mesa ocupada
- **Área según el agente:** MESAS, PEDIDOS EN SALA Y RESERVAS
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 00:53:44
- **Detalle:** Para resolver de raíz el problema de concurrencia y evitar el uso de mesas ficticias, José propone que el plano de mesas se actualice en tiempo real. Si un mozo o el cajero intenta ingresar una comanda en una mesa que acaba de ser ocupada por otro usuario, el sistema bloqueará la acción y desplegará un mensaje de alerta preventivo (ejemplo: "La mesa número X está ocupada"), evitando la pérdida de pedidos o la duplicidad de cuentas.
- **Cita:** "Se podría trabajar de que se actualice en tiempo real esto o que al momento que haga un pedido y digamos la mesa ya ha sido ocupada, le muestro un aviso. La mesa número siete está ocupada y no se puede hacer el pedido para que no se quede al aire."
- **Prioridad:** Inmediato · **Confianza:** Alta

### C-11 · Opción independiente de "Para llevar" para ventas en caja sin mesa física
- **Área según el agente:** MESAS, PEDIDOS EN SALA Y RESERVAS
- **Tipo:** Idea del cliente · **Quién:** Kevin · **Hora:** 00:53:44
- **Detalle:** Al analizar el flujo de pedidos en caja, Kevin plantea cómo se registrarán las compras presenciales de clientes que piden para llevar sin ocupar una mesa en el salón. José confirma que en el módulo de ventas compartidas se incorporará un botón o selector expreso de "Para llevar" que permita procesar la venta y comandar productos sin vincular obligatoriamente una mesa física del plano.
- **Cita:** "igual eso aplica solamente, por ejemplo, ¿cómo haría un cajero para tomar un pedido para llevar?... tendría que ponerle una opción más, para llevar, o sea, que no."
- **Prioridad:** Inmediato · **Confianza:** Alta

### C-12 · Margen de tolerancia de 15 minutos en reservas de mesa
- **Área según el agente:** DECISIONES Y REGLAS CONFIRMADAS
- **Tipo:** Regla de negocio · **Quién:** Kevin · **Hora:** 00:55:09
- **Detalle:** Las reservas en Caprichos se solicitan con baja recurrencia (aproximadamente de 4 a 5 veces al mes). La regla operativa del negocio es agendar la mesa para la hora pactada y conceder una tolerancia estricta de 15 minutos. Si los comensales no se presentan cumplido ese lapso, la mesa se libera de inmediato para atender a los clientes en espera en el salón.
- **Cita:** "le reservamos una mesa para las 8, le damos 15 minutos de tolerancia y si no liberamos la mesa."
- **Prioridad:** Inmediato · **Confianza:** Alta

### C-13 · Descarte de reserva con selección previa de platos desde la página web
- **Área según el agente:** APLAZADO, DESCARTADO O A FUTURO
- **Tipo:** Idea del cliente · **Quién:** Kevin · **Hora:** 00:56:25
- **Detalle:** José planteó habilitar en la web pública una función para que los clientes separen mesa y elijan sus platos con antelación. Kevin descartó la idea: los clientes que reservan acuden a encuentros sociales o de trabajo y no saben con anticipación qué consumirán; el pedido de alimentos se toma recién cuando llegan y se sientan. Habilitar pre-órdenes en la web añadiría complejidad innecesaria y entorpecería la experiencia del usuario.
- **Cita:** "si le pones esa opción le vas a obligar a que, o sea, a que pida, pero usualmente los que reservan no saben que pedir todavía llegan, se reúnen y llegan... solo nosotros lo reservamos y cuando llega el cliente le tomamos pedidos."
- **Prioridad:** Inmediato · **Confianza:** Alta

### C-14 · Señalización gráfica de mesa reservada ("R" y color rojo/naranja) en el plano
- **Área según el agente:** MESAS, PEDIDOS EN SALA Y RESERVAS
- **Tipo:** Idea del cliente · **Quién:** Kevin · **Hora:** 00:57:43
- **Detalle:** En vez de estructurar un módulo complejo e independiente de reservas, Kevin prefiere mantenerlo simple y operativo en el plano de mesas existente: contar con una opción para marcar una mesa como reservada, cambiando visualmente su estado con un color distintivo (naranja o rojo) y una letra "R" visible.
- **Cita:** "ahí puedes poner una R reservado no más, o sea, reservar mesa, una opción para reservar mesa, pero no una categoría entera... que aparezca rojo y R, algo así naranja"
- **Prioridad:** Próximo · **Confianza:** Alta

### C-15 · Notificación administrativa previa de 15 minutos para colocar señalizador físico
- **Área según el agente:** MESAS, PEDIDOS EN SALA Y RESERVAS
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 00:57:43
- **Detalle:** Cuando una mesa sea reservada con horas de anticipación, el panel administrativo emitirá una alerta visual/sonora 15 minutos antes de la hora programada ("En 15 minutos la mesa 5 va a estar reservada"). Esto servirá para que el personal de sala se acerque y coloque en la mesa física un soporte o flyer informativo de reserva ("base informativa") que tienen disponible en el local.
- **Cita:** "que en la parte administrativa le salga una alerta. En 15 minutos la mesa 5 va a estar reservada. Así que ahí creo que ustedes pueden trabajarlo con un conito o con algo que referencia que está reservada."
- **Prioridad:** Próximo · **Confianza:** Alta

### C-16 · Canal de reservas centralizado exclusivamente por WhatsApp
- **Área según el agente:** DECISIONES Y REGLAS CONFIRMADAS
- **Tipo:** Regla de negocio · **Quién:** Kevin · **Hora:** 00:58:46
- **Detalle:** Queda formalmente descartado incluir un flujo de reservas dentro de la carta web para el cliente final. Kevin argumenta que programar reservas en la web representaría un esfuerzo innecesario para una función que apenas se usa 4 o 5 veces al mes y saturaría visualmente la carta con botones prescindibles. Se mantendrá el canal habitual: el cliente consulta disponibilidad por WhatsApp y el personal registra la reserva manualmente en el sistema.
- **Cita:** "No, no, no es que no lo hacen difícil. Va a ser un gasto innecesario de tiempo. Cuando lo hagan con recurrencia, yo creo que se puede invertir el tiempo ahí, pero no lo hacen en realidad... Queremos que sea más lo más simple posible."
- **Prioridad:** Inmediato · **Confianza:** Alta

### C-17 · Flujo del Chatbot de reservas solicitando comensales y hora sin asignar mesa
- **Área según el agente:** CHATBOT WHATSAPP
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 00:59:49
- **Detalle:** Dado que las consultas de reserva ingresan por WhatsApp, se incorporará una opción en el Chatbot para iniciar la solicitud. José y Kevin convienen en que el bot no debe solicitar ni permitir elegir un número específico de mesa; únicamente preguntará para cuántas personas es la reserva, la fecha y la hora, derivando los datos al personal para la confirmación y asignación física.
- **Cita:** "y no decirle exactamente qué mesa, sino para cuántas personas y ya."
- **Prioridad:** Próximo · **Confianza:** Alta

### C-18 · Botón de derivación a personal humano en el Chatbot ("Hablar con un asesor")
- **Área según el agente:** CHATBOT WHATSAPP
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 00:59:49
- **Detalle:** Para evitar la frustración de clientes que no deseen interactuar con flujos automáticos o requieran atención personalizada, José plantea incorporar un botón directo que transfiera la conversación a una persona del equipo ("Quiero hablar con un asesor directamente" o "Quiero hablar con un camarero directamente"). Kevin respalda y aprueba la iniciativa.
- **Cita:** "otro punto que ahorita se me ocurrió para el chatbot es quiero hablar con un asesor directamente, quiero hablar con un camarero directamente... y quiero hablar con un asesor"
- **Prioridad:** Inmediato · **Confianza:** Alta

### C-19 · Inclusión de emojis en botones interactivos y banner de bienvenida en Chatbot
- **Área según el agente:** CHATBOT WHATSAPP
- **Tipo:** Idea del cliente · **Quién:** Kevin · **Hora:** 01:00:36
- **Detalle:** Kevin sugiere añadir emojis en los textos de los botones del menú de WhatsApp para brindar una experiencia más cercana, amigable y visualmente atractiva. José complementa la recomendación sugiriendo que el mensaje de bienvenida inicial cuente con un banner de cabecera ("Hola Caprichos") acompañado de emojis alusivos.
- **Cita:** "ponerle emojis de repente a los botones para que sea un poco más amena... Un emoji por ahí que digamos un banner al principio. Un banner. Bueno, hola capricho. Ya. Y poner el emojis."
- **Prioridad:** Próximo · **Confianza:** Alta

### C-20 · Reincorporación del sistema de puntos y simplificación de asignación
- **Área según el agente:** CLIENTES, PUNTOS, CRÉDITOS Y DESCUENTOS
- **Tipo:** Pedido del cliente · **Quién:** Kevin · **Hora:** 01:00:36
- **Detalle:** Kevin solicita expresamente volver a habilitar el programa de fidelización por puntos, señalando que la clientela habitual lo solicita de manera constante. Recuerda que Hola Click contaba con puntos, pero presentaba la gran desventaja de obligar a configurar y definir las reglas de puntos de manera individual producto por producto, lo que resultaba muy engorroso de mantener.
- **Cita:** "También me gustaría implementar el tema de los puntos. Eso me lo han pedido bastante los clientes, que regrese los puntos. Hola, Click tiene, pero tiene tengo que configurar producto por producto"
- **Prioridad:** Inmediato · **Confianza:** Alta

### C-21 · Modelo de compra de Cineplanet (invitado sin puntos vs logueado con puntos)
- **Área según el agente:** INVESTIGAR O REVISAR (referencias)
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 01:01:34
- **Detalle:** José plantea como referencia técnica la experiencia de compra en línea de Cineplanet: ofrecer al cliente la opción de realizar pedidos de forma ágil como invitado (comprando directamente sin acumular puntos) o mediante inicio de sesión/registro de cuenta, en cuyo caso sí acumula puntos canjeables por beneficios en sus consumos.
- **Cita:** "los puntos lo podríamos trabajar como Cineplanet. ¿Usted ha comprado en línea por Cineplanet alguna vez?... le permite comprar como invitado o loguearse. Cuando te logueas recolectas puntos, pero cuando es un invitado compras no más y no recolectas puntos. esa forma podríamos usar."
- **Prioridad:** Próximo · **Confianza:** Alta

### C-22 · Recolección de fecha de cumpleaños para campañas automáticas de fidelización
- **Área según el agente:** MARKETING, POSVENTA Y OPINIONES
- **Tipo:** Idea del cliente · **Quién:** Kevin · **Hora:** 01:01:34
- **Detalle:** Kevin solicita que el formulario de registro de clientes en la plataforma incluya obligatoriamente el campo de fecha de cumpleaños. El objetivo comercial es automatizar campañas de saludo y fidelización enviando al cumpleañero promociones personalizadas, cortesías u obsequios especiales en su fecha festiva.
- **Cita:** "que se lo ve y que ponga este datos como fecha de cumpleaños me gustaría para hacer una campaña especial por el cumpleaños del cliente, ¿no? Darle algo, fecha de cumpleaños, que ponga su fecha de cumpleaños."
- **Prioridad:** Próximo · **Confianza:** Alta

### C-23 · Inicio de sesión basado en correo electrónico para recopilar correos verídicos
- **Área según el agente:** DECISIONES Y REGLAS CONFIRMADAS
- **Tipo:** Regla de negocio · **Quién:** Kevin · **Hora:** 01:02:33
- **Detalle:** Al definir si el login debe usar nombre de usuario o correo, Kevin resuelve que sea obligatoriamente por correo electrónico. Explica que esto permite captar el correo personal real del cliente (Gmail, Outlook, etc.) en vez de un alias ficticio inventado solo para Caprichos, construyendo una base de datos de correos verificados para futuras estrategias de email marketing.
- **Cita:** "creo mejor correo porque ahí estamos este matando dos pájaros un solo tiro porque estamos pidiendo un correo en vez de nombre de usuario y ese mismo correo posiblemente sea el mismo correo real que él tiene en su Gmail o un look... ya estamos teniendo su correo electrónico ya como usar."
- **Prioridad:** Inmediato · **Confianza:** Alta

### C-24 · Inclusión de aviso de privacidad y tratamiento de datos personales en el registro
- **Área según el agente:** INFRAESTRUCTURA Y OPERACIÓN
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 01:02:33
- **Detalle:** Al recopilar información personal sensible del cliente durante el proceso de registro (nombres completos, teléfonos, direcciones residenciales, correos electrónicos y fechas de cumpleaños), José señala que se debe colocar un pie informativo o cláusula legal de privacidad y términos y condiciones, asegurando al usuario que sus datos serán tratados y almacenados de manera segura.
- **Cita:** "tendrías que poner un poco abajo restricciones de que va que su información va a ser guardada y todo eso."
- **Prioridad:** Próximo · **Confianza:** Alta

### C-25 · Aplazamiento de niveles y categorías de puntos (Platino, Súper Capricho)
- **Área según el agente:** APLAZADO, DESCARTADO O A FUTURO
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 01:03:27
- **Detalle:** José propone estructurar niveles de membresía o categorías de fidelización escalonadas por puntos acumulados (por ejemplo, nivel Platino o cliente "Súper Capricho") con privilegios crecientes. Kevin muestra agrado por el concepto, pero ambos coinciden en aplazar su diseño y parametrización para una etapa posterior.
- **Cita:** "¿Quién sabe haber niveles platino o quién sabe super capricho? Ya hay niveles... Ya sería algo de pensarlo para después. Eso."
- **Prioridad:** Futuro · **Confianza:** Alta

### C-26 · Sistema de crédito interno para consumo del personal con plazo de 15 días
- **Área según el agente:** CLIENTES, PUNTOS, CRÉDITOS Y DESCUENTOS
- **Tipo:** Regla de negocio · **Quién:** Kevin · **Hora:** 01:03:27
- **Detalle:** En Caprichos no se otorga crédito comercial a clientes externos bajo ninguna circunstancia. Sin embargo, sí existe una política activa de crédito para el personal de la empresa: los trabajadores pueden consumir productos a cuenta y disponen de hasta 15 días (o liquidación quincenal/fin de mes) para saldar su deuda.
- **Cita:** "créditos no damos a clientes créditos a nadie, pero sí damos créditos al personal. Al personal compra por crédito... lo tiene para pagar hasta 15 días así."
- **Prioridad:** Inmediato · **Confianza:** Alta

### C-27 · Descuento del 25% para personal con exclusión de combos y promociones
- **Área según el agente:** DECISIONES Y REGLAS CONFIRMADAS
- **Tipo:** Regla de negocio · **Quién:** Kevin · **Hora:** 01:04:24
- **Detalle:** Los trabajadores del equipo (beneficio extendido a José por su colaboración en el proyecto) gozan de un 25% de descuento sobre el precio de carta regular. Se establecen excepciones estrictas: el 25% no es acumulable ni aplica a combos ni promociones, excluyendo expresamente el "Dúo Compartir", el "Dúo Irresistible" y la media docena de donas (ítems que ya cuentan con tarifa rebajada). Se detallan precios resultantes: una dona individual queda en S/ 3.00 y un frappé de S/ 14.50 se reduce a aproximadamente S/ 10.50 o S/ 10.60. A los empleados les resulta más económico comprar productos individuales con su 25% que adquirir combos.
- **Cita:** "Se le descuenta el 25% de todo lo en general, todo menos promociones y combos, menos los dos dúos compartir, el dúo compartir y el dúo resistible, menos eso... una dona a ellos le sale a 3 soles... Un frapé de 1450 ya les cuesta 10 soles 60 por ahí, 10 soles 50 uno."
- **Prioridad:** Inmediato · **Confianza:** Alta

### C-28 · Disponibilidad estructural del módulo de crédito autenticado por cuenta de usuario
- **Área según el agente:** ADMINISTRATIVO Y ROLES
- **Tipo:** Idea del cliente · **Quién:** Kevin · **Hora:** 01:05:24
- **Detalle:** Aunque el crédito se destina operativamente solo al equipo de trabajo, Kevin pide que el módulo de créditos no se bloquee a nivel de código ni se limite exclusivamente a un rol, sino que quede disponible de forma general en el sistema (tal como lo permite Restaurant.pe). Cada colaborador contará con su cuenta de usuario individual para iniciar sesión y registrar sus compras a crédito como si fuera un cliente registrado.
- **Cita:** "ponle para todos en realidad. O sea, ahí incluimos al trabajador, pues porque ellos tienen que tener su usuario, tienen que loguearse... la compra la van a hacer con su usuario, ¿no? Como un cliente."
- **Prioridad:** Inmediato · **Confianza:** Alta

### C-29 · Asociación de cupones y descuentos a la cuenta autenticada del cliente
- **Área según el agente:** CLIENTES, PUNTOS, CRÉDITOS Y DESCUENTOS
- **Tipo:** Idea del cliente · **Quién:** Kevin · **Hora:** 01:05:24
- **Detalle:** Kevin destaca que la aplicación de cupones promocionales y descuentos especiales debe realizarse a través de la cuenta de usuario del cliente, garantizando el control de acceso, la trazabilidad del uso y la validación de condiciones como la fecha de caducidad y el porcentaje o monto del beneficio.
- **Cita:** "cupones de descuento y todas esas cosas se aplican también con el usuario."
- **Prioridad:** Próximo · **Confianza:** Alta

### C-30 · Definición de parámetros y condiciones de cupones para Caprichos
- **Área según el agente:** DUDAS ABIERTAS
- **Tipo:** Pregunta · **Quién:** José · **Hora:** 01:06:22
- **Detalle:** José formuló preguntas puntuales sobre las reglas de negocio de los cupones en Caprichos: cuánto tiempo de validez tendrán, cuál será el importe o porcentaje de descuento y sobre qué categorías o productos específicos aplicarán. Kevin no respondió los valores numéricos concretos para su negocio, sino que remitió a revisar las opciones existentes en Restaurant.pe, quedando pendiente definir la política comercial propia.
- **Cita:** "La validez del cupón. ¿Cuánto tiempo va a durar el cupón? ¿De cuánto es el cupón? ¿En qué cosa solamente aplica el cupón?"
- **Prioridad:** No se sabe · **Confianza:** Alta

### C-31 · Envío del enlace de Restaurant.pe sobre configuración de cupones y descuentos
- **Área según el agente:** PENDIENTES DEL CLIENTE
- **Tipo:** Compromiso · **Quién:** Kevin · **Hora:** 01:06:22
- **Detalle:** Kevin afirma que Restaurant.pe tiene un módulo muy completo y detallado para estructurar cupones de descuento y promociones, y se compromete formalmente a remitirle el enlace web a José para que analice la arquitectura, campos y opciones de parametrización disponibles en ese sistema.
- **Cita:** "El restaurant tiene todo eso, tiene está todo masticadito en Restaurant. Eso es lo bueno. Te voy a pasar el link para que tú lo el veas... Te voy a pasar el link ahí para que tú veas la estructura que tiene."
- **Prioridad:** Inmediato · **Confianza:** Alta

### C-32 · Asociación automática y memoria de dirección por número de teléfono en pedidos como invitado
- **Área según el agente:** CARTA WEB (cliente)
- **Tipo:** Pedido del cliente · **Quién:** Kevin · **Hora:** 01:07:16
- **Detalle:** Kevin subraya una funcionalidad crítica para mejorar la usabilidad en pedidos de delivery recurrentes: cuando un cliente hace un nuevo pedido como invitado e ingresa su número telefónico, el sistema debe recordar y asociar la dirección guardada en su compra anterior, impidiendo que deba volver a señalar su ubicación en el mapa cada vez que ordena.
- **Cita:** "porque el Lola Click, algo lo bueno que tiene el Lola Click es que con el número ya lo asociaba el número y recordaba la ubicación para que el cliente no esté nuevamente colocando su ubicación en el aplicativo. Si eso es algo muy importante porque es la facilidad para el cliente"
- **Prioridad:** Inmediato · **Confianza:** Alta

### C-33 · Pantalla de verificación rápida de dirección ("¿Es para su misma ubicación?")
- **Área según el agente:** CARTA WEB (cliente)
- **Tipo:** Idea del cliente · **Quién:** Kevin · **Hora:** 01:08:33
- **Detalle:** Describiendo la última mejora implementada en Hola Click, Kevin propone que al detectar una dirección previa asociada al teléfono, la plataforma muestre una ventana de confirmación mostrando el mapa con la pregunta: "¿Es para su misma ubicación? Esta es su ubicación". De este modo el cliente valida con un solo clic o corrige el pin si se encuentra en otra dirección.
- **Cita:** "Hola, click. Verificaba último... ¿Qué le preguntaba al cliente? Este era es para su misma ubicación. Esta es su ubicación, le decía, ¿no? O sea, y le mostraba ahí el mapa. Sería bueno que en el flujo de de hola click que veas."
- **Prioridad:** Inmediato · **Confianza:** Alta

### C-34 · Envío de credenciales de acceso de Hola Click para auditar configuraciones y flujos
- **Área según el agente:** PENDIENTES DEL CLIENTE
- **Tipo:** Compromiso · **Quién:** Kevin · **Hora:** 01:08:33
- **Detalle:** Kevin se compromete a buscar y compartir sus credenciales de usuario y clave de Hola Click para que José explore el panel de configuración interna y pruebe la interfaz de compra desde la perspectiva del cliente, aclarando que al no estar pagando el servicio actualmente algunas funciones podrían estar restringidas.
- **Cita:** "A ver, voy a ver si tengo todavía. Si te paso el usuario de hola click... ahorita voy a buscar el usuario, te lo paso de OC para que puedas revisarlo a detalle."
- **Prioridad:** Inmediato · **Confianza:** Alta

### C-35 · Revisión técnica de la plataforma y experiencia de usuario en Hola Click
- **Área según el agente:** PENDIENTES DEL DESARROLLADOR
- **Tipo:** Compromiso · **Quién:** José · **Hora:** 01:08:33
- **Detalle:** Tras el ofrecimiento de Kevin, José acepta las credenciales y se compromete a ingresar a Hola Click para revisar en detalle el flujo de cliente, la verificación de ubicación y los paneles de configuración administrativa.
- **Cita:** "Ya, ya lo regreso. Segos."
- **Prioridad:** Próximo · **Confianza:** Media

### C-36 · Creación y desactivación en cascada de categorías estacionales o por temporada
- **Área según el agente:** ADMINISTRATIVO Y ROLES
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 01:10:02
- **Detalle:** En el gestor de catálogo se permitirá dar de alta múltiples categorías de productos. Se incluirá la capacidad de desactivar temporalmente una categoría completa (ideal para líneas de temporada festiva o estacional), logrando que todos los artículos agrupados en dicha categoría queden ocultos en cascada de la carta digital de forma instantánea.
- **Cita:** "va a poder gestionar también lo que es categorías, va a poder crear todas las categorías que quiera, que sabe por ahí lo desactiva una categoría o ya más adelante no se usa y se desactiva así en escala todos los propios se desactiva."
- **Prioridad:** Próximo · **Confianza:** Alta

### C-37 · Presentación de productos en tarjetas cuadradas con conmutador de disponibilidad
- **Área según el agente:** CARTA WEB (cliente)
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 01:10:55
- **Detalle:** En el diseño visual de la carta virtual, José propone maquetar los productos en formato de tarjetas cuadradas con carga de imágenes optimizadas y un control de disponibilidad ("aquí y disponible") para marcar en tiempo real si un producto se encuentra agotado o listo para la venta.
- **Cita:** "Se va a poder subir las sus imágenes, se guarda y se mantiene. Bueno, lo voy a hacer un poquito más cuadrado con el aquí y disponible."
- **Prioridad:** Próximo · **Confianza:** Alta

### C-38 · Administración de promociones avanzadas (2x1, 3x2, descuentos porcentuales y vales de sorteo)
- **Área según el agente:** CARTA WEB (cliente)
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 01:10:55
- **Detalle:** En el módulo de ofertas y descuentos se integrarán diversas modalidades promocionales inspiradas en Restaurant.pe: promociones tipo 2x1, combos 3x2, rebajas de porcentaje fijo, aplicación de cupones de descuento y emisión y control de vales para sorteos comerciales.
- **Cita:** "ofertas y descuentos. Estos son las ofertas. Combo 2 por 3 por 2, por un descuento, cupones también se van a agregar acá vale sorteos también me tiene. Y acá se va a poder gestionar todo esto"
- **Prioridad:** Próximo · **Confianza:** Alta

### C-39 · Programación de vinculación obligatoria de productos e insumos en combos
- **Área según el agente:** PENDIENTES DEL DESARROLLADOR
- **Tipo:** Compromiso · **Quién:** José · **Hora:** 01:12:00
- **Detalle:** José asume el compromiso de programar una lógica de entrelazado entre los productos que componen un combo o promoción, garantizando que el sistema mantenga una relación ordenada entre los ítems seleccionados, sus variantes y la deducción correspondiente en cocina y almacén.
- **Cita:** "Bueno, acá después lo voy a gestionar yo para que cuando hagan promociones entrelacen los productos para que estén enlazados. Sería mucho mejor para que haya un orden."
- **Prioridad:** Próximo · **Confianza:** Alta

### C-40 · Filtros avanzados en módulo de compras por período temporal, categoría y sede
- **Área según el agente:** ALMACÉN, STOCK, RECETAS Y COMPRAS
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 01:12:00
- **Detalle:** En el historial de compras de insumos e inventario, José añadirá filtros de búsqueda dinámicos que permitan consultar transacciones por rangos temporales específicos (1 día, 2 días, 1 semana, 1 año), por categoría de insumos y por ubicación o local de procedencia.
- **Cita:** "Acá está el historial de compras, todas las compras que se hicieron. Le voy a poner más filtros, quién sabe por fechas, eh, un día, dos días o un año, una semana, una categoría, quién sabe, de una cierta ubicación"
- **Prioridad:** Próximo · **Confianza:** Alta

### C-41 · Replicación del flujo de almacén de Restaurant.pe (Entrada, Salida, Transferencia y Merma)
- **Área según el agente:** DECISIONES Y REGLAS CONFIRMADAS
- **Tipo:** Regla de negocio · **Quién:** Kevin · **Hora:** 01:12:00
- **Detalle:** Kevin indica que actualmente no llevan control de almacén en el sistema. Sin embargo, decide adoptar exactamente la estructura de cuatro movimientos que ofrece Restaurant.pe: Entrada, Salida, Transferencia y Merma, debido a que es un esquema operativo estándar y comprobado en el rubro gastronómico.
- **Cita:** "No lo manejamos actualmente, no estamos usando el almacén eh actualidad... Este así como está restaurant.p Porque ese flujo ya está ya comprobado que sí funciona."
- **Prioridad:** Próximo · **Confianza:** Alta

### C-42 · Protocolo operativo de producción matutina y descargo de insumos y stock diario
- **Área según el agente:** ALMACÉN, STOCK, RECETAS Y COMPRAS
- **Tipo:** Regla de negocio · **Quién:** Kevin · **Hora:** 01:12:58
- **Detalle:** Kevin describe la rutina productiva del negocio: una colaboradora asiste por las mañanas exclusivamente a elaborar la producción del día (postres, panes pullman y gelatinas). En el nuevo sistema, ella retirará los insumos de almacén anotando lo utilizado, y al terminar su jornada matutina ingresará al sistema: 1) La salida formal de insumos consumidos; 2) La entrada a stock diario de los productos terminados disponibles para la venta.
- **Cita:** "En la mañana viene producción. Este viene una señorita que hace toda la producción, todo lo que son los postres, los panes, pulman, gelatinas, todo viene en la mañana... La idea es que ahorita agarre, apunte y después en su salida ingrese todos esos registros al sistema de entrada... Que ingrese este los insumos que ha usado, ¿no? Que sacó del almacén. y que ingrese también los productos que ha preparado el stop diario al finalizar su jornada."
- **Prioridad:** Inmediato · **Confianza:** Alta

### C-43 · Creación del rol operativo de Producción y Almacén
- **Área según el agente:** ADMINISTRATIVO Y ROLES
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 01:14:24
- **Detalle:** Para soportar operativamente el flujo matutino descrito por Kevin, José establece que en la gestión de roles y permisos se creará un perfil específico para la encargada de repostería/cocina con permisos acotados exclusivamente a la extracción de insumos de almacén y al registro de producto terminado en stock diario.
- **Cita:** "ella como almacén y preparación de productos va a tener esos roles"
- **Prioridad:** Inmediato · **Confianza:** Alta

### Sección del agente: Datos del negocio que se mencionaron
- Número de teléfono celular utilizado en la demostración: 946 388 934.
- Nombres de clientes y personal mencionados en el sistema de ventas/delivery: Nicolás, Liset y Miguel Ángel.
- Cantidad de mesas del local: Físicamente el salón tiene aproximadamente 8 mesas (utilizadas usualmente por mozos del 1 al 8). En el sistema anterior fueron ampliadas artificialmente a 30 mesas (caja usaba del 9 al 30) para evitar que se junten y crucen pedidos concurrentes de distintos clientes.
- Frecuencia de reservas de mesas: Ocurren de 4 a 5 veces al mes.
- Regla de tolerancia en reservas: 15 minutos exactos de tolerancia; de no presentarse el cliente, la mesa se libera al público.
- Señalización física de reservas: El local dispone de una base informativa / flyer parante para colocar físicamente en la mesa reservada en salón.
- Descuento general al personal: 25% de descuento sobre el precio de carta regular para trabajadores del negocio (beneficio extendido a José).
- Exclusiones del descuento de personal: No aplica a promociones ni combos; quedan explícitamente excluidos el "Dúo Compartir", el "Dúo Irresistible" y la media docena de donas.
- Precios y ejemplos de productos mencionados:
  - Dona individual: con descuento de personal del 25% queda a S/ 3.00.
  - Frappé: precio de carta regular S/ 14.50; con descuento de personal del 25% queda en S/ 10.50 o S/ 10.60.
- Condiciones de crédito interno al personal: Los trabajadores pueden consumir a crédito con un plazo de pago de hasta 15 días (liquidación quincenal o mensual).
- Operación y productos de producción matutina: Se elaboran panes pullman (pan de molde), variedad de postres y gelatinas durante la mañana.
- Movimientos de almacén requeridos: Entrada, Salida, Transferencia y Merma.



### Sección del agente: Enlaces, páginas o sistemas nombrados
- **Hola Click (o HolaClick):** Sistema anterior de carta virtual, pedidos delivery y gestión de clientes. Se mencionó por su capacidad de asociar la ubicación anterior al número de teléfono del cliente, su confirmación interactiva de dirección ("¿Es para su misma ubicación?"), el uso de códigos plus de Google Maps y su sistema de puntos por producto. Cuenta actual con acceso gratuito/limitado.
- **Restaurant.pe (o restaurant.p):** Sistema de gestión gastronómica actualmente contratado y utilizado por Caprichos. Se nombraron sus módulos de mesas, cupones de descuento, catálogo de promociones y flujo de almacén (Entrada, Salida, Transferencia, Merma).
- **Delivery Pro:** Software o módulo de delivery contratado actualmente por Caprichos, del cual Kevin señala que para él no funciona bien; cuenta con panel de pedidos, mapas y opción de tótems de autoservicio (Self Service).
- **Google Maps:** Mapeo de referencia utilizado para obtener y copiar el "código plus" (Plus Code) de las ubicaciones enviadas por clientes vía WhatsApp.
- **Mapa alternativo sin coordenadas:** Servicio de mapas implementado en el sistema actual de Caprichos (Kevin tiene el nombre guardado) que no permite pegar coordenadas geográficas ni Plus Codes.
- **Cineplanet:** Sistema de venta en línea tomado como modelo de referencia para la dualidad de compra como invitado (sin acumular puntos) vs. compra autenticada con usuario/clave (acumula puntos canjeables).
- **McDonald's:** Cadena de comida rápida nombrada como ejemplo referencial del uso de tótems publicitarios y kioscos de autoservicio (Self Service).
- **Gmail y Outlook:** Proveedores de correo electrónico mencionados por Kevin como origen de los correos personales reales de los clientes al registrarse.



### Sección del agente: Ruido descartado
- Problemas técnicos transitorios de audio durante la videollamada al minuto 00:55:09 ("Jefre, te escucho... Ya, ahora sí te escucho, amigo", y mención de "Jefre" atribuible a ruido de fondo o confusión momentánea de la transcripción).



### Sección del agente: Cobertura
- El tramo C abarca desde la línea 1 hasta la línea 362 (aproximadamente desde el minuto 00:44:xx hasta el minuto 01:14:24 de la reunión).
- Se detectó contenido sustancial y accionable en aproximadamente 340 de las 362 líneas del archivo.
- No se omitió ninguna iniciativa, sugerencia, idea, pedido, pendiente, referencia de sistemas ni regla de negocio expresada en el tramo.


## Tramo D

### D-01 · Replicar el flujo de almacén comprobado de restaurant.pe
- **Área según el agente:** INVESTIGAR O REVISAR (referencias)
- **Tipo:** Idea del cliente · **Quién:** Kevin · **Hora:** 01:12:58
- **Detalle:** Kevin indica que en la actualidad no manejan ni usan el módulo de almacén en Caprichos. Solicita que el diseño y flujo del almacén en la nueva plataforma sea exactamente como el de restaurant.pe ("restaurant.p"), debido a que dicho flujo operativo ya está probado y funciona con éxito en el rubro gastronómico.
- **Cita:** "Este así como está restaurant.p Porque ese flujo ya está ya comprobado que sí funciona."
- **Prioridad:** Inmediato · **Confianza:** Alta

### D-02 · Registro de insumos y producción diaria matutina
- **Área según el agente:** ALMACÉN, STOCK, RECETAS Y COMPRAS
- **Tipo:** Regla de negocio · **Quién:** Kevin · **Hora:** 01:12:58
- **Detalle:** Por las mañanas acude una encargada de producción que elabora postres, pan pullman, gelatinas y otros productos. Ella toma los insumos directamente del almacén físico, anota lo utilizado y, al finalizar su jornada diaria, debe ingresar al sistema tanto el consumo de insumos (salidas de almacén) como el inventario de productos terminados preparados (entradas de stock diario).
- **Cita:** "La idea es que ahorita agarre, apunte y después en su salida ingrese todos esos registros al sistema de entrada... Que ingrese este los insumos que ha usado, ¿no? Que sacó del almacén. y que ingrese también los productos que ha preparado el stop diario al finalizar su jornada."
- **Prioridad:** Inmediato · **Confianza:** Alta

### D-03 · Rol dual de almacén y producción para encargada matutina
- **Área según el agente:** ADMINISTRATIVO Y ROLES
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 01:14:24
- **Detalle:** José plantea que la encargada de elaborar los productos por la mañana dispondrá en el sistema de un perfil con doble función: rol de almacén (para registrar las salidas de insumos) y rol de preparación de productos (para dar de alta el stock final terminado).
- **Cita:** "Ya, ella como almacén y preparación de productos va a tener esos roles"
- **Prioridad:** Próximo · **Confianza:** Alta

### D-04 · Política y destino de mermas de productos perecibles
- **Área según el agente:** ALMACÉN, STOCK, RECETAS Y COMPRAS
- **Tipo:** Regla de negocio · **Quién:** Kevin · **Hora:** 01:15:21
- **Detalle:** Los productos perecibles no vendidos al cierre del turno (especialmente donas) se clasifican formalmente como merma. Kevin explica que anteriormente se repartían entre todo el equipo de trabajo, pero actualmente todo se separa y él decide personalmente su destino. Aunque raras veces sobra producto, cuando quedan donas se regalan a familiares o conocidos; no se desechan a la basura porque Kevin no acostumbra botar comida.
- **Cita:** "pero raras veces queda, pero sí cuando queda este donas se regalan, se se donan las donas, no se votan. Todavía no estoy acostumbrado a votar es esa cosa. Prefiero que alguien lo lo disfrute, ¿no? Algo, pero no votarlo."
- **Prioridad:** Inmediato · **Confianza:** Alta

### D-05 · Autorización para el registro de mermas
- **Área según el agente:** ADMINISTRATIVO Y ROLES
- **Tipo:** Regla de negocio · **Quién:** Kevin · **Hora:** 01:15:21
- **Detalle:** El ingreso y control de las mermas en el sistema es una facultad restringida que realizan únicamente Kevin y, en ocasiones, la supervisora del local.
- **Cita:** "Este, yo me encargo de yo y a veces la supervisora que está aquí, ella es la"
- **Prioridad:** Inmediato · **Confianza:** Alta

### D-06 · Rol de almacenero vespertino asignado al repartidor de delivery
- **Área según el agente:** ADMINISTRATIVO Y ROLES
- **Tipo:** Regla de negocio · **Quién:** Kevin · **Hora:** 01:16:53
- **Detalle:** Para cubrir las salidas de insumos durante el turno tarde y noche (como vasos, sorbetes, tapas, servilletas, azúcar, crema de leche, fresas, etc.), el repartidor de delivery principal asume el rol de almacenero. Él contará con un usuario en el sistema para registrar las salidas de insumos por la tarde y registrar las entradas cuando llegue mercadería.
- **Cita:** "el delivery es el que te encarga del almacén, también es almacenero. ¿Qué pasa si necesitan vasos? ¿Necesitan sorbete? ¿Necesitan tapas? ¿Necesitan servilletas? eh azúcar, tantos insumos, crema de leche, necesitan fresa, todo eso, ¿no? Entonces, que haya una persona responsable como él que se encargue de anotar todas esas salidas en la tarde"
- **Prioridad:** Inmediato · **Confianza:** Alta

### D-07 · Acceso administrativo para Kevin y suplencia ante descansos del almacenero
- **Área según el agente:** ADMINISTRATIVO Y ROLES
- **Tipo:** Regla de negocio · **Quién:** Kevin · **Hora:** 01:16:53
- **Detalle:** Kevin requiere contar con credenciales de acceso para registrar directamente las entradas de mercadería que él mismo adquiere y transporta al local. Además, cuando el delivery almacenero descansa, Kevin asume dicha función, puesto que el repartidor secundario solo trabaja un día a la semana y desconoce la distribución de los insumos en el almacén.
- **Cita:** "Yo también, yo también tener acceso para pues poder colocar yo lo que traigo, ¿no? A veces él a veces descansa y yo estoy en el turno y el otro delivery no se encarga tanto del almacén porque viene una vez a la semana y no conoce dónde están ubicadas las cosas al 100%."
- **Prioridad:** Inmediato · **Confianza:** Alta

### D-08 · Eliminación del módulo de transferencias entre almacenes en fase inicial
- **Área según el agente:** APLAZADO, DESCARTADO O A FUTURO
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 01:17:56
- **Detalle:** José aclara que la opción de transferencias fue copiada de otro sistema y confirma que la suprimirá de la versión inicial, dado que Caprichos cuenta con un solo local y un único almacén central. Kevin conviene en que dicha función solo se retomará a futuro si surge la necesidad de abrir sucursales o múltiples almacenes.
- **Cita:** "Bueno, yo me copié del otro y sí lo voy a eliminar porque como están trabajando con uno no más. Kevin Rosales: Sí, cuando tengamos de repente necesidad de eso se podría"
- **Prioridad:** Futuro · **Confianza:** Alta

### D-09 · Vida útil de doce horas para donas y reseteo matutino de stock
- **Área según el agente:** ALMACÉN, STOCK, RECETAS Y COMPRAS
- **Tipo:** Regla de negocio · **Quién:** Kevin · **Hora:** 01:17:56
- **Detalle:** El periodo de vida comercial de las donas para los estándares de Caprichos es de máximo 12 horas (un día de turno), ya que de un día para otro la textura cambia. Por consiguiente, cada mañana el stock registrado de donas debe comenzar en cero y cualquier sobrante debe ser computado como merma.
- **Cita:** "Eh, de donas, sí, solo de donas. Donas su periodo de vida es de un día nada más, es menos todavía. O sea, lo hacen en la tarde son como 12 horas y eso un día. O sea, para caprichos."
- **Prioridad:** Inmediato · **Confianza:** Alta

### D-10 · Conservación y prioridad de salida para filetes de pollo cocidos
- **Área según el agente:** ALMACÉN, STOCK, RECETAS Y COMPRAS
- **Tipo:** Regla de negocio · **Quién:** Kevin · **Hora:** 01:19:01
- **Detalle:** Cuando quedan filetes de pechuga de pollo cocidos al final del turno de noche que formaban parte del mise en place (por ejemplo, cuatro filetes), se refrigeran dentro de un táper de acero inoxidable. Al día siguiente, estos filetes refrigerados son los primeros que deben consumirse en la preparación de pedidos. Su tiempo de conservación máximo es de un día.
- **Cita:** "A veces se quedan pollos, filetes de pollos se quedan cocidos ya que lo tienen parte como parte de su misan plaz... lo refrigera, lo colocas en un tapper de acero y lo refrigeran para el día siguiente y eso es lo que sale primero al día siguiente, ¿no? Pero ese eso vendría siendo este periodo de vida de un día máximo del del pollo"
- **Prioridad:** Inmediato · **Confianza:** Alta

### D-11 · Parámetro configurable de tiempo de vida útil por producto
- **Área según el agente:** ALMACÉN, STOCK, RECETAS Y COMPRAS
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 01:19:01
- **Detalle:** José propone incorporar un campo editable en el sistema para que el administrador pueda parametrizar y modificar la vida útil de cada producto o insumo perecible (estableciendo uno o dos días, según corresponda), evitando que el stock se vacíe erróneamente de forma fija.
- **Cita:** "Claro, para esos productos va a ser editable. ¿Quién sabe? Hoy en día es un día, otro día quién sabe, lo pueden editar, poner dos días y ya."
- **Prioridad:** Próximo · **Confianza:** Alta

### D-12 · Descuento automatizado de insumos al vender productos preparados al momento
- **Área según el agente:** ALMACÉN, STOCK, RECETAS Y COMPRAS
- **Tipo:** Pedido del cliente · **Quién:** Kevin · **Hora:** 01:20:19
- **Detalle:** Kevin requiere que al venderse un plato preparado al momento (como el Club Sándwich), el sistema descargue automáticamente del inventario cada insumo individual involucrado en su receta (filete de pollo, rebanadas de pan, queso, jamón, etc.). Explica que ingresar salidas manuales plato por plato es ineficiente y no automatiza la operación.
- **Cita:** "Y la idea, la idea es que cuando se vende un club sándwich ya se esté vendiendo este, por ejemplo, ingresaron filetes de pollo... cuando sale el club Sandwich, se va a estar agotando automáticamente un filete de pollo."
- **Prioridad:** Inmediato · **Confianza:** Alta

### D-13 · Estandarización de porciones y uso de filetes enteros de pechuga
- **Área según el agente:** ALMACÉN, STOCK, RECETAS Y COMPRAS
- **Tipo:** Queja o problema actual · **Quién:** Kevin · **Hora:** 01:20:19
- **Detalle:** A diferencia de la mayoría de establecimientos que preparan el Club Sándwich con pollo deshilachado, Caprichos utiliza filetes enteros de pechuga. Kevin señala como oportunidad de mejora que cuando un filete es muy pequeño en cocina agregan uno y medio, por lo que deben estandarizar el gramaje o tamaño unitario para asegurar la precisión del descuento de stock.
- **Cita:** "A veces le colocan uno y medio porque el filete es muy pequeñito. Entonces ahí este ahí nos falta mejorar a nosotros para que sean tamaños estándar o gramajes. Por eso la mayoría trabaja con pollo de silachado, el club sándwich, pero nosotros trabajamos con filete."
- **Prioridad:** Próximo · **Confianza:** Alta

### D-14 · Receta estándar y dosificación de insumos del Club Sándwich
- **Área según el agente:** ALMACÉN, STOCK, RECETAS Y COMPRAS
- **Tipo:** Dato del negocio · **Quién:** Kevin · **Hora:** 01:22:47
- **Detalle:** Kevin detalla los insumos que componen la receta del Club Sándwich: cuatro rebanadas de pan de molde pullman (de un molde horneado se dosifican las rebanadas, rindiendo aprox. siete sándwiches), un filete de pollo, dos rebanadas de jamón inglés, dos rebanadas de queso edam, tocino culinario, tomate y lechuga. La receta debe estar enlazada al producto para descontar insumos en tiempo real.
- **Cita:** "cada club sand lleva dos rebanadas de jamón edan y dos rebanadas de queso inglés, eh, perdón, queso, queso edan y jamón inglés, ¿no? O sea, tiene una receta y esa receta tiene que estar anexada a productos para que cuando se venda ese producto automáticamente se descuente esa receta del almacén que salga."
- **Prioridad:** Inmediato · **Confianza:** Alta

### D-15 · Diferenciación operativa entre productos por lote y productos bajo pedido
- **Área según el agente:** DECISIONES Y REGLAS CONFIRMADAS
- **Tipo:** Regla de negocio · **Quién:** Kevin · **Hora:** 01:25:31
- **Detalle:** Se establece la diferencia funcional del flujo de inventario: para productos elaborados por lote (como donas), la encargada descarga insumos por la mañana y registra la entrada del lote terminado al stock, descontándose unidades terminadas en caja al vender; para sándwiches y salados preparados al instante, la cocina se abastece de insumos y la venta descuenta los insumos individuales según la receta.
- **Cita:** "Porque no, porque mira, te hago el ejemplo, pero no con un producto complejo como el PLP Sandy, sino con una dona... anota sus salidas, pero también agrega las entradas que son los productos que ella ha preparado... Y cuando el cajero ya inicie su jornada y venda una dona de fresa... esa dona ya estaría con su salida"
- **Prioridad:** Inmediato · **Confianza:** Alta

### D-16 · Abastecimiento matutino y conservación en mesas refrigeradas de cocina
- **Área según el agente:** COCINA, PANTALLAS E IMPRESIÓN
- **Tipo:** Regla de negocio · **Quién:** Kevin · **Hora:** 01:26:46
- **Detalle:** El personal del área de salados inicia su jornada abasteciéndose en el almacén de los insumos necesarios para el día (quesos, jamones, verduras, congelados) y registra una salida global matutina. Dichos insumos se conservan en las mesas refrigeradas y congeladoras propias de la estación de cocina. Si requieren insumos adicionales durante el día, acuden y registran la salida.
- **Cita:** "Eso quiere decir que al iniciar la jornada, el personal de Salado, que es que prepara el club Sandwich, tiene que ir al almacén y tienen que abastecerse para el día... en su área ellos tienen mesas refrigeradas, pues ellos guardan ellos guardan ahí todo lo todo su queso, su jamón, su lechuga, tienen congeladores también."
- **Prioridad:** Inmediato · **Confianza:** Alta

### D-17 · Manejo de remanentes diarios en cocina y declaración de merma
- **Área según el agente:** ALMACÉN, STOCK, RECETAS Y COMPRAS
- **Tipo:** Regla de negocio · **Quién:** Kevin · **Hora:** 01:27:36
- **Detalle:** Los insumos que sobran al culminar el turno en las mesas refrigeradas de cocina se mantienen almacenados allí para la producción del día siguiente. No se procesa una devolución física al almacén general a menos que el producto se deteriore o eche a perder, en cuyo caso se registra formalmente como merma.
- **Cita:** "o que se quede, si le sobra, que se quede para el día siguiente... Y si se malobra, es merma."
- **Prioridad:** Inmediato · **Confianza:** Alta

### D-18 · Envío pendiente de plantilla Excel con recetas y costeo de Caprichos
- **Área según el agente:** PENDIENTES DEL CLIENTE
- **Tipo:** Compromiso · **Quién:** Kevin · **Hora:** 01:27:36
- **Detalle:** Kevin explica que las recetas son fundamentales para calcular el costeo y la utilidad de cada producto de la carta. Manifiesta que cuenta con un archivo Excel con la información de recetas y costos, comprometiéndose a ordenarlo y completarlo para facilitárselo a José.
- **Cita:** "Yo tengo por ahí un Excel de recetas. Lo voy a yo voy a armar todas las recetas que tengo mientras tú eso que sea lo último que hagamos las recetas... Te voy a armar las recetas y ahí este ya cuando tenga toda la data lista te las paso."
- **Prioridad:** Próximo · **Confianza:** Alta

### D-19 · Aplazamiento de carga de recetas y trabajo con datos de prueba
- **Área según el agente:** PENDIENTES DEL DESARROLLADOR
- **Tipo:** Compromiso · **Quién:** José · **Hora:** 01:28:50
- **Detalle:** José y Kevin acuerdan que la alimentación definitiva de las recetas en la base de datos se dejará como última etapa del desarrollo. Mientras Kevin consolida el Excel con la información real, José programará y probará los módulos de recetas y almacén utilizando datos simulados o ficticios.
- **Cita:** "Sí, eso es lo que va a alimentar la la base de datos, pero sí Después me lo puede pasar. Por mientras voy a estar trabajando con datas así ficticias."
- **Prioridad:** Próximo · **Confianza:** Alta

### D-20 · Compra y control de pollo por unidades de filete de pechuga especial
- **Área según el agente:** ALMACÉN, STOCK, RECETAS Y COMPRAS
- **Tipo:** Dato del negocio · **Quién:** Kevin · **Hora:** 01:29:46
- **Detalle:** Kevin aclara que Caprichos no adquiere pollos enteros ni piezas mixtas (piernas o entrepiernas), sino exclusivamente filetes de pechuga limpios y cortados ("pecho especial"). José confirma que la gestión de entradas y salidas en el sistema se controlará directamente por número de filetes unitarios.
- **Cita:** "Nosotros lo compramos ya en filetes... Ya lo manejaríamos por por filetes. Entonces, no hay parte pecho, no hay parte pierna entre pierna, nada de eso. Solamente filete."
- **Prioridad:** Inmediato · **Confianza:** Alta

### D-21 · Módulo visual de inventario con porcentajes e insumos de cafetería
- **Área según el agente:** ALMACÉN, STOCK, RECETAS Y COMPRAS
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 01:28:50
- **Detalle:** José exhibe un módulo de stock en la maqueta donde se visualizan insumos habituales de cafetería (leche entera, leche sin lactosa, bebidas embotelladas, etc.) acompañados de un indicador porcentual del nivel disponible en inventario.
- **Cita:** "Acá también se va a poder visualizar su propio módulo, leche entera, leche sin lactosa, bebidas y el porcentaje."
- **Prioridad:** Próximo · **Confianza:** Alta

### D-22 · Gráficos y diagramas para reportes de ventas por mozo y producto
- **Área según el agente:** ADMINISTRATIVO Y ROLES
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 01:29:46
- **Detalle:** José revisa la sección de informes y ventas por mozo y por producto, proponiendo enriquecer la visualización de datos mediante gráficos y diagramas en lugar de tablas planas de texto.
- **Cita:** "Análisis. Bueno, acá es un poco de informe. Ventas por mozo, por producto. Ya. Esto de acá creo que sería mucho mejor con diagramas."
- **Prioridad:** Próximo · **Confianza:** Alta

### D-23 · Filtros para stock bajo y stock alto con historial de movimientos
- **Área según el agente:** ALMACÉN, STOCK, RECETAS Y COMPRAS
- **Tipo:** Pedido del cliente · **Quién:** Kevin · **Hora:** 01:30:57
- **Detalle:** Kevin solicita incorporar filtros rápidos para visualizar insumos en "stock bajo" y "stock alto", lo que facilitará la emisión oportuna de órdenes de compra. José añade que cada insumo mostrará su historial cronológico de entradas y salidas con fechas y cantidades.
- **Cita:** "Lo de lo de stock este sí me ayudaría bastante que sea stock bajo, un filtro, ¿no? todo lo que está en stock bajo, stock bajo, este stock alto, así para saber qué para hacer una orden de compra"
- **Prioridad:** Inmediato · **Confianza:** Alta

### D-24 · Logística de compras y centros de abastecimiento de Caprichos
- **Área según el agente:** ALMACÉN, STOCK, RECETAS Y COMPRAS
- **Tipo:** Dato del negocio · **Quién:** Kevin · **Hora:** 01:32:06
- **Detalle:** Kevin describe su circuito de abastecimiento: acude personalmente al Mercado de Productores de Abarrotes, Productores de Verduras y al Mercado de Frutas de San Luis. En Makro adquiere sacos de azúcar y harina por conveniencia geográfica cuando su vehículo particular no puede cargar más peso (su capacidad límite es de seis a ocho sacos); en Makro paga 20 soles de delivery y una diferencia de aproximadamente 10 soles adicionales por saco respecto a productores. Descarta Candy por precios excesivos.
- **Cita:** "Yo voy a productores de abarrotes, productores de verduras, también voy al mercado de frutas de San Luis. Eh, pocas veces compro en macro sacos de azúcar, harina por lo que está cerca... pero la capacidad de carro no es mucha, entonces para traer unos seis, ocho sacos lo mata el carro"
- **Prioridad:** Inmediato · **Confianza:** Alta

### D-25 · Catálogo de proveedores jerarquizado por insumo (A, B, C)
- **Área según el agente:** ALMACÉN, STOCK, RECETAS Y COMPRAS
- **Tipo:** Idea del cliente · **Quién:** Kevin · **Hora:** 01:32:06
- **Detalle:** Kevin solicita que el sistema permita registrar una terna de proveedores priorizada para cada insumo: Proveedor A (principal), Proveedor B (de contingencia) y Proveedor C, de modo que ante el desabastecimiento o fallo del proveedor habitual, el negocio pueda contactar inmediatamente a la siguiente alternativa.
- **Cita:** "pero podríamos tener proveedor A, proveedor B, proveedor C en orden de prioridades. En caso nos falle proveedor A, el proveedor B."
- **Prioridad:** Próximo · **Confianza:** Alta

### D-26 · Generación y envío de solicitudes de compra con un clic vía WhatsApp
- **Área según el agente:** ALMACÉN, STOCK, RECETAS Y COMPRAS
- **Tipo:** Pedido del cliente · **Quién:** Kevin · **Hora:** 01:32:06
- **Detalle:** Kevin pide con gran interés implementar un botón que permita enviar directamente por WhatsApp la orden de compra a los proveedores para los insumos en stock bajo. La función debe abrir una plantilla de mensaje predefinido y editable indicando la cantidad y la fecha programada de entrega (por ejemplo: "Hola, por favor necesito para su próxima visita 100 cajas de leche Gloria entera"). Señala que esto ahorraría un tiempo invaluable.
- **Cita:** "ayudaría demasiado demasiado, no sabes cuánto ayudaría que eh se puedan exportar de alguna manera las o con un solo con un clic enviar las solicitudes por WhatsApp... un botoncito para hacer las solicitudes de compra y vararías bastante directo a WhatsApp."
- **Prioridad:** Inmediato · **Confianza:** Alta

### D-27 · Arquitectura del catálogo de pedidos centrada en el insumo
- **Área según el agente:** ALMACÉN, STOCK, RECETAS Y COMPRAS
- **Tipo:** Pedido del cliente · **Quién:** Kevin · **Hora:** 01:33:32
- **Detalle:** Kevin subraya que la lista de pedidos de reposición debe estructurarse teniendo como eje central los insumos agotados y no los proveedores. Explica que un mismo proveedor distribuye productos diversos (como galletas Oreo, crema de leche, etc.), por lo que el sistema debe filtrar primero por insumo faltante y desde allí asociar el proveedor correspondiente.
- **Cita:** "pero sobre todo orientado sobre todo a los insumos, no tanto a los proveedores. O sea, que los insumos sean la eh la prioridad, ¿no? Que si el proveedor X me trae, o sea, no ordenarlos por proveedor, sino por insumo, así como está ahorita."
- **Prioridad:** Inmediato · **Confianza:** Alta

### D-28 · Semáforo de stock con parámetros mínimo, intermedio y máximo
- **Área según el agente:** ALMACÉN, STOCK, RECETAS Y COMPRAS
- **Tipo:** Regla de negocio · **Quién:** Kevin · **Hora:** 01:35:13
- **Detalle:** Se acuerda definir para cada insumo umbrales de stock mínimo, stock intermedio y stock máximo, activando un indicador semafórico visual: color verde cuando hay stock suficiente, naranja para stock regular o medio, y rojo para stock bajo crítico.
- **Cita:** "Sí, sí, porque con eso vamos a poder tener los indicadores de verde que hay stock, naranja que hay poco o que hay regular y y rojo que hay stock bajo. Con eso podemos tener esos indicadores ingresando esos parámetros."
- **Prioridad:** Inmediato · **Confianza:** Alta

### D-29 · Alertas por correo electrónico ante insumos en stock crítico
- **Área según el agente:** INFRAESTRUCTURA Y OPERACIÓN
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 01:35:13
- **Detalle:** José sugiere aprovechar la disponibilidad del dominio propio para configurar el envío automático de notificaciones de advertencia al correo de Kevin cuando un insumo crítico (como leche sin lactosa) alcance un nivel bajo. A Kevin le parece una funcionalidad muy útil y conveniente para no tener que revisar el sistema de forma permanente.
- **Cita:** "No, o sea, me refiero que a usted le llega una notificación de advertencia. Mira, el leche sin lácteos, eh, ya se va a acabar ya a como advertencias... Kevin Rosales: Ah, sería chévere... Sí, sería genial."
- **Prioridad:** Próximo · **Confianza:** Alta

### D-30 · Descarte de emisión de órdenes de compra mediante correo electrónico
- **Área según el agente:** APLAZADO, DESCARTADO O A FUTURO
- **Tipo:** Regla de negocio · **Quién:** Kevin · **Hora:** 01:35:13
- **Detalle:** Kevin descarta el uso del correo electrónico para tramitar pedidos a proveedores. Aclara que en el funcionamiento real de Caprichos todas las órdenes de compra y coordinaciones de suministros se gestionan única y exclusivamente a través de WhatsApp.
- **Cita:** "Ahí ya sí, pero por correo ahorita, actualmente no lo manejo la orden de compra por correo, solamente por WhatsApp, nada más. Todo."
- **Prioridad:** Inmediato · **Confianza:** Alta

### D-31 · Editor visual interactivo de la carta web desde el panel administrativo
- **Área según el agente:** CARTA WEB (cliente)
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 01:36:14
- **Detalle:** José muestra el módulo de diseño de la carta web donde el administrador puede reubicar productos, cambiar fotografías y editar descripciones directamente sobre la vista previa en pantalla, destacando que es un esquema mucho más ágil e intuitivo que editar mediante formularios y tablas tradicionales.
- **Cita:** "este es el diseño de carta que le había mencionado, que usted va a poder ingresar directamente al diseño de la carta y editarlo. ¿Quién sabe? Lo quiere cambiar de lugar. Eh, ¿quién sabe? Le quiere cambiar la foto. Él cambia la foto. Lo cambió. Más intuitivo que un formulario."
- **Prioridad:** Inmediato · **Confianza:** Alta

### D-32 · Descarte de filtros complejos y rangos de precio en la carta de comida
- **Área según el agente:** APLAZADO, DESCARTADO O A FUTURO
- **Tipo:** Regla de negocio · **Quién:** Kevin · **Hora:** 01:37:11
- **Detalle:** Kevin solicita prescindir de filtros complejos o búsquedas por rango de precios en la carta web, explicando que en gastronomía el cliente no compra como en un e-commerce de electrodomésticos o tecnología, ni descarta un plato si cuesta 12 soles en lugar de 10. Concluyen que basta con mantener la barra superior de categorías.
- **Cita:** "este no son tan necesarios porque eh no es como un e-commerce que va a buscar ah no es como un que vamos a comprar de repente relojes o productos que son muy similares y precios diferentes... Por categorías como está arriba y nada más. Nada más. Sí, nada más para evitarte todo."
- **Prioridad:** Inmediato · **Confianza:** Alta

### D-33 · Destacado y filtro de productos más vendidos en la carta web
- **Área según el agente:** CARTA WEB (cliente)
- **Tipo:** Idea del cliente · **Quién:** Kevin · **Hora:** 01:37:57
- **Detalle:** Kevin plantea que el único filtro o distintivo que realmente ayuda al comensal es una categoría o etiqueta de "Lo más vendido" (identificada con una estrella o indicador), permitiendo que clientes nuevos o indecisos elijan con confianza opciones probadas del menú.
- **Cita:** "Lo que sí puedes poner un filtro puede ser lo más vendido, ¿no? Eso ayuda mucho a la gente a pues que no ha probado a que pueda probar, que se vaya la segura entre comillas."
- **Prioridad:** Próximo · **Confianza:** Alta

### D-34 · Descarte de valoraciones y reseñas públicas en la carta virtual
- **Área según el agente:** APLAZADO, DESCARTADO O A FUTURO
- **Tipo:** Regla de negocio · **Quién:** Kevin · **Hora:** 01:38:59
- **Detalle:** Kevin rechaza implementar calificaciones o reseñas con estrellas públicas en los productos de la web. Argumenta que en productos elaborados al momento o transportados por delivery existen riesgos externos (como la crema chantillí derretida por el clima o una decoración movida por el traslado) que inducen a clientes a emitir calificaciones bajas injustas, perjudicando la reputación comercial del negocio.
- **Cita:** "Opiniones, porque no sé qué tan favorable sea, de verdad... a veces la bebida le puede llegar el chantillí derretido bajo. Entonces ahí ya nos arriesgaríamos una a una este valoración baja... En la web, dejarla tal como está. Este, sin opiniones"
- **Prioridad:** Inmediato · **Confianza:** Alta

### D-35 · Encuesta de posventa automática por WhatsApp dos horas después de la entrega
- **Área según el agente:** CHATBOT WHATSAPP
- **Tipo:** Pedido del cliente · **Quién:** Kevin · **Hora:** 01:40:15
- **Detalle:** Kevin propone programar un mensaje de satisfacción automatizado por WhatsApp que el bot envíe exactamente dos horas después de confirmado o entregado el pedido (tiempo idóneo para que el cliente ya haya consumido). El bot consultará cordialmente: "Hola. Queremos saber si tu pedido llegó todo bien y está todo en orden".
- **Cita:** "un mensaje de postventa eh por WhatsApp automático, sí, a las 2 horas después después de haber confirmado su pedido, que el bot le envíe automáticamente este, hola. Queremos saber si está si tu pedido llegó todo bien y está todo en orden, ¿no? Para poder este tener conocimiento, poder estar tranquilo algo."
- **Prioridad:** Inmediato · **Confianza:** Alta

### D-36 · Incentivo y redirección a Google Maps para opiniones positivas analizadas por IA
- **Área según el agente:** MARKETING, POSVENTA Y OPINIONES
- **Tipo:** Idea del cliente · **Quién:** Kevin · **Hora:** 01:41:39
- **Detalle:** Si el análisis de lenguaje natural del bot determina que la respuesta de posventa del cliente es positiva, el sistema le enviará automáticamente el enlace directo al perfil de Google Maps de Caprichos invitándolo a copiar su comentario a cambio de un beneficio (como un 25% de descuento en su siguiente pedido o participación en promociones), potenciando el posicionamiento orgánico y la reputación en Google Maps.
- **Cita:** "Y el cliente si responde un mensaje positivo, que el bot la IA lo analice. Si el mensaje es positivo, que automáticamente lo redirija. al al este al Google, a las opiniones de Google... copia y pégalo en este link y participa de y obtén un 25% de descuento en tu próximo PI"
- **Prioridad:** Inmediato · **Confianza:** Alta

### D-37 · Derivación interna y soporte humano ante incidencias o respuestas negativas
- **Área según el agente:** CHATBOT WHATSAPP
- **Tipo:** Pedido del cliente · **Quién:** Kevin · **Hora:** 01:41:39
- **Detalle:** En caso de que la respuesta del cliente a la posventa sea negativa, el bot tiene prohibido redirigirlo a Google Maps o redes públicas. El sistema debe responder indicando que transfiere el chat de inmediato a un asesor o encargado ("permíteme derivar esta conversación a un asesor para ver cómo te podemos ayudar"). El equipo contactará al cliente internamente para disculparse y, si amerita, reemplazar el producto defectuoso.
- **Cita:** "Si es negativa, le decimos al bot que enseguida lo estamos transfiriendo con una con un eh con un asesor... o con el encargado, algo así para que pueda darle una solución al inconveniente que tuvo, pero no enviarle para que lo comente en Google Maps, solamente Por interno lo manejamos, lo solucionamos por interno y ahí queda todo."
- **Prioridad:** Inmediato · **Confianza:** Alta

### D-38 · Envío automático de quejas y opiniones negativas al WhatsApp de gerencia
- **Área según el agente:** MARKETING, POSVENTA Y OPINIONES
- **Tipo:** Queja o problema actual · **Quién:** Kevin · **Hora:** 01:44:37
- **Detalle:** Kevin expone que en el día a día las quejas suelen quedarse en el personal de caja, quienes frecuentemente no las transmiten al grupo interno por falta de tiempo o carga laboral. Pide que el sistema envíe en tiempo real cualquier comentario negativo o reclamo a su WhatsApp personal o a un grupo de WhatsApp de administración para realizar seguimiento inmediato y corregir posibles fallas en la preparación o el servicio.
- **Cita:** "estas opiniones negativas muchas veces solamente lo sabe el cajero. Nosotros tenemos un grupo de opiniones donde el cajero y la cajera o la cajera deberían enviarlo, pero a veces no lo envían porque están ocupados... La idea sería esas opiniones negativas... que se envíen a un a mi WhatsApp, por ejemplo, o a un grupo de WhatsApp. ¿Para qué? para que uno les pueda dar seguimiento"
- **Prioridad:** Inmediato · **Confianza:** Alta

### D-39 · Ambientación y temas festivos configurables para la carta web
- **Área según el agente:** CARTA WEB (cliente)
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 01:46:01
- **Detalle:** José presenta una funcionalidad en el panel administrativo que permite personalizar globalmente la estética, colores y estilo visual de la carta virtual en fechas conmemorativas o festividades (como Halloween, Navidad o Día del Niño). Kevin aprueba con entusiasmo la idea, destacando que le gusta mucho.
- **Cita:** "Y también decoración, ¿quién sabe? Halloween... No, no, no. O sea, esto ustedes lo van a poder hacer. ¿Quién sabe? Es Navidad lo van lo va a cambiar usted directamente para personalizar las fiestas para y todos los clientes lo van a ver así. Kevin Rosales: Ah, no, está está chévere. Está chévere. Está chévere. Me gusta."
- **Prioridad:** Próximo · **Confianza:** Alta

### D-40 · Reorganización interactiva de categorías y productos en el panel de la carta
- **Área según el agente:** ADMINISTRATIVO Y ROLES
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 01:46:39
- **Detalle:** José muestra cómo ordenar interactivamente las categorías y productos de la carta mediante una vista previa dinámica en el panel de administración (por ejemplo, desplazar frappés hacia abajo, ubicar la categoría Ice en la primera posición o reordenar combos Dúo) sin necesidad de llenar tablas o formularios engorrosos.
- **Cita:** "Es más intuitivo porque no es un una tabla. En la tabla va a estar editando un formulario. Acá va a poder editarlo más intuitivo. ¿Quién sabe? Los frapés lo quieren mandar abajo, lo manda. ¿Quién sabe? Dúo no quiere que esté primero, lo manda. ¿Quién sabe? Ice quiere que esté primero y lo manda primerito a Ice y así lo va editando"
- **Prioridad:** Próximo · **Confianza:** Alta

### Sección del agente: Datos del negocio que se mencionaron
- Personal y funciones operativas:
  - Señorita encargada de producción matutina: elabora postres, pan pullman, gelatinas y retira insumos del almacén.
  - Personal de salados / cocina: prepara sándwiches al momento (como Club Sándwich) y se abastece de insumos en la mañana para sus mesas refrigeradas.
  - Repartidor de delivery principal: labora en el turno tarde/noche y asume la responsabilidad de almacenero, registrando salidas de insumos y entradas de mercadería.
  - Repartidor de delivery secundario: asiste solo una vez por semana y desconoce la distribución de los insumos en el almacén.
  - Supervisora del local: autorizada junto a Kevin para registrar mermas en el sistema.
  - Cajero / cajera: registra ventas y atiende comentarios iniciales de clientes en caja.
- Productos, vida útil y mermas:
  - Donas (por ejemplo donas de fresa): vida útil de 12 horas (máximo 1 día); lote diario típico de unas 10 unidades; remanente amanece en cero en el sistema y se clasifica como merma (se dona/regala, no se desecha a la basura).
  - Club Sándwich: producto preparado al instante con filete entero de pechuga de pollo (pecho especial), no con pollo deshilachado.
  - Receta unitaria del Club Sándwich: 4 rebanadas de pan de molde pullman (un pan horneado rinde para aprox. 7 Club Sándwich), 1 filete de pollo (a veces 1.5 si es pequeño), 2 rebanadas de queso edam, 2 rebanadas de jamón inglés, tocino culinario, tomate y lechuga.
  - Filetes de pollo cocidos (mise en place nocturno): típicamente quedan 4 filetes al cierre; se refrigeran en un táper de acero inoxidable; vida útil máxima de 1 día; prioridad de consumo en el primer turno del día siguiente.
  - Cafetería y bebidas: cappuccino (leche entera, leche vaporizada/evaporada), leche entera, leche sin lactosa, frappés (con crema chantillí decorativa), línea de bebidas Ice y combos Dúo.
- Proveedores, compras y logística:
  - Compra de pollo: se adquieren aprox. 100 filetes cada 3 días en cortes de pechuga especial (no compran pollo entero ni partes con hueso como piernas o entrepiernas).
  - Centros de compra habituales: Mercado de Productores de Abarrotes, Mercado de Productores de Verduras y Mercado de Frutas de San Luis.
  - Tienda Makro: compra ocasional de sacos de azúcar y harina por conveniencia de transporte; el auto de Kevin soporta de 6 a 8 sacos como máximo; Makro cobra S/ 20 de delivery y sus sacos tienen un sobrecosto de aprox. S/ 10 respecto a los productores.
  - Distribuidora Candy: expresamente descartada por precios exorbitantes.
  - Marca de leche: Leche Gloria entera (pedidos habituales de 100 cajas).
  - Otros insumos habituales de reposición: galletas Oreo, crema de leche, fresas, azúcar, vasos descartables, sorbetes, tapas y servilletas.
- Parámetros operativos y comerciales:
  - Alerta semafórica de inventario: verde (stock suficiente), naranja (stock regular o medio) y rojo (stock bajo crítico).
  - Mensaje automático de posventa: programado a las 2 horas tras confirmar la entrega del pedido.
  - Promoción por reseña en Google Maps: 25% de descuento en el próximo pedido del cliente o participación en promociones.
- Infraestructura y equipamiento físico del local:
  - Mesas refrigeradas en la estación de salados para conservación diaria de jamón, queso, verduras e insumos frescos.
  - Congeladoras en cocina y área de producción.
  - Táperes de acero inoxidable para resguardo de alimentos cocidos refrigerados.



### Sección del agente: Enlaces, páginas o sistemas nombrados
- restaurant.pe ("restaurant.p"): software para restaurantes citado por Kevin como modelo referencial de flujo probado de almacén (entradas, salidas, transferencias y mermas).
- WhatsApp: plataforma indispensable para la recepción y envío de solicitudes de compra a proveedores con un solo clic, envío de encuestas de posventa a clientes y alertas de quejas a la gerencia.
- Google Maps: sistema de posicionamiento local y reseñas públicas al cual redirigir clientes con experiencias de compra positivas.
- Makro ("macro"): tienda mayorista utilizada para la compra de azúcar y harina.
- Candy: distribuidora comercial nombrada y rechazada por costos altos.
- Mercado de Productores de Abarrotes, Mercado de Productores de Verduras y Mercado de Frutas de San Luis: mercados de abasto mencionados para compras presenciales.
- Leche Gloria: marca de leche requerida en las órdenes de compra.
- Galletas Oreo: insumo de marca solicitado a distribuidores especializados.



### Sección del agente: Ruido descartado
- Intervenciones domésticas breves y ajenas al proyecto durante la videollamada: Kevin solicitando a su entorno que le alcancen un chaleco (línea 208) y despidiéndose de un tercero llamado Jeffrey (línea 236).



### Sección del agente: Cobertura
- El tramo examinado abarca las 381 líneas de transcripción de segmento-d.txt (marcas de tiempo 01:12:58 a 01:46:39). El contenido útil y sustantivo se extiende de forma continua a lo largo de prácticamente todo el texto (aproximadamente 370 líneas activas). No se omitió ninguna sugerencia, idea, pedido, pendiente, referencia ni regla de negocio expresada en la conversación.


## Tramo E

### E-01 · Personalización temática de la carta web para festividades
- **Área según el agente:** CARTA WEB (cliente)
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 01:46:39
- **Detalle:** José muestra que desde el panel administrativo el cliente podrá cambiar de forma directa y visual el diseño, colores y ambientación de la carta digital según festividades especiales (Navidad, Día del Niño, aniversario). Al hacer el cambio, todos los comensales verán la carta tematizada de forma inmediata sin necesidad de tocar código.
- **Cita:** "Es Navidad lo van lo va a cambiar usted directamente para personalizar las fiestas para y todos los clientes lo van a ver así."
- **Prioridad:** Próximo · **Confianza:** Alta

### E-02 · Reordenamiento visual e interactivo de categorías en el panel
- **Área según el agente:** ADMINISTRATIVO Y ROLES
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 01:46:39
- **Detalle:** José explica que la administración del orden de las categorías de la carta es visual e intuitiva, alejándose de formularios o tablas tradicionales. Se pueden mover bloques arriba o abajo fácilmente (por ejemplo, mandar Frapés al fondo, colocar la categoría de cafés fríos / Ice en primer lugar o crear una sección destacada para el aniversario del local).
- **Cita:** "Es más intuitivo porque no es un una tabla. En la tabla va a estar editando un formulario. Acá va a poder editarlo más intuitivo. ¿Quién sabe? Los frapés lo quieren mandar abajo, lo manda."
- **Prioridad:** Próximo · **Confianza:** Alta

### E-03 · Reordenamiento de productos dentro de una misma categoría
- **Área según el agente:** ADMINISTRATIVO Y ROLES
- **Tipo:** Pedido del cliente · **Quién:** Kevin · **Hora:** 01:46:39
- **Detalle:** Kevin consulta y solicita que el sistema permita definir el orden de aparición de los productos específicos dentro de una categoría (por ejemplo, priorizar que aparezca primero el chocolate o el waffle). José confirma que el panel dispone de controles con flechas para reordenar cada ítem individualmente (ejemplo: subir Iced Coffee al primer lugar).
- **Cita:** "también el orden de los productos, ¿no? De una categoría. O sea, que salga primero la chocolate, ¿no? El cofre."
- **Prioridad:** Inmediato · **Confianza:** Alta

### E-04 · Módulo administrativo para edición de paleta de colores
- **Área según el agente:** ADMINISTRATIVO Y ROLES
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 01:47:19
- **Detalle:** José destaca que el sistema incluye un módulo dedicado de paleta de colores en el panel de control. Si al cliente no le satisface la combinación de colores predeterminada, podrá ajustarla y personalizarla directamente según sus preferencias de marca.
- **Cita:** "Ni quién sabe no le gusta la paleta de colores. Acá mismo hay un módulo paleta de colores. Ustedes lo editan."
- **Prioridad:** Próximo · **Confianza:** Alta

### E-05 · Depuración de secciones innecesarias heredadas de restaurant.pe
- **Área según el agente:** APLAZADO, DESCARTADO O A FUTURO
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 01:47:19
- **Detalle:** José analiza módulos confusos presentes en la plataforma anterior restaurant.pe (tales como "Datos de la empresa" y "Condición servicio externo"), concluyendo que carecen de intuición y no aportan valor operativo práctico, por lo que propone eliminarlos de la nueva plataforma. Kevin coincide plenamente en que no son necesarios.
- **Cita:** "Dat de la empresa. Conición servicio externo. Creo que no, no sirve para nada."
- **Prioridad:** Inmediato · **Confianza:** Alta

### E-06 · Configuración y gestión de impresoras de producción por red local
- **Área según el agente:** COCINA, PANTALLAS E IMPRESIÓN
- **Tipo:** Pedido del cliente · **Quién:** Kevin · **Hora:** 01:48:14
- **Detalle:** Kevin recalca que la administración de impresoras para áreas de producción es un componente indispensable del sistema. José aclara que la conexión con las impresoras térmicas se efectuará a través de la red local (LAN) del café, requiriendo únicamente conocer el modelo de cada equipo. Kevin ratifica que la red y los equipos son plenamente manejables.
- **Cita:** "lo de las impresoras sí es este importante, ¿no? Claro, tú lo vas a modificar ahí. Impresoras, de producción."
- **Prioridad:** Inmediato · **Confianza:** Alta

### E-07 · Definición de moneda única en Soles peruanos
- **Área según el agente:** DECISIONES Y REGLAS CONFIRMADAS
- **Tipo:** Regla de negocio · **Quién:** Kevin · **Hora:** 01:48:14
- **Detalle:** Ante la consulta de José sobre la configuración monetaria del sistema, Kevin confirma de forma terminante que todas las listas de precios, comandas, cuentas y cobros operan exclusivamente en soles peruanos (PEN), sin requerimiento de gestión multimoneda.
- **Cita:** "Salones, moneda, puros soles, ¿no? Sí, sol."
- **Prioridad:** Inmediato · **Confianza:** Alta

### E-08 · Omisión de módulo tributario y Kardex contable para SUNAT
- **Área según el agente:** APLAZADO, DESCARTADO O A FUTURO
- **Tipo:** Regla de negocio · **Quién:** Kevin · **Hora:** 01:49:18
- **Detalle:** José indaga si el café genera Kardex o declaraciones tributarias mensuales para SUNAT a través del software. Kevin explica que no se necesita incorporar esa lógica en el sistema por ahora, debido a que él efectúa la declaración mensual directamente en el portal web de SUNAT, validando allí las propuestas prellenadas de compras y ventas de la empresa.
- **Cita:** "no es necesario, ahorita no es necesario porque yo lo trabajo de la misma web de la SUNAT, ahí mismo acepto la propuesta de compra y de ventas que la Sunap este tiene registrada"
- **Prioridad:** Futuro · **Confianza:** Alta

### E-09 · Configuración de tipos de comprobante y Nota de Venta por defecto
- **Área según el agente:** DECISIONES Y REGLAS CONFIRMADAS
- **Tipo:** Pedido del cliente · **Quién:** Kevin · **Hora:** 01:49:18
- **Detalle:** Kevin establece como regla de negocio estricta que al cobrar se disponga de tres alternativas de comprobante: Boleta, Factura y Nota de venta. Exige que todas las ventas salgan configuradas por defecto como Nota de Venta; en caso de que un cliente solicite expresamente boleta o factura, el cajero deberá realizar la modificación de forma manual.
- **Cita:** "que por defecto todas las ventas se hagan con nota de venta, en caso del cliente solicite factura o boleta, que manualmente lo haga el cambio, pero por defecto que vaya nota de venta"
- **Prioridad:** Inmediato · **Confianza:** Alta

### E-10 · Postergación de facturación electrónica directa con SUNAT
- **Área según el agente:** APLAZADO, DESCARTADO O A FUTURO
- **Tipo:** Idea del cliente · **Quién:** Kevin · **Hora:** 01:49:18
- **Detalle:** Kevin aclara que la sincronización automática de facturas y boletas electrónicas directamente hacia los servidores de SUNAT no se requiere en la fase inicial, acordando evaluar más adelante su conexión e integración directa.
- **Cita:** "Este y pues después vemos cómo este asociar el tema de factura y boleta con SUNAT para que se emite directo."
- **Prioridad:** Futuro · **Confianza:** Alta

### E-11 · Módulo de gestión de usuarios y jerarquía de permisos
- **Área según el agente:** ADMINISTRATIVO Y ROLES
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 01:50:27
- **Detalle:** José expone el funcionamiento del módulo de usuarios, orientado a crear cuentas de empleados, editarlas y desactivar al personal que cese sus funciones. Se establece la regla de seguridad de que únicamente el administrador tendrá autorización para cambiar nombres y usuarios; el personal operativo únicamente podrá cambiar su foto de perfil y cerrar su sesión.
- **Cita:** "va a editar, desactivar usuario, quién no trabaja, ya lo desactiva... solamente el admin debería cambiar su su dato, es n más su foto y su cerrar sesión."
- **Prioridad:** Próximo · **Confianza:** Alta

### E-12 · Editor visual de plano de mesas y distribución física del local
- **Área según el agente:** MESAS, PEDIDOS EN SALA Y RESERVAS
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 01:50:27
- **Detalle:** José presenta la interfaz interactiva para el diseño del plano del salón. Aunque actualmente atienden con equipos de cómputo fijos, la herramienta permite agregar mesas, desactivarlas y reorganizarlas arrastrándolas. También permite ubicar puntos estructurales de referencia como la barra, la puerta de ingreso, los servicios higiénicos y la salida de cocina/luz, facilitando la ubicación espacial de los mozos al tomar comandas.
- **Cita:** "agregar mesa, desactivar mesa. Puede agregar una mesa más acá y lo mueve. Y según el orden, la entrada, ¿quién se va a otro lado? El baño luz de la cocina, ¿ya? Y según esto lo va a poder ver el mozo"
- **Prioridad:** Próximo · **Confianza:** Alta

### E-13 · Centro de notificaciones generales en panel administrativo
- **Área según el agente:** ADMINISTRATIVO Y ROLES
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 01:50:27
- **Detalle:** José plantea incorporar una sección centralizada de notificaciones en el panel administrativo para alertar a los usuarios sobre eventos importantes de la operación o mensajes del sistema.
- **Cita:** "Y notificaciones acá... Mejor todavía un poco más general. ¿Quién sabe con notificaciones para usuario y su y su perfil?"
- **Prioridad:** Próximo · **Confianza:** Media

### E-14 · Definición de los cinco requisitos no negociables de la plataforma
- **Área según el agente:** INFRAESTRUCTURA Y OPERACIÓN
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 01:51:29
- **Detalle:** José establece cinco condiciones operativas indispensables que la arquitectura tecnológica del sistema debe cumplir rigurosamente: 1) Disponibilidad permanente (alta disponibilidad), 2) Procesamiento de pedidos en tiempo real e instantáneo, 3) Integridad y seguridad de la información corporativa, 4) Impresión local fiable en el establecimiento, y 5) Costos fijos predecibles mes a mes sin variaciones imprevistas.
- **Cita:** "cinco cosas que no pueden fallar claramente. Siempre disponible, pedidos al instante, información segura, imprimir en local y costos claros que no varíe en mes tras mes."
- **Prioridad:** Inmediato · **Confianza:** Alta

### E-15 · Adopción de VPS propio en la nube frente a esquemas serverless
- **Área según el agente:** DECISIONES Y REGLAS CONFIRMADAS
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 01:51:29
- **Detalle:** José analiza dos propuestas de infraestructura para alojar el sistema: la Opción A (un Servidor Privado Virtual / VPS propio alquilado) y la Opción B (plataforma serverless en Vercel). Descarta Vercel por imponer límites en su capa gratuita y generar costos variables irregulares en planes de pago. Defiende el VPS por ofrecer tarifa mensual fija, escalabilidad vertical, control total del código fuente y recursos garantizados (RAM, CPU, almacenamiento) que evitan saturaciones ante picos de demanda.
- **Cita:** "Opción A, una BPS, un servicio propio alquilado. ventajas, costo fijo, predecible, todo en un solo lugar puede ir escalando eh verticalmente sin causas ni límites por cantidad de pedido."
- **Prioridad:** Inmediato · **Confianza:** Alta

### E-16 · Selección formal de Contabo como proveedor de VPS
- **Área según el agente:** DECISIONES Y REGLAS CONFIRMADAS
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 01:57:50
- **Detalle:** José recomienda formalmente contratar la máquina virtual con el proveedor Contabo ("Contable"), destacando su paquete de prestaciones: 8 GB de memoria RAM, 4 vCPU, 100 GB de disco SSD, copias de seguridad automáticas (snapshots) y transferencia de datos ilimitada. Todo esto bajo una tarifa promocional por 24 meses de aproximadamente $5 a $6 mensuales (ajustándose a $8-$9 tras la promoción). Kevin aprueba la propuesta.
- **Cita:** "uno de mis proveedores que más confío es el de Contable... $ al mes y de ahí sube ocho después de los dos meses. Esa era una buena promoción y lo bueno es que tiene mucho espacio. Tiene 8 de RAM, 4 de CPU, 100 GB de SSD, así que tiene almacenamiento hasta para rato."
- **Prioridad:** Inmediato · **Confianza:** Alta

### E-17 · Vulnerabilidad operativa por cortes recurrentes de internet en horas punta
- **Área según el agente:** INFRAESTRUCTURA Y OPERACIÓN
- **Tipo:** Queja o problema actual · **Quién:** Kevin · **Hora:** 01:55:42
- **Detalle:** Kevin destaca que, aunque el servidor en la nube mantenga un 99% de operatividad, la vulnerabilidad real radica en el servicio de internet del establecimiento físico. Advierte que la conexión local suele colapsar durante días festivos, feriados y fechas de máxima concurrencia debido a la congestión de la red en la zona, dejando al restaurante desprotegido en sus momentos de mayor venta.
- **Cita:** "el internet va a fallar y ahí olvídate. Eso era uno de los problemas por el cual nos pasamos de hola restaurar. P. El internet, usualmente, ¿cuándo falla el internet? Cuando hay más demanda también. O sea, fechas célebres, días festivos, que todo está sobrecargado, colapsa."
- **Prioridad:** Inmediato · **Confianza:** Alta

### E-18 · Colapso operativo y pérdida de control por falta de sistema offline
- **Área según el agente:** INFRAESTRUCTURA Y OPERACIÓN
- **Tipo:** Queja o problema actual · **Quién:** Kevin · **Hora:** 01:56:41
- **Detalle:** Kevin relata la traumática experiencia vivida al usar software netamente web (como Hola Click): al cortarse el internet, el negocio quedaba a la deriva y debían recurrir a comandas manuales en papel. Esto provocaba descontrol administrativo absoluto, pérdida de métricas y auditoría de ventas, lentitud en la atención y una crisis generalizada en la que el personal operaba en "modo supervivencia".
- **Cita:** "nos quedamos sin internet y pues nosotros nos quedamos a la deriva. ¿Cómo procesamos pedidos? de forma manual, así lo hacíamos, pero no es la idea porque ahí se pierde todo rastro ya de lo que vendría siendo eh control y y el monitoreo de ventas, todo se pierde. Se ralentiza el trabajo, todo entra en un modo supervivencia"
- **Prioridad:** Inmediato · **Confianza:** Alta

### E-19 · Exigencia de continuidad operativa local sin conexión para sala, caja y cocina
- **Área según el agente:** INFRAESTRUCTURA Y OPERACIÓN
- **Tipo:** Pedido del cliente · **Quién:** Kevin · **Hora:** 01:54:38
- **Detalle:** Kevin pregunta y exige como condición operativa indispensable que, si se interrumpe el acceso a internet, los mozos puedan continuar registrando comandas, la cajera continúe facturando y procesando cobros, y las pantallas de cocina mantengan la recepción de pedidos operando de forma 100% autónoma en la red local.
- **Cita:** "en caso de que el internet se vaya, el internet local... el mozo va a poder seguir procesando pedidos, la cajera va a seguir poder procesando pedidos, las pantallas de cocina se van a poder seguir viendo de forma local."
- **Prioridad:** Inmediato · **Confianza:** Alta

### E-20 · Diseño de arquitectura local con réplica y cola de sincronización diferida
- **Área según el agente:** INFRAESTRUCTURA Y OPERACIÓN
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 01:55:42
- **Detalle:** José asimila el requerimiento planteado por Kevin basándose en el funcionamiento de restaurant.pe y propone estructurar una solución mediante una aplicación de escritorio o instancia local con cola de sincronización. De este modo, ante una desconexión, la operación se retiene localmente en cola sin interrumpir las ventas y, en cuanto se restablece el internet, los pedidos acumulados se transmiten de forma automática hacia el VPS en la nube.
- **Cita:** "Le réplica de manera local... Lo mantenga todo local y hasta que vuelva al internet lo envíe recién lo mantiene en una cola. Ya, ya sé cómo es eso."
- **Prioridad:** Próximo · **Confianza:** Alta

### E-21 · Compromiso de estudiar la arquitectura de contingencia sin conexión
- **Área según el agente:** PENDIENTES DEL DESARROLLADOR
- **Tipo:** Compromiso · **Quién:** José · **Hora:** 01:57:50
- **Detalle:** José asume expresamente el compromiso técnico de evaluar a detalle la mejor alternativa arquitectónica (aplicación de escritorio, base de datos local y colas de sincronización) para garantizar la continuidad operativa ante caídas del servicio de internet.
- **Cita:** "Sí, esa parte sí lo voy a analizar para una mejor solución."
- **Prioridad:** Inmediato · **Confianza:** Alta

### E-22 · Antecedentes de desincronización y fallos de comanda en restaurant.pe
- **Área según el agente:** INVESTIGAR O REVISAR (referencias)
- **Tipo:** Queja o problema actual · **Quién:** Kevin · **Hora:** 01:59:03
- **Detalle:** Kevin comparte que en restaurant.pe, pese a contar con aplicación de escritorio sincronizada periódicamente con el servidor central, en ocasiones ocurrían errores de sincronización o bloqueos por timeout que impedían que las órdenes llegaran a las comandas de producción. José toma nota del caso para diseñar un mecanismo de reconexión resiliente con reintentos controlados y preservación de la última copia local coherente.
- **Cita:** "a veces ha pasado problemas que no se sincronizaba por x y motivo, no sé, y este había errores, ¿no?, que no llegaban pedidos a la cumanda, cosas así."
- **Prioridad:** Próximo · **Confianza:** Alta

### E-23 · Descarte de software dependiente al 100% de conexión web
- **Área según el agente:** APLAZADO, DESCARTADO O A FUTURO
- **Tipo:** Regla de negocio · **Quién:** Kevin · **Hora:** 02:00:05
- **Detalle:** Kevin y José ratifican que los sistemas de punto de venta que funcionan exclusivamente en la nube sin cliente local ni tolerancia a fallas de red (como Hola Click) quedan completamente descartados para el funcionamiento físico del local de Caprichos.
- **Cita:** "En cambio, hola, click como es web, sí o sí tienes que tener... Claro, todo netamente web."
- **Prioridad:** Inmediato · **Confianza:** Alta

### E-24 · Adquisición prioritaria del dominio institucional caprichos.pe
- **Área según el agente:** DECISIONES Y REGLAS CONFIRMADAS
- **Tipo:** Pedido del cliente · **Quién:** Kevin · **Hora:** 02:00:05
- **Detalle:** José propone la compra del dominio `caprichos.pe` en Punto.pe (NIC Perú) por una inversión anual de 110 soles, explicando que servirá para consolidar la marca corporativa y habilitar el despacho de correos electrónicos transaccionales. Kevin da su aprobación inmediata y pide concretar la compra cuanto antes para reservarlo y evitar que terceros lo tomen.
- **Cita:** "El dominio se pagaba 110 en punto en un solo paga una vez al año y esto va a servir eh para lo que es los envíos de correos para que tenga su propio marca, su propio branding... Capricho.pe ahí queda. Hay que comprar ese dominio más bien ya cuando tú puedas este para reservarlo."
- **Prioridad:** Inmediato · **Confianza:** Alta

### E-25 · Rechazo a la compra del dominio comercial .com por especulación
- **Área según el agente:** APLAZADO, DESCARTADO O A FUTURO
- **Tipo:** Decisión y regla del cliente · **Quién:** Kevin · **Hora:** 02:01:07
- **Detalle:** José informa que el dominio `caprichos.com` se encuentra en manos de un revendedor que exige precios desorbitados. Kevin rechaza de manera tajante entrar en negociaciones o pagar tarifas especulativas, argumentando que "Caprichos" es una denominación genérica y que la extensión territorial `.pe` satisface plenamente sus necesidades comerciales en Lima.
- **Cita:** "No, no es que esté caro, sino que alguien ya lo tiene y él lo revende. Ay, no. Sí, pues ya cuánto querrá. No, no, ni negociar con él... no es un nombre pues este no es un nombre exclusivo, ¿no? Está bien. Capricho.pe ahí queda."
- **Prioridad:** Inmediato · **Confianza:** Alta

### E-26 · Registro de cuenta corporativa para gestión de dominios en Punto.pe
- **Área según el agente:** INFRAESTRUCTURA Y OPERACIÓN
- **Tipo:** Compromiso · **Quién:** José · **Hora:** 02:01:07
- **Detalle:** José explica que la adquisición del dominio en Punto.pe exige crear un perfil con correo electrónico y vincular tarjeta de pago. Kevin autoriza a José a crear el usuario en la plataforma con el correo corporativo del negocio, asignarle una contraseña temporal y luego proporcionársela a Kevin para que este formalice el pago con su tarjeta bancaria.
- **Cita:** "Aquí está el correo. Ya le lo creas y le pones una contraseña y de ahí me lo pasas. Pero es el correo o por Ajá. porque creo que tienes que crear usuario para comprar el dominio."
- **Prioridad:** Inmediato · **Confianza:** Alta

### E-27 · Entrega del correo institucional para administración del dominio
- **Área según el agente:** PENDIENTES DEL CLIENTE
- **Tipo:** Compromiso · **Quién:** Kevin · **Hora:** 02:02:34
- **Detalle:** Kevin se compromete y procede a entregar la dirección de correo electrónico corporativo empleada para las gestiones de la empresa (Caprichos Campoy / grupo) con el propósito de centralizar las compras de infraestructura y dominio web.
- **Cita:** "Sí, ya. Pues listo. Este te paso correo. Es Capricho Campoy, ¿no? Este grupo... Te pasé el correo."
- **Prioridad:** Inmediato · **Confianza:** Alta

### E-28 · Confirmación de WhatsApp Business Cloud API oficial con chip exclusivo
- **Área según el agente:** CHATBOT WHATSAPP
- **Tipo:** Dato del negocio · **Quién:** Kevin · **Hora:** 02:02:34
- **Detalle:** José consulta por las características técnicas de la línea de WhatsApp. Kevin confirma que cuentan con la API oficial de Meta (WhatsApp Business Cloud API). La cuenta está asociada a una tarjeta SIM (chip) física que no se utiliza para llamadas de voz ni uso particular, destinada en exclusiva para el tráfico del chatbot.
- **Cita:** "A ver, uno que me da curiosidad, el lápiz de WhatsApp es el API mismo de meta. Sí, de metes con un chip que no se usa. Ni sé dónde está ese chip. Sí, pero no no se usa para para WhatsApp. No solamente no se usa para llamadas, solamente para WhatsApp."
- **Prioridad:** Inmediato · **Confianza:** Alta

### E-29 · Plataforma actual del bot creada por Josué mediante Antigravity Pro
- **Área según el agente:** CHATBOT WHATSAPP
- **Tipo:** Dato del negocio · **Quién:** Kevin · **Hora:** 02:03:46
- **Detalle:** Kevin revela que la solución de chatbot actual fue implementada por un desarrollador externo llamado Josué empleando la herramienta Antigravity bajo una suscripción Pro costeada por Caprichos. Con el tiempo, Kevin ha continuado ajustando y optimizando el flujo de atención por su cuenta.
- **Cita:** "el muchacho porque dice que la misma le creó la plataforma, pero de ahí la plataforma lo fuimos poco a poco... Te voy a pasar también ahorita lo que es el el bot en panel administrativo del bot para que lo revises para que veas cómo está lo del antigravity."
- **Prioridad:** Inmediato · **Confianza:** Alta

### E-30 · Evaluación comparativa de modelos de lenguaje para el bot (ChatGPT, Gemini o alternativa asiática)
- **Área según el agente:** INVESTIGAR O REVISAR (referencias)
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 02:03:46
- **Detalle:** José expone que evaluará costos, velocidad, calidad interpretativa y seguridad entre la API de ChatGPT (OpenAI), Google Gemini o una alternativa china (DeepSeek), con el objetivo de presentar a Kevin una comparativa presupuestaria y funcional que optimice el rendimiento del bot.
- **Cita:** "lo que me podría servir a mí es también la una API, pero la API de ahí tendría que ver entre precios y calidad y seguridad y sale una propuesta entre lápiz de CH GPT o de Yemina o una china porque vamos a necesitar una pip de ella para el chat"
- **Prioridad:** Próximo · **Confianza:** Alta

### E-31 · Optimización financiera mediante flujos híbridos en WhatsApp
- **Área según el agente:** CHATBOT WHATSAPP
- **Tipo:** Idea del desarrollador · **Quién:** José · **Hora:** 02:04:49
- **Detalle:** José explica que la razón del elevado consumo económico en el bot anterior radicaba en someter cada mensaje al modelo de IA generativa. Plantea como solución estructurar la carta y selección de pedidos con botones y formularios nativos de WhatsApp (sin costo de IA), restringiendo el uso del LLM únicamente a brindar sugerencias culinarias y responder dudas abiertas que requieran lenguaje natural. De esta manera, una recarga pequeña de tokens podrá durar hasta seis meses.
- **Cita:** "en el formulario que yo había puesto, no es no es IA, eso es el lo mismo que hace Meta. No es IA... IA solamente se va Sí, se va a ahorrar bastante la IA. solamente se va a usar para sugerencias y ahí se tiene que entrenar la ella para que no diga cosas que no son"
- **Prioridad:** Inmediato · **Confianza:** Alta

### E-32 · Consumo descontrolado de saldo API tras migración a GPT-4o
- **Área según el agente:** CHATBOT WHATSAPP
- **Tipo:** Queja o problema actual · **Quién:** Kevin · **Hora:** 02:04:49
- **Detalle:** Kevin relata que antes utilizaban el modelo económico `gpt-4o-mini`, pero el desarrollador Josué lo reemplazó por un modelo superior o Pro (`gpt-4o`) para intentar resolver incidencias. Debido a que el bot reenviaba todo el tráfico conversacional hacia la IA sin filtros, el crédito se agotó rápidamente, registrando un gasto imprevisto de casi $10 USD en tan solo tres días.
- **Cita:** "estábamos con el GP GP4 mini y último... el muchacho Josué le hizo el cambio, no sé porque tenía problemas. Le hice cambio a a la otra versión Pro, creo, o una GPO4 no más... en 3 días consumió $10, casi $."
- **Prioridad:** Inmediato · **Confianza:** Alta

### E-33 · Compromiso de transferencia de prompts y reglas de contexto del bot
- **Área según el agente:** PENDIENTES DEL CLIENTE
- **Tipo:** Compromiso · **Quién:** Kevin · **Hora:** 02:05:54
- **Detalle:** Kevin se compromete a organizar, depurar y entregar a José el conjunto de directrices, prompts de sistema y vocabulario que ha venido entrenando en el asistente virtual para que comprenda con criterio las solicitudes de los clientes limeños, facilitando su reutilización en el nuevo chatbot.
- **Cita:** "Eso es lo que te puedo pasar porque más o menos ya estamos entrenando la IA porque tú sabes que ahorita la IA te ha respondido y te ha te ha tratado de este decifrar las palabras, ¿no? Con criterio. Entonces ya está tiene algo. Voy a ir puliéndolo para todo eso ya pasártelo y y lo puedas acoplar"
- **Prioridad:** Próximo · **Confianza:** Alta

### E-34 · Despliegue del bot actual en servidor privado sin nombre de dominio
- **Área según el agente:** INVESTIGAR O REVISAR (referencias)
- **Tipo:** Dato del negocio · **Quién:** José · **Hora:** 02:05:54
- **Detalle:** Al observar en vivo la pantalla del panel administrativo del bot compartida por Kevin, José descubre que está montado sobre un servidor VPS que responde únicamente en una dirección IP de red privada sin dominio web asignado. Constata además que el proyecto de código fuente fue programado con Antigravity en una computadora física local y posteriormente subido a dicha máquina.
- **Cita:** "Ya, mira, veo que está una BPS. No tienen otro acceso. Mira, en acá es una red privada, no tiene dominio. Mm, el código fuente tiene esta web porque el antigravity no trabaja directamente con esto, sino trabaja directamente con un con un proyecto y ya el proyecto lo sube acá."
- **Prioridad:** Inmediato · **Confianza:** Alta

### E-35 · Regla de retención de historial de chat limitado a 10-15 mensajes
- **Área según el agente:** CHATBOT WHATSAPP
- **Tipo:** Regla de negocio · **Quién:** Kevin · **Hora:** 02:07:02
- **Detalle:** Kevin detalla el protocolo de gestión de memoria del bot: al culminar la jornada, los mensajes del día pasan automáticamente de la vista "Hoy" a "Todos". Para controlar el consumo de tokens y la memoria operativa, la IA únicamente retiene en contexto activo los últimos 10 a 15 mensajes de la conversación, archivando el historial anterior. Kevin planea solicitar una función de búsqueda para consultar conversaciones archivadas.
- **Cita:** "se pasan de los mensajes de hoy a todos y ahorita solamente está recordando en historial los últimos como que los últimos 10, 15 mensajes nada más. Pero los demás mensajes creo que los archiva y ahorita todavía tengo que pedirle al asistente que cree una opción para poder consultar los mensajes anteriores"
- **Prioridad:** Próximo · **Confianza:** Alta

### E-36 · Registro persistente de ubicación GPS, celular y nombre del cliente
- **Área según el agente:** CHATBOT WHATSAPP
- **Tipo:** Regla de negocio · **Quién:** Kevin · **Hora:** 02:07:02
- **Detalle:** Kevin resalta que, al margen del archivado de mensajes antiguos, la base de datos almacena indefectiblemente tres atributos esenciales de cada comensal: sus coordenadas geográficas GPS (para delivery), su número telefónico de celular y su nombre, datos valiosos incluso tratándose de usuarios nuevos no registrados.
- **Cita:** "lo que sí guarda es el GPS, el número solar y el nombre, porque a veces son usuarios que no tenemos número solar ni nombre. Eso es lo que sí guarda."
- **Prioridad:** Inmediato · **Confianza:** Alta

### E-37 · Alerta roja "Se requiere atención" y protocolo de transferencia a humano
- **Área según el agente:** CHATBOT WHATSAPP
- **Tipo:** Regla de negocio · **Quién:** Kevin · **Hora:** 02:07:02
- **Detalle:** Kevin describe la bandeja de atención prioritaria del panel del bot: un punto rojo indicador llamado "Se requiere atención". Se activa bajo tres escenarios: 1) Cuando el cliente escribe expresamente que desea interactuar con un humano, 2) En el caso eventual de que el bot no logre absolver una consulta, y 3) Al completarse un pedido de comida, debido a que el bot actual carece de enlace automático con restaurant.pe y obliga a la cajera a copiar y pegar manualmente la comanda para procesarla en el punto de venta.
- **Cita:** "cuando se va al punto rojo que está en la izquierda, donde dice se requiere atención, es cuando el bot hace la transferencia al humano y ahí una alerta parece, se requiere atención... y ahí es donde tienen que intervenir el cajero o para procesar el pedido, porque como este bot no está asociado al restaurant, procesa el pedido manualmente, copy pea"
- **Prioridad:** Inmediato · **Confianza:** Alta

### E-38 · Protocolo operativo del botón "Marcar como atendido"
- **Área según el agente:** ADMINISTRATIVO Y ROLES
- **Tipo:** Regla de negocio · **Quién:** Kevin · **Hora:** 02:09:18
- **Detalle:** Kevin describe la dinámica de trabajo de los operadores en el panel: tras gestionar una consulta o transcribir un pedido derivado en la bandeja "Se requiere atención", el operador presiona el botón "Marcar como atendido" en la parte derecha de la pantalla. Dicha conversación sale de la cola de alerta y se traslada a la pestaña "Hoy", manteniendo limpia la lista de casos pendientes. La cajera debe vigilar ambas pantallas durante su turno.
- **Cita:** "cuando marcas como atendido, por ejemplo, se va, ¿no? Para, por ejemplo, requiere atención. Cuando estás en requiere atención y marcas como atendido en la parte derecha, se va para hoy. Entonces requiere atención, queda vacío. Solamente está en requiere atención los que debe de intervenir las personas"
- **Prioridad:** Inmediato · **Confianza:** Alta

### E-39 · Mecanismo de "Alta demanda" y ajuste dinámico de tiempos de entrega
- **Área según el agente:** CHATBOT WHATSAPP
- **Tipo:** Regla de negocio · **Quién:** Kevin · **Hora:** 02:09:18
- **Detalle:** Kevin explica la funcionalidad del interruptor de "Alta demanda" ubicado en la barra superior del panel del bot. Al activarlo (posición ON), el bot reajusta de forma inmediata los tiempos estimados de despacho y entrega prometidos al cliente en sus respuestas automáticas para evitar quejas por demoras en horas punta. Asimismo, cuenta con respuestas rápidas predefinidas (como la plantilla "Listo").
- **Cita:** "Ahí puedes pausar el bot este en alta demanda. on. Cuando le colocas on en la parte superior alta demanda... y tú le envías la plantilla de listo que dice respuestas rápidas, le envías el listo, le envías, eh, se configura diferentes tiempos de entrega. En cuando hay alta demanda, se el tiempo de entrega sube."
- **Prioridad:** Inmediato · **Confianza:** Alta

### E-40 · Incorporación obligatoria de captura de ubicación GPS en la solución web
- **Área según el agente:** CARTA WEB (cliente)
- **Tipo:** Compromiso · **Quién:** José · **Hora:** 02:08:12
- **Detalle:** Al verificar la interfaz del bot existente donde se captura la geolocalización satelital del cliente, José reconoce que omitió la solicitud de ubicación GPS en su prototipo de pedidos. Asume de inmediato el compromiso de incorporar el envío y captura de ubicación GPS en la carta web y en el nuevo flujo de pedidos de WhatsApp.
- **Cita:** "Ah, mira, algo que también no vi en mi en mi ejemplo del WhatsApp web, la ubicación es ahora me qued No le iba a ver... Ya. Entonces lo reviso esto."
- **Prioridad:** Inmediato · **Confianza:** Alta

### E-41 · Visita técnica presencial al almacén del local para extracción de código y accesos
- **Área según el agente:** PENDIENTES DEL DESARROLLADOR
- **Tipo:** Compromiso · **Quién:** José · **Hora:** 02:10:15
- **Detalle:** Dado que la plataforma del bot actual se ejecuta sobre una IP privada y no es posible descargar las credenciales de Meta ni los proyectos originales de Antigravity por la web, José y Kevin acuerdan una visita presencial de José al local de Caprichos. Kevin señala que la computadora principal se halla en el área de almacén y su acceso es inmediato.
- **Cita:** "Tendrías que venir tú y la computadora y sacar la data... Sí, porque no creo que a través de esto, porque debe haber credenciales para ingresar. Si tiene la API, la API de meta, hay credenciales de API... La está en el almacén... es de fácil acceso."
- **Prioridad:** Inmediato · **Confianza:** Alta

### E-42 · Disponibilidad horaria para la visita técnica presencial
- **Área según el agente:** INVESTIGAR O REVISAR (referencias)
- **Tipo:** Dato del negocio · **Quién:** José · **Hora:** 02:10:15
- **Detalle:** José establece sus horarios libres para la inspección presencial: trabaja de lunes a viernes hasta las 7:00 PM, por lo que puede concurrir al local entre semana a partir de las 7:00 PM, o en cualquier franja horaria los fines de semana (sábados y domingos por la mañana). Kevin valida que en las tardes el local presenta un ambiente despejado y propicio para trabajar.
- **Cita:** "Yo juego de lunes a viernes de las 7 para arriba, porque esa salo salgo de trabajar. Sábado, domingo estoy libre. Puede ser un sábado domingo temprano, cualquier hora o el de lunes a viernes plan de las 7. Voy un rato"
- **Prioridad:** Inmediato · **Confianza:** Alta

### E-43 · Elaboración de propuesta integral y definición de pago inicial para el viernes
- **Área según el agente:** PENDIENTES DEL DESARROLLADOR
- **Tipo:** Compromiso · **Quién:** José · **Hora:** 02:00:05
- **Detalle:** José se compromete a consolidar todas las especificaciones tratadas en la sesión en una propuesta técnica y económica formal para presentarla en su próxima reunión programada para el viernes (17 de octubre). Kevin solicita que defina con claridad el monto del primer abono económico para formalizar el inicio del desarrollo.
- **Cita:** "todo lo que conversamos hoy lo voy a editar y de acá que estamos el viernes, le parece nos volvemos a reunir... voy a hacer lo que es la propuesta... me planteas cuánto sería el primer abono que te tengo que hacer."
- **Prioridad:** Inmediato · **Confianza:** Alta

### E-44 · Identificación del modelo y protocolo de las impresoras térmicas de producción
- **Área según el agente:** DUDAS ABIERTAS
- **Tipo:** Pregunta · **Quién:** José · **Hora:** 01:48:14
- **Detalle:** Queda pendiente identificar la marca, modelo exacto y protocolo de conexión (ESC/POS, red cableada o USB compartida en red) de las impresoras de producción del establecimiento para garantizar la emisión directa de tickets y comandas de cocina desde la red local.
- **Cita:** "Tendría que ver el modelo de la impresora."
- **Prioridad:** Próximo · **Confianza:** Alta

### E-45 · Definición de la arquitectura técnica para contingencia sin conexión (offline)
- **Área según el agente:** DUDAS ABIERTAS
- **Tipo:** Pregunta · **Quién:** Kevin · **Hora:** 01:54:38
- **Detalle:** Queda abierta para resolución técnica de José la selección del mecanismo específico para garantizar la operatividad continua en contingencia (si se desarrollará una aplicación empaquetada de escritorio para Windows, una réplica de base de datos local SQLite/PostgreSQL o una cola de sincronización con Service Workers) que impida el retraso de comandas y pérdidas de datos ante caídas de internet.
- **Cita:** "la cajera va a seguir poder procesando pedidos, las pantallas de cocina se van a poder seguir viendo de forma local... esa parte sí lo voy a analizar para una mejor solución."
- **Prioridad:** Inmediato · **Confianza:** Alta

### Sección del agente: Datos del negocio que se mencionaron
- Precios y costos de servicios:
  * Dominio `.pe` en Punto.pe: 110 soles al año (pago único anual).
  * Servidor VPS en Contabo: Tarifa promocional por 24 meses de entre $5 y $6 USD mensuales (incrementándose posteriormente a $8 - $9 USD al mes).
  * Consumo reciente de IA en el chatbot: $10 USD gastados en solo 3 días debido al uso intensivo de GPT-4o para procesar la totalidad de mensajes.
  * Plan Pro de Antigravity: Suscripción de pago mensual asumida actualmente por Caprichos para el soporte del bot previo.
- Especificaciones técnicas del VPS Contabo: 8 GB de RAM, 4 vCPU, 100 GB de almacenamiento SSD, 1 snapshot de respaldo automático y transferencia de datos ilimitada.
- Moneda oficial de las operaciones: Exclusivamente Soles peruanos (PEN).
- Sedes y denominación comercial: Sede Campoy (referenciada en el correo corporativo `caprichoscampoy` / `grupo...`).
- Estructura física y equipamiento del local:
  * Equipamiento de atención: Computadoras de escritorio operadas por mozos y cajera.
  * Área de elaboración y cocina: Impresoras de producción térmicas conectadas a la red local (LAN).
  * Almacén del café: Ubicación de la computadora principal de fácil acceso que aloja los proyectos y credenciales de desarrollo.
  * Salón comedor: Espacio con barra, puerta de ingreso, baños, salida de cocina e iluminación/referencias espaciales con distribución configurable de mesas.
- Telefonía y conectividad:
  * Número oficial de WhatsApp Business: Enlazado a un chip SIM físico exclusivo que no recibe llamadas telefónicas, reservado únicamente para mensajería.
  * Conectividad a internet local: Línea sujeta a cortes e inestabilidad frecuente en días feriados y de alta demanda por saturación en la zona de Campoy.
- Horarios y rutina operativa:
  * Disponibilidad de José para trabajo presencial: Lunes a viernes a partir de las 7:00 PM (hora de salida de su trabajo diario); sábados y domingos disponibles en cualquier horario de la mañana o tarde.
  * Dinámica del local: Tardes con afluencia tranquila en el café, óptimas para labores de inspección técnica.
- Facturación y tributación:
  * Procedimiento ante SUNAT: Declaración mensual de ventas y compras efectuada por Kevin directamente desde el portal web de la SUNAT aprobando las propuestas del sistema tributario.
  * Política de comprobantes en caja: Tres tipos de documentos (Boleta, Factura y Nota de venta), con Nota de Venta fijada como comprobante por defecto.
- Reglas operativas del Chatbot de WhatsApp:
  * Ventana de memoria activa: Limitada a los últimos 10 a 15 mensajes del diálogo para preservar tokens.
  * Depuración de chats: Las conversaciones de la vista "Hoy" se trasladan de forma automatizada a la pestaña general "Todos" al día siguiente.
  * Datos fijos recopilados: Nombre del usuario, número de celular y coordenadas GPS de ubicación (indispensable para delivery).
  * Control de demanda: Interruptor de "Alta demanda" que amplía los tiempos de entrega comunicados al cliente y habilita respuestas rápidas predefinidas (ej. plantilla "Listo").
  * Protocolo de derivación: Alerta roja "Se requiere atención" para intervención humana inmediata de la cajera ante solicitudes expresas de clientes, dudas complejas o recepción de pedidos que requieren transcripción manual a comanda.
  * Flujo de atención: Botón "Marcar como atendido" para despejar la cola de soporte y archivar el chat en el historial diario.



### Sección del agente: Enlaces, páginas o sistemas nombrados
- Punto.pe (NIC.pe) - Portal oficial para el registro y pago anual de dominios peruanos (.pe).
- Contabo ("Contable") - Proveedor alemán de infraestructura de servidores privados virtuales (VPS) recomendado por José.
- Vercel ("Bel") - Plataforma de despliegue serverless mencionada como opción gratuita/paga con costos variables, finalmente descartada.
- SUNAT (Superintendencia Nacional de Aduanas y de Administración Tributaria) - Portal oficial del ente recaudador peruano donde Kevin realiza las declaraciones mensuales de compras y ventas.
- Meta Cloud API (WhatsApp Business API) - Plataforma oficial de Meta para integración y mensajería automatizada empresarial.
- Antigravity - Entorno y framework de desarrollo en versión Pro utilizado por el programador Josué para implementar el bot actual de Caprichos.
- OpenAI ChatGPT / GPT-4o / GPT-4o-mini ("GP4 mini", "versión Pro", "GPO4", "GPO5") - Modelos de lenguaje de OpenAI evaluados y empleados en el bot actual.
- Google Gemini ("Yemina") - Modelo de inteligencia artificial propuesto por José para su evaluación presupuestaria y funcional.
- API China (referencia implícita a DeepSeek u homólogos asiáticos) - Proveedor alternativo de modelos de IA de bajo costo sugerido por José.
- restaurant.pe ("rest.p", "restaurant.p") - Sistema gastronómico actual utilizado en Caprichos, que cuenta con aplicación de escritorio y sincronización recurrente con la nube.
- Hola Click ("hola click", "la click") - Plataforma web de pedidos gastronómicos utilizada con anterioridad por Caprichos y descartada por no tolerar caídas de internet.
- `caprichos.pe` - Dominio web oficial acordado para la plataforma y correos institucionales del café.
- `caprichos.com` - Dominio comercial evaluado y descartado por sobreprecio derivado de especulación y reventa de terceros.
- Panel administrativo del bot actual - Interfaz web montada sobre VPS privado donde se gestionan los estados de atención, alta demanda y chats de WhatsApp.



### Sección del agente: Ruido descartado
- Se descartaron interrupciones domésticas y familiares durante la llamada: Kevin atendiendo a su hijo en segundo plano ("juego contigo papá", "estoy jugando solito", "toma agua", "papi mira esto") y José pidiendo un masaje a un familiar ("hazme masajito").



### Sección del agente: Cobertura
- Se cubrieron exhaustivamente las líneas con contenido útil del segmento (aproximadamente desde la línea 1 hasta la 366). No se dejó ninguna sugerencia, iniciativa, número, requerimiento técnico, queja, pendiente o referencia sin registrar en el informe.

