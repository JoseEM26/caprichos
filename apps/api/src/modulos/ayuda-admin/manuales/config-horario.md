---
modulo: mirest
titulo: Configuración: Horario y fechas especiales
ruta: /admin/mirest
seccion: horario
activa_con: [tab=horario]
permiso: local/ver
roles: [ADMIN]
relacionados: [caja, mensajes, cocina]
sugerencias:
  - ¿Cómo cambio el horario de atención de un día?
  - ¿Cómo cierro un día completo, por ejemplo el domingo?
  - ¿Cómo registro un feriado o un horario especial?
  - ¿Por qué la carta dice "Cerrado por hoy"?
---
# Configuración: Horario y fechas especiales

## Para que sirve
Define a qué hora abre y cierra el local cada día de la semana y qué días son distintos (feriados, vacaciones, horario especial). Fuera de horario la carta virtual no recibe pedidos y el chatbot avisa que estamos cerrados. Mozo y Caja pueden seguir registrando pedidos. Los pedidos ya creados no se tocan.

## Como se hace: cambiar el horario de un día de la semana
1. Entra a Configuración del local y abre la pestaña "Horario y fechas" ([Horario y fechas](/admin/mirest?tab=horario)).
2. En la sección "Horario semanal" busca el día (por ejemplo Martes) y escribe la hora de apertura y la de cierre. La apertura debe ser antes del cierre: un horario no puede cruzar la medianoche.
3. Pulsa "Guardar horario". Aparece "¿Guardar horario semanal?"; pulsa "Sí, guardar horario".
4. Desde la hora de apertura la carta recibe pedidos. Antes de abrir dice "Abrimos hoy a las…" y desde la hora de cierre dice "Cerrado por hoy". Con 14:00 a 22:00, a las 21:59 aún se piden y a las 22:00 ya no.

## Como se hace: cerrar o abrir un día completo
1. En el día que quieras, pulsa "Cerrar este día" (si estaba abierto) o "Abrir este día" (si estaba cerrado).
2. Un día cerrado no recibe pedidos de la carta ni del chatbot y la carta dice "Cerrado hoy".
3. Pulsa "Guardar horario" y confirma con "Sí, guardar horario".

## Como se hace: registrar un feriado o un horario especial
1. En la misma pestaña, baja a "Fechas especiales y feriados" y pulsa "Agregar nueva fecha especial".
2. Elige la fecha (solo desde mañana en adelante; si ya hay una para ese día, se reemplaza).
3. Elige "Cerrado todo el día" o "Horario especial". Con horario especial aparecen la hora de apertura y la de cierre (por ejemplo 12:00 a 18:00; la apertura debe ser antes del cierre).
4. Escribe el motivo (por ejemplo "Cerrado por Navidad"). Es lo que lee el cliente; si lo dejas vacío dice "Cerrado por feriado". Con horario especial el motivo no se muestra.
5. Confirma con "Sí, registrar" en "¿Registrar fecha especial?". Esa fecha reemplaza al horario semanal solo ese día.

## Como se hace: quitar una fecha especial
1. En la lista de fechas especiales, pulsa "Quitar" en la fecha.
2. Confirma con "Sí, eliminar" en "¿Eliminar fecha especial?". Solo se quitan fechas futuras; ese día el local vuelve a atender con su horario semanal.

