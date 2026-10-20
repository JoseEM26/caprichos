---
id: ANA-CAP-020
tipo: analisis
titulo: "Informe de Analisis Funcional: Modulo de Reservas para el Rol Cajero en Caprichos POS"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, cajero-informes]
---

# Informe de Analisis Funcional: Modulo de Reservas para el Rol Cajero en Caprichos POS

Este informe evalua de manera estatica y funcional el modulo de **Reservas** (vista `reservas`) en el sistema administrativo de la cafeteria Caprichos (Lima, Peru). El analisis examina que puede ver y operar el usuario con rol de **Cajero** (`ROLES.cajero`), contrastando el prototipo actual ([Admin.dc.html](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html)), los requerimientos de negocio ([BRD.md](file:///tmp/claude-1000/cajero-agy/fuente/BRD.md)), la matriz de permisos ([modulos-y-roles.md](file:///tmp/claude-1000/cajero-agy/fuente/modulos-y-roles.md)), el flujo de atencion ([flujo-de-pedidos.md](file:///tmp/claude-1000/cajero-agy/fuente/flujo-de-pedidos.md)) y la documentacion funcional del sistema de referencia ([referencia/reservas.md](file:///tmp/claude-1000/cajero-agy/referencia/reservas.md)).

---

## 1 Lo que el cajero YA puede hacer en el mockup en este modulo (con evidencia: lineas o funciones)

En el prototipo interactivo ([Admin.dc.html](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html)), el rol de Cajero cuenta con las siguientes capacidades operativas y visuales en torno al modulo de reservas:

1. **Acceso al modulo desde la barra de navegacion lateral:**
   - En [Admin.dc.html, linea 2667](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2667), el objeto `ROLES.cajero` incluye explicitamente la vista `'reservas'` en su lista permitida `views: [ 'escritorio', 'caja', 'cierre', 'reservas', 'clientes', 'creditos', 'ofertas', 'notificaciones' ]`.
   - En [Admin.dc.html, linea 2806](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2806), el enlace al modulo figura visible en el menu de navegacion bajo la agrupacion "Operacion" con la etiqueta "Reservas".

2. **Acceso directo y contador desde el Escritorio:**
   - En [Admin.dc.html, linea 3004](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3004), en la seccion de pendientes del Escritorio del cajero (`dPending`), se renderiza el boton `nav2('Reservas de hoy', 3, 'reservas')`. Al pulsarlo, transfiere directamente al usuario a la vista de Reservas. (Nota: el valor 3 es una cifra fija codificada en la plantilla).

3. **Recepcion de alertas de solicitudes en la campana de notificaciones:**
   - En [Admin.dc.html, lineas 3392 a 3398](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3392-L3398), el cajero esta incluido en los roles de atencion (`ROLES_ATT = [ 'admin', 'cajero', 'mozo', 'callcenter' ]`). Cuando existen solicitudes de reserva en estado pendiente (`s.rs.filter(r => r.estado === 'pendiente')`), la campana superior muestra una alerta con prioridad media: `Solicitud de reserva: [Nombre]` y el detalle `[X] personas · [Hora] · por WhatsApp (falta aprobar)`. Incluye el boton de accion "Revisar", que redirige a la vista `reservas`.

4. **Visualizacion de la lista de reservas en tarjetas informativas:**
   - En [Admin.dc.html, lineas 1089 a 1108](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1089-L1108) (plantilla) y [lineas 2680 a 2685](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2680-L2685) (datos en `TABLES.reservas`), el cajero visualiza una cuadricula paginada (6 tarjetas por pagina) con 10 reservas de demostracion (`R-031` a `R-040`).
   - Cada tarjeta expone los siguientes datos estructurados:
     - Codigo identificador (ejemplo: `R-031`).
     - Distintivo visual (chip) de estado: `Confirmada`, `Pendiente`, `Cancelada` o `Atendida`, con estilos de color diferenciados mediante la funcion `chipStyle` ([linea 2678](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2678)).
     - Campos secundarios: Cliente (`r[1]`), Fecha (`r[2]`), Hora (`r[3]`), Personas (`r[4]`) y Mesa asignada (`r[5]`).
   - En [Admin.dc.html, lineas 1111 a 1117](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1111-L1117) y [lineas 2960 a 2978](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2960-L2978), el paginador permite avanzar, retroceder y saltar entre paginas numeradas.

5. **Busqueda rapida de reservas por texto libre:**
   - En [Admin.dc.html, lineas 1061 a 1065](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1061-L1065) y [linea 2959](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2959), el cajero dispone de un campo de busqueda (`input#t-q`, placeholder "Buscar por cliente o codigo"). Al escribir, el sistema filtra en tiempo real las tarjetas que coincidan en cualquiera de sus columnas con el texto ingresado.

6. **Filtrado parametrico de la lista:**
   - En [Admin.dc.html, lineas 1064 a 1085](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1064-L1085) y [linea 2682](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2682), el boton "Filtros" despliega un panel con opciones seleccionables:
     - Filtro por **Estado**: opciones `Confirmada`, `Pendiente`, `Cancelada`, `Atendida`.
     - Filtro por **Personas**: opciones `2`, `4`, `6`.
     - Filtro por **Registro**: opciones `Activos`, `Desactivados` ([linea 2965](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2965)).

7. **Desactivacion logica de tarjetas:**
   - En [Admin.dc.html, linea 1104](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1104) y [linea 2975](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2975), cada tarjeta cuenta con el boton "Desactivar" (o "Activar"). Al hacer clic, pide confirmacion previa (`ask`), opaca la tarjeta al 60% (`s.tinactive`) y cambia la etiqueta a "Activar". Cumple con la regla general de no eliminacion de registros.

8. **Edicion basica de datos en formulario modal:**
   - En [Admin.dc.html, linea 1103](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1103) y [lineas 2976, 2859 a 2862](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2976), al pulsar "Editar" en una tarjeta, se abre la ventana modal generica `s.edit` con campos de texto libre para modificar Codigo, Cliente, Fecha, Hora, Personas, Mesa y Estado. Al guardar, se actualiza en memoria en el diccionario `s.tedits`.

9. **Gestion de solicitudes de reserva llegadas por WhatsApp:**
   - En [Admin.dc.html, lineas 1185 a 1203](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1185-L1203) (plantilla) y [lineas 3376 a 3382](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3376-L3382) (controlador), se renderiza el bloque dedicado "Solicitudes de reserva por WhatsApp":
     - Muestra las solicitudes pendientes de aprobacion provenientes del estado `s.rs` (por defecto `S-01 Camila Rios` y `S-02 Jorge Luna`).
     - Muestra el nombre, telefono, cantidad de comensales y hora de la solicitud.
     - Genera dinamicamente botones (chips) con las mesas fisicas libres del plano que tengan capacidad suficiente para esa cantidad de comensales (`allMesas.filter(e => e.seats >= r.personas && !busy[mesaCode(e)] && !resvMap[mesaCode(e)])`, [linea 3377](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3377)).
     - **Aprobar y guardar la mesa**: Al pulsar una mesa libre y presionar este boton ([linea 3380](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3380)), el sistema solicita confirmacion con el mensaje: *"¿Aprobar la reserva de [Nombre]? Se guarda la [Mesa] a las [Hora] y se le avisa al cliente por WhatsApp."*. Al confirmar, actualiza el estado de la solicitud a `aprobada`, guarda la mesa asignada y agrega el registro al arreglo interno `s.reserv`.
     - **Rechazar solicitud**: Al pulsar "Rechazar" ([linea 3381](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3381)), solicita confirmacion: *"¿Rechazar la solicitud de [Nombre]? Se le avisa por WhatsApp que no hay mesa a esa hora."*. Al confirmar, pasa el estado a `rechazada`.
     - **Historial de solicitudes**: En el bloque inferior "YA RESUELTAS" ([lineas 1200-1201](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1200-L1201) y [linea 3382](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3382)), el cajero visualiza el historico de solicitudes que ya fueron aprobadas o rechazadas durante la sesion.

10. **Crear una reserva manual y asignarla en el plano grafico (desde la vista "Pedidos y caja"):**
   - Aunque la pantalla `reservas` no tiene boton de creacion, el cajero puede crear una reserva desde la vista `caja` a traves del flujo de nuevo pedido ([Admin.dc.html, lineas 228, 3337 y 3282 a 3286](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L228)):
     - Pulsa "Nuevo pedido" (`canTableOrder` habilitado para cajero en [linea 3768](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3768)).
     - Elige la opcion "Reservar mesa" (descripcion: "Por personas y hora (acta 02)").
     - Ingresa el nombre de quien reserva en el campo `rv-n` ([linea 1666](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1666)).
     - Selecciona la cantidad de comensales mediante botones: 2, 4, 6 u 8 personas ([linea 3346](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3346)).
     - Selecciona la hora deseada de entre los horarios validos de atencion calculados segun la apertura y cierre del local ([lineas 3344-3345](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3344-L3345)).
     - Pulsa "Elegir la mesa en el plano" ([linea 1670](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1670)).
     - Se despliega el plano visual del piso seleccionado con las mesas en verde (libres), anaranjado (ocupadas) y amarillo (reservadas).
     - Al hacer clic sobre una mesa libre ([linea 3284](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3284)), el sistema valida que no este ocupada ni reservada, y muestra la confirmacion: *"¿Reservar [Mesa]? [Nombre] · [Personas] personas · [Hora]. Se guarda 15 minutos de tolerancia y luego se libera."*.
     - Al confirmar, guarda la reserva en el estado `this.state.reserv` y muestra la pantalla final de exito ([lineas 1673-1676](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1673-L1676)). A partir de ese momento, la mesa queda graficamente senalizada en el plano con color amarillo, borde mostaza y la etiqueta `R [Hora]` ([lineas 3275-3278](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3275-L3278)).

---

## 2 Lo que hace restaurant.pe en este modulo (resumen propio, con el archivo de REFERENCIA que lo respalda)

De acuerdo con la documentacion tecnica y funcional de restaurant.pe contenida en [referencia/reservas.md](file:///tmp/claude-1000/cajero-agy/referencia/reservas.md), el modulo de Reservas opera como un subsistema estructurado en 4 pantallas e integrado con la caja fisica, la facturacion electronica y el punto de venta (POS):

1. **Visor Principal de Reservas (`#!/reservas/principal`):**
   - Organiza la operacion diaria en tres pestanas segun el ciclo de vida: *Reservas pendientes*, *Reservas en curso* (clientes sentados en el salon) y *Reservas finalizadas* ([referencia/reservas.md, lineas 46-48](file:///tmp/claude-1000/cajero-agy/referencia/reservas.md#L46-L48)).
   - En la pestana de finalizadas dispone de un control de rango de fechas (`date-range-picker`) para auditoria historica ([linea 51](file:///tmp/claude-1000/cajero-agy/referencia/reservas.md#L51)).
   - Cada tarjeta expone: cliente, telefono, codigo `#ID`, estado, fecha/hora, local, cantidad de personas (PAX), monto recibido por adelantado (amortizacion) y saldo para consumo ([lineas 65-80](file:///tmp/claude-1000/cajero-agy/referencia/reservas.md#L65-L80)).
   - Cuenta con botones de accion rapida:
     - **Activar**: Cambia el estado de la mesa a ocupada en el POS, envia un aviso por WebSocket a las tablets de mozos y comanda platos a cocina si habia pedidos precargados ([lineas 54 y 79](file:///tmp/claude-1000/cajero-agy/referencia/reservas.md#L54)).
     - **Anular**: Cancela la reserva. Si se cobro seña o garantia, solicita confirmacion para emitir un comprobante de egreso y devolver el dinero desde la caja activa ([lineas 55 y 78](file:///tmp/claude-1000/cajero-agy/referencia/reservas.md#L55)).

2. **Selector de Fecha y Calendario Mensual (`#!/reservas/calendario/:clienteId`):**
   - Presenta una vista de calendario interactivo de todo el mes (`FullCalendar`) donde cada celda muestra la saturacion y las reservas programadas con el formato: `Inicia: HH:mm | R: [Nombre] / PAX: [N°]` ([lineas 99-100](file:///tmp/claude-1000/cajero-agy/referencia/reservas.md#L99-L100)).
   - Valida que no se seleccionen fechas pasadas.
   - Al elegir un dia, abre un modal con selectores de reloj (`ClockPicker`) para definir el horario exacto ("Desde" y "Hasta") antes de pasar al registro ([lineas 106-113](file:///tmp/claude-1000/cajero-agy/referencia/reservas.md#L106-L113)).

3. **Asistente de Registro y Edicion Avanzada (`#!/reservas/registro/:clienteId/:diaReserva`):**
   - **Perfil del cliente (columna lateral):** Muestra el historial del cliente, accesos rapidos a sus ultimas reservas, indicador de reservas anuladas en los ultimos 3 meses y sus metricas de consumo historico (ticket promedio, maximo y minimo) para evaluar inasistencias (*no-show*) ([lineas 127-140](file:///tmp/claude-1000/cajero-agy/referencia/reservas.md#L127-L140)).
   - **Paso 1 (Comprobante):** Permite preconfigurar Boleta, Factura (con buscador de RUC ante SUNAT) o Nota de venta ([lineas 141-148](file:///tmp/claude-1000/cajero-agy/referencia/reservas.md#L141-L148)).
   - **Paso 2 (Datos de reserva en grilla de 8 bloques):** Titular, telefono de contacto, seleccion visual de mesas por salon en plano interactivo (`modal-seleccionDeMesas.html`), cantidad de personas y minutos de tolerancia de espera (`modal-numeroPersonas.html`), fechas/horas, costo por derecho de reserva segun tarifa del salon (`salon_costoporreserva`), local, modalidad (*Solo mesas*, *Mesas y productos*, o *Solo productos*) y campo de observaciones libres para alergias, decoracion o peticiones especiales ([lineas 149-160](file:///tmp/claude-1000/cajero-agy/referencia/reservas.md#L149-L160)).
   - **Paso 3 (Productos y Caja):** Permite precargar platos y bebidas de la carta comercial (`ProductSelectorCtrl`), y registrar pagos por adelantado (garantia/amortizacion) en efectivo o tarjeta. Este dinero ingresa formalmente al cuadre de la caja activa del turno (`dineroingresacaja == '1'`) ([lineas 161-177](file:///tmp/claude-1000/cajero-agy/referencia/reservas.md#L161-L177)).

4. **Ficha de Resumen y Liquidacion Financiera (`#!/reservas/resumen/:reservaId`):**
   - Presenta la ficha tecnica completa de la reserva con auditoria de registro (quien la creo, fecha y hora).
   - Detalle de mesas asignadas y productos precargados (comanda original).
   - Balance financiero: subtotal de productos, costo de reserva, total general, monto cobrado en efectivo/tarjeta y **saldo pendiente de cobro** al llegar al salon ([lineas 253-259](file:///tmp/claude-1000/cajero-agy/referencia/reservas.md#L253-L259)).
   - Botones para impresion de voucher fisico en ticketera termica, descarga de comprobante en PDF oficial y boton "Activar" para ocupar la mesa ([lineas 260-267](file:///tmp/claude-1000/cajero-agy/referencia/reservas.md#L260-L267)).

---

## 3 Diferencias y faltantes

La siguiente tabla resume las brechas detectadas entre lo que ofrece restaurant.pe, los requerimientos de Caprichos y lo actualmente construido en el mockup:

| Que falta o esta mal | Donde se ve | Por que importa | Gravedad |
| :--- | :--- | :--- | :---: |
| **No se puede activar la mesa reservada al llegar el cliente ("Callejon sin salida")** | En [Admin.dc.html, linea 3285](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3285), al hacer clic en una mesa reservada en el plano para atenderla, el sistema emite el mensaje `Mesa está reservada...` y bloquea la pantalla con `return`. | Impide la operacion principal: cuando el cliente que reservo llega a la cafeteria, el cajero o mozo no tiene como abrirle pedido en su mesa asignada. | **Alta** |
| **Desconexion de datos: las reservas aprobadas no se anaden a la lista de reservas** | Al aprobar en [Admin.dc.html, linea 3380](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3380), se guarda en `s.reserv`, pero la tabla del modulo lee unicamente las 10 filas estaticas de `TABLES.reservas.rows` ([linea 2683](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2683)). | El cajero aprueba solicitudes de WhatsApp o crea reservas manuales, pero la lista de reservas nunca las muestra. | **Alta** |
| **No existe boton de "+ Nueva reserva" dentro del modulo Reservas** | En la vista `reservas` ([Admin.dc.html, lineas 1017-1203](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1017-L1203)), no hay ningun boton para crear reservas. | Para registrar una reserva manual, el cajero debe salir de Reservas, ir a "Pedidos y caja", abrir "Nuevo pedido" y buscar la opcion. Es antiintuitivo. | **Alta** |
| **Tolerancia de 15 minutos sin logica ni control temporal** | En [Admin.dc.html, lineas 1668, 1675, 2680, 3284](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1668), los 15 minutos solo figuran como textos explicativos. NO EXISTE temporizador ni liberacion automatica. | La mesa queda bloqueada indefinidamente si el cliente no asiste (*no-show*), haciendo perder ventas al negocio. | **Alta** |
| **Aprobacion de WhatsApp no ofrece enlace directo ni mensaje a enviar** | En [Admin.dc.html, linea 3380](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3380), el texto dice "se le avisa al cliente por WhatsApp", pero no existe boton ni enlace `wa.me/51...` con la respuesta prellenada. | En llamadas y atencion externa ([Admin.dc.html, linea 3397](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3397)), si hay boton de WhatsApp; en reservas se dejo sin link, obligando al cajero a tipear manualmente el mensaje en su celular. | **Media** |
| **No hay vista de Agenda ni Calendario por fechas** | En [Admin.dc.html, lineas 1017-1118](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1017-L1118), solo hay una lista generica de tarjetas fijas sin vista de calendario mensual ni agenda diaria por horas. | En restaurant.pe existe `reservas.selectorfecha.html` ([referencia/reservas.md, linea 91](file:///tmp/claude-1000/cajero-agy/referencia/reservas.md#L91)). El cajero no puede planificar la ocupacion de los proximos dias. | **Media** |
| **Filtro de fecha ausente en la tabla del modulo** | En [Admin.dc.html, linea 2682](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2682), los filtros de `TABLES.reservas` solo permiten filtrar por Estado y Personas, no por fecha. | El cajero no puede aislar las reservas de "Hoy" respecto a las de ayer o la proxima semana. | **Media** |
| **Filtro de personas incompleto** | En [Admin.dc.html, linea 2682](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2682), el filtro de comensales solo contempla `['2', '4', '6']`, omitiendo grupos de 8. | En el asistente de reservas ([linea 3346](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3346)), si se permite reservar para 8 personas. El filtro queda desalineado. | **Baja** |
| **Falta de registro de anticipos/señas monetarias en caja** | NO EXISTE en el mockup de reservas ningun campo para registrar abonos de dinero o señas en efectivo/Yape/tarjeta. | En restaurant.pe ([referencia/reservas.md, linea 170](file:///tmp/claude-1000/cajero-agy/referencia/reservas.md#L170)), las garantias ingresan a la caja del turno. Si Kevin decide cobrar señas para grupos de 6 u 8 personas, el sistema actual no lo soporta. | **Media** |
| **No se pueden ingresar notas especiales ni alergias** | En el flujo de reserva manual ([Admin.dc.html, lineas 1665-1671](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1665-L1671)), solo se solicita Nombre, Personas, Hora y Mesa. | Impide registrar solicitudes tipicas de cafeteria: cumpleaños, decoracion, alergias alimentarias o si traen torta externa. | **Media** |

---

## 4 Errores o incoherencias que veas en el mockup (botones que no hacen nada, textos viejos, reglas contradictorias con flujo-de-pedidos.md, permisos que no corresponden al cajero)

Durante la revision estatica del codigo del administrativo se identificaron las siguientes fallas e incoherencias concretas:

1. **Bloqueo definitivo de mesas reservadas en el plano de pedidos (Incoherencia operativa critica):**
   - *Evidencia:* En [Admin.dc.html, linea 3285](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3285):
     `if (rv) { this.setState({ mo: Object.assign({}, mo, { msg: e.label + ' está reservada para ' + rv.nombre + ' a las ' + rv.hora + '. Llega con 15 minutos de tolerancia.' }) }); return; }`
   - *Falla:* Si el mozo o cajero toca la mesa en el plano cuando el comensal llega, la interfaz solo muestra un mensaje de advertencia y se detiene. No existe ningun boton tipo "Activar reserva", "El cliente ya llegó" o "Abrir pedido de reserva". La mesa queda inutilizable en el plano para tomar pedidos.

2. **Texto no verificado sobre avisos de 15 minutos (Promesa visual inexistente):**
   - *Evidencia:* En [Admin.dc.html, linea 1675](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1675), el texto de exito tras crear una reserva afirma:
     *"La mesa queda marcada con R en el plano. Se guarda 15 minutos de tolerancia y luego se libera. En el administrativo aparece un aviso 15 minutos antes de la hora (ejemplo)."*
   - *Falla:* Dicho aviso automatico 15 minutos antes **NO EXISTE** en la logica de notificaciones de [Admin.dc.html, lineas 3390 a 3410](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3390-L3410). Asimismo, la liberacion automatica al cumplirse la tolerancia tampoco esta programada.

3. **Filtro de fecha cableado a una fecha fija en el plano del local:**
   - *Evidencia:* En [Admin.dc.html, linea 3272](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3272):
     `TABLES.reservas.rows.forEach((r) => { if (r[2] === '15/10' && r[6] !== 'Cancelada' && r[6] !== 'Atendida') { resvMap[r[5]] = { nombre: r[1], hora: r[3] }; } });`
   - *Falla:* El codigo solo evalua las reservas cuya fecha sea exactamente `'15/10'`. Las reservas del dia 14/10, 16/10 o 17/10 jamas interactuan con el plano. Ademas, esta condicion ignora las desactivaciones de tarjeta (`s.tinactive`) y las ediciones (`s.tedits`). Si el cajero cancela o desactiva la reserva `R-035`, la mesa `M06` sigue mostrandose como reservada en el plano.

4. **El contador de reservas en el Escritorio del Cajero es estatico:**
   - *Evidencia:* En [Admin.dc.html, linea 3004](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3004):
     `nav2('Reservas de hoy', 3, 'reservas')`
   - *Falla:* El numero `3` es un texto quemado en el codigo; no calcula la cantidad real de reservas pendientes de la fecha. Mas aun, en el escritorio del Mozo ([Admin.dc.html, linea 3014](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3014)) se colocaron `4` reservas, generando una discordancia evidente entre roles para el mismo dia.

5. **Aprobacion de solicitudes WhatsApp sin validacion obligatoria de seleccion de mesa:**
   - *Evidencia:* En [Admin.dc.html, linea 3380](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3380):
     `approve: sel ? ask(...) : () => this.setState({ rsMsg: 'Elige primero una mesa libre para ' + r.nombre + '.' })`
   - *Falla:* Aunque el controlador muestra un mensaje de advertencia si no se eligio mesa, el boton "Aprobar y guardar la mesa" ([linea 1195](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L1195)) permanece visualmente activo con color anaranjado solido (`#E67929`), en lugar de aparecer deshabilitado (`disabled`), lo que confunde al operador.

6. **Edicion libre sin reglas de negocio en la tabla:**
   - *Evidencia:* En [Admin.dc.html, lineas 2976 y 2859](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2976), al presionar "Editar" en una reserva, se despliegan campos de texto sin validar formato de hora, sin calendario y sin verificar si la mesa asignada ya esta ocupada en ese horario.

7. **Incoherencia con el canal de recepcion estipulado en el BRD:**
   - *Evidencia:* El requerimiento `RN-CAP-032` ([BRD.md, linea 203](file:///tmp/claude-1000/cajero-agy/fuente/BRD.md#L203)) y el Acta 02 ([BRD.md, lineas 146 y 298](file:///tmp/claude-1000/cajero-agy/fuente/BRD.md#L146)) senalan que en Caprichos las reservas son minimas (4 o 5 al mes) y se gestionan exclusivamente como solicitudes por WhatsApp aprobadas por personal. Sin embargo, el modulo muestra una estructura de 10 tarjetas fijas estilo restaurante de gran volumen y mantiene desconectado el bloque de WhatsApp del resto de la interfaz.

---

## 5 Propuesta concreta de mejora para el mockup (pantallas, campos, botones, reglas), priorizada

Considerando que Caprichos es una cafeteria con operacion agil de mostrador y salon y baja frecuencia de reservas (grupos grandes o eventos de té), la propuesta prioriza la sencillez operativa y la resolucion de cuellos de botella:

### Prioridad 1: Desbloqueo y Activacion de Mesas en el Plano (Critica - Inmediata)
- **Accion "Llego el comensal / Ocupar mesa":**
  - Modificar la condicion en el plano ([Admin.dc.html, linea 3285](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L3285)). Al pulsar sobre una mesa marcada con `R`, en lugar de bloquear el paso, desplegar un modal de decision:
    - *Boton 1 ("Activar y sentar cliente"):* Cambia el estado de la reserva a "Atendida", retira la marca `R`, pasa la mesa a estado ocupada en el POS y abre inmediatamente la carta para ingresar el pedido del cliente.
    - *Boton 2 ("Liberar mesa / No se presentó"):* Permite al cajero cancelar la reserva si vencio la tolerancia y liberar la mesa para clientes de paso.

### Prioridad 2: Unificar la coleccion de datos del modulo (Alta)
- Eliminar la division entre `TABLES.reservas.rows`, `s.rs` y `s.reserv`.
- Toda solicitud aprobada desde WhatsApp o creada manualmente debe registrarse de manera reactiva en la lista principal de reservas y asociarse dinamicamente con el plano del local para la fecha de hoy.
- Al desactivar o cambiar el estado de una reserva a "Cancelada", la marca `R` debe desaparecer de inmediato del plano.

### Prioridad 3: Incorporar el boton "+ Registrar Reserva" dentro del modulo (Alta)
- Agregar en la cabecera de la vista `reservas` un boton destacado: `+ Nueva reserva`.
- Al pulsarlo, abrir un modal sencillo con los siguientes campos:
  - Nombre del cliente y telefono de contacto.
  - Fecha (por defecto hoy) y Hora (desplegable de horas operativas).
  - Cantidad de personas (selector numerico o botones 2, 4, 6, 8+).
  - Selector de mesa (mostrando mesas libres del plano).
  - Campo de texto: *Observaciones / Alergias / Motivo* (ej. "Mesa para cumpleaños, traen torta").

### Prioridad 4: Integracion real de coordinacion por WhatsApp (Media)
- En el bloque de solicitudes por WhatsApp, incorporar botones directos con enlace `https://wa.me/51[telefono]?text=...`:
  - **Boton "Coordinar por WhatsApp":** Abre la conversacion con mensaje inicial saludando al cliente.
  - **Al Aprobar:** Generar mensaje automatico: *"¡Hola [Nombre]! Tu reserva en Caprichos para [PAX] personas el [Fecha] a las [Hora] en la Mesa [MXX] ha sido CONFIRMADA. Te guardamos 15 minutos de tolerancia. ¡Te esperamos!"*.
  - **Al Rechazar:** Generar mensaje prellenado avisando que no hay disponibilidad y ofreciendo horarios alternativos.

### Prioridad 5: Control visual de la tolerancia de 15 minutos (Media)
- En la lista de tarjetas y en el plano de mesas:
  - Si la hora actual se encuentra dentro de los 15 minutos previos a la hora de reserva: mostrar distintivo amarillo *"Por llegar"*.
  - Si transcurrieron mas de 15 minutos de la hora pactada y el cliente no ha sido marcado como "Atendido": mostrar alerta roja *"Tolerancia vencida (+15 min)"* con boton rapido *"Liberar mesa"*.

### Prioridad 6: Opcion de cobro de seña para grupos mayores a 5 personas (Baja / Opcional)
- Si Kevin confirma que se solicita garantia para mesas de 6 u 8 personas (segun el anuncio `N-4` en [Admin.dc.html, linea 2137](file:///tmp/claude-1000/cajero-agy/fuente/Admin.dc.html#L2137)), incluir un casillero opcional: `Monto de seña (S/)` y `Medio de pago (Yape/Plin/Efectivo)` que ingrese como movimiento a la caja activa del cajero.

---

## 6 Preguntas para el dueno (Kevin)

Para cerrar las definiciones funcionales de cara al desarrollo final, se requiere respuesta a los siguientes puntos de negocio:

1. **Cobro de seña o adelanto monetario:** ¿Caprichos solicita actualmente o planea solicitar un pago por adelantado (por ejemplo S/ 20 o S/ 50) para asegurar la reserva de grupos grandes (cumpleaños, lonches de 6 a 8 personas), o las reservas son 100% sin costo?
2. **Protocolo ante vencimiento de tolerancia:** Cuando se cumplen los 15 minutos de espera y el cliente no llega, ¿el personal tiene autorizacion para liberar la mesa inmediatamente a clientes en espera, o la regla exige comunicarse antes por telefono/WhatsApp con quien reservo?
3. **Mesas combinables / juntas:** Cuando reservan 6 u 8 personas, ¿la cafeteria junta fisicamente mesas individuales (ejemplo: Mesa 4 y Mesa 5)? ¿Desea que el sistema permita asignar dos mesas simultaneas a una sola reserva?
4. **Pedidos y productos anticipados:** ¿Los clientes que reservan suelen encargar productos con anticipacion por WhatsApp (por ejemplo, una torta entera, porciones especificas o bocaditos), o la reserva es unicamente por el espacio fisico de las sillas?
5. **Restriccion en horarios punta:** ¿Existen dias u horas de maxima afluencia (por ejemplo fines de semana de 17:00 a 19:00) donde la politica del local deba restringir la admision de reservas para priorizar la rotacion natural de comensales directos?

---

## 7 NO VERIFICADO

1. **Envio de mensajes reales hacia la API oficial de WhatsApp Business:** NO VERIFICADO en el codigo fuente. El mockup se ejecuta en un entorno web estatico local y sus botones de WhatsApp operan unicamente mediante enlaces de protocolo `wa.me` sin pasarela de mensajeria automatizada.
2. **Volumen real historico de reservas en produccion de Caprichos:** NO VERIFICADO. Segun la auditoria de produccion documentada en [referencia/reservas.md, linea 428](file:///tmp/claude-1000/cajero-agy/referencia/reservas.md#L428), la base de datos de restaurant.pe arrojaba `totalregistros: "0"`, por lo que el comportamiento del personal en situaciones de alta concurrencia de reservas no pudo ser observado directamente en vivo.
3. **Politica de devolucion de señas ante cancelacion:** NO VERIFICADO en las actas de reunion si existe retencion parcial o devolucion total en caso de desistimiento del cliente.

---
INFORME LISTO.
