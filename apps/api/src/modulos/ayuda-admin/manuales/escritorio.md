---
modulo: escritorio
titulo: Escritorio
ruta: /admin
permiso:
roles: [ADMIN, CAJERO, COCINA, MOZO, ALMACEN, REPARTIDOR, SUPERVISOR]
relacionados: [caja, cocina, repartos, compras, informes, reservas, plano, notificaciones]
sugerencias:
  - Como cambio el periodo de fechas para ver las ventas
  - Que graficos tiene el escritorio del administrador
  - Por que no veo los graficos de ventas en mi usuario
  - Que veo en el escritorio de cada puesto
  - Por que mi escritorio no muestra dinero
  - Quien ve los cumpleanos y por que me sale un saludo al entrar
  - Donde veo si algun insumo se esta quedando sin stock
  - Que hago si el escritorio sale vacio
---
# Escritorio

## Para que sirve
Es el panel principal de bienvenida y resumen de la operacion diaria. Cada persona ve solo lo de su trabajo: el Administrador ve las ventas con sus graficos y el resto del personal ve la operacion del dia (pedidos, reparto, stock, salon) sin dinero. Conecta con modulos como [[caja]], [[cocina]] y [[repartos]].

## Como se hace: Filtrar las ventas por fecha o canal (Administrador)
1. En la parte superior, elegir el Periodo: Hoy, 7 dias, 30 dias, 90 dias, Este ano o Elegir fechas. Con Elegir fechas aparecen los campos Desde y Hasta.
2. Elegir el Canal: Todos, Salon, Delivery, Web o WhatsApp. Las cifras y todos los graficos cambian juntos.
3. Los filtros quedan guardados en la direccion de la pagina: al recargar o compartir el enlace se conservan. El periodo por defecto son los ultimos 30 dias.
4. Los dias se cuentan por fecha de Lima, igual que en [[informes]].
Ver tambien: [[informes]]

## Como se hace: Leer los graficos del Administrador
1. Arriba van las cifras: Ventas, Pedidos, Ticket promedio, Tiempo de entrega y Por cobrar, con su comparacion frente al periodo anterior.
2. En Ventas: ventas por dia, pedidos por hora del dia, ventas por dia de la semana, y la mezcla por canal, por modalidad (en el local, para llevar, delivery) y por medio de pago.
3. En Productos: ventas por categoria y los productos mas pedidos por unidades.
4. En Operacion: tiempo de entrega por dia frente a la meta de 13 minutos, pedidos por estado y la lista Para hacer ahora.
5. Cada grafico escribe sus valores en texto y trae el enlace Ver como tabla con los mismos datos. Las secciones se pueden plegar tocando su titulo.

## Como se hace: Usar el escritorio de tu puesto (sin dinero)
1. Cajero, Mozo, Cocina, Almacen, Repartidor y Supervisor ven solo los bloques de los modulos que tienen. Si tienes varios roles, ves la suma de lo permitido.
2. Pedidos (Cajero, Mozo, Cocina, Supervisor): contadores Por confirmar, En cola, En preparacion, Listos, En reparto y Atrasados (mas de 13 minutos), el grafico Cola por estado y el de Pedidos por hora de hoy. Al tocar un contador abre su modulo si lo tienes.
3. Reparto (quien tiene [[repartos]]): Disponibles para tomar, En camino y Entregados hoy. El Repartidor ve solo sus propios pedidos.
4. Insumos con stock bajo (quien tiene [[stock]]): cuantos faltan y los cinco mas bajos, con el boton Pedir al proveedor si tienes [[compras]]. No aparece si el Control de almacen esta apagado.
5. Reservas, mesas y caja (Supervisor): Reservas para hoy, Mesas ocupadas y libres, y el estado de la caja (Abierta, Cerrada o Sin abrir hoy). Abren [[reservas]] y el [[plano]].
6. Avisos: cuantos avisos sin leer tienes; abre [[notificaciones]].
Ver tambien: [[caja]], [[cocina]], [[repartos]]

## Como se hace: Ver los cumpleanos del equipo
1. La tarjeta Cumpleanos aparece solo para el Administrador y el Supervisor (pestana Equipo) y para quien puede ver Clientes (pestana Clientes).
2. Elige Hoy, 7 dias o Este mes. El cumpleanos de hoy sale resaltado. Nunca muestra el ano de nacimiento ni la edad.
3. En la pestana Clientes el celular sale con puntos. El boton Felicitar por WhatsApp solo aparece si el cliente escribio en las ultimas 24 horas; si no, se avisa para no pagar una plantilla de Meta.
4. Cuando es tu cumpleanos, al entrar al panel la primera vez ese dia sale un saludo grande. Se cierra con Gracias o con Esc.

## Errores y dudas comunes
- Si la fecha inicial es mayor a la final, aparece el aviso La fecha inicial no puede ser despues de la final y no se actualiza la informacion hasta corregirla.
- Si un grafico no carga, muestra un aviso de error en ese grafico en vez de ceros; vuelve a intentar en unos segundos.
- Si tu escritorio sale sin cifras, tu puesto no necesita resumen: usa los accesos que aparecen debajo del mensaje para entrar a tus modulos.
- Ventas, ticket promedio, medios de pago, montos por producto o categoria y datos de clientes son solo del Administrador: el servidor ni siquiera los envia a otros puestos.
- Los datos de ventas no se pueden modificar desde esta pantalla; es un panel de consulta.

## Quien puede hacerlo
- Todos los usuarios activos con puesto operativo pueden ingresar al Escritorio (Marketing y diseno entra directo a sus modulos).
- Solo el Administrador ve el resumen financiero, los KPIs de ventas y los graficos de dinero.
- Solo el Administrador y el Supervisor ven los cumpleanos del equipo; los de clientes, quien tiene permiso de ver Clientes.
