---
id: ANA-CAP-017
tipo: analisis
titulo: "Informe de analisis funcional: Escritorio, notificaciones, perfil, inicio de sesion y menu lateral del cajero"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, cajero-informes]
---

# Informe de analisis funcional: Escritorio, notificaciones, perfil, inicio de sesion y menu lateral del cajero

## 1 Lo que el cajero YA puede hacer en el mockup en este modulo (con evidencia: lineas o funciones)

El prototipo actual (`Admin.dc.html`) implementa para el rol de cajero (`ROLES.cajero`, linea 2667) un entorno operativo delimitado que abarca el inicio de sesion, la navegacion lateral, la barra superior con alertas de conectividad y notificaciones, el escritorio principal y la consulta de su perfil. A continuacion se detallan las funcionalidades comprobadas:

### A. Inicio de sesion (Login)
- **Visualizacion del contexto de operacion**: En la pantalla de autenticacion (lineas 67 a 97), el cajero visualiza tres insignias fijas informativas con los datos operativos: `LOCAL: CAPRICHOS`, `CAJA: Caja Principal` y `TURNO: Dia` (lineas 76 a 80).
- **Ingreso de credenciales**: Dispone de campos para escribir su nombre de usuario (`loginUser`, linea 83) y contrasena (linea 87).
- **Seleccion de rol rapida en mockup**: Incluye selector por botones de rol (`roleChips`, linea 91) y funcion de ingreso `doLogin()` (linea 2769), la cual permite conmutar directamente al perfil de cajero cargando su configuracion de permisos.

### B. Menu lateral y navegacion
- **Filtrado estricto por rol**: La estructura del menu lateral (lineas 102 a 177 y funcion `renderNav()`, lineas 2805 a 2832) aplica el filtro de vistas de `ROLES.cajero` (linea 2667). El cajero unicamente visualiza en su barra lateral los 8 modulos autorizados:
  1. *Escritorio* (`view === 'escritorio'`)
  2. *Caja* (`view === 'caja'`)
  3. *Caja y cierres* (`view === 'cierre'`)
  4. *Reservas* (`view === 'reservas'`)
  5. *Clientes* (`view === 'clientes'`)
  6. *Creditos* (`view === 'creditos'`)
  7. *Ofertas y descuentos* (`view === 'ofertas'`)
  8. *Notificaciones* (`view === 'notificaciones'`)
- **Agrupacion por secciones operativas**: Los modulos aparecen organizados bajo acapites plegables: *Operacion* (Escritorio, Caja, Caja y cierres, Reservas), *Clientes y ventas* (Clientes, Creditos, Ofertas) y el acceso inferior a *Notificaciones*. Estan completamente ocultas para el cajero las secciones de *Compras y stock*, *Analisis* y *Configuracion*.
- **Modos de visualizacion del menu**: Cuenta con menu expandido de 220px, modo colapsado tipo riel (`rail`, lineas 134 a 150) con iconos e insignias de conteo numerico, y panel deslizante para dispositivos moviles (`menuOpen`, lineas 102 y 2779).
- **Pie del menu lateral**: Muestra la tarjeta del usuario en sesion con nombre, rol (`userName`, `userRole`, linea 127), boton para abrir *Mi perfil* (`openProfile()`, linea 2785) y boton directo de cierre de sesion (`doLogout()`, linea 131 y 2774).

