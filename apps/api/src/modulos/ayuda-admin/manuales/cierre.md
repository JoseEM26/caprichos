---
modulo: cierre
titulo: Caja y cierres
ruta: /admin/cierre
permiso: caja/ver
roles: [ADMIN, CAJERO, SUPERVISOR]
relacionados: [caja, repartos, comprobantes, mensajes, propinas, informes]
sugerencias:
  - Como realizo el arqueo ciego al terminar el turno
  - Como audito los vouchers digitales de Yape y Plin antes del cierre
  - Que hago si el sistema me dice que la caja no cuadra
  - Como liquido el dinero que trajeron los repartidores
  - Donde veo las propinas del dia en el cierre
  - Las cortesias suman en el cierre
  - Una devolucion pendiente por cambio de ubicacion afecta el cierre
  - Como veo las ventas del turno en tabla o tarjetas con sus columnas y filtros
---
# Caja y cierres

## Para que sirve
Gestion del cierre formal de la caja diaria y cambio de turno. Implementa el protocolo de arqueo ciego donde el personal declara el dinero sin ver los montos del sistema, audita los comprobantes digitales de [[mensajes]], liquida el efectivo pendiente de [[repartos]], concilia las ventas de [[caja]] y emite el balance para [[comprobantes]] e [[informes]].

## Como se hace: Resolver pendientes de cobro antes de cerrar
1. En la pestana Cierre actual, revisar la seccion 1: Pedidos pendientes de cobro.
2. Si aparecen pedidos en la lista, la caja no podra cerrarse por regla del sistema.
3. Para cada pedido pendiente, pulsar Ir a cobrar en [[caja]] o proceder a anularlo si fue cancelado o desistido.
4. Un pedido ya Entregado que sigue sin cobrar (Para llevar, Recoger o Delivery digital) tambien impide cerrar: cobralo o anulalo. Si no se puede, solo el Administrador puede cerrar justificandolo: en el panel escribe un motivo (minimo 10 letras) y pulsa Justificar y permitir el cierre. El sistema avisa con la lista (ENTREGADOS_SIN_COBRAR) y deja auditado el cierre con el motivo. Si ademas hay pedidos todavia en curso, siguen bloqueando.
5. Tampoco se puede cerrar si queda algun pedido sin terminar: que no este Entregado ni Anulado, aunque ya este pagado (por ejemplo un delivery Listo o En camino). El panel Pedidos sin terminar lo lista (codigo, cliente, modalidad, estado, pago y total) con Ver pedido, Ir a Repartos (delivery), Entregar y Anular con motivo; el boton de cerrar sigue deshabilitado hasta que la lista quede vacia. El sistema responde PEDIDOS_SIN_TERMINAR. Solo el Administrador puede cerrar justificandolo: escribe un motivo (minimo 10 letras) y pulsa Justificar sin terminar y permitir el cierre; queda auditado como CIERRE_PEDIDOS_SIN_TERMINAR. Si en la caja siguiente quedan pedidos de dias anteriores sin terminar, un aviso en rojo lo recuerda.
Requiere: [[caja]]
Antes: [[caja]]
Ver tambien: [[caja]]

## Como se hace: Auditar la lista de vouchers de Yape y Plin del dia
1. En la seccion Vouchers digitales del dia, revisar el consolidado de comprobantes registrados durante la jornada (tanto los recibidos por WhatsApp en [[mensajes]] como los capturados por mozos en [[plano]]).
2. Comprobar el estado del semaforo asignado por la IA a cada comprobante: Confiable (verde), Observado (amarillo), Raro (naranja) o Ilegible (gris).
3. Hacer clic sobre la miniatura para visualizar la imagen completa del voucher en alta resolucion y contrastar el titular, monto y numero de operacion con el extracto bancario o la aplicacion del negocio.
4. Para cada comprobante verificado, pulsar el boton Marcar revisado y confirmar con Si, marcar revisado en el cuadro emergente.
5. El contador de vouchers pendientes de revision disminuira en vivo hasta quedar en cero.
Antes: [[mensajes]]
Ver tambien: [[caja]]

