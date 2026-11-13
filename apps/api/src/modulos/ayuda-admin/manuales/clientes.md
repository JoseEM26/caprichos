---
modulo: clientes
titulo: Clientes
ruta: /admin/clientes
permiso: clientes/ver
roles: [ADMIN]
relacionados: [caja, ofertas, mensajes, zonas, usuarios]
sugerencias:
  - Como registro a un nuevo cliente en el sistema
  - Como busco el historial de compras de un cliente
  - Como ajusto o agrego puntos de fidelidad a un cliente
  - Como edito el telefono o direccion de un cliente
  - Como verifica el cliente su celular al crear su cuenta
  - Por que el cliente escribe primero al WhatsApp del negocio
  - El cliente dice que no avanza la verificacion del celular
---
# Clientes

## Para que sirve
Directorio centralizado de clientes de Caprichos. Permite registrar nuevos consumidores para compras en [[caja]], consultar su historial de pedidos y preferencias atendidas por [[mensajes]], gestionar el programa de puntos y cupones de [[ofertas]] y configurar beneficios especiales de reparto.

## Como se hace: Registrar un cliente nuevo desde mostrador o telefono
1. En la parte superior de la pantalla, pulsar el boton + Nuevo cliente.
2. Ingresar el Nombre completo y el Celular (9 digitos, empieza con 9). El celular es el usuario de su cuenta; no se pide DNI. Una empresa se registra con su RUC. Si ese celular ya estaba en el sistema por pedidos o chats de WhatsApp (sin cuenta), no da error: se crea la cuenta sobre esa misma persona y conserva sus pedidos y puntos; solo se completan nombre, cumpleanos y correo si estaban vacios. Si el celular es de un usuario del equipo, el sistema dice que ya recibe su descuento con ese celular y que no hace falta crearlo como cliente (si quiere su cuenta de la carta, se registra alli con ese mismo celular y se une a su persona); si ya es cliente, dice Ya existe un cliente con ese celular.
3. Completar el Correo electronico y la Fecha de cumpleanos si el cliente lo autoriza.
4. Marcar la casilla obligatoria de Acepta tratamiento de datos personales.
5. Pulsar el boton Guardar cliente.
Despues: [[caja]]
Ver tambien: [[mensajes]]

## Como se hace: Filtrar y ordenar la lista de clientes
1. Debajo del buscador hay botones rapidos. Para ver cuantas veces compran: Todos, Nuevos (1 pedido), Recurrentes (2 o mas) y Frecuentes (5 o mas). Para elegir las fechas: Hoy, Esta semana, Este mes o Desde siempre. Los pedidos y el consumo que se muestran son los pedidos cobrados dentro de esas fechas (no cuentan los anulados).
2. Pulsar Mas filtros para afinar: Tipo, Registro, Verificacion, Puntos (con o sin), Canal (Carta, WhatsApp, Caja o Mozo), rangos de Pedidos, Consumo (S/) y Puntos (desde y hasta), fechas propias (Compraron desde y hasta), Sin comprar hace mas de N dias (clientes dormidos) y Cumplen anos este mes. Todos se pueden combinar.
3. Los filtros puestos aparecen como botones con una X: tocar uno lo quita. Limpiar filtros quita todos.
4. Ordenar por Mas nuevos, Mas compras, Mas consumo, Mas puntos, Ultima compra o Nombre. Por pagina se elige 24, 48 o 96.
5. Los botones Tarjetas y Tabla cambian la vista. La tabla muestra nombre, celular, pedidos, consumo, puntos, ultima compra y si esta verificado; tocar una fila abre la ficha. El sistema recuerda la vista y el tamano elegidos en ese equipo.
Ver tambien: [[caja]]

## Como se hace: Descargar la lista en Excel
1. Poner los filtros que se quieran (la descarga trae toda la lista filtrada, no solo la pagina que se ve; hasta 10.000 clientes).
2. Pulsar Descargar Excel. Solo el Administrador ve este boton, porque el archivo lleva el celular completo.
3. Cada descarga queda en la auditoria con los filtros y la cantidad de filas, sin datos de personas.

