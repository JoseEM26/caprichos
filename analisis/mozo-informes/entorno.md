---
id: ANA-CAP-038
tipo: analisis
titulo: "Informe Integral de Auditoria: El Entorno Operativo del Rol Mozo"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-18
relacionados: [BRD-CAP-001]
tags: [analisis, apoyo, mozo-informes]
---

# Informe Integral de Auditoria: El Entorno Operativo del Rol Mozo

## 1. Introduccion y Alcance de la Auditoria

El presente informe constituye la auditoria tecnica y funcional sobre todo lo que rodea operativamente al rol Mozo (`mozo`) en el prototipo interactivo del sistema administrativo de Caprichos (`fuente/Admin.dc.html`). El analisis contrasta la implementacion del mockup contra:
1. Las directrices y decisiones de negocio de Kevin Rosales (cliente y administrador de Caprichos) recogidas en las reuniones de descubrimiento (`fuente/acta-01-descubrimiento.md`, `fuente/acta-02-descubrimiento.md`, `fuente/iniciativas-acta-02.md` y `fuente/BRD.md`).
2. La arquitectura funcional observada en el sistema en produccion actual restaurant.pe, documentada en los informes de auditoria pasiva:
   - `referencia/escritorio.md` (dashboard de control operativo y KPIs).
   - `referencia/modulos-usuarios-notificaciones.md` (alertas en tiempo real, perfiles y catalogo de permisos granulares).
   - `referencia/modulos.md` (jerarquia completa de modulos y navegacion).

La evaluacion abarca diez ejes criticos que definen la jornada del mozo en el salon:
- Escritorio del mozo (cifras reales versus cifras fijas).
- Notificaciones y avisos (pedidos listos de cocina, clientes en espera y reservas por llegar).
- Gestion de reservas (creacion, margen de tolerancia de 15 minutos y activacion de mesa reservada).
- Pantalla de Productos para el mozo (alcance de visualizacion, marcado de agotados y brechas de seguridad).
- Matriz de permisos (acciones permitidas, prohibiciones de cobro y visibilidad de datos de otros roles).
- Plano del local y dinamica de estados de mesa (concurrencia, artificio de 30 mesas y cobro anticipado).
- Gestion de propinas.
- Precuenta imprimible (diseno, desglose de consumos y capacidades de emision fisica).
- Division de cuentas y soporte de pago mixto (segregacion mozo versus caja).
- Cierre de turno y liquidacion operativa del mozo.

Todos los hallazgos se catalogan bajo las etiquetas estandar:
- CONFIRMADO en el codigo: verificado textualmente en las funciones, estados y plantillas de `fuente/Admin.dc.html`.
- CONFIRMADO en el acta: declarado textualmente por Kevin Rosales o acordado en las actas de descubrimiento.
- SUPOSICION: deduccion funcional o tecnica fundamentada en buenas practicas para cafeterias artesanales, sujeta a confirmacion final del cliente.

---

## 2. Hallazgos por Eje Tematico

```
+----------------------------------------------------------------------------------------------------+
|                                    MATRIZ GENERAL DE HALLAZGOS                                     |
+----+--------------------------------+--------------------+-----------------------+-----------------+
| N. | Eje Evaluado                   | Estado en Mockup   | Cumplimiento con Acta | Prioridad       |
+----+--------------------------------+--------------------+-----------------------+-----------------+
| 01 | Escritorio del Mozo            | Parcialmente Real  | Cumple a medias       | Media           |
| 02 | Notificaciones y Avisos        | Deficiente         | No cumple             | Alta            |
| 03 | Reservas y Activacion de Mesa  | Bloqueante         | No cumple (Falla bug) | Alta            |
| 04 | Pantalla de Productos          | Inseguro           | Brecha de seguridad   | Alta            |
| 05 | Permisos y Otros Roles         | Aceptable          | Cumple en cobro       | Media           |
| 06 | Plano y Estados de Mesa        | Incompleto         | Cumple a medias       | Alta            |
| 07 | Propinas                       | Inexistente        | Omitido               | Media           |
| 08 | Precuenta Imprimible           | Simulado / Mutilado| Cumple a medias       | Alta            |
| 09 | Division de Cuentas y Mixto    | Mixto Si, Split No | Cumple a medias       | Alta            |
| 10 | Cierre de Turno del Mozo       | Inexistente        | No cumple             | Media           |
+----+--------------------------------+--------------------+-----------------------+-----------------+
```

---

### Eje 1: Escritorio del Mozo (Cifras Reales vs. Fijas)

#### Evidencia en el Mockup (`fuente/Admin.dc.html`)
- Busqueda por texto: `s.role === 'mozo'`.
- Configuracion del rol: El rol mozo tiene asignadas las vistas: `views: [ 'escritorio', 'caja', 'reservas', 'productos', 'notificaciones' ]`, con pagina de inicio `home: 'escritorio'` y `manage: false`.
- Tarjetas de indicadores (`dKpis`):
  - "Mesas con pedido abierto": se calcula evaluando la longitud del arreglo `mesas = orders.filter((o) => o.modal === 'local' && ['nuevo', 'cola', 'prep', 'listo'].indexOf(o.status) >= 0)`.
  - "Listos para llevar a la mesa": se calcula evaluando `orders.filter((o) => o.modal === 'local' && o.status === 'listo').length`.
  - "Reservas de hoy": presenta un valor de cadena fija `'4'` (`v: '4'`).
- Tareas pendientes ("Para hacer ahora" / `dPending`):
  - "Pedidos de mis mesas": enlace con contador dinamico `mesas.length`.
  - "Reservas de hoy": enlace con contador estatico fijado en el numero `4`.
  - "Productos agotados": enlace con contador dinamico `Object.keys(s.avail).filter((k) => s.avail[k] === false).length`.
