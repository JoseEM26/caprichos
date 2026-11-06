---
modulo: mirest
titulo: Configuración: Propina opcional
ruta: /admin/mirest
seccion: propinas
permiso: local/ver
roles: [ADMIN]
relacionados: [propinas, caja, mensajes]
sugerencias:
  - ¿Cómo activo la propina solo en la carta y no en WhatsApp?
  - ¿Dónde cambio el tope de propina por pedido?
  - ¿La propina sale en el comprobante o suma puntos?
---
# Configuración: Propina opcional

## Para que sirve
Permite que el cliente deje una propina al pedir. Se enciende por canal (carta virtual y WhatsApp, cada uno por separado) y tiene un tope por pedido. La propina va aparte del pedido: no es venta, no sale en el comprobante y no suma puntos. No existe propina de mozo ni de caja. El reparto de lo acumulado se ve en [[propinas]].

## Como se hace: encender o apagar la propina en la carta o en WhatsApp
1. Entra a Configuración del local, pestaña "Operación" ([Propina en la carta virtual](/admin/mirest?tab=operacion&campo=operacion-propina-carta)).
2. En la tarjeta "Propina opcional" cambia el interruptor de "la carta virtual" o de "WhatsApp" (el parámetro propina_activa guarda los dos como carta y bot).
3. Confirma con "Sí, confirmar". Viene apagada por defecto.
4. Con la propina encendida en WhatsApp, el bot pregunta "Sin propina" o "Dejar propina" antes de pagar y el cliente escribe el monto.

## Como se hace: cambiar el tope de propina por pedido
1. En la misma tarjeta, en "Tope de propina por pedido (S/)" ([Tope de propina por pedido (S/)](/admin/mirest?tab=operacion&campo=operacion-propina-tope)) escribe un monto de 1 a 1000. Por defecto es 200.
2. Pulsa "Guardar tope". Un monto mayor se rechaza y el cliente debe escribir otro.

## Ajustes: Propina
- **Propina en la carta virtual** (propina_activa): Encendida, el cliente que pide desde la carta virtual ve la opción de dejar una propina. Va aparte del pedido: no es venta, no sale en el comprobante y no suma puntos. Apagada por defecto. Ejemplo: Encendida, el cliente deja S/ 5 y paga S/ 45 si el pedido es de S/ 40. Riesgo alto: toca dinero o deja de atender clientes. Permiso: ADMIN. [Propina en la carta virtual](/admin/mirest?tab=operacion&campo=operacion-propina-carta)
- **Propina en WhatsApp** (propina_activa): Encendida, el bot de WhatsApp pregunta al cliente si quiere dejar una propina antes de pagar. Es independiente de la carta virtual. Va aparte del pedido y no suma puntos. Apagada por defecto. Ejemplo: Encendida, el bot pregunta «Sin propina» o «Dejar propina» y el cliente escribe 5. Riesgo alto: toca dinero o deja de atender clientes. Permiso: ADMIN. [Propina en WhatsApp](/admin/mirest?tab=operacion&campo=operacion-propina-bot)
- **Tope de propina por pedido (S/)** (propina_tope): El monto máximo de propina que se acepta en un pedido, en carta y en WhatsApp. Un monto mayor se rechaza y el cliente debe escribir otro. Ejemplo: Con 50, nadie puede dejar más de S/ 50 en un pedido. valor por defecto 200, rango 1 a 1000, unidad S/. Permiso: ADMIN. [Tope de propina por pedido (S/)](/admin/mirest?tab=operacion&campo=operacion-propina-tope)

## Errores y dudas comunes
- "El tope de propina debe estar entre S/ 1 y S/ 1000": usa un monto dentro de ese rango.
- "La propina se enciende o apaga por canal: carta y bot": cada canal es verdadero o falso por separado.
- La propina no aparece en el comprobante: es normal, va aparte de la venta.

## Quien puede hacerlo
Solo el Administrador (ADMIN): entrar a Configuración del local exige el permiso local/ver y para cambiar datos, local/editar o configuracion/editar, que solo tiene el rol ADMIN. El administrador no escribe código de supervisor: el sistema lo autoriza solo y el cambio queda en el historial de auditoría.