## Ajustes: Horario semanal y fechas especiales
- **Horario de atención de cada día** (horario_dia): Hora de apertura y cierre de cada día de la semana. Fuera de ese horario la carta no recibe pedidos y el bot avisa que estamos cerrados. Mozo y Caja pueden seguir registrando pedidos. Ejemplo: Martes de 14:00 a 22:00. Riesgo alto: toca dinero o deja de atender clientes. [Horario de atención de cada día](/admin/mirest?tab=horario&campo=horario-semanal)
- **Lunes: hora de apertura y cierre** (horario_dia): Hora a la que se abre y se cierra el lunes. Entre ambas horas la carta recibe pedidos; antes de abrir dice «Abrimos hoy a las…» y desde la hora de cierre dice «Cerrado por hoy». Ejemplo: 14:00 a 22:00: a las 21:59 aún se piden; a las 22:00 ya no. valor por defecto 14:00 a 22:00, rango La apertura debe ser antes del cierre (no se puede cruzar la medianoche). Riesgo alto: toca dinero o deja de atender clientes. [Lunes: hora de apertura y cierre](/admin/mirest?tab=horario&campo=horario-dia-lunes)
- **Martes: hora de apertura y cierre** (horario_dia): Hora a la que se abre y se cierra el martes. Entre ambas horas la carta recibe pedidos; antes de abrir dice «Abrimos hoy a las…» y desde la hora de cierre dice «Cerrado por hoy». Ejemplo: 14:00 a 22:00: a las 21:59 aún se piden; a las 22:00 ya no. valor por defecto 14:00 a 22:00, rango La apertura debe ser antes del cierre (no se puede cruzar la medianoche). Riesgo alto: toca dinero o deja de atender clientes. [Martes: hora de apertura y cierre](/admin/mirest?tab=horario&campo=horario-dia-martes)
- **Miércoles: hora de apertura y cierre** (horario_dia): Hora a la que se abre y se cierra el miércoles. Entre ambas horas la carta recibe pedidos; antes de abrir dice «Abrimos hoy a las…» y desde la hora de cierre dice «Cerrado por hoy». Ejemplo: 14:00 a 22:00: a las 21:59 aún se piden; a las 22:00 ya no. valor por defecto 14:00 a 22:00, rango La apertura debe ser antes del cierre (no se puede cruzar la medianoche). Riesgo alto: toca dinero o deja de atender clientes. [Miércoles: hora de apertura y cierre](/admin/mirest?tab=horario&campo=horario-dia-miercoles)
- **Jueves: hora de apertura y cierre** (horario_dia): Hora a la que se abre y se cierra el jueves. Entre ambas horas la carta recibe pedidos; antes de abrir dice «Abrimos hoy a las…» y desde la hora de cierre dice «Cerrado por hoy». Ejemplo: 14:00 a 22:00: a las 21:59 aún se piden; a las 22:00 ya no. valor por defecto 14:00 a 22:00, rango La apertura debe ser antes del cierre (no se puede cruzar la medianoche). Riesgo alto: toca dinero o deja de atender clientes. [Jueves: hora de apertura y cierre](/admin/mirest?tab=horario&campo=horario-dia-jueves)
- **Viernes: hora de apertura y cierre** (horario_dia): Hora a la que se abre y se cierra el viernes. Entre ambas horas la carta recibe pedidos; antes de abrir dice «Abrimos hoy a las…» y desde la hora de cierre dice «Cerrado por hoy». Ejemplo: 14:00 a 22:00: a las 21:59 aún se piden; a las 22:00 ya no. valor por defecto 14:00 a 22:00, rango La apertura debe ser antes del cierre (no se puede cruzar la medianoche). Riesgo alto: toca dinero o deja de atender clientes. [Viernes: hora de apertura y cierre](/admin/mirest?tab=horario&campo=horario-dia-viernes)
- **Sábado: hora de apertura y cierre** (horario_dia): Hora a la que se abre y se cierra el sábado. Entre ambas horas la carta recibe pedidos; antes de abrir dice «Abrimos hoy a las…» y desde la hora de cierre dice «Cerrado por hoy». Ejemplo: 14:00 a 22:00: a las 21:59 aún se piden; a las 22:00 ya no. valor por defecto 14:00 a 22:00, rango La apertura debe ser antes del cierre (no se puede cruzar la medianoche). Riesgo alto: toca dinero o deja de atender clientes. [Sábado: hora de apertura y cierre](/admin/mirest?tab=horario&campo=horario-dia-sabado)
- **Domingo: hora de apertura y cierre** (horario_dia): Hora a la que se abre y se cierra el domingo. Entre ambas horas la carta recibe pedidos; antes de abrir dice «Abrimos hoy a las…» y desde la hora de cierre dice «Cerrado por hoy». Ejemplo: 14:00 a 22:00: a las 21:59 aún se piden; a las 22:00 ya no. valor por defecto 14:00 a 22:00, rango La apertura debe ser antes del cierre (no se puede cruzar la medianoche). Riesgo alto: toca dinero o deja de atender clientes. [Domingo: hora de apertura y cierre](/admin/mirest?tab=horario&campo=horario-dia-domingo)
- **Cerrar o abrir un día completo**: Botón «Cerrar este día» / «Abrir este día» de cada día. Un día cerrado no recibe pedidos de la carta ni del bot y la carta dice «Cerrado hoy». Ejemplo: Cerrar el domingo si no atienden. Riesgo alto: toca dinero o deja de atender clientes. [Cerrar o abrir un día completo](/admin/mirest?tab=horario&campo=horario-dia-cerrado)
- **Guardar el horario semanal**: Aplica los horarios a la carta virtual y al bot. Pide confirmación Sí/No. Los pedidos ya creados no se tocan. Riesgo alto: toca dinero o deja de atender clientes. [Guardar el horario semanal](/admin/mirest?tab=horario&campo=horario-guardar)
- **Feriados y fechas especiales** (fecha_especial): Días con horario distinto o cerrados (feriados, vacaciones). Reemplazan al horario semanal solo ese día; después todo vuelve a la normalidad. Ejemplo: 28 de julio: cerrado. Riesgo alto: toca dinero o deja de atender clientes. [Feriados y fechas especiales](/admin/mirest?tab=horario&campo=fechas-especiales)
- **Fecha de la excepción** (fecha_especial.fecha): Día calendario que tendrá un trato distinto al horario semanal. Solo se aceptan fechas futuras (desde mañana). Si ya existe una para ese día, se reemplaza. Ejemplo: 25 de diciembre. rango Desde mañana en adelante. Riesgo alto: toca dinero o deja de atender clientes. [Fecha de la excepción](/admin/mirest?tab=horario&campo=fechas-fecha)
- **Motivo de la fecha especial** (fecha_especial.motivo): Texto que lee el cliente cuando ese día el local está cerrado en la carta y el bot. Si lo dejas vacío dice «Cerrado por feriado». Con horario especial no se muestra. Ejemplo: Cerrado por Navidad. [Motivo de la fecha especial](/admin/mirest?tab=horario&campo=fechas-motivo)
- **Cerrado todo el día u horario especial** (fecha_especial.cerrado): «Cerrado todo el día» no recibe pedidos esa fecha. «Horario especial» abre solo entre las horas que pongas (por ejemplo de 12:00 a 18:00). Ejemplo: Víspera de Año Nuevo: de 12:00 a 18:00. valor por defecto Cerrado todo el día, rango La apertura debe ser antes del cierre. Riesgo alto: toca dinero o deja de atender clientes. [Cerrado todo el día u horario especial](/admin/mirest?tab=horario&campo=fechas-condicion)
- **Hora de apertura del horario especial** (fecha_especial.abre): Hora a la que se abre ese día especial. Solo aparece al elegir «Horario especial». Ejemplo: 12:00. valor por defecto 12:00. Riesgo alto: toca dinero o deja de atender clientes. [Hora de apertura del horario especial](/admin/mirest?tab=horario&campo=fechas-abre)
- **Hora de cierre del horario especial** (fecha_especial.cierra): Hora a la que se cierra ese día especial. Solo aparece al elegir «Horario especial». Ejemplo: 18:00. valor por defecto 18:00. Riesgo alto: toca dinero o deja de atender clientes. [Hora de cierre del horario especial](/admin/mirest?tab=horario&campo=fechas-cierra)
- **Quitar una fecha especial**: Botón «Quitar» de cada fecha registrada. Solo se quitan fechas futuras; ese día el local vuelve a atender según su horario semanal. Riesgo alto: toca dinero o deja de atender clientes. [Quitar una fecha especial](/admin/mirest?tab=horario&campo=fechas-quitar)

## Errores y dudas comunes
- La carta dice "Cerrado por hoy" pero ya es hora de atender: revisa que el día no esté cerrado, que no haya una fecha especial para hoy y la hora de cierre.
- No me deja guardar un horario: la apertura debe ser antes del cierre (no se puede cruzar la medianoche).
- No puedo registrar la fecha de hoy: las fechas especiales se aceptan solo desde mañana.
- Cambié el horario y un pedido ya creado no cambió: es normal, los pedidos ya creados no se tocan.
- El chatbot responde fuera de horario con un aviso fijo con el horario; el texto de "Mensaje fuera de horario" del chatbot hoy no se usa (ver [Mensaje fuera de horario (texto guardado)](/admin/mirest?tab=chatbot&campo=chatbot-texto-fuera-horario)).

## Quien puede hacerlo
Solo el Administrador (ADMIN): entrar a Configuración del local exige el permiso local/ver y para cambiar datos, local/editar o configuracion/editar, que solo tiene el rol ADMIN. El cambio queda en el historial de auditoría.