- Lista operativa del escritorio (`dListTitle = 'Mis mesas'`):
  - Mapea las ordenes de `mesas`, asignando como titulo: `'Mesa ' + o.mesa + ' · ' + o.id`.

#### Comparacion con `referencia/escritorio.md`
- En restaurant.pe, la pantalla de inicio principal (`escritorio.resumen`) es un panel macroeconomico y gerencial alimentado por el endpoint centralizado `obtenerPortadaV2`.
- El dashboard de restaurant.pe expone: total de ventas en efectivo, tarjetas, vales, ingresos consolidados, egresos de caja chica, curvas de afluencia por hora (hora punta y hora libre), tiempos maximos y minimos de despacho de cocina, y el ranking de mozos ("Mozo del dia", pedidos realizados, porcentaje de ventas del turno y enlace para "Mostrar los demas mozos").
- El mockup respeta la directriz de Kevin Rosales (RN-CAP-013 del BRD): el mozo no debe ver la facturacion global ni las ventas monetarias del negocio. No obstante, mientras restaurant.pe procesa todas sus metricas en tiempo real desde la base de datos, el prototipo mezcla calculos interactivos con valores fijados a mano ("hardcodeados").

#### Evaluacion y Calificacion
- Clasificacion: CONFIRMADO en el codigo.
- Hallazgo (a):
  En la evaluacion de `s.role === 'mozo'` en `fuente/Admin.dc.html`, el indicador de "Reservas de hoy" tanto en la tarjeta KPI como en el acceso directo de pendientes esta fijado arbitrariamente en `4`, sin consultar las filas de la tabla de reservas (`TABLES.reservas.rows`) ni el arreglo reactivo de solicitudes (`s.rs`).
  Asimismo, aunque la lista se titula "Mis mesas", la variable `mesas` toma absolutamente todos los pedidos en salon del local (`modal === 'local'`), sin filtrar por el identificador del mozo en sesion (`mozo01`).
- Por que importa para una cafeteria (b):
  Si el mozo observa una cifra fija de reservas que no coincide con las reservas reales agendadas para el turno, planificara erroneamente la rotacion de mesas en el salon, asignando a clientes que llegan sin cita mesas que deben permanecer bloqueadas. Ademas, al mostrarle todas las mesas del local en lugar de las que estan bajo su responsabilidad, se genera confusion entre los distintos mozos de turno respecto a quien debe atender que comanda.
- Prioridad (c): Media.

---

### Eje 2: Notificaciones y Avisos (Pedidos Listos, Clientes en Espera, Reservas)

#### Evidencia en el Mockup (`fuente/Admin.dc.html`)
- Busqueda por texto: `const ROLES_ATT = [ 'admin', 'cajero', 'mozo', 'callcenter' ]` y evaluacion de la campana `addN`.
- Alertas procesadas para el mozo:
  1. `cli-`: Procesa alertas de clientes (`s.alerts.filter((a) => a.estado === 'pendiente')`). Si el cliente respondio "Mal" en la encuesta web, genera: "Queja de [nombre] · Respondio 'Mal' en la encuesta. Se aviso al correo [dueno] y al grupo de WhatsApp". Si el cliente solicito soporte, genera: "[nombre] espera por WhatsApp · Pidio hablar con una persona".
  2. `res-`: Procesa solicitudes de reserva pendientes (`s.rs`). Titulo: "Solicitud de reserva: [nombre] · falta aprobar".
  3. `net` y `sync`: Alertas generales de corte y reanudacion de conexion a internet.
  4. `acc`: Notificacion de pedidos entrantes fuera de salon (`porAceptar > 0`). Titulo: "X pedidos por confirmar · Caja debe verificarlos y aceptarlos para que pasen a cocina".
- Notificaciones de despacho:
  - En el codigo existe la variable `dispR = orders.filter((o) => o.modal === 'delivery' && o.status === 'listo' && !o.rider).length`, pero esta condicionada exclusivamente al rol repartidor: `roles: [ 'repartidor' ]`.

#### Comparacion con `referencia/modulos-usuarios-notificaciones.md`
- En restaurant.pe, la barra superior posee alertas operativas especificas:
  - Icono de impresora (`fa-print`) con animacion y alerta visual cuando falla la cola de impresion o se desconecta una ticketera.
  - Alerta de pedidos delivery por confirmar (`fa-truck`).
  - Dropdown con avisos de stock bajo de insumos criticos.
  - Campana de regularizacion de comprobantes fiscales ante SUNAT.
- En el mockup de Caprichos, la campana unificada resuelve bien el canal de comunicacion, pero omite las senales auditivas y visuales clave para el servicio directo en mesa.

#### Evaluacion y Calificacion
- Clasificacion: CONFIRMADO en el codigo y CONFIRMADO en el acta.
- Hallazgo (a):
  1. Pedido listo para llevar a la mesa: En `fuente/Admin.dc.html`, cuando la pantalla de cocina cambia un pedido de salon a estado "listo" (`status === 'listo' && modal === 'local'`), NO se genera ninguna notificacion en la campana para el mozo. Solo existe alerta para pedidos de delivery dirigidos al motorizado. El mozo unicamente se entera si permanece mirando la tarjeta KPI de su escritorio o consultando el listado de pedidos.
  2. Cliente espera: La notificacion existente corresponde al chatbot de WhatsApp ("espera por WhatsApp"), pero no existe ningun mecanismo de aviso para el salon fisico (por ejemplo, llamada de asistencia o solicitud de atencion desde el codigo QR de la mesa).
  3. Reserva por llegar: En el Acta 02 (minuto 00:58:30 y punto C-14 de iniciativas), Jose y Kevin acordaron expresamente: "y que en la parte administrativa le salga una alerta: 'En 15 minutos la mesa 5 va a estar reservada', para que el personal coloque el conito o base informativa". En `fuente/Admin.dc.html` esta alerta de proximidad de 15 minutos previa a la llegada NO esta implementada; solo existe la alerta de solicitud pendiente de aprobacion.