### C. Barra superior (Top Bar) y estado del sistema
- **Indicador de conectividad e internet**: Muestra en tiempo real el estado de red mediante un punto de color y texto (`connDot`, `connText`, lineas 183 y 3709-3710). Permite identificar visualmente el estado "En linea" (verde) o "Sin internet - X por sincronizar" (rojo/ambar).
- **Reloj del sistema**: Despliega la hora actual formateada en vivo (`clockText`, lineas 184 y 3709).
- **Campana de notificaciones emergente**: Icono de campana interactivo (linea 185) con contador de alertas pendientes (`notifCount`, lineas 187 y 3407). Al pulsar la campana, se despliega una bandeja emergente flotante (`notifOpen`, lineas 189 a 207) gestionada por la funcion `computeNotifItems()` (lineas 3390 a 3409).
- **Priorizacion de alertas recibidas por el cajero**: La campana calcula un puntaje de urgencia segun nivel (`alta`, `media`, `baja`) mas tiempo de espera transcurrido, mostrando acciones directas segun el tipo de evento:
  1. *Solicitudes de clientes por WhatsApp* (`cli-`, lineas 3396-3397): Prioridad alta. Muestra texto de solicitud del cliente y botones de accion directa: "Abrir WhatsApp" (`wa.me`) y "Marcar atendido" (`resolveAlert()`, linea 3704).
  2. *Solicitudes de reserva del chatbot* (`res-`, linea 3398): Prioridad media. Muestra nombre del cliente y boton "Revisar" que redirige a la pantalla de Reservas (`goView('reservas')`).
  3. *Alerta de corte de internet* (`net`, linea 3399): Prioridad alta con impulso de 200 puntos. Notifica: "Esta caja sigue trabajando en este equipo. Al volver la conexion se enviara todo".
  4. *Alerta de sincronizacion completada* (`sync`, linea 3400): Prioridad baja. Informa cuando las ventas locales pendientes se sincronizan con exito.
  5. *Pedidos por confirmar* (`acc`, linea 3401): Prioridad media. Se activa si existen pedidos externos sin confirmar (`porAceptar > 0`), con boton "Ir a pedidos" (`goView('caja')`).
  6. *Error de comunicacion de impresora* (`prt`, linea 3403): Prioridad alta. Notifica fallo en impresora de cocina con boton "Marcar resuelto".
  7. *Filtro de privacidad en stock*: Las alertas de insumos con stock bajo (`stk`, linea 3402) estan restringidas a administracion, almacen, produccion y cocina; el cajero no las recibe en su campana.
- **Accion de marcado global**: La bandeja incluye el boton "Marcar todo leido" (`markAllNotif()`, lineas 192 y 3702).

### D. Escritorio del Cajero (Dashboard operativo)
En `Admin.dc.html` (plantilla lineas 935 a 981 y logica en lineas 3000 a 3006), al ingresar el cajero observa una vista sintetica adaptada a su jornada diaria:
- **Mensaje de bienvenida personalizado**: Banner superior que senala: "Hola, [nombre]. Este es tu escritorio de Cajero: solo muestra lo que corresponde a tu rol. Datos de ejemplo." (lineas 937 a 940).
- **Tarjetas de indicadores (KPIs del cajero)** (linea 3003):
  1. *Pedidos por confirmar*: Conteo numerico **DINAMICO**. Lee el total de pedidos en estado nuevo pendientes de atencion (`String(porAceptar)`).
  2. *Cobros pendientes*: Conteo numerico **DINAMICO**. Calcula las cuentas del turno que no han sido pagadas y no estan rechazadas (`String(orders.filter((o) => !o.paid && o.status !== 'rechazado').length)`).
  3. *Cobrado en mi caja hoy*: Valor **FIJO DE EJEMPLO**. En el codigo fuente figura textualmente la cadena fija `'s/ 668.40'` (linea 3003). No suma las transacciones reales en efectivo ni POS del turno.
  4. *Pedidos cerrados hoy*: Conteo numerico **DINAMICO**. Cuenta pedidos que llegaron al estado final entregado (`String(orders.filter((o) => o.status === 'entregado').length)`).
- **Accesos directos "Para hacer ahora"** (linea 3004):
  1. *Pedidos por confirmar*: Cantidad **DINAMICA** vinculada a `porAceptar`. Al pulsar, navega directamente a la vista de pedidos en caja (`caja`).
  2. *Reservas de hoy*: Valor **FIJO DE EJEMPLO**. En el codigo figura el numero estatico `3` (linea 3004: `nav2('Reservas de hoy', 3, 'reservas')`). Al pulsar, redirige al modulo de Reservas.
  3. *Creditos por vencer*: Valor **FIJO DE EJEMPLO**. En el codigo figura el numero estatico `2` (linea 3004: `nav2('Creditos por vencer', 2, 'creditos')`). Al pulsar, redirige al modulo de Creditos.
