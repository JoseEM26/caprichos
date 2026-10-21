# Reporte de Auditoría: Notificaciones, Perfil de Usuario y Módulo de Usuarios
**Sistema**: Restaurant.pe (Instancia en Producción: CAPRICHOS - `https://caprichos.restaurant.pe/restaurant/#!/login`)  
**Fecha de Ejecución**: 2026-10-13 11:00:00 (Hora Local Lima / America/Lima)  
**Usuario de Auditoría**: `krosales`  
**Modo**: SOLO LECTURA estricto en entorno de PRODUCCIÓN en uso real.

---

## (a) Resultado del Inicio de Sesión y Detalle Observado

### 1. Estado de la Autenticación: **EXITOSO (1 Solo Intento)**

El proceso de autenticación se completó en un **único intento controlado**, respetando de manera estricta la directiva de no tocar los selectores precargados, no ingresar clave de caja y no reintentar.

### 2. Inspección Previa de Controles en el Formulario de Login:
Antes de ingresar credenciales, se inspeccionaron los elementos del DOM y sus valores:

| Campo (`name` / `ng-model`) | Tipo de Control | Valor Precargado Observado | Texto Visible / Etiqueta | Acción Realizada |
| :--- | :--- | :--- | :--- | :--- |
| `local_id` (`vm.usuario.local_id`) | `<select>` | `string:1` | **CAPRICHOS** | *No tocado (conservado)* |
| `caja_id` (`vm.usuario.caja_id`) | `<select>` | `string:1` | **Caja Principal** | *No tocado (conservado)* |
| `turno_id` (`vm.usuario.turno_id`) | `<select>` | `string:1` | **Turno Dia** | *No tocado (conservado)* |
| `usuario_nick` (`vm.usuario.usuario_nick`) | `<input type="text">` | `""` (vacío) | Placeholder: `Usuario` | *Escrito únicamente: `krosales`* |
| `usuario_clave` (`vm.usuario.usuario_clave`) | `<input type="password">` | `""` (vacío) | Placeholder: `Contraseña` | *Inyectado desde variable de entorno `LOGIN_PASSWORD`* |
| `usuario_clavecaja` (`vm.usuario.usuario_clavecaja`)| `<input type="password">`| `""` (vacío) | Placeholder: `Clave de caja` | *No tocado (se mantuvo vacío)* |

### 3. Dinámica del Clic y Estado de la Red / Botón:
- **Estado del botón antes del clic**:  
  - Texto: `Iniciar sesión`  
  - Clases: `btn btn-primary btn-block m-t-lg ladda-button`  
  - Atributo `disabled`: `false`.
- **Acción**: Pulsación única sobre el botón de envío.
- **Segundo 1 tras el clic**: El botón pasó a estado bloqueado temporalmente (`disabled: true`) mientras el componente Ladda gestionaba la solicitud asíncrona.
- **Segundo 2 tras el clic**: Transición exitosa de URL desde `http://caprichos.restaurant.pe/restaurant/#!/login` hacia la consola principal `http://caprichos.restaurant.pe/restaurant/#!/`.
- **Registro HTTP de la Solicitud de Autenticación**:
  - **Método**: `POST`
  - **URL**: `http://caprichos.restaurant.pe/restaurant/m/rest/usuario/login`
  - **Payload enviado**: `{"usuario_recordar":"1","local_id":"1","caja_id":"1","turno_id":"1","usuario_nick":"krosales","usuario_clave":"[REDACTED]","app":"Web"}`
  - **Código de Estado HTTP**: `200 OK`
  - **Cuerpo de Respuesta**: `{"mensajes":["logueado con exito"],"mensajes2":[],"tipo":"1"}`
- **Mensajes de error o bloqueo**: **Ninguno**. No se observaron mensajes de error, advertencias de intento fallido ni contadores de bloqueo.

> [!NOTE]  
> **Diagnóstico del incidente previo de bloqueo en pantalla de login**:  
> El sistema en frontend requiere entre 2.5 y 4 segundos para que AngularJS ejecute las llamadas REST (`getLocalList`, `getCajaListByLocal/1`, `getTurnoListByLocal/1`) y popule los `<select>` vinculados al modelo `vm.usuario`. Si un script o usuario interactúa y envía el formulario antes de que dichos modelos terminen de inicializarse, la validación cliente de AngularJS (`form.$invalid = true`) cancela el evento de envío silenciosamente sin emitir peticiones HTTP ni mostrar mensajes de error visibles. Al aguardar 4 segundos de estabilización pasiva previa, la petición POST se disparó y resolvió de forma inmediata en 2 segundos.

