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

Configuración › Parámetros de operación › **Número que recibe la verificación**: el celular del negocio con código de país (por ejemplo `51914244077`). Si se deja vacío, se usa en este orden:

1. La variable del servidor **`VERIFICACION_WHATSAPP_NUMERO`** (solo si está definida y bien escrita).
2. El **WhatsApp de contacto** del local (Configuración › Mi local › Contacto).

El número del parámetro gana siempre sobre la variable. Un número mal escrito se ignora y se sigue con el orden de arriba.

Si no hay ningún número, el modo WHATSAPP_ENTRANTE muestra «La verificación del celular no está disponible en este momento» y no falla en silencio. Revisa el número antes de avisar a los clientes.

## Fijar el número de la demo (sin tocar prod)

El mensaje tiene que llegar al número que atiende el webhook de **esa** instalación. La demo tiene su propio número de prueba de Meta; si el botón abre el WhatsApp real de Caprichos, el mensaje llega a producción y la demo nunca lo ve («no reconoce en tiempo real», la carta espera 10 minutos y vence).

Para la demo hay dos formas, en este orden de preferencia:

- **Parámetro** (Configuración › Parámetros de operación › Número que recibe la verificación): escribe el número de prueba de Meta de la demo, solo dígitos con código de país. Es lo más visible para el dueño.
- **Variable en el `.env` del servidor demo**: `VERIFICACION_WHATSAPP_NUMERO=<número de prueba con 51>`. El compose de demo ya la pasa al contenedor de la API (vacía por defecto). Tras cambiarla, redesplegar o recrear el contenedor `api` de la demo. **No** tocar el `.env` de producción ni su compose.

El número **no** va en Git ni en esta guía: se pone en el servidor o en el parámetro de la demo.

## Qué probar en la demo

- El número de prueba de Meta **solo recibe** mensajes de celulares que estén agregados como destinatarios de prueba en la consola de Meta (sección de la API de WhatsApp, destinatarios de prueba). Si el celular de prueba no está agregado, su mensaje no llega y la carta no avanza. Esto **no está confirmado** en las pruebas de este repositorio: compruébalo enviando un mensaje desde un celular agregado y desde uno sin agregar antes de dar por buena la demo.
- Mientras tanto, la confirmación que la API envía de vuelta («Listo ✅ ya verificamos tu celular…») puede **no llegar** si el celular de prueba no está autorizado para recibir. Aun así la carta avanza: la verificación se marca al **recibir** el mensaje, no al enviar la confirmación.
- Si el mensaje no llega, la carta muestra a los 60 s la pista «¿Ya enviaste el mensaje y no avanza?» y ofrece pedir un enlace nuevo. Si no hay ningún número configurado, muestra «La verificación del celular no está disponible».
- Por eso, en la demo, la confirmación que la API envía de vuelta («Listo ✅ ya verificamos tu celular…») puede **no llegar** si el celular de prueba no está autorizado. Aun así la carta avanza: la verificación se marca al **recibir** el mensaje, no al enviar la confirmación.
- Prueba: crear cuenta con el celular, enviar el mensaje desde WhatsApp, ver que la carta avanza sola; probar con un enlace vencido; probar que otro celular no sirve con el enlace de un tercero.
- Con el número real de producción, la confirmación sí debe llegar.

## Seguridad, en corto

- El enlace vale una sola vez y 10 minutos.
- Solo sirve al celular que lo pidió. Si otro celular envía el mensaje, no verifica nada; tras varios intentos el enlace se invalida.
- La carta no muestra ningún celular al consultar el estado; solo «pendiente», «verificado» o «vencido».
- Hay límite de pedidos por celular e IP, igual que antes.