- Por que importa para una cafeteria (b):
  En una cafeteria, el cafe de especialidad (cappuccinos, lattes, espressos) y la comida caliente pierden temperatura, textura y espuma en cuestion de 2 a 3 minutos. Si el mozo no recibe un aviso sonoro o alerta inmediata de "Pedido listo en barra/cocina para Mesa X", las bebidas permanecen enfriandose en el pase de despacho, arruinando la experiencia sensorial del cliente.
- Prioridad (c): Alta.

---

### Eje 3: Reservas (Nueva Reserva, Tolerancia y Activacion de Mesa)

#### Evidencia en el Mockup (`fuente/Admin.dc.html`)
- Busqueda por texto: `isReservasView`, `mo.reserving`, `TABLES.reservas` y `resvMap`.
- Nueva reserva:
  - El mozo puede crear una reserva desde el modal de pedidos seleccionando "Reservar mesa": define nombre, comensales (2, 4, 6), hora y selecciona la mesa en el plano.
  - El mozo tambien puede gestionar la vista `reservas` (`isReservasView`), aprobando solicitudes pendientes recibidas por WhatsApp y asignandoles mesa mediante chips interactivos (`solPend`).
- Tolerancia:
  - En la vista y textos de confirmacion figura la frase: "Hora (15 minutos de tolerancia)" y "Se guarda 15 minutos de tolerancia y luego se libera" (Acta 02, minuto 00:56:25).
  - En el codigo JavaScript no existe ningun cronometro, proceso de fondo ni temporizador que calcule la expiracion del tiempo y modifique el estado de la reserva o libere la mesa de forma automatica.
- Activacion de mesa reservada (Comportamiento critico en el plano):
  - En el mapeo de elementos interactivos del plano (`moEls`), se evalua: `const rv = isM ? resvMap[code] : null;`.
  - Cuando el mozo pulsa una mesa que tiene reserva (`rv` es verdadero), el controlador ejecuta:
    `if (rv) { this.setState({ mo: Object.assign({}, mo, { msg: e.label + ' esta reservada para ' + rv.nombre + ' a las ' + rv.hora + '. Llega con 15 minutos de tolerancia.' }) }); return; }`
  - La funcion de "Liberar o marcar mesa" (`mo.liberar`) unicamente conmuta `mesaOv[code] = used ? 'libre' : 'ocupada'`. No remueve la entrada en `s.reserv` ni modifica el registro en `TABLES.reservas`.

#### Comparacion con `referencia/modulos.md` y Actas
- En restaurant.pe, el modulo Reservas (`#!/reservas/principal`) existe pero figura con baja actividad (`deboMostrarReservas: "0"` en la respuesta de addons de Caprichos).
- En el Acta 02 (minutos 00:56:00 a 00:58:00), Kevin detallo que las reservas ocurren de 4 a 5 veces al mes, no requieren pre-orden de platos desde la web y solo exigen guardar la mesa en el plano identificada con una "R", respetando 15 minutos de tolerancia.

#### Evaluacion y Calificacion
- Clasificacion: CONFIRMADO en el codigo (Defecto de programacion / Bug operativo).
- Hallazgo (a):
  En `fuente/Admin.dc.html`, existe un bloqueo insalvable en el flujo de atencion: cuando el cliente que reservo llega fisicamente a la cafeteria y el mozo se acerca a tomarle el pedido, al pulsar la mesa reservada en el plano interactivo, el sistema despliega el mensaje informativo pero ejecuta un `return;` que cancela la transicion a la seleccion de productos (`step: 'items'`). La herramienta de liberacion manual tampoco purga el mapa de reservas. En consecuencia, no existe ninguna accion para "Activar mesa", "Sentar comensales" o "Iniciar consumo", dejando la mesa bloqueada e impidiendo registrar la comanda bajo el numero correcto de mesa.
- Por que importa para una cafeteria (b):
  Si un cliente VIP o regular que reservo mesa con anticipacion llega al local, el personal no podra asociar los cafes y postres a esa mesa. El mozo se vera forzado a usar mesas ficticias (reincidiendo en el vicio de las 30 mesas de restaurant.pe) o a cobrar en comanda volante sin control de comanda.
- Prioridad (c): Alta.

---

### Eje 4: Pantalla de Productos para el Mozo (Visualizacion vs. Edicion de Precios)

#### Evidencia en el Mockup (`fuente/Admin.dc.html`)
- Busqueda por texto: `isProductos` y `products = pfiltered.slice...`.
- Acceso del mozo: El rol `mozo` posee acceso nativo a la vista `productos` en su arreglo `views`.
- Disponibilidad operativa (Agotados):
  - Cada tarjeta de producto expone un boton de conmutacion:
    `toggle: ask('¿' + (off ? 'Marcar disponible' : 'Marcar agotado') + ' "' + p.n + '"?', off ? 'Volvera a ofrecerse en la carta y el chatbot.' : 'Dejara de ofrecerse en la carta y el chatbot.', () => { ... })`
  - El mozo puede marcar un producto como AGOTADO o DISPONIBLE en tiempo real.
