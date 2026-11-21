---
modulo: anuncios
titulo: Anuncios emergentes
ruta: /admin/anuncios
permiso: anuncios/ver
roles: [ADMIN, MARKETING]
relacionados: [novedades, ofertas, disenador, notificaciones]
sugerencias:
  - ¿Cómo creo un anuncio que salga al entrar a la carta?
  - ¿Cómo hago que un anuncio dure solo una semana?
  - ¿Cómo hago que salga solo una vez al día?
  - ¿Cómo mando un comunicado interno al personal?
  - ¿Cómo veo cuántas personas vieron el anuncio?
  - ¿Por qué mi anuncio no aparece?
---
# Anuncios emergentes

## Para que sirve
Crea ventanas emergentes (modales) que se muestran al entrar a la carta virtual de los clientes o al panel del personal: una promoción, un aviso, un evento, un afiche o un comunicado interno. Tú eliges cuándo sale, cuántas veces y cuánto tiempo se queda en pantalla. No reemplaza a las tarjetas de [[novedades]] de la carta ni a la campanita de [[notificaciones]]: esas se quedan en su lugar; el anuncio es la ventana que aparece encima al ingresar.

## Como se hace: crear un anuncio
1. Pulsa "Nuevo anuncio". Se abre una ventana con cuatro pestañas: "Contenido", "Público", "Cuándo sale" y "Cierre".
2. En "Contenido" elige la plantilla (Novedad, Promoción, Aviso, Evento, Solo imagen, Bienvenida o Comunicado interno), escribe el título y el texto, sube una imagen si quieres y, si lo deseas, agrega un botón con su texto y su enlace interno (por ejemplo /carta o /admin/caja). A la derecha ves la vista previa en vivo; cambia entre "Celular" y "PC".
3. En "Público" elige quién lo ve: "Carta" (clientes), "Personal" (empleados del panel) o "Ambos". Si es para personal, puedes marcar los roles que lo reciben; sin marcar ninguno lo ven todos.
4. En "Cuándo sale" fija la vigencia, la franja horaria, los días y la frecuencia (ver abajo).
5. En "Cierre" elige a los cuántos segundos se cierra solo (0 = no se cierra solo) y si la persona puede cerrarlo antes.
6. Pulsa "Guardar". Puedes revisar el resultado real con "Vista previa" en la lista.
Antes: [[novedades]]

## Como se hace: elegir cuándo sale
1. Vigencia: escribe "Desde" y "Hasta" (hora de Lima) o usa los atajos "Solo hoy", "Unas horas", "Días", "Una semana" y "Hasta que lo apague". Con "Unas horas" y "Días" indicas la cantidad.
2. Franja horaria (opcional): por ejemplo de 07:00 a 11:00, para que solo salga en ese rato. Si dejas las horas vacías sale todo el día.
3. Días de la semana (opcional): marca los días en que sale; sin marcar sale todos los días.
4. Frecuencia: "Una sola vez" (solo la primera vez que la persona entra mientras esté vigente), "Cada ingreso", "Veces por día" (indicas 1, 2…) o "Cada N horas".
5. Si hay varios anuncios al aire, salen uno tras otro por prioridad (el número más alto primero), con un máximo de 3 por ingreso.
Ver tambien: [[ofertas]]

## Como se hace: comunicados internos para el personal
1. Elige la plantilla "Comunicado interno" y el público "Personal".
2. Marca los roles que deben verlo, o ninguno para todo el equipo.
3. En "Cierre", si desactivas "La persona puede cerrarlo antes", solo se cierra pulsando "Entendido". En ese caso no puede cerrarse solo.
4. Para los clientes de la carta siempre se puede cerrar con la X o con Esc.
Ver tambien: [[notificaciones]]

## Como se hace: apagar, duplicar y ver resultados
1. En la lista, el interruptor "Activo" apaga o enciende el anuncio sin borrarlo.
2. El botón "Duplicar" crea una copia apagada para editarla antes de ponerla al aire.
3. Cada fila muestra el estado (Programado, Al aire, Vencido o Apagado) y los números de vistas, cierres y clics en el botón. Usa los filtros de estado y de público para encontrar uno.
4. "Eliminar" lo borra del todo y también sus números; si solo quieres pausarlo, apágalo.

## Errores y dudas comunes
- Mi anuncio no aparece: revisa que esté encendido, que la fecha "Hasta" no haya pasado, que la hora esté dentro de la franja y que hoy sea uno de los días marcados. Si ya lo viste y la frecuencia es "Una sola vez", no vuelve a salir en ese navegador o con ese usuario.
- En la carta la frecuencia se recuerda en el navegador del cliente: si borra los datos del navegador o entra desde otro celular, puede verlo de nuevo.
- Al guardar dice que el enlace del botón es inválido: debe ser interno y empezar con una sola barra (/carta, /admin/…); no se aceptan direcciones externas.
- La imagen no se sube: usa una foto en formato JPG, PNG o WebP; el sistema la reduce solo.

## Quien puede hacerlo
Ver la lista y las vistas previas requiere el permiso anuncios/ver; crear y duplicar, anuncios/crear; editar, encender y apagar, anuncios/editar; y eliminar, anuncios/eliminar. Los tiene por defecto el Administrador (ADMIN) y Marketing (MARKETING). Cualquier persona del personal ve los anuncios que le tocan al entrar al panel, sin necesidad de permiso.
