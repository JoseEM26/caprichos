---
modulo: analisis
titulo: Analisis
ruta: /admin/analisis
permiso: analisis/ver
roles: [ADMIN, SUPERVISOR]
relacionados: [informes, cocina, caja, repartos, cierre, mirest, clientes, mensajes]
sugerencias:
  - Donde veo cuanto tarda cada etapa de un pedido
  - Como encuentro los pedidos atascados ahora
  - Como cambio la meta de minutos de una etapa
  - Como veo solo el turno de la noche o solo delivery
  - Cuantos clientes nuevos y cuantos recurrentes tuve
  - Cada cuanto regresan mis clientes
  - Cuanto tarda el equipo en responder por WhatsApp
  - Que chats de WhatsApp estan sin respuesta ahora
---
# Analisis

## Para que sirve
Es el lugar para entender como trabaja el local, con graficos simples y sin salir del panel. Cada tema es una pestana y todas comparten el mismo filtro de fechas. Las pestanas son Tiempos (sigue al pedido desde que entra hasta el cierre de caja), Clientes (quienes regresan, embudo de la carta, puntos y calificaciones) y WhatsApp (cuanto tarda el equipo en responder y como se reparte el trabajo entre el bot y las personas). Los pedidos y su detalle siguen en [[caja]] y [[cocina]]; los reportes en [[informes]].

## Como se hace: Elegir fechas y filtros
1. Entra a Analisis y elige la pestana (por ahora Tiempos).
2. En la barra de filtros toca Hoy, Ayer, 7 dias, 30 dias o Elegir fechas (con Desde y Hasta).
3. Si quieres, filtra por modalidad (Mesa, Recoger, Delivery, Comer en local), canal (Carta, Caja, Mozo, WhatsApp, Bot) y turno (manana, tarde, noche, por hora de Lima).
4. El rango maximo es de 92 dias y no se puede mirar el futuro. Los filtros quedan en la direccion de la pagina.
Ver tambien: [[informes]]

## Como se hace: Leer el recorrido del pedido (pestana Tiempos)
1. Cada barra es una etapa: espera de aprobacion o pago, enviado a cocina, cocina, espera de despacho, despacho y armado, entrega segun modalidad (mesa, recoger o delivery), cobro y cierre de caja.
2. Cada barra muestra el promedio y la mediana en minutos, cuantos pedidos entraron en el calculo y su semaforo contra la meta: verde dentro de la meta, ambar hasta una vez y media la meta, rojo mas alla.
3. La etapa mas lenta sale resaltada y con la palabra Mas lenta, no solo con color. El cierre de caja espera horas por diseno y no compite.
4. Debajo de cada grafico esta Ver como tabla con los mismos numeros.
5. Si una etapa dice Sin dato es que el sistema no guarda esa hora para esos pedidos; nada se inventa.
Ver tambien: [[cocina]]

## Como se hace: Comparar las areas de cocina
1. En Cocina por area cada area tiene su promedio, mediana y semaforo contra la meta de cocina.
2. El tiempo de un area va desde que el pedido paso a cocina hasta que esa area marco Listo.
Ver tambien: [[cocina]]

## Como se hace: Ver los pedidos atascados ahora
1. La lista Pedidos atascados ahora muestra los pedidos de las ultimas 24 horas que llevan en su etapa actual mas minutos que la meta, del mas pasado al menos.
2. Cada fila dice el codigo, la etapa, cuantos minutos lleva, cuantas veces pasa la meta y, en cocina, que areas faltan.
3. Toca Abrir para ir a la pantalla donde se destraba: [[caja]], [[cocina]] o [[repartos]].
4. La lista se actualiza sola cada 30 segundos y tambien con el boton Actualizar.
Despues: [[caja]]