- Brecha de permisos de edicion en la tarjeta de producto:
  - En la misma tarjeta se renderiza el boton `Editar` (`p.edit`), que abre el modal generico de modificacion:
    `edit: () => this.setState({ edit: { kind: 'product', key: p.n, title: p.n, labels: ['Nombre', 'Categoría', 'Precio (s/)'], vals: [p.n, p.cat, String(p.p)], lock: [true, false, false], combos: { 1: 'categorias' } ... } })`
    Los campos de Categoria y Precio no estan bloqueados (`lock: [true, false, false]`), permitiendo alterar el valor monetario del producto.
  - Se renderiza el boton `Opciones y tamanos` (`p.openOpc`), que permite alterar los precios de cada variante de tamano (8 oz, 12 oz, 16 oz).
  - En la cabecera del modulo se expone la barra "Gestionar listas" (`isManageProd`), con capacidad para crear y renombrar tipos de producto (Donas, Galletas, Pizzas) y sabores.

#### Comparacion con `referencia/modulos.md`, `referencia/productos.md` y `fuente/modulos-y-roles.md`
- En restaurant.pe, la gestion de productos (`#!/productos/platos/categoria/All`) esta estrictamente reservada para administradores. El personal operativo cuenta con una pantalla de solo lectura: "Consulta de precios" (`#!/informes/inventario/productos-con-precio`).
- En `fuente/modulos-y-roles.md` (seccion 5, "Por confirmar con el cliente"), se planteo la duda expresa: "Si el mozo debe cobrar o solo tomar pedidos, y si puede marcar productos agotados". En ninguna parte de las actas ni del BRD Kevin autorizo que los mozos editen la carta ni alteren tarifas de venta.

#### Evaluacion y Calificacion
- Clasificacion: CONFIRMADO en el codigo.
- Hallazgo (a):
  En `fuente/Admin.dc.html`, la vista `productos` no valida el rol ni la bandera `canManage`. Un usuario con rol Mozo no solo puede visualizar el catalogo y marcar platos agotados, sino que tiene habilitados los controles para modificar el precio de venta en soles, alterar tarifas de tamanos y crear categorias de carta.
- Por que importa para una cafeteria (b):
  Permitir que el personal de servicio en salon modifique precios abre una vulnerabilidad severa de fraude interno, errores accidentales en la facturacion y discrepancias financieras frente a los precios publicados en la carta digital y el chatbot de WhatsApp. El mozo unicamente debe contar con consulta de precios y, si Kevin lo aprueba, la facultad de marcar productos como agotados.
- Prioridad (c): Alta.

---

### Eje 5: Matriz de Permisos (Capacidades, Prohibiciones y Visibilidad de Otros Roles)

#### Evidencia en el Mockup (`fuente/Admin.dc.html`)
- Busqueda por texto: `const canManage = role.manage;` y evaluacion de permisos por rol.
- En la definicion de roles:
  `mozo: { n: 'Mozo', user: 'mozo01', person: 'Mozo de ejemplo', views: [ 'escritorio', 'caja', 'reservas', 'productos', 'notificaciones' ], manage: false }`
- Validaciones en Pedidos y Caja:
  - Registro de cobro: `canCollect = selOrder.status !== 'nuevo' && selOrder.status !== 'rechazado' && !selOrder.paid && canManage`. Al ser `canManage: false`, el boton "Registrar cobro" NO es visible para el mozo.
  - Credito del personal: El boton "Cobrar a credito del personal" (`openCr`) esta contenido dentro del bloque condicional `sel.canCollect`, permaneciendo oculto para el mozo.
  - Aceptacion de pedidos: `canAccept = selOrder.status === 'nuevo' && selOrder.modal === 'local' && canManage`. El mozo no puede pulsar "Aceptar y enviar a cocina" desde la lista (los pedidos que toma en el local van directo a cocina mediante la creacion modal).
  - Reimpresion de tickets: `canReprint = selOrder.status !== 'nuevo' && selOrder.status !== 'rechazado' && canManage`. El mozo no puede solicitar reimpresion de tickets en cocina.
  - Cierre y entrega: `canDeliver = selOrder.status === 'listo' && !isDelivery && canManage`. El mozo no puede marcar la orden de salon como entregada y cerrada en el sistema.
  - Confirmacion de pagos externos: `canConfirmPay = selOrder.status === 'nuevo' && selOrder.modal !== 'local' && [ 'admin', 'cajero', 'mozo', 'callcenter' ].indexOf(s.role) >= 0`. El mozo si tiene permiso para confirmar pagos de pedidos externos por WhatsApp subiendo comprobantes.

#### Comparacion con `referencia/modulos-usuarios-notificaciones.md`
- Restaurant.pe implementa un esquema de mas de 500 tags de permisos granulares (`ventas.hacerpedidos.salones.ver`, `ventas.hacerpedidos.salones.anular`, `caja.cobrar`, etc.).
- En el mockup de Caprichos, toda la seguridad descansa en un unico valor booleano (`manage`). Esto genera distorsiones funcionales: para evitar que el mozo cobre, se le desactiva `manage`, pero al hacerlo se le bloquea tambien la capacidad de reimprimir un ticket de comanda manchado o perdido en barra, y se le retira el boton para marcar una mesa como servida/entregada.

