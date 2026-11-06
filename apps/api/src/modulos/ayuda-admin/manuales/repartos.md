---
modulo: repartos
titulo: Repartos
ruta: /admin/repartos
permiso: repartos/ver
roles: [ADMIN, CAJERO, REPARTIDOR, SUPERVISOR, MOZO]
relacionados: [caja, cocina, cierre, zonas, mensajes, mapa, usuarios, asistencia]
sugerencias:
  - Como tomo un pedido o una ruta para repartir
  - Como le escribo por WhatsApp al cliente de mi pedido
  - La ubicacion del cliente esta mal, como la corrijo
  - Como veo que repartidores estan libres u ocupados
  - Como cambio la ubicacion de un pedido de delivery
  - Como veo todos los pedidos de delivery y en que etapa estan
  - Como suelto o reasigno un pedido
  - Como tomo un pedido yo mismo como administrador
---
# Repartos

## Para que sirve
Modulo de asignacion, ruta y seguimiento de los pedidos a domicilio. Muestra los pedidos que [[cocina]] ya dejo listos, los reparte entre los repartidores, dibuja la ruta en el mapa (limitado por las [[zonas]]) y controla el efectivo que hay que rendir en [[caja]] y [[cierre]].

Segun el rol la pantalla es distinta: el Repartidor conserva su pantalla todo-mapa para celular con solo sus pedidos; los demas roles ven la vista de seguimiento.

Para Administrador, Supervisor, Cajero y Mozo la pantalla es de seguimiento: muestra que lleva y entrega cada repartidor y todos los pedidos de delivery.

## Reglas de seguridad y aislamiento
1. Cada repartidor ve y toca solo sus pedidos; si intenta con uno ajeno el sistema responde 403 NO_ASIGNADO ("Solo puedes tomar rutas para ti" / "Este pedido no esta asignado a ti").
2. El telefono completo, la direccion exacta y el chat del cliente solo se ven despues de tomar el pedido; antes se ve la zona y una direccion aproximada.
3. Tope de pedidos: un repartidor no puede llevar mas del maximo (por defecto 5, parametro rep_max_pedidos, entre 1 y 20). Mensajes: "Ya llevas el maximo de N pedidos: entrega alguno antes de tomar otro" y "Tu ruta supera el maximo de N pedidos: entrega alguno antes de tomar otro".
4. Un delivery no se entrega sin repartidor asignado, y un pedido sin ubicacion en el mapa muestra "Falta ubicar" en vez de Tomar pedido.

## Vista del Repartidor (celular, todo mapa)
- Barra inferior con tres botones: Pedidos (mapa con los pedidos disponibles y proximos), Mis pedidos (los que ya tomaste, con sus pasos) y Mas.
- El menu Mas tiene: Mi perfil, Notificaciones, Hechos hoy (N), Mis rutas, Reportar falla (si tienes pedidos activos), Rutas sugeridas y Cerrar sesion. Si tienes permiso de asistencia, un boton pequeno Asistencia te lleva a [[mi-asistencia]].
- En el mapa cada pedido es un marcador numerado con el nombre del cliente y el codigo, coloreado por tiempo de espera. Toca un marcador para elegirlo; manten presionado (presion larga) y pulsa Ver detalles para abrir la hoja inferior con zona, direccion, telefono (solo si es tuyo), forma de pago, nota y total.
- Hechos hoy muestra las entregas completadas y la tarjeta "Efectivo para liquidar" que se rinde en [[caja]].

## Como se hace: Tomar pedidos y empezar una ruta
1. En Pedidos, toca uno o varios marcadores o usa Agregar a mi ruta en el menu del pedido. Se arma tu ruta con linea y numeros de parada.
2. Pulsa Tomar ruta: el sistema pregunta "Tomar esta ruta?" con la lista de pedidos en orden. Confirma con Si, confirmar. Aparece "Ruta tomada". Si prefieres uno solo, usa Tomar solo este pedido.
3. Tambien puedes abrir Rutas sugeridas (en el menu Mas): hasta 5 rutas agrupadas por sector, incluida la mas cercana y la mas urgente. Eliges una y pulsas Iniciar ruta; se abre tu aplicacion de mapas favorita (Google Maps, Waze, Apple Maps u otra).
4. Es todo o nada: si otro repartidor gana un pedido antes que tu, el sistema avisa cual se perdio y no toma la ruta incompleta sin decirtelo.
5. Orden: tu eliges con cual empezar (Empezar por este) y el resto queda por cercania; es obligatorio respetar el orden. El numero de parada no cambia hasta cerrar la ruta. Saltar este pedido esta permitido con motivo, maximo 2 veces por pedido ("Ya saltaste este pedido 2 veces: reporta la falla"), y queda auditado; el sistema avisa cual sigue ("Saltaste el #2; sigue el #3").
Antes: [[cocina]]

