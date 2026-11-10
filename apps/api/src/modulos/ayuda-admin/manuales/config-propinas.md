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
Permite que el cliente deje una propina al pedir. Se enciende por canal (carta virtual, WhatsApp, el mozo y Caja, cada uno por separado) y tiene un tope por pedido. La propina es siempre un monto libre (sin porcentajes) y va aparte del pedido: no es venta, no sale en el comprobante y no suma puntos. En Nuevo pedido del mozo y de Caja se escribe en el paso Pago, con cualquier medio de pago. El reparto de lo acumulado se ve en [[propinas]].

## Como se hace: encender o apagar la propina en la carta o en WhatsApp
1. Entra a Configuración del local, pestaña "Operación" ([Propina en la carta virtual](/admin/mirest?tab=operacion&campo=operacion-propina-carta)).
2. En la tarjeta "Propina opcional" cambia el interruptor de "la carta virtual", "WhatsApp", "el mozo (Nuevo pedido)" o "Caja (Nuevo pedido)" (el parámetro propina_activa guarda los cuatro como carta, bot, mozo y caja).
3. Confirma con "Sí, confirmar". Viene encendida por defecto en todos los canales: apaga solo el que no quieras.
4. Con la propina encendida en WhatsApp, el bot pregunta "Sin propina" o "Dejar propina" antes de pagar y el cliente escribe el monto.

## Como se hace: cambiar el tope de propina por pedido
1. En la misma tarjeta, en "Tope de propina por pedido (S/)" ([Tope de propina por pedido (S/)](/admin/mirest?tab=operacion&campo=operacion-propina-tope)) escribe un monto de 1 a 1000. Por defecto es 200.
2. Pulsa "Guardar tope". Un monto mayor se rechaza y el cliente debe escribir otro.

## Ajustes: Propina
- **Propina en la carta virtual** (propina_activa): Encendida, el cliente que pide desde la carta virtual ve la opción de dejar una propina. Va aparte del pedido: no es venta, no sale en el comprobante y no suma puntos. Apagada por defecto. Ejemplo: Encendida, el cliente deja S/ 5 y paga S/ 45 si el pedido es de S/ 40. Riesgo alto: toca dinero o deja de atender clientes. Permiso: ADMIN. [Propina en la carta virtual](/admin/mirest?tab=operacion&campo=operacion-propina-carta)
- **Propina en WhatsApp** (propina_activa): Encendida, el bot de WhatsApp pregunta al cliente si quiere dejar una propina antes de pagar. Es independiente de la carta virtual. Va aparte del pedido y no suma puntos. Apagada por defecto. Ejemplo: Encendida, el bot pregunta «Sin propina» o «Dejar propina» y el cliente escribe 5. Riesgo alto: toca dinero o deja de atender clientes. Permiso: ADMIN. [Propina en WhatsApp](/admin/mirest?tab=operacion&campo=operacion-propina-bot)
- **Propina en el mozo (Nuevo pedido)** (propina_activa): Encendida, el mozo puede anotar una propina (monto libre) en el paso «Pago» del Nuevo pedido. Es independiente de los demás canales. Va aparte del pedido y no suma puntos. Apagada por defecto. Ejemplo: Encendida, el mozo escribe 5 en «Propina» y el cliente paga S/ 45 si el pedido es de S/ 40. Riesgo alto: toca dinero o deja de atender clientes. Permiso: ADMIN. [Propina en el mozo (Nuevo pedido)](/admin/mirest?tab=operacion&campo=operacion-propina-mozo)
- **Propina en Caja (Nuevo pedido)** (propina_activa): Encendida, Caja puede anotar una propina (monto libre) en el paso «Pago» del Nuevo pedido. Es independiente de los demás canales. Va aparte del pedido y no suma puntos. Apagada por defecto. Ejemplo: Encendida, Caja escribe 5 en «Propina» y el cliente paga S/ 45 si el pedido es de S/ 40. Riesgo alto: toca dinero o deja de atender clientes. Permiso: ADMIN. [Propina en Caja (Nuevo pedido)](/admin/mirest?tab=operacion&campo=operacion-propina-caja)
- **Tope de propina por pedido (S/)** (propina_tope): El monto máximo de propina que se acepta en un pedido, en carta, WhatsApp, mozo y Caja. Un monto mayor se rechaza y el cliente debe escribir otro. Ejemplo: Con 50, nadie puede dejar más de S/ 50 en un pedido. valor por defecto 200, rango 1 a 1000, unidad S/. Permiso: ADMIN. [Tope de propina por pedido (S/)](/admin/mirest?tab=operacion&campo=operacion-propina-tope)

## Errores y dudas comunes
- "El tope de propina debe estar entre S/ 1 y S/ 1000": usa un monto dentro de ese rango.
- "La propina se enciende o apaga por canal: carta, bot, mozo y caja": cada canal es verdadero o falso por separado.
- La propina no aparece en el comprobante: es normal, va aparte de la venta.

## Quien puede hacerlo
Solo el Administrador (ADMIN): entrar a Configuración del local exige el permiso local/ver y para cambiar datos, local/editar o configuracion/editar, que solo tiene el rol ADMIN. El cambio queda en el historial de auditoría.
