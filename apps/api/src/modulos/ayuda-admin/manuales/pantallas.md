---
modulo: pantallas
titulo: Pantallas
ruta: /admin/pantallas
permiso: pantallas/ver
roles: [ADMIN]
relacionados: [cocina, mirest, notificaciones]
sugerencias:
  - ¿Cómo vinculo una nueva televisión de cocina con su código?
  - ¿Cómo asigno una pantalla a la estación de fríos o calientes?
  - ¿Cómo desactivo una pantalla si la televisión no se usará hoy?
  - ¿Qué hago si una pantalla dice que está desconectada?
  - ¿Cómo pongo la pantalla de pedidos del local en la TV?
  - ¿Cómo oculto el nombre del cliente en la pantalla del local?
---
# Pantallas

## Para que sirve
Gestiona las pantallas y televisores inteligentes (Smart TV) del local dedicados a la visualización de comandas en [[cocina]], barra y despacho. Se vincula con la configuración de áreas en [[mirest]] y con el centro de alertas operativas en [[notificaciones]].

## Como se hace: vincular una nueva pantalla de TV
1. En el navegador de la TV abre la dirección de la vista que quieres: caprichos.pe/tv/salon-vivo (Salón en vivo), caprichos.pe/pantalla/cocina (Cocina) o caprichos.pe/pantalla-local (Pedidos del local). No pide usuario ni contraseña.
2. La TV muestra un código grande de 6 caracteres (letras y números, con un guion al medio) y una cuenta regresiva: el código cambia solo cada 10 minutos.
3. En el administrativo, en Pantallas, escribe ese código en la casilla de vinculación (con o sin guion).
4. Pulsa el botón "Vincular pantalla".
5. Se abrirá la ventana "¿Vincular esta pantalla?". Pulsa "Sí, vincular" para confirmar o "No, cancelar" para abortar.
6. La TV entra sola a su vista en unos segundos y queda en la lista con su vista ("Salón en vivo", "Pedidos del local" o "Cocina · área"). Luego puedes cambiarle el nombre y el área con "Editar".
7. Solo se puede vincular una TV que esté mostrando su código en ese momento; no se crean pantallas desde aquí. Si desactivas una pantalla, esa TV vuelve a mostrar un código.
Despues: [[cocina]]
Ver tambien: [[mirest]]

## Como se hace: editar el nombre o la estación asignada
1. En la lista de pantallas, busca el dispositivo que deseas reconfigurar y pulsa el botón "Editar".
2. En la ventana "Editar pantalla", escribe un nombre descriptivo (por ejemplo: "TV Barra Principal" o "Monitor Planchas").
3. En el selector "Estación asignada", elige el área de preparación cuyas comandas debe mostrar esa pantalla (por ejemplo: "Todas", "Bebidas calientes", "Frappes", "Waffles" o "Salados").
4. Pulsa el botón "Guardar cambios". La pantalla en la cocina actualizará sus pedidos automáticamente según la estación elegida.
Antes: [[cocina]]
Ver tambien: [[pantallas]]

## Como se hace: activar o desactivar una pantalla
1. Si un televisor está apagado, en mantenimiento o no se requiere en el turno actual, pulsa el botón "Desactivar" en su tarjeta.
2. Se abrirá la ventana emergente "¿Desactivar Pantalla X?".
3. Pulsa "Sí, desactivar" para confirmar o "No, cancelar" para mantenerla activa. La pantalla dejará de recibir y acumular pedidos en memoria.
4. Para reactivarla cuando se reanude el servicio en esa área, pulsa el botón "Activar" y confirma en la ventana emergente con "Sí, activar".
Ver tambien: [[cocina]]

## Como se hace: poner la pantalla de pedidos del local en la TV
1. Esta pantalla es para el personal y los clientes en sala: muestra solo pedidos, con el reloj, sobre fondo claro. Ya no tiene a Capri. Como lleva nombre, productos y forma de pago, ya no es pública: se vincula con código igual que el Salón en vivo.
2. En el navegador de la TV escribe caprichos.pe/pantalla-local. La TV muestra un código grande de 6 caracteres. En Pantallas escríbelo y pulsa "Vincular pantalla"; la TV entra sola a "Pedidos del local". Con sesión y permiso de cocina también se puede abrir desde Configuración del local, pestaña "Parámetros de operación", grupo "Pantalla de pedidos del local (TV)", botón "Abrir pantalla del local".
3. Cada tarjeta muestra el código, quién pidió, dónde (Mesa N, Comer en el local, Para llevar, Recoger o DELIVERY con su zona), cada producto con cantidad, tamaño, opciones, sabores, nombre del vaso y nota, el pago (Pagado o Por cobrar y con qué medio) y cuánto tiempo lleva esperando, que corre solo y se pone naranja o rojo si se demora.
4. El avance se ve por partes: En caja, En cocina, Listo. Debajo, cada área con su estado (por ejemplo "Salado ✓ Lista" y "Bebidas ● Preparando").
5. Los pedidos anulados se quedan 2 minutos marcados con el sello ANULADO y luego desaparecen. Un pedido "Listo" se queda unos 20 minutos si nadie lo entrega antes; los entregados salen.
6. Si hay más pedidos de los que caben (6 por pantalla), la pantalla pasa sola de página cada 12 segundos y abajo indica "Página 1 de 2".
7. Pulsa "Pantalla completa" (el botón aparece al mover el mouse o tocar la pantalla y se esconde solo). La pantalla se actualiza sola cada 5 segundos.
8. Para ocultar el nombre del cliente, en Configuración del local, grupo "Pantalla de pedidos del local (TV)", cambia "Mostrar nombre del cliente en la pantalla" a "No". Solo se muestra el nombre de pila: nunca apellidos, celular, DNI ni la dirección (en delivery solo la zona).
Ver tambien: [[cocina]]

## Errores y dudas comunes
- La pantalla del local pide un código al abrirla: es lo normal la primera vez. Vincúlala en Pantallas; si la desactivas, la TV vuelve a pedir código.
- La pantalla del local dice "Sin conexión, reintentando": revisa el Internet de la TV; sigue mostrando lo último que recibió y se recupera sola.
- La televisión no muestra pedidos: verifica que la pantalla figure como "Activa" y con estado de conexión en verde. Si aparece desconectada, comprueba la conexión a Internet o red Wi-Fi de la TV.
- "No hay ninguna TV mostrando ese código": el código venció o está mal escrito. La TV ya cambió a otro código solo; escribe el que ves ahora.

## Quien puede hacerlo
El módulo Pantallas requiere el permiso pantallas/ver y está restringido al rol Administrador (ADMIN), quien tiene permisos para pantallas/vincular y pantallas/desactivar. El personal de cocina utiliza las pantallas para visualizar las comandas, pero no tiene acceso para vincular ni reasignar estaciones desde este panel.
