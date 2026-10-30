---
modulo: compras
titulo: Compras
ruta: /admin/compras
permiso: stock/ver
roles: [ADMIN, ALMACEN]
relacionados: [almacen, stock, cierre, comprobantes]
sugerencias:
  - ¿Cómo registro una compra de insumos con factura o boleta?
  - ¿Dónde veo qué insumos están por terminarse para pedir al proveedor?
  - ¿Cómo genero la lista de compras para enviarla por WhatsApp?
  - ¿Cómo doy de alta a un proveedor nuevo en el sistema?
---
# Compras

## Para que sirve
Centraliza la adquisicion de materias primas e insumos necesarios para la operacion del local. Permite registrar facturas, boletas y guias de compra, actualizar el costo y el inventario en [[almacen]] de forma automatica, gestionar los datos de contacto de proveedores y revisar que insumos de [[stock]] requieren reposicion urgente segun sus niveles criticos.

## Como se hace: Registrar una compra de insumos
1. En la parte superior de la pantalla, pulsa el boton "Registrar compra".
2. Selecciona el proveedor en la lista desplegable o escribe su nombre para buscarlo.
3. Elige el tipo de comprobante recibido (Factura, Boleta, Guia o Recibo) e ingresa el numero de serie y correlativo.
4. En el detalle del documento, selecciona cada insumo adquirido, escribe la cantidad ingresada y el costo unitario pactado en soles.
5. Elige la condicion de pago (Contado o Credito) y el metodo con el que se liquido o liquidara.
6. Pulsa el boton "Guardar compra". En el mensaje de confirmacion, pulsa "Si, confirmar". El inventario del almacen principal aumentara inmediatamente.
Antes: [[stock]]
Despues: [[almacen]]
Ver tambien: [[cierre]]

## Como se hace: Consultar faltantes y pedir por WhatsApp
1. Haz clic en la pestana "Que falta pedir".
2. La vista muestra los insumos con niveles criticos en semaforo rojo o amarillo segun el estado en [[stock]], agrupados bajo el proveedor que los suministra habitualmente.
3. Revisa la cantidad sugerida para reponer existencias.
4. Pulsa el boton con el icono de WhatsApp junto al proveedor correspondiente. Se abrira una conversacion con un mensaje predeterminado que lista los insumos y las cantidades requeridas para facilitar el envio del pedido.
Antes: [[stock]]
Despues: [[compras]]

## Como se hace: Registrar un proveedor nuevo
1. Dirigete a la pestana "Proveedores".
2. Pulsa el boton "+ Nuevo proveedor".
3. Escribe la razon social o nombre del proveedor, numero de RUC o documento, telefono de contacto y direccion de correo electronico.
4. Pulsa "Guardar proveedor" y confirma la operacion para que quede disponible al ingresar compras.
Despues: [[compras]]

## Como se hace: Realizar una compra rapida menor
1. Pulsa el boton "Compra rapida" en la cabecera del modulo.
2. Selecciona el insumo comprado al paso en caja o comercio local, escribe la cantidad recibida y el monto pagado en efectivo.
3. Pulsa "Registrar ingreso" para asentar el costo y sumar las unidades al inventario sin requerir el formulario extenso.
Despues: [[almacen]]
Ver tambien: [[cierre]]

## Errores y dudas comunes
- Las existencias aumentan al instante: si, toda compra confirmada suma automaticamente las unidades correspondientes al stock del almacen principal.
- Como anular una compra mal registrada: en la pestana "Historial de compras", pulsa "Ver detalle" sobre la compra afectada y haz clic en "Anular compra". Deberas indicar el motivo y confirmar con "Si, anular" para que el sistema reste las cantidades ingresadas por error.
- Que hacer si no aparece el telefono del proveedor: edita los datos del proveedor en la pestana "Proveedores" para que el enlace a WhatsApp se active correctamente.

## Quien puede hacerlo
- Administrador y Almacen: tienen acceso para consultar necesidades de reposicion, dar de alta proveedores, registrar compras y anular comprobantes errados.
- Cocina: puede visualizar existencias en su area, pero no tiene acceso para registrar compras ni gestionar proveedores.
- Otros roles (Cajero, Mozo, Repartidor): no tienen acceso al modulo de compras.