## Como se hace: Entregar un pedido paso a paso
1. En Mis pedidos, el boton grande cambia segun la etapa: Salir a reparto (pasa a En camino y registra la hora; el cliente recibe aviso por WhatsApp), Llegue a destino (registra el arribo) y Entregar pedido (marca Entregado). Cada accion pide Si, confirmar.
2. Si el pedido es en efectivo, aparece "Efectivo a rendir: S/ N (se liquida en caja, no se cobra aqui)": entregas y rindes el dinero en caja al terminar.
3. Para llamar usa Llamar; para escribir usa Chatear por WhatsApp. Hay enlaces a Google Maps y Waze.
4. Cuando entregas o falla el ultimo pedido, la ruta se cierra con el aviso "Ruta terminada". Mis rutas lista las rutas pasadas; los pedidos entregados quedan en gris con un check hasta cerrar la ruta.
Despues: [[caja]]

## Como se hace: Chatear por WhatsApp con el cliente de mi pedido
1. En un pedido que ya tomaste pulsa Chatear por WhatsApp (el boton aparece solo si el cliente tiene numero).
2. Se abre el chat dentro de la pantalla ("Chat de WhatsApp del pedido ..."). Veras los mensajes desde que se creo el pedido, marcados Local o Cliente con su hora. Escribe en "Escribe un mensaje" y pulsa Enviar.
3. El chat esta disponible mientras el pedido esta Listo o En camino y hasta 2 horas despues de entregado.
4. Avisos: "El local esta atendiendo este chat ahora. Podras escribir cuando lo suelte." (Caja o Mensajes tiene tomada la conversacion), "Pasaron 24 h sin respuesta del cliente; el local debe escribirle." (la ventana de 24 horas de WhatsApp esta cerrada; ver [[mensajes]]) y "No puedes escribir ahora".
Ver tambien: [[mensajes]]

## Como se hace: Corregir la ubicacion real de un pedido (repartidor propone)
1. En el pedido, pulsa Proponer ubicacion real (solo en pedidos en curso, Listo o En camino).
2. Si estas en el lugar, pulsa "Estoy en la ubicacion real" para usar tu GPS ("Usamos tu ubicacion actual. Puedes mover el pin si hace falta."), o toca el mapa para mover el pin. Escribe una Nota (opcional).
3. Pulsa Enviar propuesta. Aparece "Propuesta enviada. Caja la revisara; el pedido no cambia hasta que la aprueben."
4. El estado se ve en el mismo boton: "Pendiente de revision en caja", "Aprobada: caja cambio la ubicacion" o "Rechazada por caja" (con el motivo). Puedes usar Cancelar mi propuesta mientras este pendiente. Solo puede haber una propuesta pendiente por pedido ("Ya hay una propuesta pendiente...").
Ver tambien: [[caja]]