---

## (b) Mapeo y Documentación de Módulos Específicos

---

### (1) NOTIFICACIONES (Barra Superior y Alertas de Sistema)

#### ¿Qué es y para qué sirve?
Es el subsistema centralizado de alerta y comunicación en tiempo real de la plataforma. Su función es notificar al personal de restaurante sobre incidencias operativas críticas (problemas de conexión con impresoras de cocina/caja), estatus fiscal ante la SUNAT (comprobantes pendientes o vencimiento del Certificado Digital Tributario), mensajes internos entre colaboradores, alertas de stock bajo en almacén y pedidos de delivery entrantes que requieren confirmación inmediata.

#### Secciones y Tipos de Notificaciones:
1. **Campana de Comprobantes Pendientes (`fa-bell` en cabecera)**:
   - *Condición de despliegue*: Se activa visiblemente en tono anaranjado cuando existen comprobantes o boletas pendientes de envío/sincronización fiscal (`vm.boletas !== 0`).
   - *Destino / Acción*: Al hacer clic dispara `vm.fmVerficdoffacturas()`, abriendo el módulo de regularización de facturación electrónica.
2. **Buzón de Mensajes Internos (`fa-envelope` en cabecera)**:
   - *Condición de despliegue*: Muestra un badge numérico rojo (`label-danger`) con el conteo de mensajes no leídos.
   - *Panel flotante desplegable (`#messages-popup`)*:
     - Lista de mensajes recibidos mostrando nombre del remitente (`usuarioRemite`), cuerpo del mensaje y tiempo transcurrido (*time-ago*).
     - Acciones rápidas de lectura: "Marcar como leído" o "Marcar como no leído".
     - Enlace al pie: Redirige a la bandeja general de mensajes (`ui-sref="mensajes.inbox"`).
3. **Notificaciones del Sistema y Almacén (`dropdown-messages`)**:
   - Menú desplegable con las últimas 7 alertas generales del sistema, acompañadas de avatar o icono descriptivo, fecha y botón "Eliminar".
   - *Alerta fija de inventario*: Muestra un aviso con enlace directo: *"Desde ahora puedes ver los articulos con stock bajo desde Almacen/stock, click aquí para ir"*, el cual ejecuta `vm.fnAbrirInformeStockBajo()` redirigiendo a la pantalla de existencias mínimas.
4. **Alerta de Soporte y Error de Impresora (`fa-print`)**:
   - Se anima con efecto *tada* y muestra un distintivo rojo de exclamación (`!`) cuando se detecta falla en la cola de impresión local o puerto de red.
   - Panel emergente: *"Se produjo un error de impresión"*, con enlace directo al asistente de diagnóstico y soporte de impresoras (`vm.fnSoporteImpresora()`).
5. **Avisos de Delivery por Confirmar (`fa-truck`)**:
   - Notificación de acceso rápido para consultar pedidos online o externos que aguardan confirmación del encargado (`vm.fnDeliverysPorConfirmar()`).
6. **Banners de Notificación Fijos en la Cabecera Global (`topnavbar.html`)**:
   - **Pago pendiente del sistema**: Alerta de cobranza del servicio restaurant.pe con enlace a `mirestaurante.facturas` ("Ir a Pagos del Sistema").
   - **Caducidad de Certificado Digital (SUNAT)**: Avisos de alerta preventiva y de suspensión ante vencimiento del Certificado Digital Tributario (CDT).
   - **Atención de Incidencias**: Mensaje flotante cuando el personal de soporte centralizado de la plataforma está atendiendo un ticket del local.
   - **Transmisiones y Novedades**: Notificación de webinars o capacitaciones en vivo.

---

### (2) PERFIL DE USUARIO (Menú del Usuario en Barra Superior y Menú Lateral)

#### ¿Qué es y para qué sirve?
Es el módulo de identidad y contexto de trabajo del usuario. Permite al operador verificar de forma permanente bajo qué credencial, caja registradora y sucursal física está transaccionando en el restaurante, alternar entre diferentes locales si tiene asignados privilegios multisucursal, acceder rápidamente al panel de Ajustes del sistema y finalizar la sesión de manera segura.

