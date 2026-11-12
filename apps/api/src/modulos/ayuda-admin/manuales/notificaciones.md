---
modulo: notificaciones
titulo: Notificaciones
ruta: /admin/notificaciones
permiso: notificaciones/ver
roles: [ADMIN, COCINA, MOZO, ALMACEN, REPARTIDOR, SUPERVISOR, MARKETING]
relacionados: [cocina, caja, stock, mensajes, repartos, reservas, escritorio]
sugerencias:
  - ¿Dónde veo los pedidos demorados y alertas urgentes de mi área?
  - ¿Cómo marco las notificaciones como leídas?
  - ¿Cómo creo un nuevo aviso para el equipo del local?
  - ¿Cómo voy directamente a resolver un pedido o mensaje pendiente?
  - ¿Por qué suena la campana cada pocos segundos?
  - ¿Por qué parpadea el menú de Reservas?
  - ¿Por qué no me llegan los avisos de pedidos nuevos?
---
# Notificaciones

## Para que sirve
Centro unificado de alertas y avisos en tiempo real para el equipo de Caprichos. Muestra en la parte superior las incidencias operativas que requieren atención inmediata (pedidos con retraso en [[cocina]], pagos en [[caja]], insumos críticos en [[stock]], mensajes de clientes en [[mensajes]] o despachos en [[repartos]]), y en la parte inferior mantiene el historial de notificaciones con filtros.

## Como se hace: revisar pendientes y resolver alertas urgentes
1. Al ingresar a la pantalla, observa las 4 tarjetas de métricas superiores: "Pendientes ahora" (total de avisos activos para tu área de trabajo), "Urgentes ahora" (incidencias de prioridad alta), "Sin leer en el historial" y "Total filtrado".
2. En la sección "Requiere atención ahora", verás las tarjetas destacadas con un borde de color según la gravedad (vino para urgentes, naranja para avisos regulares).
3. Cada alerta incluye información concreta: el tiempo transcurrido desde el evento, el código de pedido o insumo involucrado y el motivo del aviso.
4. Para atender la incidencia de inmediato, pulsa el botón de acción rápida que acompaña a la tarjeta (por ejemplo: "Ir al pedido", "Ver stock en almacén" o "Responder mensaje"). El sistema te redirigirá directamente a la pantalla correspondiente.
Despues: [[cocina]]
Ver tambien: [[caja]]

## Como se hace: marcar avisos como leídos y filtrar el historial
1. En la sección inferior "Historial de notificaciones", utiliza los filtros para encontrar alertas específicas:
   - "Buscar": escribe palabras clave o códigos.
   - "Tipo": selecciona entre "Todos", "Pedidos", "Cocina", "Stock", "Mensajes" o "Sistema".
   - "Estado": elige "Todas", "Solo nuevas" o "Solo leídas".
   - "Fecha": pulsa sobre los botones rápidos "Todo", "Hoy", "Ayer" o "Últimos 7 días", o ingresa fechas específicas en los campos "Desde" y "Hasta".
2. Para marcar una notificación individual como leída, pulsa el botón con icono de sobre o el texto "Marcar como leída". Si deseas volver a marcarla como pendiente, pulsa "Marcar como no leída".
3. Para limpiar todos los avisos acumulados de una sola vez, pulsa el botón "Marcar todas como leídas". Aparecerá la ventana de confirmación "¿Marcar todas las notificaciones como leídas?". Pulsa "Sí, marcar todas" o cancela con "No".
Ver tambien: [[historial]]

## Como se hace: crear un nuevo aviso interno para el equipo
1. En la barra superior de acciones, pulsa el botón "Nuevo aviso".
2. Se abrirá la ventana emergente "Nuevo aviso para el equipo".
3. Escribe un título conciso y el mensaje explicativo para el personal (por ejemplo: "Reunión de cambio de turno a las 4:00 pm" o "Verificar temperatura de conservadora 2").
4. Elige la prioridad ("Normal" o "Urgente") y los roles destinatarios.
5. Pulsa el botón "Enviar aviso". La notificación aparecerá instantáneamente en el panel de los colaboradores conectados.
Despues: [[notificaciones]]

## Como se hace: Entender la campana y los avisos que no se pierden
1. La campana de arriba muestra cuantos avisos sin leer tienes; el contador tambien aparece en el titulo de la pestana del navegador.
2. Cada pedido nuevo y cada reserva nueva tienen su aviso y le llega solo a quien puede atenderlo (por ejemplo, las reservas a quien tiene permiso de Reservas, los vouchers a Caja).
3. Cuando llega un aviso nuevo sale un aviso grande durante unos 8 segundos y luego se minimiza a la campana. Mientras no lo marques como leido suena un sonido cada 15 segundos.
4. Cada persona marca sus propios avisos: que uno los lea no los marca leidos para los demas. Tambien los avisos calculados (como "Caja sin abrir") se marcan por usuario.
5. El orden es: primero los no leidos por urgencia (los urgentes primero) y al final los leidos.
6. Las solicitudes de reserva pendientes (de la carta o de WhatsApp) aparecen como aviso urgente y el menu Reservas parpadea con su contador hasta atenderlas. Ver [[reservas]].
7. El boton "Marcar todas leidas" solo aparece si el Administrador lo dejo activo; si esta apagado cada aviso se marca aparte.
8. El sonido respeta tu horario de trabajo (Usuarios > Horarios y turnos): solo suena dentro de tu turno o si cubres a alguien hoy; fuera de horario la campana sigue mostrando los avisos y dice "Sonido en pausa". El Administrador, las personas marcadas 24/7 y quienes no tienen horario cargado suenan siempre.
Ver tambien: [[reservas]]

## Errores y dudas comunes
- Las alertas desaparecen solas: las notificaciones operativas de pedidos demorados o mensajes pendientes se resuelven y retiran automáticamente cuando el pedido cambia de estado o el mensaje es atendido por el personal.
- Actualización en vivo: la pantalla está conectada a sockets en tiempo real; no es necesario recargar el navegador para ver nuevos avisos.

## Quien puede hacerlo
El módulo de Notificaciones cuenta con una amplia cobertura en el equipo y está disponible mediante el permiso notificaciones/ver para los roles Administrador (ADMIN), Cocina (COCINA), Mozo (MOZO), Almacén (ALMACEN) y Repartidor (REPARTIDOR). Cada colaborador visualiza las alertas relevantes para su puesto operativo.
