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

## Errores y dudas comunes
- Por que una etapa dice Sin dato: falta la hora en el sistema, por ejemplo un pedido puesto en Listo a mano no guarda la hora de despacho por linea, o el delivery no registro quien lo tomo. Lo que faltaria guardar se explica en el panel.
- Los pedidos anulados no cuentan en los promedios: aparecen aparte con su cantidad y cuanto tardaron en anularse.
- El cobro dura 0 minutos cuando el pedido ya estaba pagado al entregarse.
- Si sale el aviso de que se leyeron solo los pedidos mas recientes, acorta el rango de fechas.
- Si no veo la opcion Analisis: solo la tienen el Administrador y el Supervisor.

## Quien puede hacerlo
- Administrador: ve todas las pestanas y cambia las metas (permiso analisis/ver y configuracion/editar).
- Supervisor: ve las pestanas y las metas, no las cambia (permiso analisis/ver).
- Los demas roles no ven el menu Analisis ni pueden abrir su direccion.