#### Ubicación en Interfaz:
- **Barra Superior Derecha**: Componente desplegable con icono de engranaje (`<li uib-dropdown class="double-line">`).
- **Encabezado del Menú Lateral**: Componente de perfil bajo el logo de la empresa (`.nav-header .profile-element`).

#### Opciones y Secciones que Ofrece:
1. **Información de Contexto Operativo Visible (Cabecera)**:
   - `Usuario`: Nombre o nick de la cuenta en sesión (`krosales`).
   - `Caja`: Caja a la que está enlazado el operador en el turno actual (`Caja Principal`).
   - `Sucursal`: Local activo del restaurante (`CAPRICHOS`).
2. **Ajustes del sistema**:
   - Enlace directo con icono `fa-gears` que redirige a la raíz del panel de configuración general (`ui-sref="ajustes"` / `#!/ajustes`).
3. **Selector y Conmutador de Sucursales (Multilocal)**:
   - Lista interactiva de todas las sucursales vinculadas a la empresa (`main.localList`).
   - Muestra en texto resaltado con icono de edificio (`fa-building`) la sucursal activa.
   - Permite hacer clic en cualquier otra sucursal para conmutar la sesión en caliente sin necesidad de desloguearse (`main.cambiarSucursal(local)`).
4. **Cerrar sesión**:
   - Opción con icono de salida (`fa-sign-out`) que ejecuta la función `main.cerrarSesion()`. Esta acción invalida la sesión activa en el servidor y redirige al navegador de vuelta a la pantalla de login (`#!/login`).

---

### (3) USUARIOS: Ajustes > Usuarios (`#!/ajustes/usuarios`)

#### ¿Qué es y para qué sirve?
Es el módulo de gestión y control de accesos del personal del restaurante. Permite dar de alta nuevos colaboradores, editar datos personales y credenciales de acceso a la web, tablets de comanda y puntos de venta (POS), fijar cargos operativos, asignar sucursales, cajas e impresoras autorizadas, y restringir o conceder permisos funcionales granulares.

---

#### 1. Vista de Lista de Usuarios (`index.html` - `#!/ajustes/usuarios`):
- **Título de Pantalla**: `Usuarios registrados`
- **Nombres Exactos de las Columnas de la Tabla**:
  1. `Usuario`
  2. `Nombres`
  3. `Apellidos`
  4. `Cargo`
  5. `Perfil`
  6. `Estado`
  7. `Acciones`
- **Botones de Acción por Cada Fila**:
  - `Editar` (Abre el formulario de edición en `#!/ajustes/usuarios/:idUsuario/editar`)
  - `Permisos POS` (Abre el formulario de permisos específicos de punto de venta en `#!/ajustes/usuarios/:idUsuario/editar-permisopos`)
  - `Eliminar FaceID` (Limpia el registro biométrico facial del usuario)
- **Filtros y Controles Superiores de la Lista**:
  - Buscador textual: `vm.valBusqueda`
  - Filtro checkbox: `Ver Inactivos` (`vm.verinactivos`)
  - Filtro checkbox: `Usuarios sin acceso a la plataforma` (`vm.versinaccesoplataforma`)
  - Botón principal de cabecera: `Nuevo usuario` (Redirige a `#!/ajustes/usuarios/nuevo`)
- **Cantidad Aproximada de Usuarios Registrados**:
  - La primera página muestra **12 filas de usuarios**.
  - Paginador observado: `Primera Anterior 1 2 Siguiente Último` (2 páginas activas).
  - Cantidad aproximada total en el restaurante Caprichos: **entre 15 y 24 usuarios registrados**. *(Cumpliendo con la directiva, no se han copiado nombres, correos ni datos personales reales).*

---

#### 2. Formulario de Edición y Creación de Usuario (`editar.html`):
El formulario se divide en las siguientes secciones y campos estructurados:

##### A. Datos del Usuario del Sistema:
- `Usuario` (`usuario_nick`) — *Campo de texto, Requerido*
- `Contraseña` (`usuario_clave`) — *Campo tipo password, Requerido al crear*
- `Cambiar contraseña` (`usuario_claveanterior`) — *Password, visible en edición*
- `Repetir contraseña` (`usuario_clavecambio`) — *Password, verificación para cambio*
- `Cargo` — *Control `ui-select`, Requerido*
  - **Opciones de Roles / Cargos**:
    - `ADMINISTRADOR`
    - `CAJERO`
    - `PRODUCCION`
    - `MOZO`
    - `CALL CENTER`
    - `AUTO SERVICIO`
    *(En el modelo base también se contempla el rol `MOTORIZADO`)*.
  - Botón asociado: `Asignar` (Aplica los permisos sugeridos por el sistema para el cargo elegido).