#### Evaluacion y Calificacion
- Clasificacion: CONFIRMADO en el codigo y CONFIRMADO en el acta.
- Hallazgo (a):
  1. Cumplimiento estricto de la directriz de Kevin (Acta 02, minuto 00:26:48): El mozo no puede cobrar en el sistema. Los controles de recepcion de dinero y cobro mixto estan completamente inaccesibles para el usuario `mozo01`.
  2. Sobrecarga de informacion de otros roles: En el modulo `Pedidos y caja`, el mozo visualiza la totalidad de transacciones operativas del local (pedidos web para delivery, motorizados en ruta y pedidos de mostrador de caja), lo que genera ruido visual e induce a equivocaciones operativas.
  3. Contradiccion de seguridad en delivery: Aunque el mozo tiene vetado el cobro presencial en salon, el codigo le permite actuar como validador de pagos de delivery por WhatsApp (`canConfirmPay`), revisando vouchers y habilitando el envio a cocina.
- Por que importa para una cafeteria (b):
  El mozo debe concentrar su atencion en la sala y las mesas asignadas. Tener acceso a la bandeja completa de delivery del call center y no poder reimprimir un ticket extraviado de una mesa presencial entorpece el dinamismo del servicio en hora punta.
- Prioridad (c): Media.

---

### Eje 6: Plano del Local y Estados de Mesa

#### Evidencia en el Mockup (`fuente/Admin.dc.html`)
- Busqueda por texto: `const busy = {}`, `s.mesaOv` y `const moEls =`.
- Resolucion del problema de concurrencia (Conflicto de las 30 mesas de restaurant.pe):
  - En el Acta 02 (minutos 00:52:16 y 00:53:44), Kevin relató que restaurant.pe no avisaba cuando dos operadores tomaban la misma mesa vacia a la vez, por lo que crearon mesas artificiales (1 al 8 para mozo, 9 al 30 para caja).
  - En el mockup, la ocupacion se detecta dinamicamente evaluando los pedidos abiertos:
    `orders.forEach((o) => { if (o.modal === 'local' && o.status !== 'entregado' && o.status !== 'rechazado' && !o.paid && o.mesa) { busy[o.mesa] = o.id; } });`
  - Si una mesa se encuentra en `busy`, al seleccionarla se despliega la advertencia: `[Mesa] esta ocupada (pedido [ID]). Se libera al cobrar o a mano.` y se impide crear un segundo pedido sobre ella, resolviendo de raiz el problema que motivo el artificio de las 30 mesas.
- Estados de mesa visualizados en el plano:
  - Libre: Fondo verde claro (`#DFF3E3`), borde verde oscuro (`#2F9E57`) y texto con aforo de comensales.
  - Ocupada: Fondo durazno (`#F6C9A5`), borde naranja fuerte (`#E67929`) y texto "ocupada".
  - Reservada: Fondo amarillo/dorado (`#F9E0B5`), borde ocre (`#D99E39`) y distintivo "R [hora]".
- Conflicto por cobro anticipado:
  - La ocupacion automatica en `busy` requiere obligatoriamente que la orden no este pagada: `!o.paid`.
  - En el instante en que el cajero registra el cobro (`paid: true`), la mesa desaparece de `busy` y vuelve a pintarse de color verde (Libre), a menos que el mozo o caja hayan forzado manualmente una marca en `mesaOv`.

#### Comparacion con `referencia/escritorio.md` y Actas
- En el Acta 02 (minutos 00:24:07 a 00:25:30, punto B-11 de iniciativas), Kevin explico que en Caprichos acostumbran pedir el pago por adelantado en mesa cuando el cliente comanda ("serian 25 soles, ¿cancela con Yape o efectivo?"), pero los clientes permanecen consumiendo en la mesa por 30 o 45 minutos. En restaurant.pe, al cobrar, la mesa se borraba del plano de inmediato, desfasando la realidad fisica del salon frente a la pantalla.

#### Evaluacion y Calificacion
- Clasificacion: CONFIRMADO en el codigo y CONFIRMADO en el acta.
- Hallazgo (a):
  1. El prototipo resuelve exitosamente la prevencion de comanda concurrente, haciendo innecesario el artificio de las 30 mesas de restaurant.pe.
  2. Sin embargo, el prototipo recae en la misma falla estructural advertida por Kevin: la formula de mesa ocupada incluye la condicion `!o.paid`. Al registrarse un cobro por adelantado en caja, la mesa pasa de inmediato a estado "Libre" (verde), induciendo al mozo a intentar sentar comensales nuevos en una mesa donde los clientes aun no terminan sus bebidas.
  3. Faltan estados operativos intermedios del ciclo de mesa: "Esperando pedido", "Comensal servido", "Precuenta emitida" y "Mesa por limpiar".
- Por que importa para una cafeteria (b):
  En una cafeteria con solo 8 mesas fisicas de alta afluencia, el salon se satura rapidamente. Si el sistema libera las mesas en el mapa apenas se cobra en caja, el mozo asumira que la mesa esta disponible para nuevos clientes, produciendo situaciones incomodas al conducir a personas hacia mesas que siguen ocupadas fisicamente.
- Prioridad (c): Alta.

---

### Eje 7: Propinas

#### Evidencia en el Mockup (`fuente/Admin.dc.html`)
- Busqueda por texto: `propina`.
- Unica aparicion identificada en todo el codigo fuente:
  En la definicion de la tabla del modulo Informes (`TABLES.informes`), fila 0:
  `['Ventas por mozo', 'Ventas', 'Ventas y propinas por mozo', 'Fecha, local', 'PDF · Excel']`
- Evaluacion en el flujo transaccional:
  - No existe campo de propina en la ordenacion modal (`mo`).
  - No existe campo de propina en la precuenta (`precuenta`).
  - No existe campo de propina en el registro de cobro de caja (`cbd`).
  - No existe acumulador de propinas en el arqueo del turno de caja (`cj`).
  - No existe metrica de propinas recibidas en el escritorio del mozo.