- **Lista de pedidos por confirmar**: Bloque central de atencion prioritaria (lineas 945 a 965 y 3005). Filtra y lista los pedidos en estado `nuevo`. Cada elemento muestra identificador, modalidad (delivery, para llevar, salon), importe y tiempo transcurrido. Al hacer clic en un pedido, redirige a la vista de Caja seleccionando dicho pedido para su atencion (`goOrder(id)`, lineas 962 y 2795).
- **Restricciones de informacion financiera y de stock**: En el escritorio del cajero la variable `showStats` es evaluada como falsa (linea 3000 y 3414); el cajero no ve graficos de ventas por hora, graficos de torta de canales, ranking de productos mas vendidos ni valor monetario total de ventas del negocio. Asimismo, el bloque de insumos criticos (`dStock`, lineas 3011 y 3025) permanece oculto para el cajero.

### E. Perfil de usuario ("Mi perfil")
- **Pantalla de informacion de sesion**: Ubicada en la plantilla de lineas 1571 a 1597 y gestionada en `renderVals()` (lineas 3731 a 3739).
- **Datos visibles**: Presenta avatar con foto o iniciales (`pickPhoto()`, linea 1575), tarjeta de usuario con login (`caja01`), rol asignado (`Cajero`), local asignado (`CAPRICHOS`) y caja/turno actual (`Caja Principal - Dia`) (lineas 1581 a 1585).
- **Proteccion contra modificaciones no autorizadas**: El cajero tiene deshabilitada la edicion de datos personales (`canEditInfo` evaluado en falso, linea 3733). Se despliega un aviso formal de seguridad: "Por seguridad, solo el administrador puede cambiar tus datos de acceso o el rol asignado a tu cuenta." (linea 1590).
- **Resumen de permisos visuales**: Lista mediante etiquetas o fichas (`userModules`, linea 1593) los nombres de los 8 modulos autorizados para su rol.
- **Acceso a salida**: Boton visible "Cerrar sesion" (`doLogout()`, linea 1594).

---

## 2 Lo que hace restaurant.pe en este modulo (resumen propio, con el archivo de REFERENCIA que lo respalda)

De acuerdo con los documentos de analisis del sistema de referencia (`escritorio.md`, `modulos-usuarios-notificaciones.md` y `modulos.md`), restaurant.pe estructura el escritorio, las notificaciones y el control de sesion con los siguientes criterios operativos:

### A. Inicio de sesion y seleccion obligatoria de contexto
- **Credenciales y entorno completo**: En restaurant.pe el formulario de acceso requiere de forma indispensable: `Usuario`, `Clave de acceso`, y en caso de perfiles de caja incluye en el DOM el campo `usuario_clavecaja` (`modulos-usuarios-notificaciones.md`, seccion 1).
- **Asignacion de punto de venta**: El sistema permite o exige seleccionar a que `Local`, `Caja` fisica y `Turno` se esta ingresando cuando el establecimiento cuenta con multiples terminales o turnos rotativos (`modulos-usuarios-notificaciones.md`, seccion 1).

### B. Notificaciones operativas en barra superior (Top Navbar)
En restaurant.pe la barra superior no es meramente decorativa ni un listado pasivo de correos, sino un monitor critico de operacion en tiempo real (`modulos-usuarios-notificaciones.md`, seccion 2):
1. **Alerta de fallas de impresion (`fa-print`)**: Notificacion critica destacada cuando la ticketera termica o impresora de comandas no responde, se queda sin papel o pierde comunicacion con el spooler local.
2. **Monitor de pedidos delivery y externos (`fa-truck`)**: Campana o indicador especifico con contador numerico y alerta sonora cuando ingresa un pedido por canales digitales o delivery que requiere ser aceptado o asignado.
3. **Control de facturacion electronica SUNAT (`fa-bell` / comprobantes pendientes)**: Alerta vital que avisa si existen comprobantes de pago (boletas o facturas emitidas) que no han podido enviarse a la SUNAT o al OSE, evitando sanciones por exceder los plazos legales de envio.
4. **Alerta sonora**: Las notificaciones operativas de pedidos nuevos y fallas tecnicas emiten pitidos audibles para captar la atencion inmediata del personal en barra.

