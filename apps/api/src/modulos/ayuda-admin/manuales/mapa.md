---
modulo: mapa
titulo: Mapa de entregas
ruta: /admin/mapa
permiso: zonas/ver
roles: [ADMIN]
relacionados: [repartos, zonas, informes, caja]
sugerencias:
  - ¿Cómo veo en el mapa dónde se concentran las entregas de delivery?
  - ¿Cómo activo el mapa de calor o las zonas de reparto?
  - ¿Dónde reviso los pedidos que intentaron hacerse fuera de cobertura?
  - ¿Cómo filtro el mapa por período o canal de venta?
---
# Mapa de entregas

## Para que sirve
Brinda una vista geografica e interactiva de todos los pedidos atendidos con servicio de entrega a domicilio en [[repartos]]. Permite visualizar la concentracion territorial de las ventas mediante un mapa de calor, analizar pedidos por zonas poligonales de reparto configuradas en [[zonas]] y por radios de distancia en kilometros desde el local, y detectar intentos de compra fuera del radio de cobertura para tomar decisiones de expansion.

## Como se hace: Visualizar y navegar en el mapa interactivo
1. Al ingresar a la pantalla, se despliega el mapa centrado sobre la ubicacion de la tienda principal de Caprichos.
2. Utiliza los botones con los signos "+" y "-" en la esquina superior del mapa para acercar o alejar la perspectiva territorial, o desliza el mapa libremente usando el mouse o el dedo.
3. Si te desplazaste a otra zona, pulsa en cualquier momento el boton "Centrar en la tienda" para regresar el foco a la base operativa.
Ver tambien: [[zonas]]

## Como se hace: Activar y alternar capas de informacion
1. En la barra de herramientas situada sobre el mapa, pulsa los botones de alternancia de capa segun el analisis que desees realizar:
   - "Mapa de calor": proyecta un degradado de calor que resalta las areas urbanas con mayor densidad de entregas completadas.
   - "Zonas de reparto": dibuja sobre el mapa los limites poligonales coloreados de cada sector comercial atendido en [[zonas]] (Campoy, Mangomarca, Zarate, Huachipa y San Juan de Lurigancho Centro).
   - "Radios de distancia": traza circunferencias concentricas a 1 km, 2 km, 3 km y 5 km alrededor del local.
Antes: [[zonas]]
Ver tambien: [[repartos]]

## Como se hace: Filtrar por fechas y canal de pedido
1. En el control de periodo, selecciona el intervalo deseado entre "Ultimos 7 dias", "Ultimos 30 dias" o "Todo el historial".
2. En el control de canal, selecciona "Todos los canales" o segmenta los pedidos recibidos por "Web", "WhatsApp" o "Call center".
3. Los puntos de entrega y los cuadros estadisticos se recalcularan inmediatamente.
Ver tambien: [[informes]]

## Como se hace: Analizar pedidos por zona y distancia
1. Debajo del mapa interactivo, revisa la tabla "Pedidos por zona", la cual detalla el conteo de pedidos despachados, el monto total vendido en soles y la participacion porcentual de cada zona.
2. Consulta la seccion "Pedidos por distancia" para evaluar la proporcion de entregas realizadas en el radio de cercania frente a aquellas que requieren traslados mas extensos.
Despues: [[zonas]]
Ver tambien: [[repartos]]

## Errores y dudas comunes
- Que indican los intentos fuera de cobertura: senala pedidos donde el cliente ingreso una direccion o ubicacion que excede los poligonos de reparto activos. Ayuda a identificar oportunidades para ampliar las rutas de entrega.
- Por que no se muestran puntos en el mapa: comprueba que el filtro de periodo abarque fechas con entregas registradas y que los pedidos cuenten con coordenadas validas en el sistema.

## Quien puede hacerlo
- Administrador: es el unico rol autorizado para ingresar al mapa de entregas y consultar la informacion analitica territorial (permiso zonas/ver).
- Los repartidores y cajeros atienden la logistica de despacho desde sus modulos de trabajo respectivos, sin acceso al mapa analitico global.
