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
1. En el navegador de la TV abre la dirección de la vista que quieres: caprichos.pe/tv/salon-vivo (Salón en vivo) o caprichos.pe/pantalla/cocina (Cocina). No pide usuario ni contraseña.
2. La TV muestra un código grande de 6 caracteres (letras y números, con un guion al medio) y una cuenta regresiva: el código cambia solo cada 10 minutos.
3. En el administrativo, en Pantallas, escribe ese código en la casilla de vinculación (con o sin guion).
4. Pulsa el botón "Vincular pantalla".
5. Se abrirá la ventana "¿Vincular esta pantalla?". Pulsa "Sí, vincular" para confirmar o "No, cancelar" para abortar.
6. La TV entra sola a su vista en unos segundos y queda en la lista con su vista ("Salón en vivo" o "Cocina · área"). Luego puedes cambiarle el nombre y el área con "Editar".
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
1. Esta pantalla es distinta a la de cocina: la ven los clientes y no pide código ni sesión. Muestra a Capri, los pedidos "Comer en el local" y "Para llevar", con "Preparando" y "¡Listo! Acércate a la barra".
2. En Configuración del local, pestaña "Parámetros de operación", abre el grupo "Pantalla de pedidos del local (TV)" y pulsa "Abrir pantalla del local". También puedes escribir la dirección /pantalla-local de Caprichos en el navegador de la TV (ejemplo: caprichos.pe/pantalla-local).
3. Pulsa "Pantalla completa" (los botones aparecen al mover el mouse o tocar la pantalla y se esconden solos a los pocos segundos).
4. Si quieres que Capri avise con voz y sonido cuando un pedido pasa a "Listo", pulsa "Activar sonido y voz". El navegador exige ese clic una vez cada vez que abres la página.
5. La pantalla se actualiza sola cada 5 segundos. Los pedidos de delivery no se muestran, y un pedido "Listo" se queda unos 20 minutos si nadie lo entrega antes.
6. Para ocultar el nombre del cliente, en el mismo grupo cambia "Mostrar nombre del cliente en la pantalla" a "No". Solo se muestra el nombre de pila, nunca apellidos, teléfono ni documento.
7. La temática (Navidad, Halloween, Fiestas Patrias, San Valentín, Año Nuevo) sigue a la de Capri en [[mascota]].
Ver tambien: [[mascota]]

## Errores y dudas comunes
- La pantalla del local dice "Sin conexión, reintentando": revisa el Internet de la TV; sigue mostrando lo último que recibió y se recupera sola.
- La televisión no muestra pedidos: verifica que la pantalla figure como "Activa" y con estado de conexión en verde. Si aparece desconectada, comprueba la conexión a Internet o red Wi-Fi de la TV.
- "No hay ninguna TV mostrando ese código": el código venció o está mal escrito. La TV ya cambió a otro código solo; escribe el que ves ahora.

## Quien puede hacerlo
El módulo Pantallas requiere el permiso pantallas/ver y está restringido al rol Administrador (ADMIN), quien tiene permisos para pantallas/vincular y pantallas/desactivar. El personal de cocina utiliza las pantallas para visualizar las comandas, pero no tiene acceso para vincular ni reasignar estaciones desde este panel.
