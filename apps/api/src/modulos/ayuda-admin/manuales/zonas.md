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

## Como se hace: modificar la tarifa de una zona
1. En la lista de zonas de reparto, localiza la zona que deseas actualizar.
2. Pulsa el botón "Editar tarifa" en la fila correspondiente.
3. Se abrirá la ventana emergente "Editar tarifa". Escribe el nuevo monto en soles (debe ser un número mayor o igual a 0).
4. Pulsa el botón "Guardar".
5. Aparecerá el diálogo de confirmación "¿Guardar nueva tarifa?". Pulsa "Sí, guardar" para confirmar o "No, cancelar" para retroceder.
6. En la parte superior verás la confirmación con la hora exacta en que se guardó el cambio. La carta virtual cobrará esta tarifa de inmediato a las direcciones que caigan dentro de esa zona.
Antes: [[mirest]]
Despues: [[caja]]

## Como se hace: activar o desactivar una zona
1. En la tabla de zonas, ubica la zona correspondiente y revisa su estado actual ("Activa" o "Inactiva").
2. Si deseas suspender temporalmente los pedidos hacia ese sector (por ejemplo por lluvia, reparaciones viales o falta de cobertura), pulsa el botón "Desactivar".
3. Aparecerá la ventana de confirmación con el mensaje "¿Desactivar zona X?". Pulsa "Sí, desactivar". A partir de ese momento, los clientes cuya dirección caiga en esa zona verán que el local no llega a su ubicación.
4. Para reanudar el servicio en el sector, pulsa el botón "Activar" en la misma fila y confirma con "Sí, activar".
Ver tambien: [[repartos]]

## Como se hace: editar el polígono de coordenadas de una zona
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
