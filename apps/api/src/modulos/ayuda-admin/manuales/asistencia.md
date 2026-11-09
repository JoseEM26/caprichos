---
modulo: asistencia
titulo: Asistencia del personal
ruta: /admin/asistencia
permiso: asistencia/administrar
roles: [ADMIN]
relacionados: [mi-asistencia, asistencia-pantalla, usuarios, propinas, historial]
sugerencias:
  - Como veo quien llego hoy y quien falto
  - Como corrijo una marca que el trabajador olvido
  - Como fijo la ubicacion del local para marcar
  - Como reinicio el celular de un trabajador
  - Donde veo las selfies de las marcas
  - Como descargo la asistencia del mes
  - Que significa A revisar en una marca
---
# Asistencia del personal

## Para que sirve
Es el panel del Administrador para controlar la asistencia: quien llego, quien llego tarde, quien falto, cuantas horas trabajo cada persona en el mes, las fotos (selfies) de cada marca y las correcciones. Cada persona marca desde su celular en [[mi-asistencia]] leyendo el QR de la [[asistencia-pantalla]]. El turno de cada uno sale de Horarios y turnos en [[usuarios]].

Tiene cinco pestanas: Hoy, Mensual, Marcas y selfies, Configuracion y Pantalla del QR. Si el local aun no tiene ubicacion aparece una franja roja "Aun no configuras la ubicacion del local: nadie podra marcar" con el enlace Configurarla ahora.

Estado: probada en preproduccion; en produccion se activa cuando se configura la ubicacion y la pantalla del QR.

## Como se hace: Ver como va el dia (pestana Hoy)
1. Abre Asistencia; la pestana Hoy muestra la jornada y un resumen: Personas, Ya marcaron entrada, Llegaron tarde, Faltas y Por revisar. Se actualiza solo cada minuto.
2. En la tabla ves por persona: Turno, Entrada, Salida, Estado (por ejemplo Cumplio, Tardanza, En curso, Falta, Descanso) y Trabajado en horas. Si hay alertas se ven bajo el estado.
3. Usa Buscar persona (por nombre) y el filtro Estado para acotar.
Ver tambien: [[usuarios]]

## Como se hace: Ver el mes y descargarlo (pestana Mensual)
1. Pulsa Mensual y elige Ano y Mes.
2. Totales por persona: horas Programadas, horas Trabajadas y Dias trabajados.
3. Detalle por dia: Estado, Trabajado, Tardanza (min), Salida antes (min) y Extra (min).
4. Pulsa Exportar CSV para bajar el archivo asistencia-AAAA-MM.csv (por ejemplo para pagar sueldos). Es una de las bases del reparto de propinas por horas, ver [[propinas]].

## Como se hace: Revisar marcas y selfies
1. Pulsa Marcas y selfies. La tabla lista Persona, Jornada, Tipo, Hora, Estado (Valida o A revisar), Distancia al local, Precision del GPS y Origen (Celular o Correccion).
2. Pulsa Ver selfie para abrir la foto de esa marca; Cerrar foto la oculta. Solo el Administrador puede ver las fotos, y se borran solas pasado el plazo de retencion (90 dias por defecto).
3. Una marca A revisar significa que el sistema vio algo raro: GPS con precision perfecta de 0 m, coordenadas identicas repetidas en varias marcas o un salto de ubicacion imposible. Mira el motivo bajo el estado y decide.

## Como se hace: Corregir una marca olvidada
1. En Marcas y selfies, en la tarjeta Correccion de una marca, escribe el ID de la persona (el numero de su usuario), elige la Jornada, el Tipo (Entrada, Salida a almuerzo, Regreso de almuerzo o Salida) y la Fecha y hora real (hora de Lima).
2. Escribe el Motivo con al menos 10 caracteres.
3. Pulsa Registrar correccion. Verás "Correccion registrada. La marca original no se modifico.": queda como un registro nuevo con origen Correccion; nada se borra.
Ver tambien: [[historial]]

## Como se hace: Fijar la ubicacion del local y las reglas (pestana Configuracion)
1. Pulsa Configuracion. En Ubicacion del local puedes: escribir Latitud y Longitud, buscar una direccion, tocar o arrastrar el punto en el mapa, o pulsar Usar mi ubicacion actual (hazlo con el celular dentro del local, al centro y con GPS activado).
2. Si el equipo no tiene GPS preciso (precision peor que 100 m, ubicacion por internet) el sistema no llena las coordenadas y lo avisa: mueve el punto en el mapa o usa el celular. Si la precision es peor que 30 m sugiere salir a un lugar abierto.
3. En Marcas ajusta: Radio del local (m) (hoy 10), Tolerancia de tardanza (min) (hoy 10) y Precision GPS maxima aceptada (m) (hoy 25).
4. En Selfies ajusta Dias que se guardan las selfies (hoy 90): pasado el plazo la foto se borra, la marca se conserva.
5. Pulsa Guardar configuracion. Veras "Configuracion guardada.".