## Como se hace: Cambiar la ubicacion de un pedido de delivery (Caja o Administrador)
1. En Pedidos y caja abre el pedido de delivery: la seccion de ubicacion muestra el mapa, la direccion y, si ya se cambio, la insignia Dirección editada (revisa el historial de ubicacion).
2. Pulsa Cambiar ubicacion (Caja o Administrador; el Supervisor no). Busca la direccion o mueve el pin en el mapa. En un pedido de delivery de Caja o del mozo tambien existe el boton Usar ubicacion de WhatsApp, que toma la ultima ubicacion que el cliente mando en las ultimas 24 horas.
3. La ventana "Cambiar ubicacion de CP-xxxx" calcula en vivo la comparacion Antes y Despues: zona, Envio, Diferencia y Total. Si el punto queda fuera de cobertura: "Ese punto esta fuera de la zona de reparto. Mueve el pin o busca otra direccion."
4. Pulsa Cambiar y confirma "Si, cambiar" en "Cambiar la ubicacion del pedido?". Aparece "Ubicacion cambiada." El envio y el total se recalculan solos, y el cliente recibe un aviso si cambia el costo de envio.
5. Si el pedido ya estaba pagado y el envio cambia, queda un ajuste: Saldo por cobrar (envio mayor: hay que cobrar mas) o Devolucion pendiente (envio menor: hay que devolver). Se resuelve con el boton Cobrar saldo o Marcar como devuelta: eliges el medio (Efectivo, Yape, Plin, Transferencia o Tarjeta; si no es efectivo escribes el Codigo de operacion). En efectivo mueve la caja de hoy; en digital queda en el cierre del dia. Si no esta pagado el total solo cambia y se cobra asi.
6. Si hay una propuesta del repartidor, la seccion la muestra con mapas Antes y Despues y los botones Aprobar o Rechazar (con motivo opcional). Si Caja cambia el punto directo mientras hay una propuesta, esa propuesta se cancela sola.
7. El historial de cambios muestra quien lo hizo (Caja o Repartidor), el estado, zona anterior y nueva, y el envio anterior y nuevo con su diferencia.
Ver tambien: [[caja]]

## Vista de seguimiento (Administrador, Supervisor, Cajero y Mozo)
Tiene cuatro pestanas: Repartidores, Todos los pedidos, Mapa y Rutas. Ver el seguimiento requiere el permiso repartos/seguir (Administrador, Supervisor, Cajero y Mozo). Mozo y Supervisor ven en modo solo lectura; el Mozo no ve telefonos de clientes. Ya no se asigna pedidos a "Repartidor 1/2/3" ni Caja asigna pedidos: cada repartidor toma los suyos desde su celular.
- Repartidores: una tarjeta por repartidor con su estado, Libre · Sin pedidos u OCUPADO (N), y los pedidos que lleva por etapa (Tomado, En camino, Llegado), mas los pedidos Sin tomar. Hay un filtro para ver Todos los repartidores o uno solo.
- Todos los pedidos: lista de todo el delivery agrupada en secciones: Esperando repartidor (listo, sin tomar), En preparacion / en espera (En cola, En cocina, En preparacion o Por confirmar), Tomados · en camino (Tomado, En camino o Llego, con la hora), Entregados hoy y No entregados / con incidente (Anulado o "Incidente: motivo"). Arriba hay chips para ver una seccion o Todas, y un buscador "Buscar por codigo o cliente". Cada fila dice zona, repartidor ("Sin repartidor" si no tiene) y etapa.
- Mapa: pedidos activos en el mapa con filtros de Espera (Retrasado desde 20 min, Tarde desde 30, Muy tarde desde 45) y por zona, pantalla completa y ruta sugerida.
- Rutas: rutas de los repartidores con filtros de Dia y Repartidor.
- Si el Administrador toma pedidos como repartidor aparece en el panel con su nombre y "(admin)" mientras los lleve.

## Como se hace: Tomar un pedido como repartidor (solo Administrador)
1. En Todos los pedidos, Mapa o el detalle de un pedido que esta Esperando repartidor, pulsa Tomar como repartidor.
2. El pedido queda a tu nombre y apareces como "Tu nombre (admin)" en Repartidores. Lo entregas con los mismos pasos de la pantalla de reparto (Salir, Llegue, Entregar).
Ver tambien: [[caja]]

## Como se hace: Soltar o reasignar un pedido (Administrador y Cajero)
1. Abre un pedido que ya tiene repartidor y no esta entregado y pulsa Soltar / reasignar.
2. Escribe el Motivo (obligatorio; si no, "Escribe el motivo").
3. Elige un repartidor destino para Reasignar, o deja "Dejarlo sin repartidor (vuelve a esperando)" y pulsa Soltar pedido. El cambio queda auditado.
4. El Mozo y el Supervisor no ven este boton. Un pedido con alerta de "tomado sin salir" tiene su propio aviso.

