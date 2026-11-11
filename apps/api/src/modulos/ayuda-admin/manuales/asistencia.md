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
2. En la pestana Planilla elige Semana o Mes arriba y usa las flechas (anterior y siguiente) o los atajos Esta semana, Semana pasada, Este mes y Mes pasado. La etiqueta dice el periodo (por ejemplo Semana del 9 al 15 de noviembre de 2026, o Noviembre 2026). Cada tarjeta muestra el A pagar de esa persona en el periodo elegido y arriba ves los totales: A pagar, Pagado y Pendiente. Regla cuando el periodo elegido no es el de la persona: en vista Mes, una persona semanal suma sus semanas cuyo domingo cae dentro del mes (cada semana con su propio estado; las ya pagadas salen congeladas y cada semana se abre y se paga por separado con sus botones de semana); en vista Semana, una persona mensual se muestra con el aviso "Se paga por mes" y su mes de referencia, y NO suma en los totales (se paga una vez, al mes). Abre a la persona con Abrir.
3. Valor hora = sueldo del periodo / horas programadas (sin break ni descansos). El break SE PAGA (cuenta como horas trabajadas). Se paga lo trabajado dentro de su turno; el tiempo de tardanza (pasada la tolerancia, 5 min) no se paga y ademas se aplica una Penalidad por tardanza = minutos de tardanza x (valor hora / 60) x factor (Penalidad por tardanza %, por defecto 100: pierde el doble; 0 = sin penalidad; maximo 500; se configura en Configuracion). Es proporcional al minuto, sin redondear a horas: con S/ 10 la hora y 60 minutos tarde, no se pagan S/ 10 y se descuentan S/ 10 de penalidad. La penalidad sale en su propia linea (Penalidad por tardanza, con el detalle por dia) dentro de los descuentos, separada de adelantos y consumos; no se aplica a quien tiene contrato temporal (Tercerizado). Salir antes no se paga. Las horas extra solo suman si las apruebas en Jornadas y extras.
4. Se le descuenta todo lo del periodo: consumos del personal, descuentos con etiqueta (consumo, merma, dano, prestamo, Netflix, otro), cuota del prestamo, servicios extra, penalidad por tardanza y adelantos. Neto = ganado + adicional (bonos) - consumos cobrados - descuentos - penalidad - cuotas y servicios - adelantos, sin descontar nada dos veces. La tarjeta lo resume y el panel lo detalla. En Descuentos y consumos marca los consumos que se cobran en este pago: son los MISMOS de Admin > Creditos (productos, fecha y monto ya con el descuento del personal). Los del periodo vienen marcados; los de periodos anteriores sin cobrar salen aparte ("Consumos de periodos anteriores sin cobrar", con su total tambien en la tarjeta) y vienen sin marcar: marca los que quieras descontar ahora. Los que no marques pasan al siguiente periodo. Al Marcar pagado quedan Cobrados en Creditos, con la fecha y la planilla que los cobro; un consumo no puede cobrarse en dos planillas. Si reabres el periodo vuelven a Pendiente. En Adelantos y descuentos registra adelantos o descuentos por producto danado (se anulan con motivo, no se borran).
5. Prestamos: al crear uno se puede indicar un Interes mensual % (0 por defecto = sin intereses; hasta 100). El interes es simple: interes = capital x interes% x meses del plan (cuotas mensuales = n meses; semanales = n x 12/52), total = capital + interes y cuota = total / n cuotas. La planilla y el detalle muestran capital, interes, cuota y saldo (saldo = capital + interes - cuotas descontadas). Los prestamos antiguos siguen sin interes. Servicios extra (Netflix y similares): nombre, monto y periodicidad semanal (monto por semana, x4 en planilla mensual) o mensual (monto por mes, entre 4 en planilla semanal), con casilla Cobrar por persona.
6. Marcar pagado congela el periodo. No mueve la caja. Para cambiarlo, Reabrir periodo con motivo.

