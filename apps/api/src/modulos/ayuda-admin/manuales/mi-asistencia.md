---
modulo: mi-asistencia
titulo: Mi asistencia
ruta: /admin/mi-asistencia
permiso: asistencia/marcar
roles: [ADMIN, CAJERO, COCINA, MOZO, ALMACEN, REPARTIDOR, SUPERVISOR, MARKETING]
relacionados: [asistencia, asistencia-pantalla, propinas, usuarios, escritorio]
sugerencias:
  - Como marco mi entrada con el QR de la pantalla
  - Que hago si la camara no lee el QR
  - Por que me sale Estas a N m del local
  - Me cambie de celular y no me deja marcar
  - Como marco la salida a almuerzo y el regreso
  - Donde veo cuanto me toca de propinas
  - Por que mi marca quedo A revisar
---
# Mi asistencia

## Para que sirve
Es la pantalla donde cada persona del equipo marca su propia asistencia desde su celular: Entrada, Salida a almuerzo, Regreso de almuerzo y Salida. Para que la marca valga hay que estar en el local: se lee el QR de la pantalla del local (ver [[asistencia-pantalla]]), se toma la ubicacion GPS del celular y una selfie. El administrador revisa los resultados en [[asistencia]].

La pantalla tiene cuatro pestanas arriba: Marcar (donde marcas), Periodo (tus horas de la semana o el mes, lo que llevas ganado, tus vacaciones y tus propinas), Calendario (tus dias con su estado y las correcciones) y Pagos (lo que se te suma, lo que se te descuenta, tus prestamos y el neto). Por encima de las pestanas siempre ves el estado de hoy: la fecha, la hora, que te falta marcar y tu turno. La pantalla recuerda la ultima pestana que abriste en ese celular; si estas en otra, el boton Ir a marcar te devuelve a Marcar.

Estado de la funcion: la asistencia esta probada en preproduccion. En produccion se activa cuando el administrador deja la ubicacion del local configurada y publica la pantalla del QR; mientras el local no tenga ubicacion nadie puede marcar.

## Que pasa si el local no tiene ubicacion
Si el administrador aun no fijo la ubicacion del local, al abrir Mi asistencia ves el aviso "El administrador aun no configuro la ubicacion del local. Todavia no puedes marcar; avisale." y los botones de la accion (Entrada, Salida...) en la pestana Marcar quedan desactivados. Las demas pestanas (periodo, calendario y pagos) se siguen viendo. Avisa al administrador: cuando guarde el punto en [[asistencia]], pestana Configuracion, vuelve a abrir la pantalla y ya podras marcar. El repartidor ve el mismo aviso.

## Como se hace: Marcar mi entrada, almuerzo o salida
1. Entra al sistema con tu usuario. Si estas en la pantalla de ingreso, puedes pulsar Marcar mi asistencia: despues de iniciar sesion te lleva directo a Mi asistencia. En el menu tambien aparece Marcar asistencia.
2. Arriba lees el estado del dia: "Te falta marcar: Entrada" (o la que toque) y tu turno, por ejemplo "Tu turno: 09:00 a 18:00 (almuerzo 13:00-14:00)". Si no hay turno dice "Hoy no tienes turno programado.".
3. En la pestana Marcar el marcado va por pasos, una parte a la vez, con "Paso N de 5" y una barra de avance. Paso 1, Que estas haciendo: toca Entrada, Salir a almorzar, Volver del almuerzo o Salida (la sugerida sale primero).
4. Paso 2, Escanea el QR: apunta la camara al QR de la pantalla del local. Cambia cada 30 segundos, asi que escanea el que esta en pantalla en ese momento. Se lee solo y pasa al siguiente paso.
5. Paso 3, Tu ubicacion: el celular pide permiso de ubicacion. Acepta. Dice "Leyendo tu ubicacion..." y pasa solo al siguiente paso.
6. Paso 4, Tu selfie: se abre la camara frontal. Pulsa Tomar selfie.
7. Paso 5, Confirma tu marca: ves un resumen con la marca, la hora, que el QR fue leido, tu ubicacion y la foto en miniatura. Pulsa Confirmar marca. Veras "Marca registrada" con la hora, por ejemplo "Marcaste Entrada a las 08:58", y el boton Hacer otra marca.
8. Si algo falta, el boton Siguiente queda apagado y justo encima dice que falta (por ejemplo "Falta escanear el QR o escribir los 6 numeros de la pantalla"). El boton Atras te devuelve al paso anterior sin perder lo que ya hiciste: el QR, la ubicacion y la selfie se conservan. Si cambias de pestana y vuelves, el paso en que ibas tambien se conserva.
9. Si el servidor rechaza la marca (por ejemplo QR vencido, estas lejos del local o la foto no sirve), la pantalla vuelve al paso del problema y explica que hacer.
Antes: [[asistencia-pantalla]]
Ver tambien: [[asistencia]]

## Como se hace: Marcar con el codigo de 6 digitos (si la camara no lee el QR)
1. En el paso 2, Escanea el QR, mira la pantalla del local: debajo del QR dice "Si la camara no funciona, escribe este codigo" con 6 digitos.
2. En el campo "O escribe el codigo de 6 digitos de la pantalla" escribe los numeros (los espacios no importan).
3. Pulsa Siguiente (se enciende cuando hay 6 digitos) y sigue con Tu ubicacion, Tu selfie y Confirmar marca como siempre.
4. El codigo tambien cambia cada 30 segundos: si tardas, escribe el nuevo.
5. Si hay varias camaras y la que se abre no sirve, pulsa Cambiar cámara. Si el navegador bloqueo la camara, el aviso explica como permitirla.
Antes: [[asistencia-pantalla]]