### C. Estructura y enfoque del Escritorio (Dashboard)
El escritorio principal de restaurant.pe (`escritorio.md`) esta concebido primordialmente como un panel de indicadores ejecutivos y de control gerencial:
- **Tarjetas KPI de alto nivel**: Total vendido en el dia (en soles), cantidad de transacciones atendidas, ticket promedio general y conteo de pedidos en curso (`escritorio.md`, seccion 1).
- **Grafico dinamico de ventas por hora**: Curva temporal que compara las ventas hora tras hora del dia actual frente al dia anterior (`escritorio.md`, seccion 2).
- **Desglose de canales de atencion**: Grafico circular o barras comparando Salon, Para llevar (Takeout) y Delivery (`escritorio.md`, seccion 3).
- **Ranking de mozos y productos estrella**: Tablas de rendimiento que muestran los platos mas vendidos y las ventas generadas por cada mozo (`escritorio.md`, seccion 4).
- **Brecha de roles en restaurant.pe**: Segun se documenta en `escritorio.md` (seccion 5) y `modulos.md` (seccion "El gran problema de restaurant.pe"), restaurant.pe tiene una debilidad estructural: no adapta el escritorio segun el rol del usuario. Un cajero o un mozo que entra a restaurant.pe se topa con el mismo panel de ventas totales de la empresa a menos que se le bloquee la pantalla por completo mediante permisos monoliticos. Caprichos requiere una experiencia adaptada y segura.

### D. Gestion de perfiles y seguridad granular
- **Matriz de mas de 500 permisos individuales**: En restaurant.pe los permisos se administran mediante casillas de verificacion independientes agrupadas en modulos (`modulos-usuarios-notificaciones.md`, seccion 4). No obstante, los nombres tecnicos de los permisos en la base de datos suelen ser confusos y no siempre bloquean visualmente las opciones del menu lateral, arrojando errores de "Acceso Denegado" solo al hacer clic (`modulos.md`, seccion 3).

---

## 3 Diferencias y faltantes

A continuacion se presentan las diferencias, carencias y elementos estaticos encontrados en el mockup de Caprichos frente a la operacion real esperada de una cafeteria y las mejores practicas de restaurant.pe:

| Que falta o esta mal | Donde se ve | Por que importa | Gravedad |
| :--- | :--- | :--- | :--- |
| **KPI "Cobrado en mi caja hoy" tiene valor fijo hardcoded** | `Admin.dc.html`, linea 3003: `'s/ 668.40'` | El cajero ve siempre s/ 668.40 sin importar cuanto dinero en efectivo, Yape o tarjeta cobro durante su turno. Pierde total utilidad para su control de caja y cuadre previo al arqueo. | **Alta** |
| **Acceso directo "Reservas de hoy" tiene numero fijo hardcoded** | `Admin.dc.html`, linea 3004: `nav2('Reservas de hoy', 3, 'reservas')` | Muestra permanentemente 3 reservas pendientes aunque en el sistema no haya ninguna o existan mas. Desorienta al cajero al planificar mesas del salon. | **Media** |
| **Acceso directo "Creditos por vencer" tiene numero fijo hardcoded** | `Admin.dc.html`, linea 3004: `nav2('Creditos por vencer', 2, 'creditos')` | Muestra permanentemente 2 creditos por vencer sin consultar las cuentas corrientes reales de clientes con consumo al credito. | **Media** |
| **Inicio de sesion no permite elegir Caja ni Turno** | `Admin.dc.html`, lineas 76-80 y 2769 | Se muestran insignias fijas (`Caja Principal`, `Dia`). Si en la cafeteria rota el personal al turno tarde/noche o se habilita una segunda caja, no hay seleccion dinamica en el login. | **Media** |
| **Falta alerta de comprobantes pendientes de envio a SUNAT** | Barra superior (`Admin.dc.html`, lineas 185-207 y `computeNotifItems()`) | En el Peru, las boletas y facturas electronicas tienen plazos maximos de envio a SUNAT. Si se corta el internet y se acumulan ventas, el cajero debe ver cuantos comprobantes estan pendientes de transmision legal. | **Alta** |
| **Falta senal sonora o parpadeo para pedidos externos por confirmar** | Barra superior y campana (`Admin.dc.html`, lineas 185-207 y 3401) | La campana solo muestra un numero pasivo. En horas pico de cocina y barra, si entra un pedido de WhatsApp o delivery externo, el cajero no mira la pantalla constantemente; requiere aviso auditivo. | **Alta** |
| **El modulo independiente "Notificaciones" muestra datos historicos desconectados** | `Admin.dc.html`, vista `notificaciones`, lineas 2735-2740 | Mientras la campana de la barra superior maneja alertas vivas con prioridad y botones interactivos, la pantalla `notificaciones` del menu muestra una tabla con 4 registros de ejemplo estaticos sin sincronizacion con las alertas reales. | **Baja** |
| **En "Mi perfil" el cajero no puede cambiar su propia contrasena** | `Admin.dc.html`, lineas 1590 y 3733 (`canEditInfo = false`) | Si bien es correcto bloquear la edicion de rol y usuario, impedir que el cajero actualice su propia clave de seguridad obliga al administrador a intervenir ante cualquier olvido o sospecha de filtracion. | **Media** |
| **Falta indicador visual claro del saldo de apertura en el escritorio** | `Admin.dc.html`, seccion KPIs de escritorio (linea 3003) | El cajero necesita tener a la vista con cuanto efectivo abrio su gaveta (saldo inicial) para saber rapidamente cuanto efectivo deberia tener en mano sumado a sus cobros. | **Media** |

