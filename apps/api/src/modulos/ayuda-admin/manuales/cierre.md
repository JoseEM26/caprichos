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
---
# Caja y cierres

## Para que sirve
Gestion del cierre formal de la caja diaria y cambio de turno. Implementa el protocolo de arqueo ciego donde el personal declara el dinero sin ver los montos del sistema, audita los comprobantes digitales de [[mensajes]], liquida el efectivo pendiente de [[repartos]], concilia las ventas de [[caja]] y emite el balance para [[comprobantes]] e [[informes]].

## Como se hace: Resolver pendientes de cobro antes de cerrar
1. En la pestana Cierre actual, revisar la seccion 1: Pedidos pendientes de cobro.
2. Si aparecen pedidos en la lista, la caja no podra cerrarse por regla del sistema.
3. Para cada pedido pendiente, pulsar Ir a cobrar en [[caja]] o proceder a anularlo si fue cancelado o desistido.
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

## Como se hace: Proceder cuando la caja no cuadra
1. Si los montos declarados difieren de las ventas registradas, la pantalla muestra el aviso No cuadra y solicita un segundo conteo fisico.
2. Volver a contar el dinero y corregir las cantidades ingresadas.
3. Si la diferencia persiste tras el reconteo, la pantalla exige una Nota explicativa obligatoria. No se pide ningun codigo de supervisor.
4. Redactar el motivo de la diferencia y pulsar Cerrar caja. El cierre queda auditado con quien lo hizo.

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
- Un cierre no se puede revertir una vez emitido; queda registrado permanentemente en la pestana Historial de cierres.
- No se puede omitir el arqueo de monedas pequenas; cada denominacion debe contarse fielmente.

## Quien puede hacerlo
- Administrador, Cajero y Supervisor (permiso caja/ver) tienen acceso al modulo de cierres y a la auditoria de vouchers digitales con el permiso vouchers/ver.
- Cerrar una caja con descuadre o diferencia solo exige escribir la nota explicativa; no hay codigo de supervisor.
