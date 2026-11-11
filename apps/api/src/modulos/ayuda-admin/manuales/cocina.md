---
modulo: cocina
titulo: Cocina
ruta: /admin/cocina
permiso: cocina/ver
roles: [ADMIN, CAJERO, COCINA]
relacionados: [caja, almacen, stock, pantallas, apertura, productos, usuarios]
sugerencias:
  - Como despejo una comanda que ya prepare
  - Como pongo en pausa la cocina por alta demanda
  - Como marco un plato o ingrediente como agotado
  - Como devuelvo una comanda que despeje por error
  - Que significa el tiempo en colores de cada comanda
  - Como despacho un pedido completo con todas sus areas
  - Por que sale Falta el conteo de apertura de hoy
  - Como pido que anulen un pedido que ya esta en cocina
---
# Cocina

## Para que sirve
Sistema de visualizacion y control de preparacion de comandas en tiempo real. Organiza los pedidos procedentes de [[caja]] por orden estricto de llegada, proyecta el estado en [[pantallas]], alerta sobre demoras, gestiona alta demanda y coordina mermas e insumos con [[almacen]] y [[stock]].

## Como se hace: Despejar una comanda preparada
1. En la pestana Pantalla del area, seleccionar el area de trabajo: Todas, Bebidas, Postres o Salados.
2. Las comandas pendientes aparecen primero, ordenadas de mas antigua a mas reciente, mostrando primero la que mas tiempo lleva esperando.
3. Al finalizar la elaboracion de los platos de esa comanda, pulsar el boton Despejar en la tarjeta del pedido y confirmar con Si, despejar.
4. La tarjeta sigue en la pantalla del area como seguimiento: el pedido no desaparece mientras otra area de ese mismo pedido siga pendiente.
5. En la pantalla de un area, cada tarjeta muestra solo las lineas de esa area. Los productos de las demas areas no aparecen ahi.
6. Cada tarjeta lleva una franja con una casilla por area del pedido: marcada cuando esa area ya despejo, en blanco cuando falta. El area de la pantalla va resaltada.
7. En la pestana Todas, cada pedido aparece una sola vez, con sus productos agrupados por area. Desde Todas no se despeja: despejar se hace en la pantalla de cada area.
8. Si el area propia ya despejo, la tarjeta se marca como lista con el aviso "Tu area ya esta lista, falta: <areas pendientes>" y ya no tiene el boton Despejar.
9. Cuando todas las areas del pedido han despejado, el pedido pasa a LISTO y sale de las pantallas de cocina. Cocina no tiene mas pasos: el mozo recibe el aviso y lleva el pedido a la mesa; en delivery o para llevar sigue el flujo de [[repartos]].
Antes: [[caja]]
Despues: [[repartos]]
Ver tambien: [[pantallas]]

## Como se hace: Devolver una comanda despejada por error
1. Ir a la pestana Despejadas hoy (junto a Pantalla del area).
2. Ubicar la comanda en la lista de despejadas de hoy.
3. Pulsar el boton Devolver a cocina.
4. La comanda volvera de inmediato a la pantalla activa conservando su tiempo transcurrido original.
Ver tambien: [[caja]]

## Como se hace: Pedir que anulen un pedido que ya esta en cocina
1. Cocina no anula pedidos: solo Caja o el Administrador pueden hacerlo (decision del dueno).
2. Si un pedido no se debe preparar, avisa a Caja; ella lo anula desde el detalle del pedido, con motivo, y el pedido desaparece de todas las areas de cocina.
Ver tambien: [[caja]]

## Como se hace: Activar el modo de alta demanda
1. Pulsar el boton Alta demanda en la cabecera superior.
2. Elegir entre aumentar el tiempo estimado de entrega (+10, +15, +20 minutos) o Pausar temporalmente la recepcion de nuevos pedidos online configurados en [[mirest]].
3. Pulsar Guardar configuracion. En la carta web y al cliente se les informara la nueva demora automaticamente.
Ver tambien: [[mirest]]

## Como se hace: Marcar un producto como agotado
1. Pulsar el boton Marcar agotado en la cabecera (marca un producto, sabor u opcion que se acabo hoy; deja de ofrecerse al instante en la carta y en el chatbot).
2. Buscar el plato en el catalogo de [[productos]] o el ingrediente en [[stock]].
3. Elegir la duracion del agotado: Solo por el turno de hoy o Hasta que se reactive manualmente.
4. Pulsar Confirmar agotado. El producto dejara de estar disponible para pedidos de inmediato.
Lo que se marca asi es un agotado a mano: no vuelve solo al reponer stock ni al abrir el dia; se quita con Reactivar. En la lista Agotados ahora cada elemento dice "Agotado a mano (no vuelve solo)" o "Agotado por stock (vuelve al reponer)" (este ultimo lo marca el sistema cuando el saldo de un producto con stock llega a 0).
Despues: [[productos]]
Ver tambien: [[stock]]

## Como se hace: Registrar una merma de cocina
1. Pulsar el boton Registrar mermas en la barra superior (por caida, vencimiento, mala preparacion o calibracion; sirve para productos o insumos).
2. Seleccionar el insumo afectado registrado en [[stock]], ingresar la cantidad y unidad de medida.
3. Elegir el motivo: Se cayo, Vencido, Mal preparado u Otro (especificando detalle).
4. Pulsar Registrar merma. No se pide ningun codigo: la merma queda auditada con quien y cuando.
Despues: [[almacen]]
Ver tambien: [[stock]]