## Como se hace: Sortear entre los clientes filtrados
1. Poner los filtros (por ejemplo Recurrentes y Este mes).
2. Pulsar Sorteo en vivo. Entran todos los clientes activos de la lista que tienen celular (hasta 5.000).
3. En pantalla solo se ven el nombre con la inicial del apellido (Maria G.) y los 3 ultimos digitos del celular, para poder mostrarlo en publico. El boton esta apagado si no hay resultados.

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

## Como se hace: Entender la verificacion del celular del cliente
La cuenta del cliente es celular + contrasena (sin DNI). Para crear la cuenta o recuperar la contrasena en la carta virtual, el celular se verifica por WhatsApp. Hay dos modos, que el Administrador elige en Configuracion, Parametros de operacion, "Como verifica el cliente su celular" (parametro verificacion_celular_modo):
1. WHATSAPP_ENTRANTE (el modo normal hoy): el cliente escribe primero al WhatsApp del negocio. En la carta toca el boton Abrir WhatsApp y enviar mensaje; WhatsApp abre un mensaje ya escrito con una clave de un solo uso (no hay que cambiar el texto) y el cliente solo pulsa enviar. Como WhatsApp informa de que numero viene, la llegada prueba que el celular es suyo. La carta lo detecta sola y pasa al siguiente paso con "Celular verificado. Seguimos con el siguiente paso...". No hace falta plantilla de Meta. La clave vence a los 10 minutos.
2. CODIGO_PLANTILLA (modo anterior, conservado): se envia un codigo de 6 digitos por una plantilla de Meta y el cliente lo escribe en la carta. Solo sirve si las plantillas caprichos_codigo_cuenta y caprichos_codigo_recuperar estan aprobadas por Meta. El codigo vence en 10 minutos y se permite maximo 3 solicitudes por hora por celular.
3. Numero por ambiente: "Numero que recibe la verificacion" (verificacion_whatsapp_numero) lleva el celular del negocio con codigo de pais (por ejemplo 51914244077). Si esta vacio se usa el numero configurado para el ambiente en el servidor y, si tampoco existe, el WhatsApp de contacto del local. En la demo y en preproduccion se usa un numero de prueba propio para no escribir al numero real de produccion; si el cliente escribe al numero equivocado la verificacion no avanza.
4. Si el cliente dice que no avanza: pidele revisar que mando el mensaje desde su propio WhatsApp al numero de Caprichos, sin cambiar el texto. A los 60 segundos la carta le dice que revisar. Si sigue igual, que pulse Pedir un enlace nuevo (o "El enlace vencio. Pide uno nuevo.") o avisa al local. Tras 5 mensajes desde otro celular la clave se invalida.
5. Registro y recuperar: en ambos modos termina igual, el cliente ya puede registrarse o crear una contrasena nueva. Si el celular ya tiene cuenta con contrasena el registro dice que ingrese o recupere.
Ver tambien: [[mensajes]]

## Errores y dudas comunes
- No es posible restar una cantidad de puntos superior al saldo actual que posee el cliente.
- Si un cliente solicita ser dado de baja, se puede cambiar su estado a Inactivo pulsando Desactivar cliente, lo cual inhabilita sus canjes sin borrar su historial de pedidos previo.
- El celular debe tener 9 digitos y empezar con 9. No puede repetirse entre cuentas activas.
- Los clientes no tienen DNI guardado: el DNI solo queda en el comprobante o en el reclamo cuando la ley lo exige.
- Lo unico que se guarda para facturar es el RUC (con su razon social y direccion fiscal), y solo cuando el cliente pide factura por primera vez. No se pide al crear la cuenta. Un RUC que empieza con 10 pertenece a una persona y contiene su DNI: tratalo como dato personal y no lo compartas.

## Quien puede hacerlo
- Solo el Administrador tiene autorizacion para acceder al modulo de Clientes y editar informacion.
- El ajuste de puntos requiere rol de Administrador o personal expresamente facultado con el permiso correspondiente.