- `Perfil de usuario` — *Control `ui-select`*
  - Opciones de perfiles predefinidos (incluye valor por defecto: `NINGUNO`).
  - Botón asociado: `Asignar` (Aplica los permisos vinculados al perfil escogido).
  - Botón asociado: `Gestión` (Abre modal de administración de perfiles `perfilUsuario.html`).
- `Tipo de conexión` — *Control `ui-select`*
  - Opciones:
    - `Conexión con puente`
    - `Conexión sin puente`
    - `Conexión POS`
- `Local` — *Control `ui-select` con listado de sucursales habilitadas*.
- `Gestionar otros locales` (`usuario_gestionarotroslocales`) — *Checkbox*
- `Caja` — *Control `ui-select` con listado de cajas disponibles*.
- `Impresora` — *Control `ui-select` con listado de impresoras configuradas*.
- `PIN para Tablet` (`usuario_pin`) — *Campo de texto / numérico, Requerido para comandas móviles*
- `Area de Producción` — *Control `ui-select` con listado de áreas (Cocina, Barra, etc.)*.
- `Estado` (`usuario_estado`) — *Checkbox: Usuario activo / inactivo*
- `Asignar a un motorizado` (`crearMotorizado`) — *Checkbox: Crea y vincula un repartidor*
- `Añadir codigo supervisor` / `Pin supervisor` (`usuario_pinsupervisor`) — *Checkbox y campo de texto*
- `Facturación e impresión` (`usuario_disparaimpresion`) — *Checkbox: Factura e imprime deliverys confirmados*
- `Mostrar todos los locales en logistica` (`usuario_todoslocaleslogistica`) — *Checkbox*
- `Usa workplace` (`usuario_workplace`) — *Checkbox de integración Workplace*
- `Usa horarios workplace` (`usuario_accesohorario`) — *Checkbox de control horario*
- `Correlativo` (`usuario_correlativo`) — *Campo de texto, visible solo si cargo es Auto Servicio*

##### B. Datos Personales:
- `Nombres` (`usuario_nombres`) — *Campo de texto, Requerido*
- `Apellidos` (`usuario_apellidos`) — *Campo de texto, Requerido*
- `Teléfono para contacto` (`usuario_telefono`) — *Campo numérico con selector de prefijo de país*
- `Email` (`usuario_correo`) — *Campo de correo electrónico*
- `DNI` (`usuario_dni`) — *Campo de documento de identidad*
- `Dirección` (`usuario_direccion`) — *Área de texto multi-línea*
- `Código Interno` (`usuario_codigointerno`) — *Texto, identificador de legajo o empleado*
- `Tipo de Contrato` — *Control `ui-select`*
  - Opciones de contrato (por defecto `NINGUNO`).
  - Botón asociado: `Gestión` (Abre modal de tipos de contrato `tipoContrato.html`).

##### C. Acceso a Cajas:
- Tabla con columnas:
  - `Local`
  - `Caja`
  - `Acceso a la caja` (*Checkbox* `caja.tienePermiso`)

##### D. Permisos a Sucursales:
- Tabla con columnas:
  - `Sucursal`
  - `Acceso a la sucursal` (*Checkbox* `localusuario.tienePermiso`)

##### E. Permisos a Marcas:
- Tabla con columnas:
  - `Marca`
  - `Acceso a la marca` (*Checkbox* `marca.usuariomarca_estado`)

---

#### 3. Estructura de Roles y Permisos:

##### A. Nombres de Roles / Cargos del Sistema:
1. `ADMINISTRADOR`
2. `CAJERO`
3. `PRODUCCION`
4. `MOZO`
5. `CALL CENTER`
6. `AUTO SERVICIO`
7. `MOTORIZADO` (gestionado a través del flag de motorizados)

##### B. Perfiles de Usuario (`perfilUsuario.html`):
El sistema permite agrupar permisos bajo un nombre personalizado (Perfil). El formulario del perfil contiene:
- `Nombre del perfil` (`perfilusuario_nombre`)
- `Estado` (`perfilusuario_estado` - Activo / Inactivo)
- `Permisos disponibles` y `Permisos del perfil` (selectores duales con traslado de elementos y checkboxes).

