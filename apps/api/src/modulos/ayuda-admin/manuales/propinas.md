---
modulo: propinas
titulo: Propinas
ruta: /admin/propinas
permiso: propinas/ver
roles: [ADMIN, CAJERO, SUPERVISOR]
relacionados: [cierre, caja, asistencia, mi-asistencia, usuarios, historial]
sugerencias:
  - Como activo la propina en la carta y en WhatsApp
  - Donde veo cuanto se junto de propinas en el mes
  - Como se reparte la propina entre el equipo
  - Por que una propina aparece pendiente de cobro
  - Como pago a cada persona su parte de propina
  - Donde veo la propina en el cierre de caja
  - Como veo cuanto me toca de propina
  - Que pasa con la propina si se devuelve un pedido
---
# Propinas

## Para que sirve
Registra y reparte las propinas que dejan los clientes. La propina va aparte de la venta: no es ingreso, no suma al total vendido ni sale en los comprobantes. Solo cuenta lo que ya se cobro en [[caja]]; si un pedido se devuelve, su propina se resta el dia de la devolucion.

Como entra la propina: el cliente escribe un monto libre (no hay porcentajes fijos) en la carta virtual ("Propina opcional para el equipo (S/)", vacio si no quiere dejar) o en el bot de WhatsApp (botones Dejar propina / Sin propina y luego "Cuanto quieres dejar de propina?"; 0 si no quiere). Hay un tope por pedido (por defecto S/ 200).

Estado: la propina viene APAGADA por defecto. El Administrador la enciende por canal (carta virtual y WhatsApp) en Configuracion, tarjeta de propina. Mientras este apagada el cliente no ve el campo y cualquier monto que llegue se ignora.

La vista Propinas tiene dos pestanas cuando eres Administrador: Acumulado y Reparto del mes. Cajero y Supervisor solo ven Acumulado.

## Como se hace: Encender o apagar la propina y poner el tope
1. Entra como Administrador a Configuracion, tarjeta de propina.
2. Cada canal (Carta virtual y WhatsApp) muestra la insignia Encendida o Apagada y un boton Encender / Apagar. Confirma el cambio. Los demas roles ven el texto "Solo ADMIN".
3. Fija el tope de propina por pedido en soles (entre S/ 1 y S/ 1000). Aparece "Tope de propina: S/ N.".
4. En Propinas, arriba, queda escrito el estado: "Propina en la carta virtual: encendida/apagada · en WhatsApp: ... · tope S/ N por pedido.".

## Como se hace: Ver lo acumulado del mes (pestana Acumulado)
1. Abre Propinas y elige el Mes (los ultimos 12).
2. Tarjetas: Total del mes (con "Devueltas: S/ N" si hubo devoluciones), En efectivo y Digital (Yape, Plin, transferencia, tarjeta).
3. Tabla Por dia con Total, Efectivo y Digital, y las listas Por medio de pago y Por canal (Carta virtual, WhatsApp, Mozo, Caja).
4. Abajo, Propinas pendientes de cobro: pedidos ya entregados con propina que aun no tienen cobro en caja. La propina no cuenta hasta que Caja registre el cobro del pedido. Si todo esta cobrado dice "Todos los pedidos entregados con propina ya estan cobrados en caja."
Ver tambien: [[caja]]

## Como se hace: Cobrar un pedido con propina y verla en el cierre
1. Al cobrar el pedido en [[caja]], el cobro muestra "Venta S/ X + propina S/ Y (va aparte, no es venta)". Se cobra venta mas propina.
2. En [[cierre]] aparece el bloque Propinas del dia con el total, el efectivo y lo digital. En el efectivo esperado se suma la linea "+ Propinas en efectivo (van aparte de la venta)".
3. Las propinas digitales (Yape, Plin, transferencia, tarjeta) ya estan dentro de esos medios, pero no se suman al total vendido: el cierre lo aclara.
4. Si el pedido se devuelve, la propina del dia ya sale descontada.
Despues: [[cierre]]