#### Comparacion con `referencia/escritorio.md` y `fuente/BRD.md`
- En restaurant.pe, la gestion de propinas forma parte de las variables principales de la portada (`vm.portada.totalIngresosPropinas`), desglosadas por cada venta y visualizadas en el badge superior financiero. En la auditoria de `referencia/escritorio.md` (seccion 14) se dejo registrada la pregunta operativa: "¿Las propinas que aparecen en el badge superior se liquidan automaticamente al mozo o se gestionan en un pozo comun de caja?".
- En `fuente/BRD.md` (alcance descartado / pendiente), se indico: "propina voluntaria: no fue elegida para la primera version; se confirma con el cliente".

#### Evaluacion y Calificacion
- Clasificacion: CONFIRMADO en el codigo y CONFIRMADO en el acta.
- Hallazgo (a):
  Las propinas han sido omitidas de todos los formularios de comanda, precuenta y cobro en `fuente/Admin.dc.html`. Solo permanecen como texto estatico en una plantilla de informes.
- Por que importa para una cafeteria (b):
  En el rubro de cafeteria de ticket medio y especialidad en Lima, una proporcion significativa de clientes que pagan con billeteras digitales (Yape/Plin) o tarjeta desean agregar una propina voluntaria al mozo (frecuentemente redondeando la cuenta o agregando entre s/ 2 y s/ 5). Si el sistema no permite ingresar la propina en el cobro ni en la precuenta, o se pierde el incentivo economico del colaborador o el dinero termina generando sobrantes anómalos en el arqueo de caja.
- Prioridad (c): Media.

---

### Eje 8: Precuenta Imprimible

#### Evidencia en el Mockup (`fuente/Admin.dc.html`)
- Busqueda por texto: `openPre`, `closePre`, `isPre` y modal de precuenta.
- Interfaz del modal de precuenta (`isPre`):
  - Renderiza una caja de dialogo modal con tipografia monoespaciada (`font-family: 'Courier New', monospace`), simulando el formato de una tira de ticket de 80 mm.
  - Encabezado: "PRECUENTA" centrado, seguido de la identificacion de mesa (`preMesa`).
  - Detalle de consumos (`preLines`):
    `preLines = selOrder ? selOrder.items.map((i) => ({ q: i.q, n: i.n, d: i.d })) : []`
    Renderizado en plantilla: `<b>{{l.q}} x {{l.n}}</b><br><span style="padding-left:14px">{{l.d}}</span>`.
  - Pie del documento: separador punteado, "TOTAL {{preTotal}}", recuadro estatico de codigo QR de ejemplo ("al 9XX XXX XXX") y mensaje legal: "La precuenta no es un comprobante de pago."
  - Boton de cierre: unicamente existe `<button onClick="{{closePre}}" ...>Cerrar</button>`.

#### Comparacion con `fuente/impresion-tickets.md` y Actas
- En el Acta 02 (minuto 00:26:48, punto B-14 de iniciativas), Kevin establecio con precision meridiana el flujo:
  "el mozo lo que puede hacer es precuentas, sacar precuentas y con eso cobrar al cliente con la precuenta. Y una vez cobrado al cliente en mesa, el mozo llega a caja, paga y recien el cajero recibe el dinero y emite el comprobante de pago".
- En `fuente/impresion-tickets.md` se analizo el circuito de impresion termica mediante el protocolo ESC/POS en el puerto TCP 9100 o agente local en Windows, resaltando la emision de precuenta fisica en estacion de servicio.

#### Evaluacion y Calificacion
- Clasificacion: CONFIRMADO en el codigo y CONFIRMADO en el acta.
- Hallazgo (a):
  1. Falta de boton y funcion de impresion fisica: El modal de precuenta en `fuente/Admin.dc.html` es meramente un dialogo en pantalla. Carece por completo de un boton "Imprimir precuenta" y no tiene asociada ninguna funcion de despacho hacia la ticketera termica de 80 mm de caja o de salon.
  2. Ausencia de precios unitarios y subtotales por producto: El arreglo `preLines` mapea cantidad, nombre y descripcion, pero omite por completo el precio unitario y el subtotal por fila. La precuenta solo muestra el importe consolidado al final.
  3. QR no funcional: El recuadro del codigo QR contiene un texto simulado de "QR" con numero de telefono ficticio no parametrizable.
- Por que importa para una cafeteria (b):
  El modelo operativo exigido por Kevin exige entregar un ticket de precuenta fisico en la mano del cliente en su mesa. El mozo no puede acercarle su tablet para que mire la pantalla, ni tampoco puede cobrarle un consumo sin que el cliente vea el desglose valorizado de lo que se le esta cobrando (por ejemplo, confirmar cuanto costo el cappuccino y cuanto el sandwich). Si la precuenta no imprime el ticket fisico con precios por item, el circuito de control de efectivo se quiebra por completo.
- Prioridad (c): Alta.

---

### Eje 9: Division de Cuenta y Pago Mixto (Mozo vs. Caja)

#### Evidencia en el Mockup (`fuente/Admin.dc.html`)
- Busqueda por texto: `cbConfirm`, `cbd` y division de pedidos.
- Soporte de Pago Mixto en Caja:
  - Implementado exhaustivamente en el controlador de cobro de pedidos (`cbd`):
    - Permite agregar multiples lineas de pago desglosadas por medio (`Efectivo`, `Tarjeta`, `Yape`, `Plin`, `Transferencia`).
    - Valida que la suma de los medios cuadre con el total exacto de la cuenta: `Math.abs(sum - o.total) <= 0.005`.
    - Si se incluye efectivo, calcula dinamicamente el vuelto considerando el efectivo recibido: `Math.max(0, Math.round((rec - cjNum(efe2.monto)) * 100) / 100)`.
    - Al confirmarse, etiqueta la orden con `pay: q.pagos.length > 1 ? 'Mixto' : q.pagos[0].m` y registra el usuario y hora de cobro.
