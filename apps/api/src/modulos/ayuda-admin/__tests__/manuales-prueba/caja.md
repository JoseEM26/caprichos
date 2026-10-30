---
modulo: caja
titulo: Pedidos y caja
ruta: /admin/caja
permiso: caja/ver
roles: [ADMIN, CAJERO]
relacionados: [cierre, cocina, comprobantes, supervisor-codigo]
sugerencias:
  - ¿Cómo anulo un pedido?
  - ¿Cómo registro un cobro?
  - ¿Cómo cierro la caja?
  - ¿Cómo abro la caja del día?
---
# Pedidos y caja

## Para que sirve
Permite gestionar todos los pedidos del día, atender cobranzas por diferentes medios de pago y realizar el control operativo del dinero en caja, conectado con [[cocina]] y [[comprobantes]].

## Como se hace: Anular un pedido
1. Entra a Pedidos y abre el pedido que necesitas anular.
2. Pulsa el botón Anular y selecciona el motivo de la anulación.
3. Si el pedido ya fue cobrado previamente, el sistema te solicitará el código del supervisor generado en [[supervisor-codigo]].
4. Confirma la acción pulsando Sí en el cuadro de diálogo.
Requiere: [[supervisor-codigo]]
Despues: [[comprobantes]]
Ver tambien: [[cierre]]

## Como se hace: Registrar un cobro
1. Abre Caja y selecciona el pedido pendiente de cobro.
2. Elige el medio de pago correspondiente: efectivo, Yape, Plin o transferencia bancaria.
3. Si pagan con captura digital, verifica minuciosamente que el monto coincida con el total.
4. Pulsa Cobrar y confirma la operación con Sí.
Despues: [[comprobantes]]
Ver tambien: [[cierre]]

## Como se hace: Abrir la caja
1. Entra a Caja y pulsa el botón Abrir caja.
2. Ingresa el monto inicial en efectivo con el que empieza el turno.
3. Confirma la apertura pulsando Sí.
Antes: [[cierre]]

## Errores y dudas comunes
Si un pedido ya está cobrado y entregado, no se puede anular sin la autorización del supervisor. Si el sistema no registra el cobro, comprueba tu conexión antes de reintentar.

## Quien puede hacerlo
Pueden utilizar este módulo el Administrador y el Cajero. Los mozos o cocineros no tienen acceso a la cobranza ni al cierre de caja.
