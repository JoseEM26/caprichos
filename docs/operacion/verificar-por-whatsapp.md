# Verificar el celular por WhatsApp

Guía corta, en lenguaje de negocio, para crear cuenta y recuperar contraseña en la carta.

## Qué ve el cliente (modo WHATSAPP_ENTRANTE, el de por defecto)

1. Escribe su celular y pulsa **Continuar** (o **Enviar código por WhatsApp**, según el paso).
2. La carta muestra el botón grande **Abrir WhatsApp y enviar mensaje**.
3. Toca el botón. WhatsApp se abre con el mensaje ya escrito: «Hola Caprichos, quiero verificar mi celular. Mi código: XXXXXXXX». Solo tiene que tocar **enviar**.
4. Vuelve a la carta. Cuando llega el mensaje, la carta dice **Celular verificado** y pasa sola al paso siguiente (poner la contraseña, o la contraseña nueva).

En computadora el botón abre WhatsApp Web; también funciona.

Si el enlace vence (10 minutos) la carta dice «El enlace venció. Pide uno nuevo» y ofrece pedir otro.

## Por qué no hace falta plantilla de Meta

WhatsApp informa de qué número escribe. Si el mensaje llega desde el celular que pidió el enlace, ese celular es de quien lo pidió. Por eso no se envía ningún código desde el negocio y no se necesita una plantilla aprobada.

## Cómo cambiar de modo

Configuración › Parámetros de operación › **Cómo verifica el cliente su celular** (grupo Puntos, personal y reservas):

- **El cliente escribe al negocio** (`WHATSAPP_ENTRANTE`): el modo por defecto. Úsalo mientras Meta no apruebe las plantillas.
- **Código de 6 dígitos por WhatsApp** (`CODIGO_PLANTILLA`): el anterior. Vuelve a usarlo cuando las plantillas **caprichos_codigo_cuenta** y **caprichos_codigo_recuperar** estén **aprobadas** en Meta. Si las pones antes de tiempo, nadie recibe el código.

El cambio aplica a quien crea cuenta o recupera contraseña desde ese momento. Las cuentas ya creadas no cambian.

## Número que recibe la verificación

Configuración › Parámetros de operación › **Número que recibe la verificación**: el celular del negocio con código de país (por ejemplo `51914244077`). Si se deja vacío, se usa el **WhatsApp de contacto** del local (Configuración › Mi local › Contacto).

Si no hay ningún número, el modo WHATSAPP_ENTRANTE muestra «La verificación del celular no está disponible en este momento» y no falla en silencio. Revisa el número antes de avisar a los clientes.

## Qué probar en la demo

- La demo usa el **número de prueba de Meta**. Ese número **recibe** mensajes de cualquiera, pero **solo envía** a los celulares autorizados.
- Por eso, en la demo, la confirmación que la API envía de vuelta («Listo ✅ ya verificamos tu celular…») puede **no llegar** si el celular de prueba no está autorizado. Aun así la carta avanza: la verificación se marca al **recibir** el mensaje, no al enviar la confirmación.
- Prueba: crear cuenta con el celular, enviar el mensaje desde WhatsApp, ver que la carta avanza sola; probar con un enlace vencido; probar que otro celular no sirve con el enlace de un tercero.
- Con el número real de producción, la confirmación sí debe llegar.

## Seguridad, en corto

- El enlace vale una sola vez y 10 minutos.
- Solo sirve al celular que lo pidió. Si otro celular envía el mensaje, no verifica nada; tras varios intentos el enlace se invalida.
- La carta no muestra ningún celular al consultar el estado; solo «pendiente», «verificado» o «vencido».
- Hay límite de pedidos por celular e IP, igual que antes.
