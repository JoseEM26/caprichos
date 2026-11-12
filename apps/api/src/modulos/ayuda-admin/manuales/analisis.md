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
  - Cuanto efectivo me deben rendir los repartidores y desde cuando
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

## Como se hace: Mirar el reparto (pestana Reparto)
1. Entregas por zona: cada zona de reparto muestra cuantos pedidos delivery tuvo, cuantos se entregaron y el promedio de minutos desde que entra el pedido hasta que se entrega, contra la promesa maxima de minutos de la zona. Toca una zona para ver su detalle debajo.
2. Donde y cuando se pide: tabla de calor de pedidos por zona y turno (manana, tarde, noche). El numero manda, el color solo ayuda.
3. Productividad de repartidores: entregas por hora marcada en asistencia y minutos por entrega (desde que sale hasta que entrega). Si el repartidor no marco asistencia dice Sin dato.
4. Efectivo por rendir: suma del efectivo contra entrega de los ultimos 92 dias que los repartidores aun no liquidan en [[cierre]], y desde cuando (la entrega mas antigua sin cubrir). No depende de las fechas del filtro.
Ver tambien: [[repartos]]

## Como se hace: Revisar al equipo y los huecos (pestana Equipo)
1. Huecos ahora: tres conteos de cualquier dia, sin filtro de fechas. Pedidos sin cobrar, pedidos sin terminar (estado distinto de entregado o anulado) y entregados sin cobrar. Cada fila tiene un boton para ir a [[cierre]] o [[caja]].
2. Asistencia y puntualidad: tardanzas y faltas por dia, con el porcentaje de puntualidad. Salen de las mismas marcas de asistencia que la planilla; no se muestran sueldos, documentos, fotos ni ubicaciones.
3. Mozos y cobros en caja: pedidos, ticket promedio y minutos. Mozo es quien registro el pedido por el canal Mozo; cobro es quien lo cobro en caja.
4. El detalle por persona solo lo ve el Administrador. El Supervisor ve los totales del equipo.
Ver tambien: [[cierre]]

## Como se hace: Vigilar el almacen (pestana Almacen)
1. Cuanto dura cada insumo: stock actual entre el consumo diario del periodo elegido. Primero van los que se acaban antes, con los dias que duran y hasta que fecha. Sin consumo en el periodo dice Sin consumo.
2. Mermas: cantidad, veces, costo (solo insumos con costo guardado) y el motivo mas repetido.
3. Productos terminados con pocas unidades: donas, galletas y otros con conteo propio que tienen 5 unidades o menos.
4. Si sale Control de almacen apagado, vender no descuenta insumos y no hay consumo que analizar: no se muestran la duracion de insumos ni sus mermas de insumo. El Administrador lo enciende en Configuracion. Los productos terminados siguen porque llevan su propio conteo.
Ver tambien: [[caja]]

## Errores y dudas comunes
- Por que una etapa dice Sin dato: falta la hora en el sistema, por ejemplo un pedido puesto en Listo a mano no guarda la hora de despacho por linea, o el delivery no registro quien lo tomo. Lo que faltaria guardar se explica en el panel.
- Los pedidos anulados no cuentan en los promedios: aparecen aparte con su cantidad y cuanto tardaron en anularse.
- El cobro dura 0 minutos cuando el pedido ya estaba pagado al entregarse.
- Si sale el aviso de que se leyeron solo los pedidos mas recientes, acorta el rango de fechas.
- Por que el efectivo por rendir no coincide con lo que veo en Cierre: aqui se cuenta lo entregado en los ultimos 92 dias menos lo liquidado, sin importar la caja del dia; el repartidor salda primero lo mas antiguo.
- Por que no veo nombres en Reparto o Equipo: solo el Administrador ve el detalle por persona.
- Si no veo la opcion Analisis: solo la tienen el Administrador y el Supervisor.

## Quien puede hacerlo
- Administrador: ve todas las pestanas, el detalle por persona de Reparto y Equipo, y cambia las metas (permiso analisis/ver y configuracion/editar).
- Supervisor: ve las pestanas con totales (sin detalle por persona) y las metas, no las cambia (permiso analisis/ver).
- Los demas roles no ven el menu Analisis ni pueden abrir su direccion.
