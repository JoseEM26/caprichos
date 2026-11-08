---
modulo: mirest
titulo: Configuración: Textos y mensajes
ruta: /admin/mirest
seccion: textos
activa_con: [tab=textos]
permiso: local/ver
roles: [ADMIN]
relacionados: [reclamos, clientes]
sugerencias:
  - ¿Dónde cambio los términos y condiciones que ve el cliente?
  - ¿Dónde edito la política de privacidad de la carta?
  - ¿Por qué no me deja guardar los términos vacíos?
---
# Configuración: Textos y mensajes

## Para que sirve
Aquí se redactan los textos legales que lee el cliente en la carta virtual: Términos y condiciones y Política de privacidad. También recuerda dónde se cambia la encuesta posventa, que no se edita aquí sino en Parámetros del sistema. Los reclamos de los clientes los atiende [[reclamos]].

## Como se hace: cambiar los términos y condiciones o la política de privacidad
1. Entra a Configuración del local y abre la pestaña "Textos y mensajes" ([Textos y mensajes](/admin/mirest?tab=textos)). Verás dos secciones plegables: "Términos y privacidad" y "Encuesta posventa".
2. En "Términos y privacidad" edita el texto de "Términos y condiciones" o de "Política de privacidad". Cada uno admite hasta 20000 caracteres.
3. Pulsa "Guardar cambios" y confirma con "Sí, guardar". El texto se ve de inmediato en la carta.
4. Cada vez que cambias de verdad uno de los dos textos, el sistema sube su versión con la fecha de hoy (hora de Lima); es la versión que queda guardada con el consentimiento del cliente.

## Como se hace: cambiar cuándo llega la encuesta posventa
1. En la misma pestaña abre "Encuesta posventa". Verás la espera actual y un enlace que te lleva a Parámetros del sistema.
2. En Parámetros edita "Espera antes de enviar la encuesta" ([Espera antes de enviar la encuesta](/admin/mirest?tab=parametros&campo=parametros-encuesta-espera-min)) y guarda.

## Ajustes: Textos legales y encuesta
- **Términos y condiciones** (terminos_texto): Texto legal que lee el cliente en la carta (Libro de reclamaciones y términos del servicio). Se guarda en el servidor y se ve de inmediato. Ejemplo: El pedido se confirma al validar el pago. Los cambios se solicitan por WhatsApp. rango hasta 20000 caracteres. [Términos y condiciones](/admin/mirest?tab=textos&campo=textos-terminos)
- **Política de privacidad** (privacidad_texto): Texto sobre el tratamiento de datos personales que lee el cliente en la carta. Se guarda en el servidor y se ve de inmediato. Ejemplo: Usamos tu teléfono solo para avisarte del estado de tu pedido. rango hasta 20000 caracteres. [Política de privacidad](/admin/mirest?tab=textos&campo=textos-privacidad)
- **Espera antes de enviar la encuesta** (encuesta_espera_min): Minutos después de la entrega (o del cobro en mesa) para enviar la encuesta de satisfacción por WhatsApp. Solo actúa si el aviso de encuesta está en Sí. Ejemplo: Con 30: un pedido entregado a las 8:00 recibe la encuesta a las 8:30. [Espera antes de enviar la encuesta](/admin/mirest?tab=parametros&campo=parametros-encuesta-espera-min)
- **Calificación que cuenta como queja** (encuesta_puntaje_queja): Una calificación igual o menor a este número se trata como queja: genera una alerta de «calificación baja» con enlace al chat del cliente. Ejemplo: Con 2: calificaciones de 1 y 2 estrellas disparan la alerta; 3 no. [Calificación que cuenta como queja](/admin/mirest?tab=parametros&campo=parametros-encuesta-puntaje-queja)
- **Días que vale la respuesta de la encuesta** (encuesta_ventana_dias): Una calificación escrita por el cliente solo se acepta si la encuesta se le envió dentro de estos días. Ejemplo: Con 7: un «5» escrito a los 10 días ya no cuenta como respuesta de la encuesta. [Días que vale la respuesta de la encuesta](/admin/mirest?tab=parametros&campo=parametros-encuesta-ventana-dias)

## Errores y dudas comunes
- "Los términos y condiciones no pueden quedar vacíos" o "La política de privacidad no puede quedar vacía": se puede cambiar el texto, no dejarlo en blanco.
- "El texto no puede pasar de 20000 caracteres": acórtalo.
- No encuentro dónde cambiar los minutos de la encuesta: esa espera y las demás reglas de la encuesta están en Parámetros del sistema, grupo "Encuesta posventa".

## Quien puede hacerlo
Solo el Administrador (ADMIN): entrar a Configuración del local exige el permiso local/ver y para cambiar datos, local/editar o configuracion/editar, que solo tiene el rol ADMIN. El cambio queda en el historial de auditoría.