## Como se hace: Reiniciar el celular de una persona
1. La asistencia queda atada al primer celular que usa cada persona. Si cambio de equipo o perdio el celular, abre la pestana Hoy.
2. En su fila pulsa Reiniciar celular. Aparece "Vinculo de celular reiniciado. La persona debe volver a marcar desde su celular.".
3. La persona marca otra vez desde el celular nuevo, que queda vinculado.
Ver tambien: [[mi-asistencia]]

## Como se hace: Preparar la pantalla del QR
1. Pulsa Pantalla del QR para generar, regenerar o desactivar el enlace de la tablet del local. Los pasos completos estan en [[asistencia-pantalla]].

## Como se hace: Pagar la planilla (pestana Planilla)
1. Pon el sueldo de cada persona en Usuarios, pestana Horario: semanal o mensual; el otro se calcula (semanal = mensual x 12 / 52).
2. En la pestana Planilla elige un dia del periodo (semana de lunes a domingo o mes, segun la modalidad de cada persona) y abre a la persona.
3. Valor hora = sueldo del periodo / horas programadas (sin break ni descansos). Se paga lo trabajado dentro de su turno; la tardanza (pasada la tolerancia, 5 min) se paga al 50 % (configurable en Configuracion); salir antes no se paga; el break no se paga. Las horas extra solo suman si las apruebas en Jornadas y extras.
4. En Consumos marca los que se cobran en este pago; los demas pasan al siguiente periodo. En Adelantos y descuentos registra adelantos o descuentos por producto danado (se anulan con motivo, no se borran).
5. Marcar pagado congela el periodo. No mueve la caja. Para cambiarlo, Reabrir periodo con motivo.

## Como se hace: Vinculo y vacaciones del personal
1. En Usuarios, pestana Horario, debajo del sueldo, elige el Tipo de vinculo: En planilla o Contrato temporal, con su fecha de ingreso (en planilla, ademas, 30 o 15 dias de vacaciones al ano; en contrato temporal, la fecha de fin si la hay). Si eliges Contrato temporal veras un aviso: un contrato sin subordinacion no es compatible con horario fijo y asistencia obligatoria; validalo con tu contador o abogado. El aviso no bloquea.
2. Cambiar de tipo no borra nada: el vinculo anterior queda en el Historial de vinculos. Adjunta el contrato firmado (PDF, maximo 5 MB) con Subir contrato; solo el Administrador lo ve, con Ver contrato.
3. En Planilla, abre a la persona y entra a la pestana Vinculo y vacaciones. En la tabla de Planilla ves el vinculo de cada uno.
4. Las vacaciones son solo para personal en planilla. Se ganan por mes cumplido desde el ingreso: 30 dias al ano son 2.5 por mes; 15 dias son 1.25. Saldo = ganados + ajustes - tomadas - pagadas.
5. Registrar vacaciones tomadas: elige desde y hasta. Solo cuentan los dias con jornada programada (los descansos no gastan). Esos dias no son falta, se pagan al valor normal de su jornada y salen como Vacaciones en Jornadas y extras.
6. Registrar vacaciones pagadas: dias y monto liquidado en dinero; la fecha decide el periodo de planilla donde entra como Vacaciones pagadas (ingreso adicional). Registrar ajuste: dias con signo y motivo obligatorio (por ejemplo, saldo de otra empresa).
7. Cualquier movimiento se anula con motivo (se conserva, tachado). Si el periodo ya esta pagado, primero Reabrir periodo. Cada persona ve su propio saldo, sin dinero, en [[mi-asistencia]].

## Como se hace: Aprobar o anular una marca
En Marcas y selfies, las marcas hechas con usuario y contrasena (pagina publica /asistencia/marcar) quedan A revisar. Aprobar las hace contar; Anular las deja sin efecto. Ambas piden motivo y la marca se conserva. Solo cuentan las marcas validas o aprobadas.

## Errores y dudas
- "Hay N jornada(s) incompletas o por revisar": corrige o aprueba las marcas de esos dias antes de pagar.
- "Solo hay N dia(s) de saldo": no puedes tomar ni pagar mas de lo ganado; si corresponde, registra un ajuste con motivo.
- "Las vacaciones son solo para personal en planilla": revisa el vinculo de la persona.
- "Aun no configuras la ubicacion del local: nadie podra marcar": falta el punto del local; ve a Configuracion y guardalo.
- "No pudimos cargar el dia / el mes / las marcas": revisa la conexion y recarga.
- "La foto ya no esta disponible": paso el plazo de retencion y la selfie se borro; la marca sigue ahi.
- "No se pudo registrar la correccion": suele ser que la hora no cae en la jornada indicada ("La hora no cae en la jornada indicada"), la hora no es valida o el ID de persona no existe ("Persona no encontrada"). Revisa los datos.
- Un trabajador dice "Estas a N m del local": ver [[mi-asistencia]]; si es por mala senal puedes ampliar el Radio o corregir la marca.
- Un trabajador no puede marcar por cambio de celular: usa Reiniciar celular.
- Una persona sin turno: aparece como Descanso; los turnos se cargan en Horarios y turnos de [[usuarios]].

## Quien puede hacerlo
Solo el Administrador (permiso asistencia/administrar): reportes, selfies, correcciones, configuracion, reinicio de celular y enlace de la pantalla. El resto del personal solo marca y ve lo suyo en [[mi-asistencia]].