- Segregacion de funciones:
  - El modal de cobro y pago mixto solo se dispara desde `collectSel` (`cbOpen`), boton que esta condicionado a `canManage`.
  - El mozo NO puede abrir el modal de cobro ni manipular el pago mixto; unicamente el cajero y el administrador tienen acceso.
- Division de Cuenta ("Split Bill"):
  - En ninguna parte de `fuente/Admin.dc.html` existe codigo, boton ni modal para dividir una comanda de mesa entre dos o mas comensales (ejemplo: separar items en comandas hijas o fraccionar una mesa en partes iguales).

#### Comparacion con `referencia/modulos-usuarios-notificaciones.md`
- En restaurant.pe, la division de cuentas es un proceso formal de punto de venta configurado bajo la categoria Ventas:
  - Tag de permiso: `ventas.hacerpedidos.salones.divisioncuentas`.
  - Opciones operativas: division por productos (asignar productos especificos a cada cliente) o division equitativa (dividir el monto total entre N pagadores).

#### Evaluacion y Calificacion
- Clasificacion: CONFIRMADO en el codigo.
- Hallazgo (a):
  1. El pago mixto esta correctamente implementado en caja y blindado frente al rol mozo.
  2. La division de cuentas esta totalmente ausente en el prototipo. No hay forma de que dos clientes que comparten una mesa soliciten precuentas independientes ni paguen sus consumos por separado.
- Por que importa para una cafeteria (b):
  En cafeterias artesanales como Caprichos, es extremadamente habitual que grupos de oficina, parejas de estudiantes o amigos compartan una mesa pero soliciten pagar por separado (cada quien su cafe y su porcion de torta). Si el sistema no soporta division de cuenta, el cajero debe recurrir a calculos manuales con calculadora o el mozo debe cancelar comandas y reingresar pedidos ficticios para generar precuentas separadas.
- Prioridad (c): Alta.

---

### Eje 10: Cierre de Turno del Mozo

#### Evidencia en el Mockup (`fuente/Admin.dc.html`)
- Busqueda por texto: `isCierre` y `cierre`.
- Modulo de Caja y Cierres (`isCierre`):
  - El modulo cubre el flujo de apertura y arqueo de caja (`cj`), movimientos de efectivo (ingresos y egresos) y emision de comprobante de Cierre Z con desglose por medio de pago.
  - La vista `cierre` unicamente forma parte de los roles `admin` y `cajero`. El rol `mozo` no tiene esta vista en sus `views`.
- Liquidacion de mesa y recaudacion del mozo:
  - En el codigo no existe ninguna pantalla, tarjeta ni funcion para que el mozo registre o verifique su fin de turno.
  - No existe balance de precuentas emitidas frente a comprobantes fiscales pagados en caja.
  - Tampoco existe registro de asistencia o de finalizacion de sesion por turno.

#### Comparacion con `referencia/escritorio.md` y `referencia/modulos-usuarios-notificaciones.md`
- En restaurant.pe, la productividad del mozo y sus mesas se auditan mediante:
  - Tablas de "Mozos del dia": `cantidadPedidos`, `porcentaje%` y `totalVentas`.
  - Mapeo de identificadores de usuario en cada transaccion (`usuario_id`, `usuario_nombres`, `usuario_apellidos`).
  - Parametrizacion del usuario con `turno_id` y `local_id`.

#### Evaluacion y Calificacion
- Clasificacion: CONFIRMADO en el codigo.
- Hallazgo (a):
  `fuente/Admin.dc.html` no proporciona ningun mecanismo de cierre de turno o arqueo de paso para el mozo. Al terminar su horario, el mozo no tiene forma de saber cuantas mesas atendio, cuantas precuentas entrego a los clientes ni confirmar que todo el dinero recaudado en mesa haya sido descargado en caja.
- Por que importa para una cafeteria (b):
  Dado que Kevin establecio que el mozo cobra en mesa con la precuenta y lleva el dinero a caja, existe un intervalo de riesgo operativo y descuadre entre el efectivo recaudado en el salon y lo que el cajero digita. Al final del turno, si hay faltante de dinero, el mozo y el cajero pueden entrar en conflicto mutuo. Un reporte de fin de turno del mozo (mesas despachadas, precuentas emitidas y suma recaudada) es el instrumento basico de control para evitar perdidas o sospechas de robo.
- Prioridad (c): Media.

---

## 3. Matriz Comparativa: Sistema Actual vs. Prototipo Mockup

