---
modulo: usuarios
titulo: Usuarios
ruta: /admin/usuarios
permiso: usuarios/ver
roles: [ADMIN]
relacionados: [supervisor-codigo, historial, creditos, asistencia, cocina, propinas, iniciativas]
sugerencias:
  - ¿Cómo registro un nuevo empleado en el sistema?
  - ¿Cómo cambio el rol o cargo de un usuario?
  - ¿Por qué me pide el código del supervisor al cambiar un rol o desactivar a alguien?
  - ¿Cómo restablezco la contraseña de un usuario que no puede entrar?
  - ¿Cómo dejo a un suplente de supervisor por unos días?
  - ¿Cómo asigno a una persona más de un rol?
  - ¿Dónde veo lo que hizo un usuario?
  - ¿Cómo corrijo la fecha de ingreso o salida de un trabajador?
  - ¿Cómo asigno las áreas de cocina de un cocinero?
---
# Usuarios

## Para que sirve
Permite administrar las cuentas de acceso del personal de Caprichos (cajeros, mozos, cocineros, repartidores, personal de almacén y administradores). Permite crear nuevos colaboradores, editar sus datos, asignarles roles con permisos específicos, desactivar cuentas inactivas, gestionar horarios, créditos del personal con [[creditos]], validar con [[supervisor-codigo]] y auditar cada cambio en [[historial]].

## Como se hace: registrar un nuevo usuario del personal
1. En la pestaña "Personal", pulsa el botón "+ Nuevo usuario" en la esquina superior derecha.
2. En la ventana "Crear usuario", completa los campos requeridos: nombres, apellidos, documento de identidad (DNI de 8 dígitos), correo electrónico de contacto y teléfono celular.
3. En el campo "Rol", selecciona la función que desempeñará en el local: Administrador (ADMIN), Cajero (CAJERO), Cocina (COCINA), Mozo (MOZO), Call Center (CALLCENTER), Almacén (ALMACEN) o Repartidor (REPARTIDOR).
4. Pulsa el botón "Crear usuario".
5. El sistema generará una contraseña inicial temporal. Cópiala y entrégasela de forma segura al colaborador; al iniciar sesión por primera vez se le solicitará cambiarla obligatoriamente.
Despues: [[usuarios]]
Ver tambien: [[historial]]

## Como se hace: editar datos y cambiar el rol de un usuario
1. En la tabla de usuarios, busca al empleado y pulsa el botón "Editar" en su fila.
2. Puedes modificar sus nombres, apellidos, teléfono o correo.
3. Si cambias el campo "Rol" para otorgarle mayores o distintos accesos en el sistema, esta acción se considera crítica.
4. Al pulsar "Guardar cambios", si entras como administrador solo confirmas con "Sí, confirmar". Otros roles deben pedir el código rotativo de 6 dígitos del supervisor (visible en el módulo [[supervisor-codigo]]) y luego pulsar "Sí, confirmar".
Requiere: [[supervisor-codigo]]
Ver tambien: [[historial]]

## Como se hace: desactivar o reactivar un usuario
1. Si un empleado ya no labora en el local o necesita una suspensión temporal, pulsa el botón "Desactivar" en su fila.
2. Por motivos de seguridad y auditoría, el sistema abrirá una ventana de confirmación solicitando el código de 6 dígitos del supervisor.
3. Digita el código rotativo vigente obtenido en [[supervisor-codigo]] y confirma con "Sí, desactivar". El usuario perderá acceso inmediato al sistema y figurará con la etiqueta "Inactivo".
4. Para rehabilitar a un colaborador desactivado, pulsa "Reactivar" y confirma la acción en la ventana emergente con "Sí, reactivar".
Requiere: [[supervisor-codigo]]
Ver tambien: [[historial]]

## Como se hace: recibir alertas por WhatsApp
1. En la ficha de un administrador, marcar la casilla Recibir alertas por WhatsApp e ingresar su celular de 9 digitos que empiece con 9.
2. Pulsar Guardar alertas y confirmar con Si, guardar.
3. Pulsar Enviar prueba de nuevo y confirmar. El administrador recibe un mensaje con el boton Si, soy yo; al pulsarlo, la cuenta queda confirmada y empieza a recibir alertas.
4. Las alertas son vouchers sin revisar, chats en espera, pedidos demorados y calificaciones bajas de la encuesta posventa. Cada administrador recibe su propio mensaje: WhatsApp no envia a grupos.
Ver tambien: [[mensajes]], [[reclamos]]

## Como se hace: restablecer contraseña o asignar PIN
1. Si un colaborador olvidó su contraseña, pulsa "Restablecer contraseña" en su fila. Aparecerá la ventana de confirmación "¿Restablecer contraseña de este usuario?". Confirma con "Sí, restablecer". El sistema generará una nueva clave provisoria para que pueda ingresar.
2. Si el cajero o mozo requiere un PIN numérico rápido para autorizaciones en salón o caja, pulsa "Asignar PIN", escribe el código de 4 o 6 dígitos y confirma el guardado.
Ver tambien: [[usuarios]]

