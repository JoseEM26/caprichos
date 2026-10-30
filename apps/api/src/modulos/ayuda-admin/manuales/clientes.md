---
modulo: clientes
titulo: Clientes
ruta: /admin/clientes
permiso: clientes/ver
roles: [ADMIN, CALLCENTER]
relacionados: [caja, ofertas, mensajes]
sugerencias:
  - Como registro a un nuevo cliente en el sistema
  - Como busco el historial de compras de un cliente
  - Como ajusto o agrego puntos de fidelidad a un cliente
  - Como edito el telefono o direccion de un cliente
---
# Clientes

## Para que sirve
Directorio centralizado de clientes de Caprichos. Permite registrar nuevos consumidores para compras en [[caja]], consultar su historial de pedidos y preferencias atendidas por [[mensajes]], gestionar el programa de puntos y cupones de [[ofertas]] y configurar beneficios especiales de reparto.

## Como se hace: Registrar un cliente nuevo desde mostrador o telefono
1. En la parte superior de la pantalla, pulsar el boton + Nuevo cliente.
2. Ingresar el Nombre completo y el Celular (9 digitos, empieza con 9). El celular es el usuario de su cuenta; no se pide DNI. Una empresa se registra con su RUC.
3. Completar el Correo electronico y la Fecha de cumpleanos si el cliente lo autoriza.
4. Marcar la casilla obligatoria de Acepta tratamiento de datos personales.
5. Pulsar el boton Guardar cliente.
Despues: [[caja]]
Ver tambien: [[mensajes]]

## Como se hace: Consultar la ficha y compras de un cliente
1. En el buscador superior, escribir el nombre o el celular del cliente.
2. Hacer clic sobre la fila del cliente en la tabla de resultados.
3. Se abrira la Ficha del cliente mostrando su saldo de puntos, nivel de cliente, cantidad total de compras registradas en [[caja]], monto historico gastado y direcciones registradas.
Ver tambien: [[caja]]

## Como se hace: Ajustar puntos de fidelidad
1. En la ficha del cliente, pulsar el boton Ajustar puntos.
2. Seleccionar el Tipo de ajuste: Sumar puntos o Restar/reversar puntos canjeables en [[ofertas]].
3. Ingresar la Cantidad de puntos a modificar.
4. Escribir el Motivo obligatorio del ajuste (minimo 3 caracteres, por ejemplo: Bono por compensacion de demora o Correccion de saldo).
5. Pulsar el boton Continuar.
6. En la ventana de confirmacion ¿Confirmas el ajuste de puntos?, pulsar Si, ajustar.
Ver tambien: [[ofertas]]

## Como se hace: Editar datos y descuentos de un cliente
1. En la ficha del cliente, pulsar el boton Editar datos.
2. Modificar el telefono, correo o fecha de cumpleanos.
3. Si corresponde, configurar un Costo de envio fijo o Descuento de envio especial aplicable a las [[zonas]] de delivery.
4. Pulsar Guardar cambios.
Ver tambien: [[zonas]]

## Errores y dudas comunes
- No es posible restar una cantidad de puntos superior al saldo actual que posee el cliente.
- Si un cliente solicita ser dado de baja, se puede cambiar su estado a Inactivo pulsando Desactivar cliente, lo cual inhabilita sus canjes sin borrar su historial de pedidos previo.
- El celular debe tener 9 digitos y empezar con 9. No puede repetirse entre cuentas activas.
- Los clientes no tienen DNI guardado: el DNI solo queda en el comprobante o en el reclamo cuando la ley lo exige.

## Quien puede hacerlo
- Administrador y Call Center tienen autorizacion para acceder al modulo de Clientes y editar informacion.
- El ajuste de puntos requiere rol de Administrador o personal expresamente facultado con el permiso correspondiente.
