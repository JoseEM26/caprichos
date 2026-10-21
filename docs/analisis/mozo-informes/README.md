---
id: ANA-CAP-037
tipo: analisis
titulo: "Revisión del rol Mozo"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, mozo-informes]
---

# Revisión del rol Mozo

Fecha: 18/10/2026. Tres informes de agentes de Antigravity sobre la v107: `kevin.md`, `pantalla.md`, `entorno.md`. Propuestas; no se cambió el mockup. Los números de línea que citan no valen: buscar por texto.

## Verificado contra el código (v107)
1. Una mesa ocupada no se puede tocar en el plano ("se libera al cobrar o a mano"): no se pueden agregar consumos a una mesa con pedido.
2. Una mesa reservada se bloquea aunque llegue el cliente de la reserva.
3. La precuenta solo tiene "Cerrar": no se imprime.
4. El mozo no puede marcar "Entregar al cliente y cerrar" (necesita permiso de gestión, que el mozo no tiene).
5. El escritorio muestra "Reservas de hoy" fijo en 4 y la comanda dice "mozo Luis" fijo.
6. Sin alerta de pedido listo para llevar a la mesa (solo un contador).
7. El descuento de 25 % del personal no se ve al tomar el pedido.

## Por verificar
Pedido duplicado por doble toque, cambiar de mesa y anular ítems, tamaño de las mesas del plano en celular, botones de edición de Productos visibles para el mozo, mesa liberada al cobrar por adelantado.

Construido en v109: ver `../delivery-informes/README.md` (bloque Mozo). Pendiente: división de cuenta, propinas, cierre del mozo, QR de mesa, asistencia, interfaz exclusiva de tablet y botones del plano más grandes en celular.