## Como se hace: Marcar manualmente (sin QR)
Si no puedes escanear el QR (computadora sin camara o sin celular), inicia sesion normal, entra a Mi asistencia, pestana Marcar, y toca Marcar manualmente (sin QR). Son solo 2 pasos (la accion y la ubicacion): el QR y la selfie no son necesarios. Solo se lee tu ubicacion: debes estar dentro del radio del local; no hay foto. Si estas lejos o sin GPS, se rechaza con un mensaje. La marca queda A revisar y solo cuenta para el pago cuando el Administrador la aprueba.

## Como se hace: Instalar la app
En Mi asistencia o en la pantalla de ingreso toca Instalar app. En Chrome o Edge (PC y Android) se instala con un clic; en iPhone, Compartir y Anadir a pantalla de inicio. La app Caprichos Asistencia se abre directo en Mi asistencia y, si no tienes sesion, vuelve aqui despues de iniciarla.

## Como se hace: Marcar el almuerzo
Marcar el almuerzo es opcional: el almuerzo se paga igual y no se descuenta de tus horas; solo queda registrado cuanto duro. El sistema te sugiere la siguiente marca (Entrada, Salida a almuerzo, Regreso de almuerzo, Salida) y puedes aceptarla o elegir otra.
1. Cuando sales a almorzar, entra a Mi asistencia: el sistema te pide "Salida a almuerzo" si tu turno tiene almuerzo y ya marcaste entrada.
2. Haz el mismo recorrido por pasos (QR, Ubicacion, Selfie, Confirmar marca).
3. Al volver, repite y marca "Regreso de almuerzo". En el paso 1 puedes elegir otra marca distinta de la sugerida.
4. Al terminar el dia marca Salida. Una vez que existe la Salida, el sistema avisa "Tu jornada ya tiene salida registrada".

## Como se hace: Ver mi periodo, mi calendario y mis pagos
1. Pestana Periodo: tus horas programadas y trabajadas, tardanzas y faltas; lo que llevas ganado dia por dia; tus vacaciones y, si el administrador ya aprobo un reparto de propinas, la lista Mis propinas (mes, horas, porcentaje, monto y si esta Por pagar o Pagado con el medio). Se ven las 3 mas recientes; Ver N mas muestra el resto. Solo ves tu parte. El numero junto al nombre de la pestana son tus propinas por pagar.
2. Pestana Calendario: tus dias del mes con su estado (Cumplio, Tardanza, Salio antes, Falta, Descanso, Incompleto, En revision, En curso). Toca un dia para ver sus marcas y pedir una correccion. El numero rojo son las jornadas con una marca que falta o no cuadra: ahi puedes pedir la correccion.
3. Pestana Pagos: lo que se te suma, lo que se te descuenta, tus prestamos y el neto estimado. Si no carga, pulsa Reintentar.
Ver tambien: [[propinas]]

## Errores y dudas
- "El local todavia no tiene ubicacion configurada. Avisa al administrador.": el administrador debe fijar el punto del local en [[asistencia]], pestana Configuracion.
- "Estas a N m del local. Debes estar a X m o menos para marcar.": estas fuera del radio (hoy 10 m por defecto). Acercate al lugar de la pantalla y vuelve a intentar. El administrador puede ampliar el radio.
- "Acercate y activa la ubicacion precisa del celular.": el GPS sale con poca precision. Activa Ubicacion en modo alta precision, sal de un rincon cerrado y reintenta.
- "Activa la ubicacion del celular y da permiso al navegador.": diste que no al permiso; habilitalo en la configuracion del navegador para este sitio.
- "El QR vencio o no es valido. Escanea el de la pantalla actual.": el QR dura 30 segundos; escanea el que esta en pantalla ahora. No sirve una foto del QR.
- "Ese QR ya lo usaste. Espera al siguiente.": cada QR vale para una sola marca por persona.
- "Tu asistencia esta vinculada a otro celular. Pide al administrador que reinicie el vinculo.": la asistencia se ata al primer celular que usas. Si cambiaste de equipo, el administrador pulsa Reiniciar celular en [[asistencia]] y vuelves a marcar.
- "Esa marca ya quedo registrada hoy.": ya marcaste ese tipo; no hace falta repetir.
- "Demasiados intentos. Espera unos minutos y vuelve a intentar.": hubo varios intentos fallidos seguidos; espera unos 5 minutos.
- Errores de la foto ("La foto no es valida", "La foto es muy grande o esta vacia"): vuelve a tomar la selfie, con buena luz.
- Marca A revisar: se guarda igual, pero el sistema vio algo raro (precision perfecta de 0 m, mismas coordenadas muchas veces o un salto imposible de ubicacion) y el administrador la revisara. La pantalla lo avisa: "queda para revision del administrador".
- Nadie puede marcar por mi: el sistema solo acepta la marca desde mi sesion, mi celular vinculado y mi selfie.

## Quien puede hacerlo
Todo el personal con usuario: Administrador, Cajero, Cocina, Mozo, Almacen, Repartidor y Supervisor tienen el permiso asistencia/marcar. El repartidor en celular llega por un boton pequeno Asistencia dentro de Repartos. Las marcas de los demas solo las ve el administrador en [[asistencia]].
