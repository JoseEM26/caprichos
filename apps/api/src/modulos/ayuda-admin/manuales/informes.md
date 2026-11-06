---
modulo: informes
titulo: Informes
ruta: /admin/informes
permiso: auditoria/ver
roles: [ADMIN]
relacionados: [caja, cierre, comprobantes, indicadores, mapa, propinas]
sugerencias:
  - ¿Cómo consulto las ventas de un día o de una semana específica?
  - ¿Cómo exporto un informe de ventas o productos a Excel?
  - ¿Dónde veo los pedidos que fueron rechazados o anulados?
  - ¿Cómo imprimo o descargo en PDF un reporte de caja?
  - ¿Dónde veo cuánto se regaló en cortesías?
---
# Informes

## Para que sirve
Es el centro analitico y financiero del negocio. Proporciona mas de 20 informes detallados sobre ventas por dia, ventas por producto, ventas por categoria, canales de atencion en [[caja]], metodos de pago, arqueos y cierres de caja en [[cierre]], mermas de inventario, compras a proveedores y clientes frecuentes, con opciones de filtrado flexible y exportacion inmediata a Excel o impresion en PDF.

## Como se hace: Abrir y consultar un informe del catalogo
1. En la pantalla principal, selecciona una categoria de reportes en las pestanas superiores (Ventas, Caja, Inventario, Compras, Clientes o Delivery), o escribe terminos clave en la barra de busqueda.
2. En la rejilla de tarjetas informativas, haz clic sobre el reporte que deseas consultar (por ejemplo: "Ventas por producto", "Ventas por dia" o "Cierres de caja").
3. Se abrira el panel con el detalle del reporte, mostrando las metricas destacadas (KPIs) y la tabla con los registros correspondientes.
Ver tambien: [[indicadores]]

## Como se hace: Filtrar por fechas o rangos personalizados
1. En la barra superior de filtros, pulsa uno de los botones de seleccion rapida: "Hoy", "Ayer", "Ultimos 7 dias", "Este mes" o "Mes anterior".
2. Si requieres un periodo puntual, ingresa las fechas en los selectores "Desde" y "Hasta".
3. De forma complementaria, aplica filtros por canal de atencion (Salon, Mostrador, WhatsApp, Web), por metodo de pago o por modalidad de pedido (Local, Llevar, Delivery).
4. La tabla de resultados y los totales numericos se actualizaran de manera automatica.
Ver tambien: [[cierre]]

## Como se hace: Exportar un informe a Excel
1. Con el informe abierto y los filtros de fecha aplicados en pantalla, pulsa el boton "Exportar a Excel" ubicado en la esquina superior del reporte.
2. El navegador web descargara directamente un archivo estructurado con todas las filas y columnas del periodo seleccionado para su analisis en hojas de calculo.
Ver tambien: [[historial]]

## Como se hace: Imprimir o generar un archivo PDF
1. En la vista del reporte abierto, pulsa el boton "Imprimir o PDF".
2. Se abrira la ventana estandar de impresion del sistema operativo configurada de forma limpia para mandar a la impresora o seleccionar la opcion "Guardar como PDF".
Ver tambien: [[comprobantes]]

## Como se hace: Ver el reporte de Cortesias
1. En la lista de informes abre Cortesias (categoria Ventas): "Lo regalado a costo 0: por motivo, por producto y por quien la dio, con su valor de lista". Filtra por Fecha.
2. Arriba ves tres cifras: Cortesias, Unidades regaladas y Valor de lista regalado.
3. La tabla va por secciones: Por motivo, Por producto, Por quien la dio y Detalle (fecha, producto y sabor, cantidad, valor de lista, motivo y nota, pedido o pedido de referencia, y quien la dio con "autoriza ..." si la autorizo un supervisor).
4. Las cortesias no cuentan en las ventas de los informes, ni en comprobantes ni en puntos. Como darlas: ver [[caja]].

## Errores y dudas comunes
- Que significa el aviso "Desde es posterior a Hasta": aparece cuando la fecha inicial elegida en el calendario es mayor que la fecha de cierre. Corrige las fechas en los selectores para que el reporte pueda procesar los datos.
- Los informes de ventas incluyen pedidos anulados o cancelados: no, los reportes regulares de ventas contabilizan unicamente transacciones completadas y cobradas. Los pedidos que no llegaron a concretarse se analizan en el informe especializado "Pedidos rechazados".

## Quien puede hacerlo
- Administrador: es el unico rol con autorizacion para acceder al modulo de informes analiticos, consultar cierres financieros y descargar reportes comerciales (permiso auditoria/ver).
- Otros roles (Cajero, Cocina, Mozo, Repartidor, Almacen): no tienen acceso a este modulo por razones de reserva financiera del negocio.