##### C. Permisos del Sistema por Categorías:
En la sección principal de permisos de la pantalla de edición, el operador visualiza dos paneles:
- **Panel Izquierdo (Categorías)**: Lista de módulos generales con indicador numérico de permisos faltantes por agregar.
- **Panel Derecho (Permisos Hijos)**: Listado de permisos detallados (`hijo.permiso_descripcion`) con selector de casillas y botón *"Seleccionar todo"*.

El catálogo de seguridad consta de más de **500 tags de permisos granulares**, organizados en las siguientes categorías maestras:
- **Ventas**:
  - Visualización de salones (`ventas.hacerpedidos.salones.ver`)
  - Aprobación de pedidos (`ventas.hacerpedidos.salones.aprobarpedido`)
  - Cancelación de pedidos (`ventas.hacerpedidos.salones.cancelarpedido`)
  - Anulación rápida de comanda y cambio de mozo
  - Descuentos de venta y aplicación de cortesías
  - División de cuentas y transferencia de mesas
- **Caja**:
  - Apertura y cierre de caja (`caja.apertura-cierre`)
  - Cobro de comandas en salón (`caja.cobrar`)
  - Generación de Cierre Z (`caja.cierre-caja-z`)
  - Registro de ingresos y egresos de efectivo
  - Emisión de notas de crédito y notas de débito
  - Visualización del monitor de ventas y arqueo ciego
- **Almacén y Compras**:
  - Creación de requerimientos y recepción de mercadería
  - Movimientos internos entre almacenes
  - Registro de facturas de proveedores y lotización
  - Ajustes de inventario y control de mermas
- **Delivery y Call Center**:
  - Recepción de pedidos de call center y menú online
  - Despacho y asignación a motorizados
  - Configuración de zonas de reparto y coberturas
  - Atención de reclamos de clientes
- **Ajustes y Administración**:
  - Gestión integral de usuarios (`ajustes.usuarios`)
  - Visualización de contraseñas de personal (`ajustes.usuarios.visualizarclaves`)
  - Configuración de locales, cajas, comprobantes e impresoras
  - Facturación electrónica y series de contingencia SUNAT
  - Formas de pago, monedas, tarjetas e impuestos
- **Informes y Reportes**:
  - Ventas por mozo, ventas por producto y platos cancelados
  - Reportes de auditoría de caja y libros electrónicos
- **Permisos POS / QuipuNET (`editar-permisopos.html`)**:
  - Edición de permisos específicos para terminales táctiles (QuipuPOS y QuipuNET).

---

## (c) Lo que NO se pudo ver y por qué

1. **NO OBSERVADO — Clics operativos en botones de Guardar, Modificar, Crear o Eliminar**:
   - *Causa*: En estricto cumplimiento de las directivas de seguridad para entornos de PRODUCCIÓN en uso real (*"SOLO LECTURA... NO pulses Guardar, Aceptar, Nuevo/Crear, Eliminar, Desactivar, Resetear contraseña, ni ningún botón que ejecute algo"*), no se realizaron envíos de formularios ni alteraciones de registros. La inspección de todos los campos, controles `ui-select` y validaciones se obtuvo mediante la lectura pasiva de la vista renderizada y el análisis del bundle de producción (`scripts.426a6ac0.js` y `$templateCache`).
2. **NO OBSERVADO — Datos personales y credenciales reales de los trabajadores**:
   - *Causa*: Siguiendo la regla explícita de confidencialidad (*"sin copiar nombres, correos ni datos reales... personas, correos, teléfonos, sueldos"*), se omitieron deliberadamente los nombres, números de DNI, teléfonos y correos electrónicos de los empleados listados en la base de datos de Caprichos.
3. **NO OBSERVADO — Lista de alertas históricas dinámicas en la campana de notificaciones**:
   - *Causa*: Al momento de la auditoría, la cuenta `krosales` no presentaba facturas retenidas ni boletas con error fiscal ante SUNAT (`vm.boletas === 0` y `badge_count: 0`), por lo que el dropdown dinámico no contenía elementos históricos generados en ese instante. Los tipos y formatos de notificación se documentaron a partir de la especificación activa de sus plantillas (`subnav.html` y `topnavbar.html`).
