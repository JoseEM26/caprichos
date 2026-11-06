---
modulo: mirest
titulo: Configuración: Verificación del celular
ruta: /admin/mirest
seccion: verificacion-celular
permiso: local/ver
roles: [ADMIN]
relacionados: [clientes, mensajes]
sugerencias:
  - ¿Cómo verifica el cliente su celular al crear su cuenta?
  - ¿A qué número escribe el cliente para verificar su celular?
  - ¿Cuándo uso el modo de código por plantilla de Meta?
---
# Configuración: Verificación del celular

## Para que sirve
Define cómo comprueba el cliente que su celular es suyo al crear una cuenta o recuperar la contraseña en la carta, y a qué número del negocio escribe. Los clientes se ven en [[clientes]]. Los dos ajustes están en Parámetros del sistema, grupo "Puntos, personal y reservas".

## Como se hace: elegir el modo de verificación
1. Entra a Configuración del local, pestaña "Parámetros del sistema", y busca "Cómo verifica el cliente su celular" ([Cómo verifica el cliente su celular al crear cuenta o recuperar la contraseña](/admin/mirest?tab=parametros&campo=parametros-verificacion-celular-modo)).
2. Pulsa "Editar" y elige uno de los dos modos: WHATSAPP_ENTRANTE o CODIGO_PLANTILLA. Guarda y confirma con "Sí, guardar".
3. WHATSAPP_ENTRANTE (recomendado mientras Meta no apruebe las plantillas de código): el cliente toca "Abrir WhatsApp y enviar mensaje", escribe él primero al número del negocio y, al llegar el mensaje, la carta avanza sola y muestra "Celular verificado". No hace falta plantilla de Meta.
4. CODIGO_PLANTILLA: el servidor envía un código de 6 dígitos por WhatsApp y el cliente lo escribe en la carta. Úsalo cuando las plantillas caprichos_codigo_cuenta y caprichos_codigo_recuperar estén aprobadas por Meta.

## Como se hace: elegir el número que recibe la verificación
1. Busca "Número de WhatsApp que recibe la verificación" ([Número de WhatsApp que recibe la verificación](/admin/mirest?tab=parametros&campo=parametros-verificacion-whatsapp-numero)) y pulsa "Editar".
2. Escribe un celular peruano de 9 dígitos que empiece con 9 (con o sin +51); se guarda con el prefijo 51.
3. Si lo dejas vacío se usa la variable del servidor VERIFICACION_WHATSAPP_NUMERO o, si no existe, el WhatsApp de contacto del local ([WhatsApp del local](/admin/mirest?tab=contacto&campo=contacto-whatsapp)).

## Ajustes: Verificación del celular
- **Cómo verifica el cliente su celular al crear cuenta o recuperar la contraseña** (verificacion_celular_modo): WHATSAPP_ENTRANTE (recomendado mientras Meta no apruebe las plantillas de código): el cliente toca «Abrir WhatsApp y enviar mensaje» y escribe él primero al número del negocio; al llegar el mensaje, la carta avanza sola. CODIGO_PLANTILLA: el servidor envía un código de 6 dígitos por WhatsApp (plantilla de Meta) y el cliente lo escribe en la carta. Ejemplo: Con WHATSAPP_ENTRANTE, Ana toca el botón, envía el mensaje ya escrito y la carta le muestra «Celular verificado» sin que escriba ningún código. [Cómo verifica el cliente su celular al crear cuenta o recuperar la contraseña](/admin/mirest?tab=parametros&campo=parametros-verificacion-celular-modo)
- **Número de WhatsApp que recibe la verificación** (verificacion_whatsapp_numero): Número del negocio al que el cliente escribe para verificar su celular, solo dígitos con código de país (por ejemplo 51914244077). Si se deja vacío se usa la variable del servidor VERIFICACION_WHATSAPP_NUMERO (la demo la usa para su número de prueba) o, si no existe, el WhatsApp de contacto del local (Configuración › Mi local › Contacto). Ejemplo: Con 51914244077, el botón abre WhatsApp con ese número y el mensaje «Hola Caprichos, quiero verificar mi celular. Mi código: …». [Número de WhatsApp que recibe la verificación](/admin/mirest?tab=parametros&campo=parametros-verificacion-whatsapp-numero)
- **Aviso: seguridad de la cuenta** (whatsapp_aviso_cuenta_activo): Enciende o apaga el mensaje de WhatsApp que recibe el cliente al crear la cuenta o cambiar la contraseña. Avisa por WhatsApp cuando se crea una cuenta de cliente o cambia su contraseña, con la indicación de escribir si no fue la persona. Requiere la plantilla de Meta aprobada. Ejemplo: En «Sí», el cliente recibe el aviso de seguridad. [Aviso: seguridad de la cuenta](/admin/mirest?tab=parametros&campo=parametros-whatsapp-aviso-cuenta-activo)
- **WhatsApp del local** (local_datos.whatsapp): Número al que escribe el cliente desde el botón de WhatsApp de la carta (enlace wa.me). Solo números, con código de país. Se guarda en el servidor y lo usan la carta, el bot y los comprobantes. Ejemplo: 51987654321. rango Solo dígitos, con código de país (51 para Perú). [WhatsApp del local](/admin/mirest?tab=contacto&campo=contacto-whatsapp)

## Errores y dudas comunes
- "El modo debe ser WHATSAPP_ENTRANTE … o CODIGO_PLANTILLA …": no se aceptan otros textos.
- "El número debe ser un celular de 9 dígitos que empiece con 9 (con o sin +51)": corrige el número.
- El cliente no recibe el código en el modo CODIGO_PLANTILLA: las plantillas de Meta aún no están aprobadas; vuelve a WHATSAPP_ENTRANTE.

## Quien puede hacerlo
Solo el Administrador (ADMIN): entrar a Configuración del local exige el permiso local/ver y para cambiar datos, local/editar o configuracion/editar, que solo tiene el rol ADMIN. El administrador no escribe código de supervisor: el sistema lo autoriza solo y el cambio queda en el historial de auditoría.
