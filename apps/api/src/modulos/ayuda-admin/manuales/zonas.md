---
modulo: zonas
titulo: Zonas de reparto
ruta: /admin/zonas
permiso: zonas/ver
roles: [ADMIN]
relacionados: [mirest, repartos, mapa, caja]
sugerencias:
  - ¿Cómo cambio el precio de envío de una zona?
  - ¿Cómo desactivo una zona de reparto para no atenderla?
  - ¿Cómo edito los límites y puntos del mapa de una zona?
  - ¿Por qué un cliente no puede pedir si está cerca del local?
---
# Zonas de reparto

## Para que sirve
Gestiona las áreas geográficas donde Caprichos realiza entregas a domicilio (delivery). Se conecta con los costos de envío cobrados en [[caja]], el despacho físico a cargo de [[repartos]], los datos maestros de [[mirest]] y la visualización geográfica en [[mapa]].

## Como se hace: ver y configurar las zonas en el mapa
1. Abre Configuración, Zonas de reparto. Por defecto ves el mapa: cada zona tiene un color, su etiqueta con código y tarifa (S/ x.xx) y las zonas inactivas aparecen en gris punteado. El marcador de Caprichos es el local.
2. Las tarjetas de la derecha son la leyenda. Tocar una tarjeta selecciona la zona en el mapa, y tocar una zona en el mapa la selecciona en la lista. El conmutador "Lista" muestra las tarjetas con sus botones de siempre.
3. Con la zona seleccionada, el panel muestra su área aproximada y su historial de cambios (fecha, quién, antes y después).
4. Avisos de cobertura: si dos zonas activas se superponen, se indica cuál gana (la de menor código, la misma regla que usa la carta). Un polígono inválido también se avisa. Los espacios sin zona son normales: ahí el delivery está fuera de cobertura.
5. "Probar un punto": activa el modo y toca el mapa. Te dice a qué zona cae y su tarifa, o si está fuera de cobertura. Muestra la tarifa pura de la zona, sin el envío gratis por monto.
6. Solo con permiso zonas/editar: "Editar área en el mapa" muestra los vértices de la zona. Arrastra un vértice para moverlo, toca un cuadrito entre dos vértices para agregar uno y usa "Quitar vértice" (mínimo 3). Los cambios quedan en borrador: "Descartar" los deshace, y "Guardar cambios" abre la confirmación Sí/No con el número de vértices y el área antes y después.
7. "Editar JSON (avanzado)" abre el editor de coordenadas como respaldo.

Los cambios de tarifa, estado y área rigen solo para pedidos nuevos. Los pedidos ya creados conservan su envío y su zona; si una ubicación se corrige a mano en un pedido (Ubicar pedido), ese pedido sí recalcula su envío con la tarifa vigente.

## Como se hace: modificar la tarifa de una zona
1. En la lista de zonas de reparto, localiza la zona que deseas actualizar.
2. Pulsa el botón "Editar tarifa" en la fila correspondiente.
3. Se abrirá la ventana emergente "Editar tarifa". Escribe el nuevo monto en soles (debe ser un número mayor o igual a 0).
4. Pulsa el botón "Guardar".
5. Aparecerá el diálogo de confirmación "¿Guardar nueva tarifa?". Pulsa "Sí, guardar" para confirmar o "No, cancelar" para retroceder.
6. En la parte superior verás la confirmación con la hora exacta en que se guardó el cambio. La carta virtual cobrará esta tarifa de inmediato a las direcciones que caigan dentro de esa zona, en pedidos nuevos.
7. Envío gratis por monto: el parámetro envio_gratis_monto (70 por defecto) y envio_gratis_modo ("mas_de" = solo si la compra supera el monto, "desde" = desde el monto exacto) deciden cuándo el envío sale gratis. Con la regla de "mas_de", una compra de exactamente 70 paga la tarifa de su zona. La carta muestra la zona, la tarifa y, si aplica, que el envío es gratis por la compra.
Antes: [[mirest]]
Despues: [[caja]]

## Como se hace: activar o desactivar una zona
1. En la tabla de zonas, ubica la zona correspondiente y revisa su estado actual ("Activa" o "Inactiva").
2. Si deseas suspender temporalmente los pedidos hacia ese sector (por ejemplo por lluvia, reparaciones viales o falta de cobertura), pulsa el botón "Desactivar".
3. Aparecerá la ventana de confirmación con el mensaje "¿Desactivar zona X?". Pulsa "Sí, desactivar". A partir de ese momento, los clientes cuya dirección caiga en esa zona verán que el local no llega a su ubicación.
4. Para reanudar el servicio en el sector, pulsa el botón "Activar" en la misma fila y confirma con "Sí, activar".
Ver tambien: [[repartos]]

## Como se hace: editar el polígono de coordenadas de una zona
La forma normal es el editor del mapa (ver la sección anterior). El editor JSON sigue disponible como respaldo:
1. Si los límites de cobertura del distrito cambiaron, pulsa el botón "Editar polígono" en la zona deseada.
2. En la ventana emergente verás el arreglo de puntos en formato JSON con las coordenadas de latitud y longitud.
3. Modifica o añade las coordenadas asegurándote de que el polígono tenga un mínimo de 3 puntos cerrados y que los valores de latitud estén entre -90 y 90, y longitud entre -180 y 180.
4. Pulsa el botón "Validar y guardar".
5. Se mostrará el diálogo de confirmación "¿Guardar nuevo polígono?". Pulsa "Sí, guardar" para que el motor de geolocalización de la carta reconozca los nuevos límites.
Ver tambien: [[mapa]]

## Errores y dudas comunes
- El cliente dice que el sistema rechaza su dirección: verifica si la zona donde reside está marcada como "Inactiva" o si su coordenada geográfica exacta queda fuera de los polígonos trazados.
- Formato de polígono inválido: si el sistema muestra un error al guardar el polígono, revisa que el texto respete la sintaxis JSON con corchetes y comas correctas, y que contenga al menos tres pares de coordenadas numéricas.
- Código de supervisor: la modificación de tarifas y polígonos de reparto no exige código de supervisor; solo requiere la confirmación Sí/No.

## Quien puede hacerlo
El módulo requiere el permiso zonas/ver para visualizar la lista y zonas/editar para modificar precios o límites. En la configuración del sistema, ambos permisos corresponden exclusivamente al Administrador (ADMIN). Los cajeros, motorizados y personal de cocina no pueden alterar las tarifas de reparto.