## Como se hace: Liquidar a los repartidores
1. En la seccion 2: Liquidacion de repartidores, identificar a cada motorizado con pedidos entregados cobrados en efectivo provenientes de [[repartos]].
2. Verificar el efectivo entregado en mano por el repartidor contra los pedidos de su turno.
3. Ingresar el monto recibido y pulsar Liquidar repartidor.
Antes: [[repartos]]
Ver tambien: [[repartos]]

## Como se hace: Realizar el arqueo ciego y cerrar caja
1. En la seccion 3: Arqueo ciego, contar fisicamente todos los billetes y monedas de la gaveta.
2. Ingresar la cantidad de cada denominacion (billetes de 200, 100, 50, 20, 10; monedas de 5, 2, 1, 0.50, 0.20, 0.10). El sistema sumara el total declarado.
3. Declarar los montos totales revisados en los reportes de medios digitales (Yape, Plin, Tarjeta, Transferencia).
4. Pulsar el boton Verificar y cerrar caja.
5. Si el conteo coincide exactamente con el sistema, se muestra el resultado Cuadra y la caja queda cerrada exitosamente.
Antes: [[caja]]
Despues: [[informes]]
Ver tambien: [[comprobantes]]

## Como se hace: Revisar las ventas del turno en tabla o tarjetas
1. En la pestana Turno actual, con la caja abierta, baja hasta la seccion Ventas del turno. Cada fila es una venta ya cobrada de la caja que vas a cerrar.
2. Arriba a la derecha elige Tabla o Tarjetas. La tabla es compacta para revisar muchas ventas; las tarjetas muestran cada venta completa y se leen bien en el celular. El sistema recuerda tu eleccion para la proxima vez.
3. En la vista Tabla pulsa Columnas para marcar o quitar las que quieres ver y usa las flechas para cambiar su orden. Puedes elegir: codigo, hora de la venta, quien la registro, tipo (local, para llevar, delivery), categoria, medio de pago, repartidor, cliente, total, propina, estado de cobro, quien cobro (Caja), cobrado por mozo, hora de cobro, comprobante, canal de origen, estado del pedido y mesa. Pulsa Restablecer columnas para volver a las de siempre. Tus columnas tambien se recuerdan.
4. Pulsa un titulo de columna para ordenar; pulsalo otra vez para invertir el orden y una tercera para quitarlo.
5. Escribe en la caja de busqueda un codigo o el nombre del cliente para encontrar una venta.
6. Pulsa Filtros para acotar por usuario que registro, quien cobro, tipo, categoria, medio de pago, repartidor, estado de cobro, comprobante o canal de origen. Los filtros se combinan entre si. Cada filtro elegido queda como una etiqueta con una x para quitarlo, y Quitar todos los borra juntos.
7. La franja de totales (ventas, total, propinas y monto por medio) siempre suma lo que estas viendo con los filtros. Si no hay filtros, coincide con las ventas del turno de arriba.
8. Pulsa Descargar CSV para bajar a Excel lo que estas viendo, con las columnas elegidas.
9. Abajo puedes cambiar cuantas ventas ver por pagina y pasar de pagina.
Ver tambien: [[caja]]

## Como se hace: Proceder cuando la caja no cuadra
1. Si los montos declarados difieren de las ventas registradas, la pantalla muestra el aviso No cuadra y solicita un segundo conteo fisico.
2. Volver a contar el dinero y corregir las cantidades ingresadas.
3. Si la diferencia persiste tras el reconteo, la pantalla exige una Nota explicativa obligatoria. No se pide ningun codigo de supervisor.
4. Redactar el motivo de la diferencia y pulsar Cerrar caja. El cierre queda auditado con quien lo hizo.

