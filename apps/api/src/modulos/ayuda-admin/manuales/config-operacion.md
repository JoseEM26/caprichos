---
modulo: mirest
titulo: Configuración: Operación
ruta: /admin/mirest
seccion: operacion
activa_con: [tab=operacion]
permiso: local/ver
roles: [ADMIN]
relacionados: [propinas, stock, recetas, resenas, notificaciones, clientes]
sugerencias:
  - ¿Cómo enciendo la propina en la carta o en WhatsApp?
  - ¿Cómo permito que el cliente pida como invitado, sin celular?
  - ¿Cómo apago el sonido de los avisos del panel?
  - ¿Cómo activo el control de insumos y recetas?
  - ¿Cómo muestro las reseñas de Google en la carta?
---
# Configuración: Operación

## Para que sirve
Pestaña de interruptores generales del local: pedir como invitado en la carta, propina opcional por canal, control de insumos y recetas, reseñas de Google en la carta, el sonido de las notificaciones del panel y, solo como consulta, tiempo prometido, tolerancia de reservas, porcentaje de puntos y descuento del personal (esos cuatro se editan en Parámetros del sistema). Cada tarjeta guarda y confirma por su cuenta. Relacionado con [[propinas]], [[stock]], [[recetas]], [[resenas]] y [[notificaciones]].

## Como se hace: encender o apagar una función general
1. En Configuración del local abre la pestaña "Operación" ([Operación](/admin/mirest?tab=operacion)).
2. Ubica la tarjeta: "Pedir como invitado", "Propina opcional", "Control de insumos y recetas" o "Reseñas de Google".
3. Cambia el interruptor y confirma con "Sí, confirmar". El cambio rige de inmediato.
4. Pedir como invitado: encendido, quien pide desde la carta puede hacerlo sin dar su celular (no suma puntos); apagado, debe poner al menos su celular.
5. Control de insumos y recetas: encendido, cada cobro descuenta insumos por receta y agota solos los productos sin insumos. El stock de productos terminados (donas, galletas) funciona aparte, con la casilla "Controlar stock de este producto" del Catálogo.

## Como se hace: encender la propina por canal y fijar el tope
1. En la tarjeta "Propina opcional" hay un interruptor para "la carta virtual" y otro para "WhatsApp"; cada canal es independiente. Viene apagada.
2. En "Tope de propina por pedido (S/)" escribe un monto de 1 a 1000 (por defecto 200) y pulsa "Guardar tope".
3. Detalle completo y reparto del dinero: ver [[propinas]] y el manual de propinas en esta sección [Propina opcional](/admin/mirest?tab=operacion).

## Como se hace: ajustar el sonido de las notificaciones
1. En la tarjeta "Notificaciones" (sonido de los avisos para todo el equipo) cambia: "Sonido de los avisos", "Cada cuántos segundos suena" (5 a 600), "Qué avisos hacen sonar" y "Botón «Marcar todas leídas»".
2. Pulsa para guardar y confirma el diálogo "Guardar los cambios de notificaciones".

## Como se hace: mostrar reseñas de Google en la carta
1. En la tarjeta "Reseñas de Google" elige tu local una sola vez; el sistema guarda sus reseñas buenas.
2. Puedes ocultar una reseña (se quita de la carta sin borrarla) o pulsar "Actualizar ahora" para traer las nuevas (una vez al día). La lista completa se ve en [[resenas]].

## Como se hace: cambiar tiempo prometido, tolerancia de reservas, puntos o descuento del personal
1. En esta misma pestaña, esos cuatro campos son de solo lectura y dicen "Se edita en Parámetros →" con un enlace.
2. Pulsa el enlace, luego "Editar" en la fila, escribe el valor, "Guardar" y confirma.

