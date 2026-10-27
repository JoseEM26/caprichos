---
modulo: cierre
titulo: Caja y cierres
ruta: /admin/cierre
permiso: caja/ver
roles: [ADMIN, CAJERO]
relacionados: [caja, repartos, supervisor-codigo, comprobantes]
sugerencias:
  - Como realizo el arqueo ciego al terminar el turno
  - Que hago si el sistema me dice que la caja no cuadra
  - Como liquido el dinero que trajeron los repartidores
  - Por que no me deja cerrar la caja si tengo pedidos pendientes
---
# Caja y cierres

## Para que sirve
Gestion del cierre formal de la caja diaria y cambio de turno. Implementa el protocolo de arqueo ciego donde el personal declara el dinero sin ver los montos del sistema, liquida el efectivo pendiente de [[repartos]], concilia las ventas de [[caja]] y emite el balance para [[comprobantes]] e [[informes]].

## Como se hace: Resolver pendientes de cobro antes de cerrar
1. En la pestana Cierre actual, revisar la seccion 1: Pedidos pendientes de cobro.
2. Si aparecen pedidos en la lista, la caja no podra cerrarse por regla del sistema.
3. Para cada pedido pendiente, pulsar Ir a cobrar en [[caja]] o proceder a anularlo con autorizacion de [[supervisor-codigo]] si fue cancelado o desistido.
Antes: [[caja]]
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
3. Si la diferencia persiste tras el reconteo, la pantalla exigira el Codigo del supervisor de 6 digitos generado en [[supervisor-codigo]] y una Nota explicativa obligatoria.
4. Ingresar el codigo del supervisor, redactar el motivo de la diferencia y pulsar Cerrar con aprobacion de supervisor.
Requiere: [[supervisor-codigo]]
Ver tambien: [[supervisor-codigo]]

## Errores y dudas comunes
- El cajero nunca puede ver los montos esperados por el sistema durante el arqueo; este mecanismo ciego protege la integridad de la recaudacion.
- Un cierre no se puede revertir una vez emitido; queda registrado permanentemente en la pestana Historial de cierres.
- No se puede omitir el arqueo de monedas pequenas; cada denominacion debe contarse fielmente.

## Quien puede hacerlo
- Administrador y Cajero tienen acceso al modulo de cierres.
- Cerrar una caja con descuadre o diferencia requiere obligatoriamente la intervencion del Administrador o supervisor con su codigo rotativo de 6 digitos.