---

## 4 Errores o incoherencias que veas en el mockup (botones que no hacen nada, textos viejos, reglas contradictorias con flujo-de-pedidos.md, permisos que no corresponden al cajero)

Durante la revision exhaustiva del codigo fuente y la documentacion operativa, se han detectado los siguientes errores, contradicciones y textos desactualizados:

1. **Texto obsoleto y regla contradictoria sobre confirmacion de pedidos de salon**:
   - *Evidencia en codigo*: En `Admin.dc.html`, linea 2837, la descripcion de la vista de caja senala textualmente: *"El cajero verifica cada pedido y lo acepta antes de que pase a cocina."* Asimismo, en la linea 3154 el codigo condiciona: `canAccept: selOrder.status === 'nuevo' && selOrder.modal === 'local' && canManage`.
   - *Contradiccion con `flujo-de-pedidos.md`*: Segun los acuerdos de la reunion de diseno del 18 de octubre registrados en `flujo-de-pedidos.md` (seccion "Decisiones tomadas"), **los pedidos de salon registrados por los mozos se envian directo a comanda/cocina sin pasar por aprobacion previa del cajero**. Exigir que el cajero acepte pedidos de salon generaria cuellos de botella intolerables en la preparacion de cafe y comidas. El estado "Por confirmar" solo debe aplicar a pedidos que provienen del exterior (WhatsApp, delivery propio o recojo).

2. **Incoherencia en el boton "Pedido del personal" en cabecera de caja**:
   - *Evidencia en codigo*: En `Admin.dc.html`, linea 228, se ubica un boton destacado rotulado `Pedido del personal` que ejecuta la funcion `openMoStaff()`.
   - *Problema funcional*: En `flujo-de-pedidos.md` (seccion "Tipos de pedido y flujos") se establece que el consumo de personal se descuenta de stock y se asocia al colaborador para su liquidacion o beneficio. Colocar un boton global directo en la barra superior del punto de venta sin seleccionar previamente una mesa o cuenta genera pedidos huerfanos si el cajero lo presiona accidentalmente.

3. **Duplicidad conceptual entre la Campana de notificaciones y el Modulo Notificaciones del menu**:
   - *Evidencia en codigo*: En la barra superior (lineas 189 a 207), la funcion `computeNotifItems()` (lineas 3390 a 3409) genera notificaciones operativas en vivo (pedidos por aceptar, fallas de impresora, alertas de WhatsApp, corte de conexion). Sin embargo, al pulsar el modulo `Notificaciones` en el menu lateral (lineas 2735 a 2740), se despliega una tabla totalmente distinta con eventos fijos antiguos que no reflejan las alertas vivas ni permiten resolverlas.

4. **Botones de accion con comportamiento simulado o incompleto**:
   - *Evidencia en codigo*: En el escritorio del cajero (linea 949), los botones de filtro `Todos`, `Mesa`, `Delivery`, `Llevar` no ejecutan filtrado dinamico sobre la lista `dashList`, ya que `dashList` esta configurado de forma fija unicamente con pedidos en estado `nuevo` (linea 3005).
   - *Evidencia en perfil*: En la pantalla de perfil (`Admin.dc.html`, linea 1575), el boton con icono de camara para cambiar foto de avatar (`pickPhoto()`, linea 2786) solo muestra un mensaje emergente de advertencia o no realiza persistencia del archivo de imagen.

