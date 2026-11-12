---
modulo: analisis
titulo: Analisis
ruta: /admin/analisis
permiso: analisis/ver
roles: [ADMIN, SUPERVISOR]
relacionados: [informes, cocina, caja, repartos, cierre, mirest]
sugerencias:
  - Donde veo cuanto tarda cada etapa de un pedido
  - Como encuentro los pedidos atascados ahora
  - Que significa el semaforo verde, ambar y rojo en Tiempos
  - Como cambio la meta de minutos de una etapa
  - Que area de cocina es la mas lenta
  - Por que una etapa dice Sin dato
  - Como veo solo el turno de la noche o solo delivery
  - Cuales son los productos mas y menos vendidos
---
# Analisis

## Para que sirve
Es el lugar para entender como trabaja el local, con graficos simples y sin salir del panel. Cada tema es una pestana y todas comparten el mismo filtro de fechas. Hoy esta la pestana Tiempos, que sigue al pedido desde que entra hasta el cierre de caja. Los pedidos y su detalle siguen en [[caja]] y [[cocina]]; los reportes en [[informes]].

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

## Como se hace: Cambiar las metas de minutos (solo Administrador)
1. En Tiempos abre Metas por etapa.
2. Escribe los minutos de cada etapa (entero de 1 a 1440) y toca Guardar. El cambio queda en el historial.
3. Las metas son parametros de [[mirest]] y mueven el semaforo y la lista de atascados.
4. El Supervisor ve las metas pero no las cambia.

## Como se hace: Leer la demanda (pestana Demanda)
1. Carga de cocina ahora: cada area muestra cuantos pedidos tiene esperando y cuanto lleva el mas antiguo, con semaforo contra la meta de cocina. Se actualiza sola cada 30 segundos y tambien con Actualizar. Un area sin pedidos dice Sin cola.
2. Cuando piden: el mapa de calor cuenta los pedidos por dia de la semana (lunes primero) y hora de Lima. Cada celda escribe su numero; el color solo refuerza. No cuenta anulados ni rechazados.
3. Tiempo prometido al cliente: de los delivery entregados, que porcentaje llego dentro del maximo que se le prometio al salir el repartidor. Si dice Sin dato es que no hubo delivery con tiempo prometido guardado; mesa y para llevar no guardan ese tiempo.
4. Pedidos anulados: cantidad, porcentaje de los pedidos, motivos escritos (se agrupan sin importar mayusculas), etapa en que estaba el pedido y cuanto tardo en anularse. Toca Quien anula para ver la lista de personas dentro de la misma pagina.
Ver tambien: [[cocina]]

## Como se hace: Leer las ventas (pestana Ventas)
1. Una venta es el total del pedido (productos menos descuentos mas envio), sin la propina, y sin pedidos anulados ni rechazados: la misma definicion de [[informes]]. Las propinas salen aparte.
2. Productos: elige Mas vendidos, Menos vendidos o Por monto. Las cortesias no cuentan, las partes de un combo no se repiten (el combo cuenta como una sola linea) y las opciones ya van dentro del precio de su producto. El monto es a precio de lista, antes del descuento del pedido.
3. Canal, modalidad y turno: ventas y ticket promedio de cada uno; el ticket mas alto sale resaltado con palabras. La evolucion es diaria hasta 31 dias y semanal (de lunes a domingo) si el rango es mayor.
4. Combos y ofertas: cuantos pedidos llevaron combo, cuanto aportan y cuanto descuento dio cada oferta o cupon. Si los combos le quitan ventas a los productos sueltos (canibalizacion) no se puede saber con lo que se guarda: dice Sin dato.
5. Medios de pago: proporcion de Efectivo, Yape, Plin, tarjeta y transferencia segun lo cobrado en caja (sin propinas, como el [[cierre]]) y su evolucion. Los pedidos sin cobro registrado se cuentan aparte.
6. El Supervisor ve pedidos y unidades pero no los montos en soles: solo el Administrador los ve.
Ver tambien: [[informes]]

## Errores y dudas comunes
- Por que una etapa dice Sin dato: falta la hora en el sistema, por ejemplo un pedido puesto en Listo a mano no guarda la hora de despacho por linea, o el delivery no registro quien lo tomo. Lo que faltaria guardar se explica en el panel.
- Los pedidos anulados no cuentan en los promedios: aparecen aparte con su cantidad y cuanto tardaron en anularse.
- El cobro dura 0 minutos cuando el pedido ya estaba pagado al entregarse.
- Si sale el aviso de que se leyeron solo los pedidos mas recientes, acorta el rango de fechas.
- Por que Demanda dice Sin dato en el tiempo prometido: solo el delivery guarda el tiempo prometido y lo guarda cuando el repartidor sale; antes de eso no hay con que comparar.
- Por que no veo montos en Ventas: los montos en soles son solo del Administrador; el Supervisor ve pedidos y unidades.
- Si no veo la opcion Analisis: solo la tienen el Administrador y el Supervisor.

## Quien puede hacerlo
- Administrador: ve todas las pestanas y cambia las metas (permiso analisis/ver y configuracion/editar).
- Supervisor: ve las pestanas y las metas, no las cambia (permiso analisis/ver).
- Los demas roles no ven el menu Analisis ni pueden abrir su direccion.
