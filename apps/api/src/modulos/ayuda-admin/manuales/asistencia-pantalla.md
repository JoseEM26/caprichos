---
modulo: asistencia-pantalla
titulo: Pantalla de asistencia (QR)
ruta: /admin/asistencia/pantalla
permiso: asistencia/pantalla
roles: [ADMIN]
relacionados: [asistencia, mi-asistencia, pantallas, usuarios]
sugerencias:
  - Como pongo la pantalla del QR en la tablet del local
  - Como instalo la app QR Asistencia
  - Por que el QR cambia cada 30 segundos
  - Dice que el enlace ya no es valido
  - Como genero un enlace nuevo o desactivo el actual
---
# Pantalla de asistencia (QR)

## Para que sirve
Es la pantalla fija del local con el codigo QR que el personal escanea para marcar su asistencia en [[mi-asistencia]]. Muestra "Marca tu asistencia", el QR, una cuenta regresiva y, debajo, el codigo de 6 digitos por si la camara no lee ("Si la camara no funciona, escribe este codigo"). El QR y el codigo cambian cada 30 segundos, por eso una foto del QR no sirve.

Hay dos formas de verla: dentro del panel (Administrador, ruta Pantalla de asistencia) o en una tablet del local con un enlace secreto que no pide usuario ni contrasena. La segunda es la normal en el dia a dia. Estado: esta probada en preproduccion; en produccion se activa junto con la asistencia.

## Como se hace: Poner la pantalla en la tablet del local
1. Entra como Administrador a Asistencia y abre la pestana Pantalla del QR.
2. Pulsa Generar enlace de la pantalla. Aparece el enlace en el campo "Enlace de la pantalla" y la insignia pasa a Activo. El enlace se muestra solo esta vez: pulsa Copiar.
3. Abre ese enlace en la tablet del local (que quede encendida y con la pantalla siempre prendida) o enviatelo a ti mismo y abrelo ahi.
4. Veras "Cargando codigo..." y luego el QR con su cuenta regresiva.
5. Aviso importante: cualquiera con ese enlace ve el codigo. Guardalo solo en la tablet y no lo compartas.
Despues: [[mi-asistencia]]

## Como se hace: Instalar la app QR Asistencia en la tablet
1. Con el enlace abierto en la tablet, pulsa el boton de instalar app que aparece en la pantalla publica (Instalar app QR Asistencia).
2. En Android/Chrome el sistema pregunta si instalar. En iPhone o iPad no hay ventana: toca Compartir y luego Anadir a pantalla de inicio. En otros navegadores, abre el menu y elige Instalar app o Anadir a pantalla de inicio.
3. Se crea el icono QR Asistencia. Al abrirlo entra directo a la pantalla del QR, sin barras del navegador. Una vez instalada, el boton de instalar desaparece.

## Como se hace: Regenerar o desactivar el enlace
1. En Asistencia, pestana Pantalla del QR, pulsa Regenerar: el enlace anterior deja de funcionar al instante y se muestra uno nuevo. Hay que volver a abrirlo en la tablet.
2. Para apagar la pantalla publica pulsa Desactivar. La insignia pasa a Sin enlace.
3. Sirve cuando se pierde o roba la tablet, o cuando el enlace se compartio por error.
Ver tambien: [[asistencia]]

## Errores y dudas
- "Este enlace ya no es valido. Pide uno nuevo al administrador.": el enlace fue regenerado o desactivado. El administrador genera uno nuevo y lo abre en la tablet.
- "Sin conexion con el servidor. Reintentando...": la tablet perdio internet; vuelve sola cuando regresa la conexion.
- "Aun no configuras la ubicacion del local: nadie podra marcar": el QR se ve, pero nadie puede marcar hasta fijar el punto del local en Asistencia, pestana Configuracion.
- El QR "no se lee": subir el brillo de la tablet y que no tenga reflejos; el personal puede usar el codigo de 6 digitos.
- El enlace en claro solo se ve al generarlo; si lo perdiste, genera uno nuevo con Regenerar.

## Quien puede hacerlo
Solo el Administrador genera, regenera y desactiva el enlace (permiso asistencia/administrar) y ve la pantalla dentro del panel (asistencia/pantalla). La tablet del local no necesita cuenta.
