---
modulo: salon-vivo
titulo: Salón en vivo
ruta: /admin/salon-vivo
permiso: salon_vivo/ver
roles: [ADMIN, SUPERVISOR, CAJERO]
relacionados: [plano, caja, cocina, reservas, repartos, mis-pedidos]
sugerencias:
  - Como veo el salon en 3D con las mesas ocupadas
  - Como se que pedidos estan en cocina o listos en despacho
  - Como pongo el salon en vivo en la TV en pantalla completa
  - Como cambio la tematica del salon en 3D
  - Como pongo el salon en modo ligero porque va lento
  - Por que no veo el salon en 3D en mi equipo
---
# Salón en vivo

## Para que sirve
Muestra el local de Caprichos en 3D, dibujado a partir del plano que ya configuraste en [[plano]]: mesas, caja, exhibidor, cocina por áreas, baños y entrada. A la derecha ves lo que pasa de verdad en el salón: pedidos en caja, en cocina, listos en despacho y en reparto, las mesas con su estado y las reservas próximas. Es solo para mirar: desde aquí no se cobra, no se abre ni se cambia nada.

## Como se hace: leer la escena
1. Cada mesa tiene un aro de color y una etiqueta. Verde es libre, naranja es esperando su pedido, dorado es comiendo, azul oscuro es que pide la cuenta y morado es reservada.
2. Cuando una mesa se ocupa llegan sus clientes y se sientan; cuando se libera, se van. Si la mesa pidió la cuenta, quien paga pasa antes por la caja.
3. Cuando un pedido aparece listo en el despacho, suena la campana y Capri (o un mozo de apoyo) lo lleva a su mesa. Los pedidos para llevar esperan en la caja y los de delivery salen en moto cuando hay pedidos en reparto.
4. Los cocineros trabajan más rápido en el área con más pedidos por preparar. Capri se preocupa cuando algún pedido pasa de 15 minutos.
5. Nada se inventa: si no cambia nada en el salón, solo hay movimiento de fondo (miradas, saludos). Las personas que ves son una figura de los clientes reales; no se muestran nombres completos, teléfonos ni documentos.
6. Los clientes que crearon su avatar en la carta aparecen con su avatar en la escena (el titular de la mesa o quien espera para llevar) y con su retrato en la lista de pendientes; los demás son figuras genéricas. En modo ligero siempre se ven las figuras genéricas.
Antes: [[plano]]

## Como se hace: usar el panel de la derecha
1. A la derecha solo están los pedidos pendientes, cada uno con una barra de avance grande: En caja (dorado), En cocina (naranja, avanza a medida que cada área termina lo suyo) y ¡Listo! (verde, el pedido espera que lo lleven).
2. Arriba del panel ves cuántos hay en caja, en cocina y listos. Los listos salen primero.
3. Cuando el pedido se entrega o sale con el repartidor, desaparece de la lista.
4. Un borde rojo avisa los pedidos que pasan de 15 minutos.
Ver tambien: [[caja]], [[cocina]], [[repartos]]

## Como se hace: ponerlo en la TV del local
1. Pulsa "Abrir en la TV" (abajo en la escena) o entra en la TV a /tv/salon-vivo con un usuario que tenga el permiso.
2. Elige la cámara, la temática y la luz con los controles de abajo, y pulsa "Pantalla completa".
3. En pantalla completa desaparecen todos los controles, porque la ven los clientes. Para volver a cambiar algo, presiona Esc.

## Como se hace: mover la cámara y ahorrar equipo
1. La temática y la luz (hora real, día, atardecer o noche) se eligen en la barra de abajo. La temática solo cambia esta pantalla.
2. Arrastra para girar, rueda o pellizco para acercar. Los botones "Todo el local", "Cocina", "Salón" y "Seguir a Capri" mueven la cámara. Toca a Capri para que te salude.
3. "Voz de Capri" anuncia en voz alta los pedidos que quedan listos y "Sonido ambiente" activa el murmullo del salón. Ambos empiezan apagados.
4. Si el equipo va lento, pulsa "Modo ligero": quita sombras y efectos, baja la calidad y los cuadros por segundo. Se recuerda en ese equipo. Si tu equipo pide reducir movimiento, la pantalla ya viene sin animaciones: las personas aparecen directamente en su lugar.
5. Los datos se actualizan solos en tiempo real y, de respaldo, cada 8 segundos.

## Errores y dudas comunes
- Dice que el equipo no puede mostrar 3D: el navegador no tiene WebGL activo. El panel de la derecha sigue funcionando.
- Una mesa aparece libre aunque hay gente: el estado sale de los pedidos abiertos de la mesa. Si el mozo no abrió el pedido en [[plano]], el sistema no sabe que está ocupada.
- Cambié el plano y no se actualiza: la escena se vuelve a dibujar sola al guardar; si no, recarga la página.
- Un tipo de elemento raro del plano sale como una caja gris con su nombre: es normal, la escena no lo conoce.
- Las personas por mesa salen de la reserva o de la lista de espera. Si el sistema no sabe cuántos son, se muestran dos.

## Quien puede hacerlo
Ver el salón en vivo requiere el permiso salon_vivo/ver. Lo tienen por defecto el Administrador (ADMIN), el Supervisor (SUPERVISOR) y el Cajero (CAJERO). El Administrador puede dar o quitar el módulo a otros roles en Usuarios, "Qué ve cada rol". No muestra montos de dinero.