```
+-----------------------------+------------------------------------+------------------------------------+
| Variable Operativa          | restaurant.pe (Auditoria Pasiva)   | Caprichos Mockup (Admin.dc.html)   |
+-----------------------------+------------------------------------+------------------------------------+
| Escritorio del Mozo         | Macro-dashboard con ventas totales | Escritorio operacional sin ventas; |
|                             | y rankings de productividad.       | reservas fijadas a mano en '4'.    |
+-----------------------------+------------------------------------+------------------------------------+
| Notificacion Pedido Listo   | No observado en frontend web;      | Omitido para salon; solo alertado  |
|                             | reportado en KDS local.            | para motorizados de delivery.      |
+-----------------------------+------------------------------------+------------------------------------+
| Alerta de Reserva Proxima   | No observada.                      | Omitida (no existe aviso 15 min    |
|                             |                                    | antes de la hora acordada).        |
+-----------------------------+------------------------------------+------------------------------------+
| Gestion de Mesas Reservadas | Modulo independiente de agenda;    | Bug en plano: bloquea la mesa e    |
|                             | liberacion manual.                 | impide tomar comanda al llegar.    |
+-----------------------------+------------------------------------+------------------------------------+
| Control de Productos        | "Consulta de precios" de lectura;  | Permite marcar agotados, pero      |
|                             | edicion restringida a ajustes.     | habilita edicion indebida precios. |
+-----------------------------+------------------------------------+------------------------------------+
| Restriccion de Cobro        | Permisos POS granulares            | Mozo bloqueado de cobrar (cumple); |
|                             | (caja.cobrar).                     | pero no puede reimprimir tickets.  |
+-----------------------------+------------------------------------+------------------------------------+
| Concurrencia en Mesas       | Falla nativa: forzo artificio de   | Resuelto: detecta colision y       |
|                             | configurar 30 mesas artificiales.  | bloquea duplicidad de ordenes.     |
+-----------------------------+------------------------------------+------------------------------------+
| Desfase Cobro Anticipado    | La mesa se libera al cobrar        | La mesa se libera al cobrar        |
|                             | generando desfase en salon.        | (!o.paid), repitiendo la falla.    |
+-----------------------------+------------------------------------+------------------------------------+
| Propinas                    | Registradas en venta y portada     | Inexistentes en comanda, cobro y   |
|                             | (totalIngresosPropinas).           | arqueos de turno.                  |
+-----------------------------+------------------------------------+------------------------------------+
| Precuenta Imprimible        | Impresion termica en estacion      | Dialogo en pantalla sin boton de   |
|                             | de servicio (puerto 9100).         | impresion y sin precios por item.  |
+-----------------------------+------------------------------------+------------------------------------+
| Division de Cuenta          | Permiso granular de separacion y   | Inexistente; no se puede fraccionar|
|                             | transferencia de mesa.             | cuentas entre comensales.          |
+-----------------------------+------------------------------------+------------------------------------+
| Cierre de Turno del Mozo    | Metricas de productividad en       | Inexistente; no hay balance ni     |
|                             | informes (ventas por mozo).        | comprobacion de precuentas.        |
+-----------------------------+------------------------------------+------------------------------------+
```

---

## 4. Plan de Accion y Recomendaciones Tecnicas

### Recomendaciones de Prioridad Alta (Inmediatas)
1. Corregir el bloqueo de mesas reservadas en el plano:
   - Modificar la condicion en `moEls` para que, si una mesa tiene reserva (`rv`), al seleccionarla se despliegue un modal con dos opciones explicitas: "Sentar cliente de reserva e iniciar pedido" o "Liberar mesa por inasistencia (tolerancia vencida)". Al presionar sentar, el sistema debe remover la reserva de `resvMap` y permitir armar la comanda normalmente en la mesa.
2. Blindar la pantalla de Productos frente al rol Mozo:
   - En la plantilla `isProductos`, condicionar los botones `p.edit`, `p.openOpc` y el contenedor `isManageProd` a que el usuario posea privilegios administrativos (`canManage === true`). Para el rol mozo, la pantalla debe operar estrictamente como catalogo informativo de precios y disponibilidad, permitiendo unicamente conmutar el estado de AGOTADO / DISPONIBLE.
3. Habilitar la impresion real y el desglose de la precuenta:
   - Incorporar en el modal de precuenta (`isPre`) un boton de accion "Imprimir precuenta" que dispare la orden al agente local de impresion térmica en formato de 80 mm.
   - Enriquecer el arreglo `preLines` para incluir el precio unitario de cada item y el subtotal por linea antes del gran total.
4. Resolver el desacople de mesas por cobro anticipado:
   - Modificar la formula de asignacion de `busy`: una mesa no debe considerarse libre solo porque `o.paid === true`. La mesa debe permanecer en estado "Ocupada (Pagada)" hasta que el mozo o el cajero presionen "Liberar mesa" o el estado de la orden pase formalmente a "entregado y desocupado".
5. Implementar la division de cuentas (Split Bill):
   - Disenar en el flujo de mesa la opcion de "Dividir comanda", permitiendo que el mozo o el cajero seleccionen que platos van a la Subcuenta A y cuales a la Subcuenta B, emitiendo precuentas independientes.

### Recomendaciones de Prioridad Media
1. Incorporar alertas sonoras y visuales de salon en la campana:
   - Disparar una notificacion de prioridad alta para el mozo cada vez que un pedido de modalidad local cambie a estado "listo" en cocina.
   - Programar la notificacion de proximidad de reserva: emitir un aviso sonoro y visual 15 minutos antes de la hora programada para que el mozo coloque el flyer de reservado en la mesa física.
2. Reemplazar la cifra fija de reservas en el escritorio del mozo:
   - Conectar el contador de "Reservas de hoy" en `dKpis` y `dPending` para que compute dinamicamente las reservas vigentes registradas para la fecha actual.
3. Habilitar soporte basico de propinas:
   - Permitir que tanto en la precuenta como en el modal de pago mixto de caja se pueda ingresar un monto voluntario de propina, aislándolo contablemente de la venta neta sujeta a impuestos.
4. Crear la vista de resumen de fin de turno del mozo:
   - Implementar un informe de cierre personal donde el mozo verifique cuantas comandas abrio, cuantas precuentas imprimio y el importe total trasladado a caja para el cuadre final con el cajero saliente.

---

INFORME LISTO
