---
modulo: ofertas
titulo: Ofertas y descuentos
ruta: /admin/ofertas
permiso: ofertas/ver
roles: [ADMIN]
relacionados: [productos, caja, comprobantes, novedades]
sugerencias:
  - ¿Cómo armo una promoción 2x1 o un combo?
  - ¿Cómo creo un descuento en porcentaje para una categoría?
  - ¿Cómo genero un cupón de descuento con código?
  - ¿Dónde reviso si un cliente ya usó un cupón?
---
# Ofertas y descuentos

## Para que sirve
Permite gestionar la estrategia de promociones y descuentos comerciales del negocio. Desde este modulo se configuran combos especiales sobre [[productos]], promociones de tipo lleva y paga (como 2x1 o 3x2), rebajas porcentuales o fijas sobre articulos o categorias completas, y cupones de descuento canjeables por codigo al cobrar en [[caja]].

## Como se hace: Armar un combo o promocion 2x1
1. Haz clic en la pestana "Combos y 2x1".
2. Pulsa el boton "+ Armar oferta".
3. En la ventana emergente, elige entre "Combo" o "Lleva y paga (2x1, 3x2)".
4. Escribe el nombre publico de la promocion y selecciona los productos que formaran parte de la misma.
5. Configura el precio especial o la cantidad de unidades que el cliente lleva frente a las que paga, los canales donde estara activa (carta web, salon o todos) y el periodo de vigencia.
6. Pulsa "Guardar oferta". En la ventana de confirmacion, pulsa "Si, continuar".
Antes: [[productos]]
Despues: [[caja]]
Ver tambien: [[novedades]]

## Como se hace: Crear un descuento directo
1. Dirigete a la pestana "Descuentos".
2. Pulsa el boton "+ Nuevo descuento".
3. Selecciona si el descuento se aplicara como porcentaje (por ejemplo 10% o 20%) o como monto fijo en soles.
4. Elige si la rebaja aplica a un producto individual o a una categoria entera de la carta.
5. Define los dias de la semana, los horarios validos y las fechas de inicio y fin del descuento.
6. Pulsa "Guardar descuento" y confirma con "Si, continuar".
Antes: [[productos]]
Ver tambien: [[caja]]

## Como se hace: Crear un cupon de descuento
1. Abre la pestana "Cupones".
2. Pulsa el boton "+ Nuevo cupon".
3. Escribe el codigo en letras mayusculas y numeros (por ejemplo: CAPRICHOS10).
4. Establece el valor del descuento, el consumo minimo requerido en la cuenta para aplicarlo y el limite maximo de usos generales o por persona vinculada a [[clientes]].
5. Pulsa "Crear cupon" y confirma con "Si, continuar".
Despues: [[caja]]
Ver tambien: [[clientes]]

## Como se hace: Pausar o desactivar una oferta activa
1. En la lista de promociones o descuentos, localiza la fila de la oferta en cuestion.
2. Pulsa el boton "Pausar" si deseas suspender la promocion temporalmente sin borrar su configuracion.
3. Para volver a encenderla en cualquier momento, pulsa "Activar".
4. Si la promocion llego a su fin definitivo, pulsa "Desactivar" y confirma la baja con "Si, confirmar".
Ver tambien: [[indicadores]]

## Errores y dudas comunes
- Como se prevé la apariencia de una oferta en la carta: en la pestana de promociones puedes pulsar el boton "Ver en carta" para abrir una previsualizacion exacta de como vera el cliente la oferta en la carta web.
- Se pueden acumular cupones con ofertas automaticas: las condiciones de acumulacion se configuran en la pestana "Reglas". Por defecto, el sistema restringe combinaciones que afecten el margen minimo del negocio.
- Donde revisar canjes de cupones: dentro de la pestana "Cupones", pulsa el boton "Historial de cupones" para auditar que pedidos y clientes utilizaron cada codigo.

## Quien puede hacerlo
- Administrador: es el unico rol autorizado para ingresar al modulo, crear promociones, configurar descuentos, emitir cupones y ajustar las reglas de acumulacion.
- Otros roles (Cajero, Cocina, Mozo, Repartidor, Almacen): no tienen acceso a este modulo.