## Como se hace: Saber por que no cuadra un cierre
1. Quien cierra la caja ve en el cuadre el panel Antes de cerrar, revisa esto: pedidos anulados que ya habian pagado, cobros anulados del dia, ingresos y egresos registrados, pedidos sin cobrar, aviso de propinas y repartidores por liquidar, mas una lista de preguntas (contaste dos veces, el total de Yape es el de la app, el POS es del mismo lote, registraste los gastos, alguien pago por otro medio, devolviste lo anulado, diste vuelto). Esa guia nunca dice cuanto falta o sobra ni en que medio.
2. Si el arqueo no cuadra, el mismo panel cambia a Algo no cuadra: revisa estos puntos y se abre solo.
3. El Administrador abre Historial de cierres, entra al Detalle del cierre y pulsa la pestana Por que no cuadra. Solo lectura: no cambia ningun monto.
4. Arriba esta la tabla por medio (sistema, visto, diferencia y total). Debajo, tarjetas con posibles causas, cada una con su explicacion, los codigos de pedido y los montos (nunca nombres ni documentos de clientes): cobro registrado en un medio y pagado por otro, entro mas dinero del registrado, pedidos anulados con pago, cobros anulados, propinas por medio, ingresos y egresos, delivery sin liquidar, credito del personal, cobros de pedidos de otro dia, diferencia pequena de vuelto o redondeo y conteo de billetes distinto.
5. En Montos que coinciden, el sistema avisa si un monto listado, o la suma de hasta tres, es igual a la diferencia de un medio (con 10 centimos de margen). Es una pista, no una prueba.
6. Al final, la Ayuda general explica en palabras simples las causas comunes de sobrante y de faltante en efectivo, Yape o Plin, transferencia y tarjeta.
Antes: [[caja]]
Ver tambien: [[informes]]

## Como se hace: Entender las propinas, cortesias y ajustes en el cierre
1. Propinas del dia: si hubo propinas, el cierre muestra el bloque Propinas del dia con el total, el efectivo y lo digital. Van aparte de la venta: no son ingreso ni salen en comprobantes. En el efectivo esperado aparece la linea "+ Propinas en efectivo (van aparte de la venta)". Los medios digitales (Yape, Plin, transferencia, tarjeta) ya incluyen la parte de propina digital, pero no se suman al total vendido: el cierre lo aclara. Las devoluciones del dia ya estan descontadas. Ver [[propinas]].
2. Cortesias: una cortesia es una venta a S/ 0 (por su valor de lista), asi que no suma dinero al cierre ni al total vendido. Se audita aparte en el reporte Cortesias de [[informes]]. Ver [[caja]].
3. Cambio de ubicacion de un delivery pagado: si el envio cambio, queda un saldo por cobrar o una devolucion pendiente. Mientras la devolucion este pendiente no afecta el cierre (ni lo bloquea). Cuando Caja la marca como devuelta, en efectivo sale como egreso de la caja de hoy y en digital se descuenta del medio correspondiente en el cierre del dia. Un saldo cobrado entra como ingreso en efectivo o suma al medio digital. Ver [[repartos]].
4. Liquidacion de repartidores: ya no bloquea el cierre ni duplica el efectivo.
Ver tambien: [[propinas]]

## Errores y dudas comunes
- La clasificacion del semaforo de IA en los vouchers es un apoyo para agilizar la deteccion de anomalias o duplicados, pero no reemplaza la auditoria del cajero o administrador al cerrar turno.
- Los comprobantes en estado Ilegible o Raro exigen verificacion manual obligatoria contra los movimientos de la cuenta receptora antes de autorizar el cierre.
- El cajero nunca puede ver los montos esperados por el sistema durante el arqueo; este mecanismo ciego protege la integridad de la recaudacion.
- Un pedido pagado pero sin entregar (Listo o En camino) tambien impide cerrar: entregalo o anulalo desde el panel Pedidos sin terminar.
- Un cierre no se puede revertir una vez emitido; queda registrado permanentemente en la pestana Historial de cierres.
- No se puede omitir el arqueo de monedas pequenas; cada denominacion debe contarse fielmente.

## Quien puede hacerlo
- Administrador, Cajero y Supervisor (permiso caja/ver) tienen acceso al modulo de cierres y a la auditoria de vouchers digitales con el permiso vouchers/ver.
- Cerrar una caja con descuadre o diferencia solo exige escribir la nota explicativa; no hay codigo de supervisor.
