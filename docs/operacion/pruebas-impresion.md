# Pruebas de impresión

Sirven para comprobar que la etiquetera y la ticketera están bien conectadas, sin hacer un pedido real.

## Dónde están

- **Configuración › Impresión de etiquetas** (y dentro de la caja): la fila **Pruebas de impresión** tiene un botón por máquina.
  - **Imprimir etiqueta de prueba**: sale por la etiquetera.
  - **Imprimir ticket de prueba**: sale por la ticketera.
- **Indicadores Etiquetera / Ticketera** (cocina y caja): al abrir el detalle de una máquina aparece su botón de prueba.

El botón está deshabilitado mientras la máquina no esté conectada, con el aviso
«Etiquetera desconectada: abre el programa de impresión» (o Ticketera).

## Qué sale

- **Etiqueta**: la misma etiqueta general de un pedido, con código PRUEBA, el nombre del local, fecha y hora de Lima, quién la pidió y una línea de ejemplo.
- **Ticket**: el mismo formato de ticket de pago, con el texto «PRUEBA DE TICKET (SIN VALOR)», dos líneas de ejemplo y un pago «SIN VALOR» en cero. No lleva comprobante, ni número ni hash.

Ninguna prueba es un pedido: no cuenta en pedidos, no genera avisos y no tiene cobro.

## Resultado

Tras confirmar («Sí, imprimir»), el botón muestra:

- **Enviada a la cola** y luego **Impresa** cuando la máquina la saca.
- **Error** con el motivo que reporta el programa del local (por ejemplo, sin papel).

Las pruebas aparecen en la cola de impresión con la etiqueta **Prueba** y se pueden descartar.

## Límites y auditoría

- Una prueba cada 10 segundos por máquina. Si se pulsa antes, el servidor responde con un aviso para esperar.
- Quién puede usarlas: los que ven la cola de impresión (ADMIN, CAJERO, COCINA y SUPERVISOR).
- Cada prueba queda en la auditoría como `IMPRESION_PRUEBA`, con la máquina pedida (sin datos personales).

## Endpoints

- `POST /admin/impresion/prueba` con `{ "rol": "ETIQUETERA" | "TICKETERA" }`: encola la prueba.
- `GET /admin/impresion/prueba/:id`: estado de la prueba (lo consulta la pantalla).
