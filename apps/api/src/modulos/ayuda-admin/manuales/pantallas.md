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
---
# Pantallas

## Para que sirve
Gestiona las pantallas y televisores inteligentes (Smart TV) del local dedicados a la visualización de comandas en [[cocina]], barra y despacho. Se vincula con la configuración de áreas en [[mirest]] y con el centro de alertas operativas en [[notificaciones]].

## Como se hace: vincular una nueva pantalla de TV
1. Enciende la televisión o abre el navegador web en el dispositivo y dirígete a la dirección de pantalla de cocina de Caprichos.
2. En la televisión aparecerá un código de vinculación de 6 caracteres (letras y números).
3. En el panel administrativo de Pantallas, escribe ese código en el campo "Código de la TV (6 caracteres)".
4. Pulsa el botón "Vincular pantalla".
5. Se abrirá la ventana de confirmación "¿Vincular esta pantalla?", con el aviso: "La TV con el código X empezará a mostrar los pedidos de cocina. No podrá cambiar nada".
6. Pulsa "Sí, vincular" para confirmar o "No, cancelar" para abortar.
7. Una vez vinculada, la televisión comenzará a recibir las comandas en tiempo real y quedará listada en tu panel con su nombre asignado.
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

## Errores y dudas comunes
- La televisión no muestra pedidos: verifica que la pantalla figure como "Activa" y con estado de conexión en verde. Si aparece desconectada, comprueba la conexión a Internet o red Wi-Fi de la TV.
- Código no válido: los códigos de 6 caracteres que muestra la TV tienen un tiempo de expiración. Si tardaste en ingresarlo, actualiza la página de la TV para generar un nuevo código e inténtalo nuevamente.
- Código de supervisor: vincular, activar o editar pantallas de TV no solicita código de supervisor; se valida únicamente con la confirmación Sí/No.

## Quien puede hacerlo
El módulo Pantallas requiere el permiso pantallas/ver y está restringido al rol Administrador (ADMIN), quien tiene permisos para pantallas/vincular y pantallas/desactivar. El personal de cocina utiliza las pantallas para visualizar las comandas, pero no tiene acceso para vincular ni reasignar estaciones desde este panel.