## Como se hace: Calcular y aprobar el reparto del mes (solo Administrador)
1. Abre Propinas, pestana Reparto del mes, y elige el mes. El reparto se calcula y aprueba cuando termina el mes (desde el dia 1 del mes siguiente); antes solo ves la vista previa.
2. Se reparte por horas trabajadas: cada persona recibe un porcentaje segun sus horas del mes en [[asistencia]]. La tabla Reparto por persona muestra Horas, % y Monto, y arriba Total de propinas, Horas totales y Personas.
3. Revisa los Avisos. En Fuera del reparto estan quienes no participan: por defecto el rol Administrador no participa. Para cada persona puedes elegir "Segun su rol", "Si participa" o "No participa". Despues de cambiarlo pulsa Recalcular borrador para que cuente.
4. Pulsa Calcular reparto (o Recalcular borrador). El estado queda Borrador.
5. Pulsa Aprobar y confirma "Al aprobar, las cifras quedan congeladas y las personas ven su parte. Aprobar?". Estado Aprobado.
6. Pulsa Exportar CSV si quieres el archivo.
Antes: [[asistencia]]

## Como se hace: Pagar el reparto
1. Con el reparto Aprobado, elige el Medio (Efectivo, Yape, Plin, Transferencia...) y la Fecha de pago.
2. Para pagar a todos pulsa el boton de pagar del reparto ("Pagos registrados"); para uno solo pulsa Pagar en su fila ("Pago registrado"). Cada fila pasa de Pendiente a "Pagado dd/mm/aaaa (medio)".
3. Cuando todos estan pagados el reparto queda Pagado.
4. Para corregir un reparto aun no pagado, pulsa Anular y escribe el motivo; luego se puede recalcular. Si hay pagos registrados no se puede anular.
5. El Historial de repartos de abajo lista los meses anteriores.

## Como se hace: Ver mi parte de propinas
1. Cualquier persona del equipo abre Mi asistencia: si el reparto ya esta aprobado aparece la seccion Mis propinas con el mes, tus horas, tu porcentaje, el monto y la insignia Por pagar o Pagado (con el medio).
2. Solo ves tu parte, nunca la de otros. Ver [[mi-asistencia]].

## Errores y dudas
- No aparece el campo de propina en la carta o el bot: esta apagada para ese canal. El Administrador la enciende en Configuracion.
- "La propina debe ser un monto en soles, con hasta 2 decimales y no mayor a S/ N": el cliente escribio un monto invalido o sobre el tope. En el bot: "Escribe un monto en soles entre 0 y S/ N, con hasta 2 decimales.".
- Una propina no aparece en el acumulado: todavia no esta cobrada. Mira Propinas pendientes de cobro y cobra el pedido en [[caja]].
- "El reparto de M/A ya esta Aprobado. Anulalo con motivo para volver a calcularlo.": para recalcular hay que anularlo (si no tiene pagos).
- "Las horas o las propinas cambiaron desde el borrador. Vuelve a calcular antes de aprobar.": llego una marca, correccion o cobro nuevo; pulsa Recalcular borrador y vuelve a aprobar.
- "Hay propinas en el mes, pero nadie tiene horas trabajadas evaluables.": faltan marcas de [[asistencia]]; corrige las marcas del mes.
- "Hay propinas en el mes, pero ninguna persona participa en el reparto.": revisa las excepciones en Fuera del reparto.
- "Las devoluciones del mes superan las propinas: revisa Propinas antes de repartir.": el acumulado quedo en negativo; revisa las devoluciones.
- "El reparto se calcula y aprueba cuando termina el mes...": espera al dia 1 del mes siguiente.
- "Solo se paga un reparto aprobado": primero hay que aprobarlo. "No hay personas pendientes de pago en la seleccion": ya estan pagados.
- "Otro usuario esta calculando este mes. Recarga la vista.": otra persona esta calculando; recarga.

## Quien puede hacerlo
Administrador: todo (ver, calcular, aprobar, pagar, anular el reparto, encender o apagar por canal). Cajero y Supervisor: ven el Acumulado (permiso propinas/ver) y las propinas del dia en el cierre. El reparto es solo del Administrador (propinas/repartir). Todo el personal ve su propia parte en [[mi-asistencia]].
