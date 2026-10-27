---
modulo: mirest
titulo: Configuración del local
ruta: /admin/mirest
permiso: local/ver
roles: [ADMIN]
relacionados: [zonas, supervisor-codigo, cocina, historial, caja]
sugerencias:
  - ¿Cómo actualizo el horario de atención y los teléfonos del local?
  - ¿Cómo activo la pausa de pedidos por alta demanda?
  - ¿Por qué me pide el código del supervisor al pausar pedidos o cambiar parámetros?
  - ¿Cómo configuro las cuentas de Yape, Plin y medios de pago?
---
# Configuración del local

## Para que sirve
Centraliza la información operativa, comercial y fiscal de Caprichos. Desde aquí se definen el nombre y descripción del negocio, dirección física, teléfonos de contacto, horarios regulares y fechas festivas, medios de pago aceptados para [[caja]] (Yape, Plin, efectivo, tarjeta), tiempos de despacho conectados con [[cocina]], límites de [[zonas]] y autorizaciones vinculadas a [[supervisor-codigo]].

## Como se hace: actualizar datos básicos y de contacto
1. En el menú de categorías superior, haz clic en la pestaña "Datos del local" para editar el nombre, lema o descripción que aparece en la sección "Conócenos" de la carta.
2. Ingresa a la pestaña "Ubicación" para actualizar la dirección física, la referencia de llegada y el enlace de Google Maps.
3. Ingresa a la pestaña "Contacto" para registrar el teléfono visible y el número de WhatsApp oficial (debe incluir el prefijo de país 51, sin espacios ni guiones).
4. Al terminar de modificar cualquiera de estas secciones, pulsa el botón "Guardar cambios" en la parte inferior. Aparecerá la ventana de confirmación "¿Guardar los datos del local?". Pulsa "Sí, guardar" para confirmar o "No, revisar" para cancelar.
Ver tambien: [[zonas]]

## Como se hace: configurar horario y fechas especiales
1. Pulsa la pestaña "Horario y fechas".
2. En la subpestaña "Horario de atención", define la hora de apertura y de cierre para cada día de la semana, o marca "Cerrado" en los días que no haya atención.
3. En la subpestaña "Fechas especiales", puedes registrar feriados o días festivos específicos indicando si el local estará cerrado todo el día o si atenderá con un horario extraordinario.
4. Pulsa el botón "Guardar cambios" y confirma con "Sí, guardar".
Ver tambien: [[mirest]]

## Como se hace: configurar pagos y entregas
1. Pulsa la pestaña "Pagos". Activa o desactiva con los interruptores los medios disponibles: "Aceptar efectivo", "Aceptar Yape", "Aceptar Plin", "Aceptar tarjeta (POS al entregar)" y "Aceptar transferencia bancaria".
2. Escribe el número y titular de Yape y Plin, así como la cuenta bancaria y código interbancario (CCI) para transferencias.
3. En la pestaña "Entrega", define el monto de compra mínima para delivery y el monto a partir del cual el envío es gratuito.
4. Guarda las modificaciones pulsando "Guardar cambios" y confirma la acción.
Ver tambien: [[caja]]

## Como se hace: activar alta demanda o pausar pedidos
1. Haz clic en la pestaña "Alta demanda y pausa de pedidos".
2. Si la cocina está saturada y los pedidos tardan más de lo habitual, selecciona los minutos adicionales de despacho usando los atajos (10, 15, 20, 30, 45 o 60 minutos) o escribe un valor en "Otro (min)".
3. Si deseas frenar temporalmente la entrada de nuevos pedidos desde la carta web y el chatbot, activa la casilla "Pausa temporal de pedidos".
4. Pulsa el botón "Activar alta demanda" o "Modificar alta demanda".
5. Se abrirá la ventana de confirmación Sí/No. Si estás pausando pedidos o modificando parámetros operativos sensibles (como tiempos de alerta o permisos), el sistema te solicitará obligatoriamente ingresar el código rotativo de 6 dígitos del supervisor.
6. Digita el código vigente de 6 dígitos que se obtiene en el módulo [[supervisor-codigo]] y pulsa "Sí, confirmar".
7. Para volver a los tiempos habituales cuando baje la congestión, pulsa el botón "Apagar alta demanda" y confirma con "Sí, apagar".
Requiere: [[supervisor-codigo]]
Antes: [[cocina]]
Ver tambien: [[historial]]

## Errores y dudas comunes
- El sistema pide código de supervisor: la pausa de pedidos por alta demanda y la edición de parámetros sensibles de operación están protegidas por seguridad. Se debe consultar el código rotativo en el módulo Código del supervisor (pantalla /admin/supervisor-codigo) e ingresarlo antes de que expire su temporizador de 30 segundos.
- La pausa de pedidos no se activa: la regla de negocio exige que la alta demanda esté encendida con un recargo de minutos antes de poder activar la pausa de pedidos.
- Mis cambios no se reflejan: asegúrate de haber pulsado "Guardar cambios" al final de la pantalla y haber confirmado el diálogo emergente con "Sí, guardar".

## Quien puede hacerlo
El acceso general a Configuración del local requiere el permiso local/ver y corresponde al Administrador (ADMIN). La activación de alta demanda también puede ser visualizada por el personal de Cocina si cuentan con cocina/demanda, pero la modificación de parámetros globales y la pausa de pedidos requieren privilegios de administración y la validación con el código de supervisor.