5. **Regla de asignacion de modulos frente a `modulos-y-roles.md`**:
   - Segun `modulos-y-roles.md` (lineas 20 a 28), el rol Cajero debe acceder a: *Escritorio*, *Pedidos y caja*, *Reservas*, *Clientes*, *Creditos*, *Ofertas y descuentos*, y *Notificaciones*.
   - En el prototipo (`Admin.dc.html`, linea 2667), el rol tiene asignadas las vistas: `['escritorio', 'caja', 'cierre', 'reservas', 'clientes', 'creditos', 'ofertas', 'notificaciones']`.
   - *Analisis*: La inclusion de `cierre` corresponde a la separacion modular realizada para la gestion especifica del arqueo y cierre de turno ("Caja y cierres"), lo cual es coherente operativamente y ya fue validado favorablemente. Los 8 modulos visibles cumplen con la matriz de confidencialidad de la cafeteria, manteniendo bloqueados los accesos a recetas, compras, costos y reportes gerenciales.

---

## 5 Propuesta concreta de mejora para el mockup (pantallas, campos, botones, reglas), priorizada

Para transformar el escritorio del cajero en una estacion de trabajo 100% util, agil y sin datos ficticios, se propone la siguiente ruta de mejoras priorizadas:

### Prioridad Alta (Impacto directo en la operacion diaria y cuadre de caja)

1. **Calculo dinamico del indicador "Cobrado en mi caja hoy"**:
   - *Pantalla*: Escritorio del cajero (`view === 'escritorio'`), seccion de tarjetas KPI superiores.
   - *Regla de calculo*: Reemplazar la cadena estatica `'s/ 668.40'` (linea 3003) por una funcion que sume los pagos registrados en la sesion actual del cajero:
     `totalCobrado = orders.filter(o => o.paid && o.cashierId === currentUserId && o.shiftId === currentShiftId).reduce((acc, o) => acc + o.totalPaid, 0)`.
   - *Presentacion*: Mostrar la cifra formateada en soles (`S/ XXX.XX`), diferenciando si es posible mediante un pequeno subtitulo el efectivo cobrado frente a pagos electronicos (Yape, Plin, POS).

2. **Sincronizacion de contadores en "Para hacer ahora"**:
   - *Pantalla*: Escritorio del cajero, tarjetas de atencion rapida.
   - *Regla de calculo*:
     - `Reservas de hoy`: Reemplazar el numero fijo `3` por `reservas.filter(r => r.fecha === fechaHoy && r.estado === 'confirmada').length`.
     - `Creditos por vencer`: Reemplazar el numero fijo `2` por `creditos.filter(c => c.diasVencimiento <= 3 && c.saldoPendiente > 0).length`.
   - *Comportamiento*: Si el contador es cero, mostrar la tarjeta en gris neutral; si es mayor a cero, resaltarla para accion inmediata.

3. **Adecuacion del flujo de confirmacion a la regla de `flujo-de-pedidos.md`**:
   - *Pantalla*: Escritorio y modulo de Caja.
   - *Regla*: Eliminar del escritorio y de la lista de pedidos por confirmar cualquier comanda que proceda del salon (`modal === 'local'`). Las comandas del salon van directo a preparacion.
   - *Contenido de la lista*: La lista del escritorio debe denominarse **"Pedidos externos por confirmar"** y alimentar unicamente pedidos con canal `whatsapp`, `delivery` o `para_llevar_web`.
   - *Acciones directas*: Cada fila debe permitir: "Ver comprobante de pago" (adjunto de Yape/Plin/Transferencia), "Confirmar y enviar a cocina", o "Contactar por WhatsApp".

4. **Incorporacion de alerta sonora y visual para pedidos externos entrantes**:
   - *Pantalla*: Barra superior (Campana) y Escritorio.
   - *Mecanismo*: Implementar una alerta con parpadeo suave y sonido discreto ("campanilla") cada vez que el contador `porAceptar` se incremente, permitiendo al cajero silenciar la alerta una vez atendido el pedido.

### Prioridad Media (Control operativo y seguridad)

5. **Indicador de saldo de apertura y efectivo estimado en gaveta**:
   - *Pantalla*: Escritorio del cajero, anadir una tarjeta KPI adicional: `Efectivo en gaveta`.
   - *Formula*: `Monto de apertura + Cobros en efectivo del turno - Salidas de caja registradas`.
   - *Utilidad*: Permite al cajero controlar en todo momento si tiene cambio suficiente (sencillo) sin tener que abandonar el escritorio para entrar al modulo de cierres.