## Como se hace: Leer el tiempo en vivo y el numero del dia
1. Cada tarjeta de comanda muestra un reloj en vivo desde que el pedido entro a cocina: mm:ss (h:mm:ss pasada la hora) con una etiqueta de color: En tiempo (verde), Atencion (naranja, desde 35 min) o Urgente (rojo, desde 50 min). El reloj corre con la hora del servidor, asi que no se desfasa aunque el equipo este mal de hora.
2. En la tarjeta aparece grande el numero del dia, por ejemplo #7: es el orden en que el pedido llego a cocina hoy. Es solo referencial: el codigo CP-xxxx sigue siendo el que vale; no va en comprobantes. Un pedido anterior a esta funcion no muestra numero.
3. El numero se asigna la primera vez que el pedido llega a cocina y reinicia a #1 cada dia a la medianoche de Lima. Un pedido numerado conserva su numero aunque se anule. En Pedidos y caja se ve como "#N del dia".
4. En las pantallas de TV de [[pantallas]] el tiempo se ve mas grande con la misma etiqueta.
Ver tambien: [[caja]]

## Como se hace: Que no me pregunte Si o No al despejar
1. En la cabecera de Cocina activa o apaga la casilla Preguntar antes de despejar. Es un ajuste propio de cada cocinero; el boton Usar la del local lo devuelve al valor general del local (Configuracion, Confirmar al despejar).
2. Con la casilla apagada, pulsar Despejar despeja de inmediato sin la ventana Si, despejar. Si despejas por error, usa la pestana Despejadas hoy y Devolver a cocina.

## Como se hace: Atender el aviso de apertura del dia
1. Si hay productos con control de stock sin contar, arriba de Cocina aparece "Falta el conteo de apertura de hoy (N productos)" con el boton Contar ahora.
2. Pulsalo y completa el conteo en [[apertura]]. Ahi tambien se botan a merma las donas o galletas vencidas.
Despues: [[apertura]]

## Como se hace: Atender solo mi area (usuarios con rol Cocina)
1. Cada usuario con rol Cocina tiene asignadas las areas que atiende (se editan en [[usuarios]], edicion del usuario). La pantalla recuerda el area elegida por cada usuario.
2. Un combo como la Cajita Caprikids sale a cocina como lineas hijas: cada parte va a su area, con su cantidad y tamano, sin cobro propio; la linea madre del combo no tiene comanda.

## Como se hace: Despachar pedidos completos (pestana Despacho)
1. Abre la pestana Despacho. Muestra los pedidos vigentes de hoy con todas sus areas juntas, del mas antiguo al mas reciente. Los anulados no salen.
2. Cada tarjeta trae el codigo, la modalidad (mesa, llevar o delivery), el cliente o la mesa, los minutos de espera y los productos agrupados por area. Cada area dice Lista o Pendiente.
3. Cuando todas las areas estan listas, la tarjeta se marca COMPLETO (borde verde) y suena el aviso. Junta lo de cada area y entrega el pedido entero.
4. Pulsa el check grande de la tarjeta para marcarlo como atendido. Queda guardado con quien lo marco y a que hora, y la tarjeta se oculta.
5. Para ver los ya atendidos, activa Ver atendidos: salen atenuados. Su check los reabre si se marcaron por error.
6. Toca una tarjeta para abrir el detalle en grande: productos con tamano, opciones y notas por area; en delivery, cliente, telefono y direccion. Tiene el mismo check.
7. La pantalla se actualiza sola con los pedidos nuevos y los cambios de cada area. Marcar atendido no cambia el estado del pedido ni cierra su cobro.
Antes: [[caja]]

## Errores y dudas comunes
- Las tarjetas cambian de color segun el tiempo de espera, con una etiqueta que acompana al color: verde En tiempo, naranja Atencion (desde 35 minutos) y rojo Urgente (desde 50 minutos). Los minutos de corte son los parametros rep_naranja_min y rep_rojo_min de Configuracion. Ver la seccion del tiempo en vivo.
- En los pedidos de mesa, la tarjeta muestra grande, en la parte de arriba, la insignia con la mesa (por ejemplo Mesa 6, o Mesas 4 y 5 si se unieron). Un pedido extra muestra la misma mesa. Si dice Mesa sin asignar, la mesa no esta registrada: pregunta al mozo. Para llevar y delivery no llevan insignia de mesa.
- Para silenciar o activar la campana de alerta sonora de nuevos pedidos, pulsar el icono de campana junto a las pestanas.
- Si una orden tiene platos de varias areas, cada area debe despejar su parte de forma independiente antes de que el pedido pase a LISTO.
- Las comandas que ya despejo tu area no cuentan en el contador de pendientes ni disparan la alerta: solo se muestran para seguimiento hasta que las demas areas terminen.

## Quien puede hacerlo
- Personal de Cocina y Administrador tienen control operativo total para despejar, agotar, activar alta demanda y registrar mermas.
- El Cajero puede ver la pantalla en modo consulta para verificar el estado de preparacion de los pedidos.
- La pestana Despacho (permiso cocina/despacho) la usan Administrador, Supervisor, Cocina y Cajero; el Mozo no la ve.
