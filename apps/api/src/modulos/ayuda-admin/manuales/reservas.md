---
modulo: reservas
titulo: Reservas
ruta: /admin/reservas
permiso: reservas/ver
roles: [ADMIN, MOZO, CALLCENTER, SUPERVISOR]
relacionados: [plano, caja, clientes, mensajes, notificaciones]
sugerencias:
  - Como registro una reserva de mesa por telefono o presencial
  - Como apruebo una solicitud de reserva que llego por la carta o WhatsApp
  - Como reservo varias mesas para un grupo grande
  - Que pasa si el cliente no llega a su reserva
  - Como paso a los clientes a su mesa cuando llegan al local
  - Como cancelo una reserva si el cliente avisa que no vendra
  - Por que me avisa que otra reserva esta menos de 2 horas antes
  - Por que no me deja reservar a esa hora
---
# Reservas

## Para que sirve
Libro de reservas del salon: agenda por dia, asignacion de mesas sobre el croquis del [[plano]], aprobacion de las solicitudes que llegan por la carta virtual y por WhatsApp (ver [[mensajes]]) y paso del cliente a su mesa. Las reservas de la carta y de WhatsApp llegan como solicitud y una persona del local las aprueba; la campana de [[notificaciones]] avisa como urgente cada solicitud pendiente y el menu Reservas muestra el contador.

Reglas del sistema:
- Horario unico: una reserva puede empezar desde que abre el local hasta una hora antes del cierre. Es la misma regla para el admin, la carta y WhatsApp. Si no se cumple dice "Atendemos de 9:00 a 21:00" con el horario real del dia, o "El local no atiende ese dia".
- Sin duracion fija: la reserva no reserva un bloque de horas. La mesa se guarda desde la hora de la reserva hasta 15 minutos despues (tolerancia) y, cuando los clientes se sientan, la mesa la ocupa el pedido.
- Una reserva puede usar varias mesas (grupos grandes): se eligen en el croquis y la suma de asientos debe alcanzar para las personas.
- Un solo recordatorio al cliente, por defecto 30 minutos antes de la hora, con hora, personas y mesas (los minutos se cambian en Configuracion).
- Por WhatsApp se aceptan hasta 20 personas; mas de 20 pasa a un asesor.

## Como se hace: Crear una reserva
1. Pulsa + Nueva reserva (arriba).
2. Escribe el nombre del cliente y su telefono (obligatorios), la fecha, la hora y el Numero de personas.
3. Elige las mesas en el croquis: verde es libre, azul es elegida, naranja es ocupada o reservada a esa hora. El croquis dibuja el plano real del local (paredes, barra, cocina). Puedes elegir varias mesas. Debajo se lee "Mesa X" / "Mesas X y Y" o "Sin mesas elegidas".
4. Si los asientos no alcanzan aparece "Faltan N asientos". El sistema permite continuar con confirmacion cuando la capacidad es menor.
5. Si otra reserva de esa mesa es menos de 2 horas antes, sale un aviso suave: la mesa puede seguir ocupada; no bloquea.
6. Pulsa Registrar reserva y confirma "Si, registrar reserva" (el texto recuerda "La mesa tendra 15 minutos de tolerancia").
Antes: [[plano]]
Ver tambien: [[clientes]]

## Como se hace: Aprobar o rechazar una solicitud (carta o WhatsApp)
1. En el bloque Solicitudes por atender estan las peticiones pendientes con cliente, fecha, hora y personas ("N por atender" o "Todo al dia").
2. Para aprobar, elige la mesa o mesas en el croquis ("Elige la mesa en el plano del local (para N personas)" o "Cambiar la mesa en el plano"), ajusta la hora si hace falta y pulsa Aprobar y guardar la mesa. El cliente recibe la confirmacion por WhatsApp.
3. Para rechazar pulsa Rechazar, escribe el motivo (minimo 5 letras) y confirma. Las solicitudes ya atendidas pasan al bloque Ya resueltas.
4. Si dos personas la atienden a la vez, la segunda ve "La solicitud ya fue atendida por otra persona. Actualiza la pantalla.".
Antes: [[mensajes]]

## Como se hace: Sentar a los clientes cuando llegan
1. Busca la reserva en la agenda del dia (estado Confirmada) y pulsa Sentar.
2. Confirma "Si, confirmar". La reserva pasa a Atendida y desde ese momento la mesa la ocupa el pedido del salon (ver [[plano]] y [[caja]]).
Despues: [[caja]]

## Como se hace: Cuando el cliente no llega (No llego y Reactivar)
1. Si pasan 15 minutos de tolerancia sin que se siente, la reserva pasa sola a No llego, con el motivo "Sin llegada: pasaron N min de tolerancia", y la mesa queda libre.
2. Si el cliente llega tarde el mismo dia, pulsa Reactivar en la reserva: vuelve a Confirmada y la tolerancia se cuenta de nuevo. Solo se reactivan las del dia de hoy.
3. Si otra reserva o un pedido abierto ya tomo la mesa, no se puede reactivar ("X tiene un pedido abierto. No se puede reactivar.").
4. Puedes filtrar por estado: Confirmada, Pendiente, Cancelada, Atendida y No llego.

## Como se hace: Cancelar o cambiar una reserva
1. Ubica la reserva y pulsa Editar para cambiar datos (solo se editan las Confirmadas) o Cancelar reserva.
2. Para cancelar escribe el motivo (minimo 5 letras) y confirma. La mesa queda libre al instante.

## Como lo pide el cliente desde la carta
1. En la carta virtual el cliente pulsa el boton Reservar y completa tres pasos: Personas, Dia y hora, Tus datos, y pulsa Enviar solicitud. Ve "Solicitud enviada".
2. El celular debe tener 9 digitos y empezar con 9. Hay un limite de solicitudes pendientes por celular y por conexion, y un maximo de dias de anticipacion y de personas. Todo se configura en Configuracion (reserva_web_activa, reserva_web_max_pendientes, reserva_web_dias_max, reserva_web_max_personas).
3. La solicitud aparece aqui para aprobar.

## Errores y dudas
- MESA_OCUPADA "X ya tiene otra reserva a las HH:MM. Elige otra mesa u otra hora." / "X tiene un pedido abierto. Elige otra mesa.": esa mesa esta tomada; elige otra. Una mesa no puede quedar en dos reservas que se cruzan.
- MESA_REPETIDA "Una mesa aparece dos veces en la reserva": elige cada mesa una sola vez.
- "Faltan N asientos" / "Debe seleccionar al menos una mesa para la reserva.": suma mas mesas.
- "La hora de la reserva ya paso" / "La hora solicitada ya paso. Elige una hora nueva para aprobar la reserva.": cambia la hora al aprobar.
- "Solo se pueden editar reservas en estado ACTIVA" (Confirmada): una reserva Atendida, Cancelada o No llego ya no se edita.
- El plano marca la mesa reservada con R solo como aviso visual: no bloquea pedidos del mozo.
- "No se pudo cargar el mapa." / Reintentar: recarga el croquis; el Call Center puede ver las mesas (solo lectura) para esto.
- "No tienes permiso": tu rol no puede crear o editar reservas.

## Quien puede hacerlo
Administrador, Mozo, Supervisor y Call Center ven, crean y editan reservas (reservas/ver, crear, editar). Cajero, Repartidor, Cocina y Almacen no tienen acceso.
