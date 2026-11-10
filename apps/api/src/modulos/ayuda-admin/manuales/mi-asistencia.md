---
modulo: mi-asistencia
titulo: Mi asistencia
ruta: /admin/mi-asistencia
permiso: asistencia/marcar
roles: [ADMIN, CAJERO, COCINA, MOZO, ALMACEN, REPARTIDOR, SUPERVISOR]
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

Tambien muestra tu turno de hoy, las marcas que ya hiciste, tus ultimos 7 dias con su estado (Cumplio, Tardanza, Salio antes, Salio despues, Falta, Descanso, Incompleto, A revisar, En curso) y, si hay reparto de propinas, la lista Mis propinas (ver [[propinas]]).

Estado de la funcion: la asistencia esta probada en preproduccion. En produccion se activa cuando el administrador deja la ubicacion del local configurada y publica la pantalla del QR; mientras el local no tenga ubicacion nadie puede marcar.

## Que pasa si el local no tiene ubicacion
Si el administrador aun no fijo la ubicacion del local, al abrir Mi asistencia ves el aviso "El administrador aun no configuro la ubicacion del local. Todavia no puedes marcar; avisale." y el boton Escanear QR queda desactivado (tampoco se puede escribir el codigo). Tu historial y tus propinas se siguen viendo. Avisa al administrador: cuando guarde el punto en [[asistencia]], pestana Configuracion, vuelve a abrir la pantalla y ya podras marcar. El repartidor ve el mismo aviso.

## Como se hace: Marcar mi entrada, almuerzo o salida
1. Entra al sistema con tu usuario. Si estas en la pantalla de ingreso, puedes pulsar Marcar mi asistencia: despues de iniciar sesion te lleva directo a Mi asistencia. En el menu tambien aparece Marcar asistencia.
2. Arriba lees el estado del dia: "Te falta marcar: Entrada" (o la que toque) y tu turno, por ejemplo "Tu turno: 09:00 a 18:00 (almuerzo 13:00-14:00)". Si no hay turno dice "Hoy no tienes turno programado.".
3. Solo la primera vez aparece un aviso de datos personales (se usan tu ubicacion, tu selfie y la hora). Marca la casilla "Acepto el tratamiento de mis datos para el control de asistencia." Sin aceptar no puedes marcar. Se acepta una sola vez: queda guardado aunque esa primera marca sea rechazada (por ejemplo, fuera del radio) y no se vuelve a pedir; abajo ves "Aceptaste el aviso de datos el..." con el enlace Ver aviso.
4. Pulsa el boton grande Escanear QR. Los pasos aparecen arriba: QR, Ubicacion, Selfie, Confirmar.
5. Paso 1, QR: apunta la camara al QR de la pantalla del local. Cambia cada 30 segundos, asi que escanea el que esta en pantalla en ese momento. Se lee solo.
6. Paso 2, Ubicacion: el celular pide permiso de ubicacion. Acepta. Dice "Leyendo tu ubicacion precisa..." y pasa solo al siguiente paso.
7. Paso 3, Selfie: se abre la camara frontal. Pulsa Tomar selfie.
8. Paso 4, Confirmar: revisa el tipo de marca y la foto, y pulsa Confirmar marca. Veras "Marca registrada" con la hora, por ejemplo "Marcaste Entrada a las 08:58".
Antes: [[asistencia-pantalla]]
Ver tambien: [[asistencia]]

## Como se hace: Marcar con el codigo de 6 digitos (si la camara no lee el QR)
1. En el paso Escanea el QR, mira la pantalla del local: debajo del QR dice "Si la camara no funciona, escribe este codigo" con 6 digitos.
2. En el campo "O escribe el codigo de 6 digitos de la pantalla" escribe los numeros (los espacios no importan).
3. Pulsa Continuar y sigue con Ubicacion, Selfie y Confirmar marca como siempre.
4. El codigo tambien cambia cada 30 segundos: si tardas, escribe el nuevo.
5. Si hay varias camaras y la que se abre no sirve, pulsa Cambiar cámara. Si el navegador bloqueo la camara, el aviso explica como permitirla.
Antes: [[asistencia-pantalla]]