## Ajustes: Operación
- **Pedir como invitado** (carta_invitado_activo): Encendido, quien pide desde la carta puede hacerlo sin dar su celular (no suma puntos). Apagado, debe poner al menos su celular para pedir y sumar puntos. Ejemplo: Apagado: el cliente escribe su celular y suma puntos; encendido: puede pedir sin celular y sin puntos. Permiso: ADMIN. [Pedir como invitado](/admin/mirest?tab=operacion&campo=operacion-carta-invitado)
- **Propina en la carta virtual** (propina_activa): Encendida, el cliente que pide desde la carta virtual ve la opción de dejar una propina. Va aparte del pedido: no es venta, no sale en el comprobante y no suma puntos. Apagada por defecto. Ejemplo: Encendida, el cliente deja S/ 5 y paga S/ 45 si el pedido es de S/ 40. Riesgo alto: toca dinero o deja de atender clientes. Permiso: ADMIN. [Propina en la carta virtual](/admin/mirest?tab=operacion&campo=operacion-propina-carta)
- **Propina en WhatsApp** (propina_activa): Encendida, el bot de WhatsApp pregunta al cliente si quiere dejar una propina antes de pagar. Es independiente de la carta virtual. Va aparte del pedido y no suma puntos. Apagada por defecto. Ejemplo: Encendida, el bot pregunta «Sin propina» o «Dejar propina» y el cliente escribe 5. Riesgo alto: toca dinero o deja de atender clientes. Permiso: ADMIN. [Propina en WhatsApp](/admin/mirest?tab=operacion&campo=operacion-propina-bot)
- **Tope de propina por pedido (S/)** (propina_tope): El monto máximo de propina que se acepta en un pedido, en carta y en WhatsApp. Un monto mayor se rechaza y el cliente debe escribir otro. Ejemplo: Con 50, nadie puede dejar más de S/ 50 en un pedido. valor por defecto 200, rango 1 a 1000, unidad S/. Permiso: ADMIN. [Tope de propina por pedido (S/)](/admin/mirest?tab=operacion&campo=operacion-propina-tope)
- **Control de insumos y recetas (descuento al cobrar)** (stock_control_activo): Gobierna SOLO los insumos y las recetas: encendido, cada cobro descuenta insumos por receta, agota solos los productos que dependen de insumos sin stock y avisa de lo que falta. Apagado, vender no descuenta insumos. El stock de productos terminados (donas, galletas) funciona aparte, con la casilla «Controlar stock de este producto» del Catálogo, y no depende de este interruptor. Ejemplo: Apagado: se cobra un frappé y no se descuenta ningún insumo, pero una dona con la casilla marcada sí baja de 24 a 23. Riesgo alto: toca dinero o deja de atender clientes. Permiso: ADMIN. [Control de insumos y recetas (descuento al cobrar)](/admin/mirest?tab=operacion&campo=operacion-control-almacen)
- **Reseñas de Google en la carta**: Elige tu local una vez y guarda sus reseñas buenas de Google. La carta las muestra en un carrusel antes de «Deja tu opinión»; ocultar una reseña la quita de la carta sin borrarla. Ejemplo: Con una reseña oculta, la carta no la muestra; «Actualizar ahora» trae las nuevas una vez al día. Permiso: ADMIN. [Reseñas de Google en la carta](/admin/mirest?tab=operacion&campo=operacion-resenas-google)
- **Tiempo prometido de entrega (base)** (tiempo_prometido_min): Minutos de espera que se le dicen al cliente como base, en la carta y en el chatbot. La alta demanda le suma sus minutos encima. También es el respaldo del aviso «tiempo estimado» cuando el pedido no tiene zona ni ubicación. Ejemplo: Si pones 30 y hay alta demanda de +15, la carta anuncia 45 minutos. [Tiempo prometido de entrega (base)](/admin/mirest?tab=parametros&campo=parametros-tiempo-prometido-min)
- **Tolerancia de reservas** (reserva_tolerancia_min): Minutos de cortesía que se guarda la mesa reservada antes de liberarla si el cliente no llega. Ejemplo: Con 15: una reserva de las 8:00 se libera a las 8:15 si nadie llegó. [Tolerancia de reservas](/admin/mirest?tab=parametros&campo=parametros-reserva-tolerancia-min)
- **Porcentaje de puntos para el cliente** (puntos_porcentaje): Qué porcentaje del consumo se convierte en puntos de fidelidad para el cliente con cuenta. Cuenta solo productos sin descuento ni promoción, sin envío y sin lo pagado con puntos. Ejemplo: Con 5 %: un pedido de S/ 40 elegible suma 2 puntos. Riesgo alto: toca dinero o deja de atender clientes. [Porcentaje de puntos para el cliente](/admin/mirest?tab=parametros&campo=parametros-puntos-porcentaje)
- **Descuento para el personal a crédito** (descuento_personal_pct): Porcentaje de descuento que recibe el personal en los consumos que paga a crédito. Ejemplo: Con 25 %: un consumo de S/ 40 del personal queda en S/ 30. Riesgo alto: toca dinero o deja de atender clientes. [Descuento para el personal a crédito](/admin/mirest?tab=parametros&campo=parametros-descuento-personal-pct)

## Ajustes: Notificaciones del panel
- **Sonido de los avisos** (notif_sonido_activo): enciende o apaga el sonido de los avisos para todo el equipo. [Notificaciones (sonido de los avisos)](/admin/mirest?tab=operacion)
- **Cada cuántos segundos suena** (notif_sonido_intervalo_seg): cada cuánto repite el sonido un aviso sin leer; entero de 5 a 600 segundos. [Intervalo del sonido de avisos](/admin/mirest?tab=operacion)
- **Qué avisos hacen sonar** (notif_sonido_alcance): Todo lo no leído (salvo prioridad baja), Solo urgentes (prioridad alta: pedidos nuevos, reservas, alertas) o Solo los de hoy (hora de Lima, salvo prioridad baja). [Qué avisos hacen sonar](/admin/mirest?tab=operacion)
- **Botón «Marcar todas leídas»** (notif_marcar_todas_activo): permite o no marcar todos los avisos como leídos de una vez. [Botón Marcar todas leídas](/admin/mirest?tab=operacion)

## Errores y dudas comunes
- Quise activar la propina y no la veo en la carta: se enciende por canal; revisa el interruptor de "la carta virtual".
- Un monto de propina mayor al tope se rechaza y el cliente debe escribir otro.
- Apagué el control de insumos y las donas siguen bajando de stock: el stock de terminados es independiente de ese interruptor.
- No puedo cambiar el tiempo prometido aquí: se cambia en Parámetros del sistema.

## Quien puede hacerlo
Solo el Administrador (ADMIN): entrar a Configuración del local exige el permiso local/ver y para cambiar datos, local/editar o configuracion/editar, que solo tiene el rol ADMIN. El administrador no escribe código de supervisor: el sistema lo autoriza solo y el cambio queda en el historial de auditoría. Los interruptores de esta pestaña los cambia solo el Administrador.