## Como se hace: Leer la pestana Clientes
1. Elige Clientes y las fechas. Los filtros de modalidad y turno aplican a todo; el canal aplica a la parte de clientes (el embudo es siempre de la carta).
2. Nuevos y recurrentes: un cliente es nuevo si su primer pedido del local cae dentro del rango y recurrente si ya habia pedido antes. Se reconoce por su cuenta o, si pidio como invitado, por su celular. Los pedidos sin cuenta ni celular, los anulados y los del personal no cuentan; los sin cuenta ni celular salen como una cifra aparte.
3. Cada cuanto regresan: dias entre un pedido y el anterior del mismo cliente. Se muestra la mediana, el 10 por ciento que mas tarda y cuatro tramos (hasta 7, 8 a 14, 15 a 30 y mas de 30 dias).
4. Embudo de la carta: pedidos creados en la carta, con pago confirmado y entregados, con el porcentaje contra el paso anterior; los anulados salen aparte. Toca un paso para ver que todavia no se guarda: visitas a la carta, carrito sin terminar y abandono del pago. Por eso el embudo empieza en el pedido creado.
5. Puntos: emitidos y canjeados del periodo (netos de reversas y devoluciones), saldo vivo de todas las cuentas y costo. Se cuenta 1 punto igual a 1 sol de descuento: el costo del programa es lo canjeado en el periodo y el pendiente es lo que costaria si todo el saldo se canjeara.
6. Calificaciones: puntaje promedio de la encuesta de posventa por semana, cuantos respondieron de los que la recibieron, comparacion del puntaje entre pedidos entregados a tiempo y con demora (pasada la espera maxima que se prometio al cliente) y el promedio de las resenas de Google. Las encuestas de prueba no cuentan. Aqui nunca se ven nombres ni comentarios.
Ver tambien: [[clientes]]

## Como se hace: Leer la pestana WhatsApp
1. Elige WhatsApp y las fechas. Arriba esta Chats sin respuesta ahora: los chats cuyo ultimo mensaje es del cliente y esperan a una persona, con el celular oculto en parte y los minutos de espera. Toca Abrir Mensajes para atenderlos en [[mensajes]]; se actualiza sola cada 30 segundos.
2. Tiempo de respuesta: minutos desde que el cliente escribe hasta la primera respuesta de una persona. Se da la mediana y el 10 por ciento que mas espero, por hora en que escribio (hora de Lima). Si el bot responde primero, esa consulta cuenta como atendida por el bot y no entra a la mediana; las que siguen sin respuesta se cuentan aparte.
3. Respuesta por persona: solo la ve el Administrador. Los mensajes enviados hace tiempo desde Mensajes pueden salir como Sin identificar porque no guardaban quien los envio.
4. Bot frente a persona: chats con mensajes del cliente en el periodo, segun los resolvio solo el bot, los atendio una persona o quedaron sin respuesta.
5. Motivos de derivacion: por que el bot paso el chat al equipo, tomado de la nota Necesita asesor que deja el bot. Si no hay motivo guardado dice Sin motivo guardado.
6. Mensajes por hora: clientes, bot y personas, sin los avisos internos.
7. Mensajes enviados: por tipo y por plantilla, con el contador del mes frente al tope gratis de Meta (1,000 al mes por defecto). Es el mismo contador de Configuracion del chatbot.
Ver tambien: [[mensajes]]

## Como se hace: Cambiar las metas de minutos (solo Administrador)
1. En Tiempos abre Metas por etapa.
2. Escribe los minutos de cada etapa (entero de 1 a 1440) y toca Guardar. El cambio queda en el historial.
3. Las metas son parametros de [[mirest]] y mueven el semaforo y la lista de atascados.
4. El Supervisor ve las metas pero no las cambia.

## Errores y dudas comunes
- Por que una etapa dice Sin dato: falta la hora en el sistema, por ejemplo un pedido puesto en Listo a mano no guarda la hora de despacho por linea, o el delivery no registro quien lo tomo. Lo que faltaria guardar se explica en el panel.
- Los pedidos anulados no cuentan en los promedios: aparecen aparte con su cantidad y cuanto tardaron en anularse.
- El cobro dura 0 minutos cuando el pedido ya estaba pagado al entregarse.
- Si sale el aviso de que se leyeron solo los pedidos mas recientes, acorta el rango de fechas.
- Por que el embudo no muestra las visitas a la carta: el sistema todavia no las guarda, ni el carrito ni el abandono del pago. Falta registrar esos eventos de la carta para completarlo.
- Por que un cliente no aparece en Nuevos ni en Recurrentes: pidio sin cuenta ni celular, o su pedido fue anulado o del personal.
- Por que no coincide el total de mensajes enviados con lo que cobra Meta: aqui se cuentan solo los enviados, entregados o leidos; Meta cobra por conversacion y lo suyo manda.
- Si no veo la opcion Analisis: solo la tienen el Administrador y el Supervisor.

## Quien puede hacerlo
- Administrador: ve todas las pestanas y cambia las metas (permiso analisis/ver y configuracion/editar).
- Supervisor: ve las pestanas y las metas, no las cambia (permiso analisis/ver).
- Los demas roles no ven el menu Analisis ni pueden abrir su direccion.
