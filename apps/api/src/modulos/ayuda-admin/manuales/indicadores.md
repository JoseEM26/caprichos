---
modulo: indicadores
titulo: Indicadores
ruta: /admin/indicadores
permiso: auditoria/ver
roles: [ADMIN]
relacionados: [informes, caja, productos, cocina, repartos]
sugerencias:
  - ¿Cómo sé si estamos cumpliendo las metas de tiempo de entrega y rotación?
  - ¿Dónde veo el producto más vendido de cada categoría este mes?
  - ¿Cómo activo o desactivo las estrellas de productos destacados en la carta?
  - ¿Dónde consulto el historial de productos más vendidos de meses anteriores?
---
# Indicadores

## Para que sirve
Monitorea en tiempo real los objetivos estrategicos y la calidad operativa del negocio. Permite auditar el cumplimiento de metas clave como tiempos maximos de entrega, ventas de productos agotados en [[caja]], platos con receta y margen visible, rotacion de mesas y frecuencia de reclamos. Ademas, identifica el producto lider de cada categoria en [[productos]] y permite gestionar el distintivo de estrella en la carta virtual.

## Como se hace: Supervisar el estado de metas operativas
1. En la seccion superior de la pantalla, observa las tarjetas de indicadores de gestion.
2. Cada bloque informa el nombre del indicador, el valor alcanzado a la fecha, la barra porcentual y la meta esperada (por ejemplo: "Tiempo de entrega: meta 13 min como maximo" o "Ventas de productos agotados: meta cero").
3. Si una barra se aparta del color verde o del rango optimo, identifica el area de servicio o cocina correspondiente para coordinar las mejoras necesarias.
Ver tambien: [[informes]]
Ver tambien: [[cocina]]
Ver tambien: [[repartos]]

## Como se hace: Revisar los productos lideres del mes por categoria
1. En la columna "Mas comprado de cada categoria", consulta que producto ocupa el primer lugar en volumen de ventas del mes en curso para frappes, bebidas calientes, waffles, postres y salados.
2. Examina la barra de porcentaje, la cantidad de unidades vendidas y la estrella asignada al articulo preferido de los clientes en [[productos]].
3. Esta clasificacion se actualiza de manera automatica conforme se confirman pedidos a lo largo del mes.
Ver tambien: [[productos]]
Ver tambien: [[informes]]

## Como se hace: Conmutar la visualizacion de estrellas en la carta
1. En la cabecera de la seccion de productos mas comprados, localiza el boton "Estrellas en la carta" (que muestra el estado "Activadas" o "Apagadas").
2. Haz clic sobre el boton para cambiar la modalidad.
3. Se abrira un cuadro de confirmacion solicitando aprobacion para modificar la aparicion de la estrella distintiva en los productos de la carta virtual.
4. Pulsa "Si, continuar". El distintivo visual se reflejara o se ocultara inmediatamente ante los clientes que visiten la carta web.
Despues: [[productos]]
Ver tambien: [[disenador]]

## Como se hace: Consultar el historico y efectividad de promociones
1. En la columna "Historial de mas comprados", revisa el registro consolidado de meses anteriores para conocer que productos lideraron la preferencia del publico en cada temporada.
2. En la parte inferior, consulta el reporte de promociones y combos vendidos en [[ofertas]], asi como el resumen de productos que se despacharon con descuento durante el periodo.
Antes: [[ofertas]]
Ver tambien: [[informes]]

## Como se hace: Filtrar los indicadores por periodo, canal, tipo de pedido y categoria
1. Arriba de la pantalla esta la barra de filtros. Elige el periodo: Hoy, Ayer, Ultimos 7 dias, Este mes (el que se usa al abrir), Mes anterior o Personalizado (aparecen las fechas Desde y Hasta; maximo 366 dias).
2. Si quieres, elige tambien el Canal (carta web, WhatsApp, bot, caja, mozo, mostrador o telefono), el Tipo de pedido (en mesa, comer en local, para recoger, para llevar o delivery) y la Categoria de producto.
3. Todos los cuadros se recalculan a la vez, y cada uno muestra debajo del titulo el periodo aplicado (por ejemplo "14/11 al 14/11"). Los pedidos anulados o rechazados no cuentan, igual que antes.
4. Si un cuadro no puede usar uno de los filtros (por ejemplo, los reclamos no se separan por canal), lo avisa con la nota "No aplica el filtro de canal" en lugar de ignorarlo en silencio.
5. Pulsa "Limpiar filtros" para volver a Este mes sin otros filtros. Los filtros quedan en la direccion de la pagina: puedes copiarla para compartir la misma vista o recargar sin perderla.
Ver tambien: [[informes]]

## Errores y dudas comunes
- Las estrellas de la carta cambian si filtro otro periodo: no. El interruptor "Estrellas en la carta" siempre usa los mas comprados del mes actual, sin importar los filtros.
- Quien selecciona los productos que llevan estrella: no se escogen manualmente; el sistema calcula de forma automatica y objetiva cual fue el articulo con mas unidades cobradas en cada categoria durante el mes calendario.
- Cuando se reinicia el calculo mensual: la medicion se reinicia automaticamente a las 00:00 horas del primer dia de cada mes, archivando el resultado del mes saliente en el historial.

## Quien puede hacerlo
- Administrador: es el unico rol con privilegios para supervisar los indicadores globales de gestion y conmutar la visibilidad de las estrellas en la carta comercial (permiso auditoria/ver).
- Ningun otro rol operativo tiene autorizacion para acceder a este panel de control de gestion.