## Como se hace: Dar un rol temporal (por ejemplo supervisor suplente)
1. Abre Usuarios, pestana Personal, y pulsa Editar en la fila de la persona que reemplaza. En el editor busca la seccion Roles temporales ("Un rol extra con fecha de fin... Al vencer deja de valer solo"). Si no tiene, dice Ninguno.
2. Pulsa Dar rol temporal. En la ventana elige el rol ("Elige un rol..."), escribe el motivo (por ejemplo "el supervisor titular no viene hoy") y, en "Hasta cuando (opcional)", la fecha y hora de fin. Pulsa Dar rol.
3. Aparece "Rol X dado hasta la fecha indicada." (o "...sin fecha de fin."). En la lista se ve la insignia "Temporal · hasta dd/mm" o "sin fecha de fin".
4. Un supervisor suplente vigente puede aprobar con el codigo de supervisor como el titular; al vencer deja de valer solo y ya no puede autorizar ni ver el codigo. Ver [[supervisor-codigo]].
5. Para retirarlo antes, pulsa Quitar junto al rol temporal y confirma.
6. El historial de roles (Otorgado, Retirado, Vencido) no se puede borrar ni alterar: queda para auditar quien tuvo que permiso y cuando.
Requiere: [[supervisor-codigo]]

## Como se hace: Dar varios roles permanentes a una persona
1. En el editor (o al crear), en Otros roles (opcional), marca los roles adicionales. Los permisos de todos sus roles se unen.
2. Reglas: Administrador y Repartidor no se combinan; nadie puede darse roles a si mismo ("Nadie puede darse roles a si mismo"); un usuario desactivado primero se reactiva ("Reactiva al usuario antes de darle un rol"); si ya lo tiene dice "La persona ya tiene ese rol".
3. Solo el Administrador da o quita roles.

## Como se hace: Registrar un usuario por pasos y con otros documentos
1. En Personal pulsa + Nuevo usuario. El formulario va por pasos: Datos personales, Puesto, Horario y Reemplazos, y termina con un Resumen final.
2. En Tipo de documento puedes elegir DNI (8 digitos) u otro documento (carne de extranjeria, cedula, pasaporte, de 7 a 12 letras y numeros). Un documento repetido da DNI_DUPLICADO.
3. Si el rol es Cocina, marca las Areas que atiende (sin ninguna marcada ve todas). Ver [[cocina]].
4. Las pestanas de la pantalla son: Personal, Clientes, Horarios y turnos y Que ve cada rol. En Horarios y turnos se cargan los turnos que usa la [[asistencia]] para calcular tardanzas.
5. Reemplazos: se indica quien cubre a quien en los dias de descanso o falta.

## Como se hace: Ver la actividad y el historial laboral de una persona
1. En el editor del usuario, la seccion Actividad lista lo que hizo y lo que le hicieron (cambios de rol, accesos, acciones), con filtros por Tipo y por fechas Desde y Hasta, y paginacion. Solo el Administrador la ve.
2. La seccion Historial laboral muestra los periodos trabajados ("Ingreso dd/mm" / "Reingreso", "Salio dd/mm" o "Sigue"), el Tiempo total trabajado, las Veces que salio y la marca "En licencia".
3. Para corregir las fechas de un periodo pulsa Corregir periodo, cambia desde y hasta, guarda y confirma. Solo el Administrador.
Ver tambien: [[historial]]

## Errores y dudas comunes
- "La fecha de fin ya paso" (FECHA_PASADA) / "La fecha de fin no es valida": elige una fecha futura para el rol temporal.
- "Solo un administrador puede dar o quitar roles": inicia sesion como Administrador.
- "La persona no tiene ese rol extra": ya se retiro o vencio.
- "No se puede quitar el rol al ultimo administrador activo": debe quedar siempre un administrador.
- El personal puede ver y crear Iniciativas: desde esta version todo el personal las ve, crea y comenta; cambiar estado es del Administrador y del Supervisor. Ver [[iniciativas]].
- Para la participacion en el reparto de [[propinas]]: el Administrador no participa salvo excepcion fijada en Propinas.
- ¿Por qué el sistema me pide código de supervisor al cambiar de rol o desactivar?: si entras como administrador no lo pide, porque tú eres quien autoriza. Para los demás roles, cambiar privilegios o revocar el acceso a un empleado son operaciones críticas y se exige el código rotativo TOTP para prevenir accesos no autorizados.
- Ver DNI completo: los números de documento se muestran enmascarados por privacidad. Al pulsar "Ver DNI", el sistema registra una entrada de auditoría con la fecha, hora y usuario que consultó el dato personal.
- No puedo iniciar sesión con la contraseña temporal: asegúrate de no copiar espacios en blanco antes o después de los caracteres generados.

## Quien puede hacerlo
El módulo Usuarios está reservado exclusivamente para el Administrador (ADMIN) mediante el permiso usuarios/ver. Ningún otro rol puede visualizar la nómina del personal, crear cuentas ni alterar los roles del equipo.
