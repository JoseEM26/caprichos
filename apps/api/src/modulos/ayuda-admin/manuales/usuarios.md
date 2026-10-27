---
modulo: usuarios
titulo: Usuarios
ruta: /admin/usuarios
permiso: usuarios/ver
roles: [ADMIN]
relacionados: [supervisor-codigo, historial, creditos]
sugerencias:
  - ¿Cómo registro un nuevo empleado en el sistema?
  - ¿Cómo cambio el rol o cargo de un usuario?
  - ¿Por qué me pide el código del supervisor al cambiar un rol o desactivar a alguien?
  - ¿Cómo restablezco la contraseña de un usuario que no puede entrar?
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
4. Al pulsar "Guardar cambios", el sistema abrirá la ventana de autorización solicitando el código rotativo de 6 dígitos del supervisor.
5. Pide el código actual al supervisor (visible en el módulo [[supervisor-codigo]]) o digítalo si eres la persona autorizada, y pulsa "Sí, confirmar".
Requiere: [[supervisor-codigo]]
Ver tambien: [[historial]]

## Como se hace: desactivar o reactivar un usuario
1. Si un empleado ya no labora en el local o necesita una suspensión temporal, pulsa el botón "Desactivar" en su fila.
2. Por motivos de seguridad y auditoría, el sistema abrirá una ventana de confirmación solicitando el código de 6 dígitos del supervisor.
3. Digita el código rotativo vigente obtenido en [[supervisor-codigo]] y confirma con "Sí, desactivar". El usuario perderá acceso inmediato al sistema y figurará con la etiqueta "Inactivo".
4. Para rehabilitar a un colaborador desactivado, pulsa "Reactivar" y confirma la acción en la ventana emergente con "Sí, reactivar".
Requiere: [[supervisor-codigo]]
Ver tambien: [[historial]]

## Como se hace: restablecer contraseña o asignar PIN
1. Si un colaborador olvidó su contraseña, pulsa "Restablecer contraseña" en su fila. Aparecerá la ventana de confirmación "¿Restablecer contraseña de este usuario?". Confirma con "Sí, restablecer". El sistema generará una nueva clave provisoria para que pueda ingresar.
2. Si el cajero o mozo requiere un PIN numérico rápido para autorizaciones en salón o caja, pulsa "Asignar PIN", escribe el código de 4 o 6 dígitos y confirma el guardado.
Ver tambien: [[usuarios]]

## Errores y dudas comunes
- ¿Por qué el sistema me pide código de supervisor al cambiar de rol o desactivar?: cambiar privilegios o revocar el acceso a un empleado son operaciones críticas. El sistema exige validar el código rotativo TOTP para prevenir accesos no autorizados.
- Ver DNI completo: los números de documento se muestran enmascarados por privacidad. Al pulsar "Ver DNI", el sistema registra una entrada de auditoría con la fecha, hora y usuario que consultó el dato personal.
- No puedo iniciar sesión con la contraseña temporal: asegúrate de no copiar espacios en blanco antes o después de los caracteres generados.

## Quien puede hacerlo
El módulo Usuarios está reservado exclusivamente para el Administrador (ADMIN) mediante el permiso usuarios/ver. Ningún otro rol puede visualizar la nómina del personal, crear cuentas ni alterar los roles del equipo.