## Otras funciones del Cajero y el Administrador
- Resolver incidentes (Resolver incidente (caja/admin)): reprogramar, retornar al local o cobrar con recargo, y liquidar el efectivo que rinde cada repartidor.
- Reenvio tras el retiro (Por reprogramar): si el cliente dijo SI, el pedido aparece como Por reprogramar con el boton «Reprogramar / Reenviar a reparto: S/ x». Ese monto es el que el cliente vio antes de responder y se suma una vez al total y al envio. Si ya estaba pagado, el recargo se cobra aparte en Caja. El costo se configura en Configuracion, Parametros de operacion, «Costo de volver a enviar un pedido».
- La liquidacion de un repartidor ya no bloquea el cierre ni duplica el efectivo.

## Como se hace: Reportar una falla en la entrega (no contesta o direccion erronea)
1. Si transcurren varios minutos sin poder contactar al cliente, pulsar el boton Reportar problema.
2. Seleccionar el motivo: No contesta o Direccion no encontrada.
3. Registrar los intentos de contacto realizados mediante llamada telefonica y notificaciones de [[mensajes]].
4. Opcionalmente adjuntar una fotografia de la fachada o comprobante del intento de entrega.
5. Pulsar Reportar entrega fallida. El incidente se notificara a la central y a caja para coordinar la solucion.
Ver tambien: [[mensajes]]

## Como se hace: entender el tiempo estimado que se le dice al cliente
- Al salir con el pedido, el cliente recibe un rango calculado para ese pedido (no un número fijo). Ese rango queda guardado.
- En la carta, el seguimiento cuenta desde la salida: lo que falta es el rango guardado menos lo transcurrido, y nunca baja de 5 minutos.
- Antes de salir, el seguimiento muestra el rango de la zona (con empaque). Sin zona ni coordenadas, muestra el tiempo base.
- Para cambiar los minutos de una zona, ve a Zonas de reparto; para cambiar la forma de calcular, ve a Parámetros de operación (eta_*).

## Errores y dudas comunes
- 403 NO_ASIGNADO: el pedido es de otro repartidor. Pide a Caja que lo reasigne.
- 409 ESTADO_INVALIDO "Solo puedes proponer ubicacion en un pedido en curso": el pedido ya se entrego o anulo.
- 409 FUERA_DE_COBERTURA / "La ubicacion indicada esta fuera de la zona de cobertura": el punto no esta en ninguna zona de reparto activa; ver [[zonas]].
- "Hay un saldo o una devolucion sin resolver en este pedido: resuelvelo antes de cambiar la ubicacion": primero cobra el saldo o marca la devolucion del cambio anterior.
- "No se puede cambiar la ubicacion de un pedido en estado ENTREGADO o ANULADO": ya no admite cambio. Solo se cambia en pedidos de delivery.
- "Abre la caja para mover efectivo" (CAJA_CERRADA): para cobrar o devolver en efectivo la caja de hoy debe estar abierta; en digital no hace falta.
- "La propuesta ya no esta pendiente": otra persona ya la aprobo, rechazo o se cancelo; recarga.
- "Falta ubicar": el pedido no tiene punto en el mapa; Caja le pone la ubicacion con Cambiar ubicacion.
- Si otro repartidor tomo antes un pedido de la ruta sugerida, el sistema avisa cual se perdio.
- Si llegas al tope de pedidos simultaneos debes entregar alguno antes de tomar otro.
- Un repartidor solo ve sus pedidos y el telefono aparece despues de tomar el pedido.
- La devolucion pendiente por cambio de ubicacion no afecta el cierre de caja mientras no se resuelva: al marcarla como devuelta, en efectivo sale como egreso de la caja de hoy y en digital se descuenta del medio en el cierre.

## Quien puede hacerlo
- Repartidor: ver y tomar sus pedidos y rutas, salir, llegar, entregar, reportar fallas, chatear con el cliente de su pedido y proponer la ubicacion real.
- Administrador: seguimiento completo, Tomar como repartidor, Soltar / reasignar, resolver incidentes, cambiar ubicaciones y liquidar.
- Cajero: seguimiento, Soltar / reasignar, resolver incidentes, liquidar y cambiar o aprobar ubicaciones (pedidos/cambiar_ubicacion).
- Supervisor y Mozo: seguimiento en solo lectura (repartos/seguir); el Mozo no ve telefonos y ninguno de los dos suelta ni cambia ubicaciones.