## Como se hace: Calendario, el modal del dia y el detalle de la persona
1. En la pestana Calendario, arriba estan los controles agrupados y con letra grande: Ver | Programar, el mes con flechas, el rango (1 dia, 3 dias, Semana, Mes, Rango personalizado, Ver movimientos) y Filtros con sus chips.
2. En el modo Ver toca un dia (o arrastra, o usa Mayus para varios) y se abre una ventana grande con TODOS los movimientos: resumen (feriado, presentes, tardanzas, faltas, a revisar, solicitudes pendientes), buscador por nombre sin tildes, filtros rapidos por estado y la lista de personas con entrada, salida a almorzar, vuelta, salida, trabajado, tardanza, extra, estado y solicitudes. Un rango trae la pestana Todo el rango (agrupada por fecha) y una pestana por dia. Con las casillas aprueba o rechaza en lote. Esc o Cerrar la cierran. Si no quieres abrirla al tocar, usa Programar.
3. En cada persona, Ver detalle abre otra ventana encima (la del dia queda debajo; al cerrarla con Volver al dia regresas a la lista) con pestanas: Resumen, Marcas (linea de tiempo, origen, GPS aproximado, selfie solo para ti, aprobar, anular, separar, cambiar rol y agregar una marca que falta), Solicitudes (aprobar o rechazar con motivo) y Pago del periodo (lo que lleva ganado y descontado en su planilla).

## Como se hace: Vinculo y vacaciones del personal
1. En Usuarios, pestana Horario, debajo del sueldo, elige el Tipo de vinculo: En planilla o Contrato temporal, con su fecha de ingreso (en planilla, ademas, 30 o 15 dias de vacaciones al ano; en contrato temporal, la fecha de fin si la hay). Si eliges Contrato temporal veras un aviso: un contrato sin subordinacion no es compatible con horario fijo y asistencia obligatoria; validalo con tu contador o abogado. El aviso no bloquea.
2. Cambiar de tipo no borra nada: el vinculo anterior queda en el Historial de vinculos. Adjunta el contrato firmado (PDF, maximo 5 MB) con Subir contrato; solo el Administrador lo ve, con Ver contrato.
3. En Planilla, abre a la persona y entra a la pestana Vinculo y vacaciones. En la tabla de Planilla ves el vinculo de cada uno.
4. Las vacaciones son solo para personal en planilla. Se ganan por mes cumplido desde el ingreso: 30 dias al ano son 2.5 por mes; 15 dias son 1.25. Saldo = ganados + ajustes - tomadas - pagadas.
5. Registrar vacaciones tomadas: elige desde y hasta. Solo cuentan los dias con jornada programada (los descansos no gastan). Esos dias no son falta, se pagan al valor normal de su jornada y salen como Vacaciones en Jornadas y extras.
6. Registrar vacaciones pagadas: dias y monto liquidado en dinero; la fecha decide el periodo de planilla donde entra como Vacaciones pagadas (ingreso adicional). Registrar ajuste: dias con signo y motivo obligatorio (por ejemplo, saldo de otra empresa).
7. Cualquier movimiento se anula con motivo (se conserva, tachado). Si el periodo ya esta pagado, primero Reabrir periodo. Cada persona ve su propio saldo, sin dinero, en [[mi-asistencia]].

## Como se hace: Aprobar o anular una marca
En Marcas y selfies, las marcas hechas con Marcar manualmente (origen Manual: solo GPS, sin QR ni foto) quedan A revisar. Las marcas antiguas con usuario y contrasena (origen Usuario y contrasena) ya no se crean, pero se siguen mostrando y se aprueban o anulan igual. Aprobar las hace contar; Anular las deja sin efecto. Ambas piden motivo y la marca se conserva. Solo cuentan las marcas validas o aprobadas.

## Como se hace: Feriados y pago doble
En la pestana Feriados (solo Administrador) estan precargados los feriados nacionales de Peru de 2026 y 2027; revisalos cada ano porque el Estado puede mover o agregar dias. Puedes agregar uno (fecha, nombre y recargo), cambiar el recargo o Desactivarlo; nunca se borran y cada cambio queda en la auditoria. Las horas trabajadas en un feriado activo se pagan a valor hora x recargo (normal x2); la penalidad por tardanza ese dia se calcula sobre el valor hora ya recargado. Las horas programadas del periodo no cambian, y un periodo ya pagado no se recalcula. En el detalle de planilla la jornada muestra la etiqueta "Feriado x2".