## Como se hace: Marcar manualmente (sin QR)
Si no puedes escanear el QR (computadora sin camara o sin celular), inicia sesion normal, entra a Mi asistencia y toca Marcar manualmente (sin QR). Solo se lee tu ubicacion: debes estar dentro del radio del local; no hay foto. Si estas lejos o sin GPS, se rechaza con un mensaje. La marca queda A revisar y solo cuenta para el pago cuando el Administrador la aprueba.

## Como se hace: Instalar la app
En Mi asistencia o en la pantalla de ingreso toca Instalar app. En Chrome o Edge (PC y Android) se instala con un clic; en iPhone, Compartir y Anadir a pantalla de inicio. La app Caprichos Asistencia se abre directo en Mi asistencia y, si no tienes sesion, vuelve aqui despues de iniciarla.

## Como se hace: Marcar el almuerzo
1. Cuando sales a almorzar, entra a Mi asistencia: el sistema te pide "Salida a almuerzo" si tu turno tiene almuerzo y ya marcaste entrada.
2. Haz el mismo recorrido (QR, Ubicacion, Selfie, Confirmar marca).
3. Al volver, repite y marca "Regreso de almuerzo". Si el boton grande dice Marcar en vez de Escanear QR, debajo aparecen botones con las otras marcas permitidas: elige la que corresponde.
4. Al terminar el dia marca Salida. Una vez que existe la Salida, el sistema avisa "Tu jornada ya tiene salida registrada".

## Como se hace: Ver mis ultimos dias y mis propinas
1. Baja en la misma pantalla: la seccion Últimos días muestra cada fecha con su estado (por ejemplo Cumplio o Tardanza).
2. Si el administrador ya aprobo un reparto de propinas, aparece la seccion Mis propinas: cada mes con tus horas, tu porcentaje, el monto en soles y si esta Por pagar o Pagado (con el medio). Solo ves tu parte.
Ver tambien: [[propinas]]

## Errores y dudas
- "El local todavia no tiene ubicacion configurada. Avisa al administrador.": el administrador debe fijar el punto del local en [[asistencia]], pestana Configuracion.
- "Estas a N m del local. Debes estar a X m o menos para marcar.": estas fuera del radio (hoy 10 m por defecto). Acercate al lugar de la pantalla y vuelve a intentar. El administrador puede ampliar el radio.
- "Acercate y activa la ubicacion precisa del celular.": el GPS sale con poca precision. Activa Ubicacion en modo alta precision, sal de un rincon cerrado y reintenta.
- "Activa la ubicacion del celular y da permiso al navegador.": diste que no al permiso; habilitalo en la configuracion del navegador para este sitio.
- "El QR vencio o no es valido. Escanea el de la pantalla actual.": el QR dura 30 segundos; escanea el que esta en pantalla ahora. No sirve una foto del QR.
- "Ese QR ya lo usaste. Espera al siguiente.": cada QR vale para una sola marca por persona.
- "Tu asistencia esta vinculada a otro celular. Pide al administrador que reinicie el vinculo.": la asistencia se ata al primer celular que usas. Si cambiaste de equipo, el administrador pulsa Reiniciar celular en [[asistencia]] y vuelves a marcar.
- "Acepta el aviso de datos personales para marcar.": marca la casilla de consentimiento.
- "Esa marca ya quedo registrada hoy.": ya marcaste ese tipo; no hace falta repetir.
- "Demasiados intentos. Espera unos minutos y vuelve a intentar.": hubo varios intentos fallidos seguidos; espera unos 5 minutos.
- Errores de la foto ("La foto no es valida", "La foto es muy grande o esta vacia"): vuelve a tomar la selfie, con buena luz.
- Marca A revisar: se guarda igual, pero el sistema vio algo raro (precision perfecta de 0 m, mismas coordenadas muchas veces o un salto imposible de ubicacion) y el administrador la revisara. La pantalla lo avisa: "queda para revision del administrador".
- Nadie puede marcar por mi: el sistema solo acepta la marca desde mi sesion, mi celular vinculado y mi selfie.

## Quien puede hacerlo
Todo el personal con usuario: Administrador, Cajero, Cocina, Mozo, Almacen, Repartidor y Supervisor tienen el permiso asistencia/marcar. El repartidor en celular llega por un boton pequeno Asistencia dentro de Repartos. Las marcas de los demas solo las ve el administrador en [[asistencia]].
