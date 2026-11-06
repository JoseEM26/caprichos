---
modulo: mirest
titulo: Configuración: Reservas de mesa
ruta: /admin/mirest
seccion: reservas
permiso: local/ver
roles: [ADMIN]
relacionados: [reservas, plano, mensajes, clientes]
sugerencias:
  - ¿Cuántos minutos se espera a un cliente con reserva antes de liberar la mesa?
  - ¿Cómo apago el botón Reservar de la carta?
  - ¿Cómo cambio cuándo llega el recordatorio de la reserva?
  - ¿Cuántas reservas pendientes puede tener un mismo celular?
---
# Configuración: Reservas de mesa

## Para que sirve
Reúne los ajustes que gobiernan las reservas de mesa: cuántos minutos se espera al cliente (tolerancia), cuándo se le manda el recordatorio por WhatsApp y las reglas de las reservas pedidas desde la carta virtual (encendido, pendientes por celular, días de anticipación y personas máximas). Las solicitudes y las reservas se atienden en [[reservas]] y las mesas están en [[plano]]. Todos estos ajustes están en Parámetros del sistema, grupo "Puntos, personal y reservas".

## Como se hace: cambiar la tolerancia o el recordatorio de la reserva
1. Entra a Configuración del local, pestaña "Parámetros del sistema", y busca "Tolerancia de reservas" ([Tolerancia de reservas](/admin/mirest?tab=parametros&campo=parametros-reserva-tolerancia-min)) o "Recordatorio de reserva (minutos antes)" ([Recordatorio de reserva (minutos antes)](/admin/mirest?tab=parametros&campo=parametros-reserva-recordatorio-min)). También puedes usar el buscador de ajustes de arriba.
2. Pulsa "Editar", escribe el valor y pulsa "Guardar"; confirma con "Sí, guardar".
3. Tolerancia: entero de 1 a 180 minutos (por defecto 15): con 15, una reserva de las 8:00 se libera a las 8:15 si nadie llegó. Recordatorio: entero de 5 a 240 minutos antes; es un único mensaje por WhatsApp.

## Como se hace: apagar o limitar las reservas desde la carta
1. En Parámetros del sistema busca "Reservar mesa desde la carta encendido" ([Reservar mesa desde la carta encendido](/admin/mirest?tab=parametros&campo=parametros-reserva-web-activa)). Con No, la carta no muestra el botón "Reservar". Cada pedido llega como solicitud pendiente que el local aprueba o rechaza en Reservas › Solicitudes.
2. Para limitar abusos usa "Reservas pendientes por celular desde la carta" (1 a 10), "Días de anticipación para reservar desde la carta" (1 a 365) y "Personas máximas por reserva desde la carta" (1 a 200; vacío = la suma de asientos de las mesas activas).
3. Para que el chatbot no tome reservas por WhatsApp, pausa "Reservas de mesa por WhatsApp" en la pestaña "Chatbot y seguridad" ([Reservas de mesa por WhatsApp](/admin/mirest?tab=chatbot&campo=chatbot-funcion-reservas)).

## Ajustes: Reservas
- **Tolerancia de reservas** (reserva_tolerancia_min): Minutos de cortesía que se guarda la mesa reservada antes de liberarla si el cliente no llega. Ejemplo: Con 15: una reserva de las 8:00 se libera a las 8:15 si nadie llegó. [Tolerancia de reservas](/admin/mirest?tab=parametros&campo=parametros-reserva-tolerancia-min)
- **Recordatorio de reserva (minutos antes)** (reserva_recordatorio_min): Cuántos minutos antes de la hora se manda el único recordatorio por WhatsApp al cliente. Sólo sale si el recordatorio está encendido. Ejemplo: Con 30: la reserva de las 8:00 recibe el mensaje a las 7:30. [Recordatorio de reserva (minutos antes)](/admin/mirest?tab=parametros&campo=parametros-reserva-recordatorio-min)
- **Reservar mesa desde la carta encendido** (reserva_web_activa): Muestra el botón «Reservar» en la carta virtual para que el cliente pida mesa. Cada pedido llega como solicitud pendiente que el local aprueba o rechaza en Reservas › Solicitudes. Ejemplo: En «No», la carta no muestra el botón de reservar y nadie puede enviar una solicitud desde ahí. [Reservar mesa desde la carta encendido](/admin/mirest?tab=parametros&campo=parametros-reserva-web-activa)
- **Reservas pendientes por celular desde la carta** (reserva_web_max_pendientes): Cuántas solicitudes de reserva pedidas desde la carta puede tener esperando respuesta un mismo celular. Frena que una persona llene la lista de pendientes. Ejemplo: Con 2: si Ana ya tiene dos pedidos sin confirmar, la carta le pide esperar antes de un tercero. [Reservas pendientes por celular desde la carta](/admin/mirest?tab=parametros&campo=parametros-reserva-web-max-pendientes)
- **Días de anticipación para reservar desde la carta** (reserva_web_dias_max): Hasta cuántos días antes de la fecha puede pedir mesa el cliente desde la carta virtual. Ejemplo: Con 30: el cliente puede pedir mesa para hoy o hasta dentro de 30 días. [Días de anticipación para reservar desde la carta](/admin/mirest?tab=parametros&campo=parametros-reserva-web-dias-max)
- **Personas máximas por reserva desde la carta** (reserva_web_max_personas): Tope de personas que acepta una reserva pedida desde la carta. Si está vacío, el tope es la suma de asientos de las mesas activas del salón. Ejemplo: Con 8: un pedido para 9 personas se rechaza en la carta y el cliente recibe la indicación de escribir o llamar al local. [Personas máximas por reserva desde la carta](/admin/mirest?tab=parametros&campo=parametros-reserva-web-max-personas)
- **Reservas de mesa por WhatsApp** (chatbot_funcion_reservas): Permite que el bot atienda consultas y registre reservas de mesa. Pausada, el cliente recibe que las reservas están pausadas y puede hablar con un asesor. Riesgo alto: toca dinero o deja de atender clientes. [Reservas de mesa por WhatsApp](/admin/mirest?tab=chatbot&campo=chatbot-funcion-reservas)

## Errores y dudas comunes
- "La tolerancia de reserva debe ser un entero entre 1 y 180 minutos" y "El recordatorio de reserva debe ser un entero entre 5 y 240 minutos antes": respeta esos rangos.
- La carta no muestra el botón Reservar: está apagado "Reservar mesa desde la carta encendido".
- Un cliente no puede pedir más reservas: llegó al máximo de pendientes por celular.
- El recordatorio no sale: solo sale si el recordatorio está encendido y dentro del tiempo configurado.

## Quien puede hacerlo
Solo el Administrador (ADMIN): entrar a Configuración del local exige el permiso local/ver y para cambiar datos, local/editar o configuracion/editar, que solo tiene el rol ADMIN. El administrador no escribe código de supervisor: el sistema lo autoriza solo y el cambio queda en el historial de auditoría.