## Como se hace: Marcas multiples, cronograma y correcciones
Una persona puede marcar varias veces (1, 3, 4, 7, 8): ya no hay un boton por tipo. El sistema ordena las marcas validas de la jornada por hora y las lee por orden y pares: la primera es la Entrada, la ultima la Salida, y las del medio se emparejan (salida a break y regreso del break). El almuerzo se paga: no se descuenta de las horas trabajadas; marcarlo es opcional y solo deja el registro de su duracion (suma de los pares). Cada marca por QR puede llevar un tipo (Entrada, Salida, Salida a almuerzo, Regreso de almuerzo): si lo trae, manda sobre el orden; las marcas antiguas sin tipo se siguen leyendo por orden y pares. Marcas a menos de 3 minutos de la anterior (se cambia en Configuracion, "Doble marca") se unen: cuenta la primera y la otra se ve tachada. Si las cantidades no cuadran (3 marcas, 7 marcas, un break sin regreso), la jornada queda A revisar con el motivo ("Marco 3 veces: falta el regreso del break") y el periodo no se puede marcar pagado hasta corregirla.
1. Pestana Cronograma: elige Dia o Mes. El mes es un calendario con indicadores en texto por dia (cumplieron, tardanzas, por revisar, faltas, solicitudes); toca un dia para ver la linea de tiempo de cada persona: franja del horario, barra de trabajo, barra rayada de break y cada marca con su hora exacta. Filtra por persona y por rol.
2. Toca una marca para ver origen, estado y selfie. Con un motivo de al menos 10 caracteres puedes Aprobarla, Anularla, Separarla (si es doble marca, pasa a ser marca propia) o Cambiar su rol (anula la original y crea una correccion a la misma hora, nada se borra).
3. Las solicitudes pendientes salen sobre la linea del dia en otro estilo (punteadas) para compararlas con las marcas y las camaras antes de decidir.
4. Pestana Solicitudes de correccion (con contador): lista las solicitudes de las personas, las marcas por revisar (manuales con usuario y contrasena, con alertas de GPS) y las dobles marcas. Filtra por tipo, persona, rol y fechas (atajos: Hoy, ultimos 2 o 3 dias, toda la semana), marca varias con las casillas o "Seleccionar todo lo visible" y usa Aprobar seleccionadas o Rechazar/anular seleccionadas (un solo motivo para todas). Se te pide confirmar con un resumen; el maximo es 200 por vez y al terminar ves el resultado de cada una (por ejemplo "Periodo ya pagado"). Nada queda a medias en silencio.
5. En Planilla, al abrir a una persona, la pestana Calendario y pago por dia muestra por dia el horario, las marcas interpretadas, horas pagadas, break, tardanza, extra pendiente de aprobar, feriado y vacacion y cuanto se gana ese dia. Arriba, el aviso "N jornadas por revisar" enlaza a cada dia. El boton "Aprobar todas las marcas dudosas del periodo" aprueba solo las simples (marcas manuales y solicitudes pendientes) tras revisar las camaras; las jornadas con cantidades raras se corrigen una por una.
6. Cuando una solicitud se aprueba se crean las marcas (origen Correccion, a tu nombre, con el motivo de la solicitud); si se rechaza, la persona ve tu motivo y la inconsistencia vuelve a aparecer. Un periodo ya pagado no admite aprobar: primero Reabrir periodo. Todo queda en la auditoria.

## Que ve el trabajador
En [[mi-asistencia]], marca con un solo boton y ve cada marca con lo que se interpreto (Entrada, Salida a break, Regreso del break, Salida). Al dia siguiente, si una jornada cerrada tiene marcas que no cuadran o un dia con horario no tiene marcas, aparece el bloque "Inconsistencia detectada" con un boton por jornada que abre la solicitud de correccion con la fecha y la marca que falta; tambien le llega un aviso en la campana. Indica la hora real y un motivo (minimo 5 caracteres): solo puede pedir de sus propias jornadas de los ultimos 7 dias (Configuracion, "Dias para pedir correccion"), nunca en periodos pagados ni con hora futura, y puede cancelar mientras este pendiente. La correccion no cuenta hasta que la apruebes. En [[mi-asistencia]], la tarjeta "Lo que llevo ganado" muestra por dia las horas y lo ganado, el acumulado del periodo y si es Estimado (puede cambiar hasta que el Administrador cierre el periodo) o Pagado (con el neto recibido). Solo ve lo suyo.

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