6. **Alerta de comprobantes electronicos pendientes de emision/envio SUNAT**:
   - *Pantalla*: Barra superior (Campana) y Escritorio.
   - *Regla*: Si existen boletas o facturas emitidas en modo local fuera de linea que no han recibido constancia de recepcion (CDR) de SUNAT, mostrar una alerta ambar: *"X comprobantes pendientes de envio SUNAT"*, con boton de reintento manual al restablecerse el internet.

7. **Permitir cambio de contrasena propio en "Mi perfil"**:
   - *Pantalla*: Vista `perfil` (`Admin.dc.html`, lineas 1571 a 1597).
   - *Campos*: Anadir seccion "Cambiar mi clave": `Contrasena actual`, `Nueva contrasena` y `Confirmar nueva contrasena`.
   - *Regla*: Mantener bloqueados los campos de Nombre, Rol y Local (solo admin), pero permitir la actualizacion segura de la clave del propio usuario.

### Prioridad Baja (Limpieza visual y consistencia)

8. **Unificacion del modulo Notificaciones con la bandeja de la campana**:
   - *Pantalla*: Vista `notificaciones`.
   - *Mejora*: Transformar la tabla de la vista `notificaciones` en un historial cronologico auditable de las mismas alertas que genera la campana (alertas de clientes atendidas, errores de impresion resueltos, momentos de caida y retorno de internet).

---

## 6 Preguntas para el dueno (Kevin)

Para cerrar la definicion funcional de estas pantallas antes de pasar a la etapa de programacion, es indispensable que Kevin valide los siguientes puntos operativos de Caprichos:

1. **Operacion de multiples cajas o turnos**: En Caprichos, cuando comience a operar el sistema con dos cajeros (por ejemplo turno manana y turno tarde), ¿el cajero que entra debe seleccionar obligatoriamente su turno y caja fisica en la pantalla de inicio de sesion, o cada cajero tendra un usuario fijo preasignado a una sola caja fisica?
2. **Alertas audibles en caja**: Cuando llegue un pedido por WhatsApp o canal externo a traves del chatbot, ¿desean que el punto de venta emita una senal sonora (timbre o pitido) para avisar al cajero, o prefieren que sea unicamente visual para no incomodar a los clientes que esten en la barra?
3. **Visibilidad de reservas de mesa**: Dado que los pedidos de salon van directo a cocina, ¿es el cajero quien debe recibir y confirmar las reservas de mesas que solicitan los clientes por el chatbot, o esa tarea sera responsabilidad del mozo / anfitrion?
4. **Alerta de faltante de sencillo (cambio)**: ¿Consideran necesario que el escritorio del cajero le avise cuando su efectivo en monedas y billetes chicos este por debajo de un monto limite (por ejemplo menos de S/ 50.00 en caja), advirtiendo que necesita solicitar sencillo a administracion?

---

## 7 NO VERIFICADO

1. **Protocolo exacto del spooler o driver de impresion local**: En `Admin.dc.html` (linea 3403) existe la alerta visual `prt` ("La impresora de cocina no responde"), pero al ser un prototipo web estatico en HTML/JS puro, **NO SE HA PODIDO VERIFICAR** como se comunicara con la ticketera fisica en el local (si utilizara un agente de impresion local tipo WebSocket, servicio intermedio en Windows/Linux, o impresion nativa del navegador).
2. **Validacion de sesion y token en servidor real**: En el archivo `Admin.dc.html` el login (`doLogin()`, linea 2769) es una conmutacion de variables en memoria local del navegador. **NO SE HA PODIDO VERIFICAR** la expiracion de sesiones por inactividad, tiempos de espera (timeout) ni renovacion de tokens de seguridad en un servidor backend real.
3. **Mecanismo de sincronizacion fuera de linea (Offline Storage)**: El prototipo muestra el badge visual `Sin internet - X por sincronizar` (`connText`, linea 3710), pero **NO SE HA PODIDO VERIFICAR** el mecanismo de persistencia local subyacente (uso de IndexedDB, LocalStorage o Service Workers) para almacenar pedidos y comprobantes cuando se corta el suministro de internet en la cafeteria.

INFORME LISTO.
